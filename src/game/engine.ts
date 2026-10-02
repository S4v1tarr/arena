import {
  BUILDINGS,
  ECO_TYPES,
  PEACE_SECONDS,
  SLOT_COUNT,
  START_MONEY,
  WEAPONS,
  WEAPON_BY_ID,
  priceFor,
  siteFor,
  slotPos,
} from "./catalog";
import type {
  Building,
  BuildingType,
  Cat,
  Difficulty,
  EventKind,
  Flight,
  GameEvent,
  GameState,
  GameView,
  PlayerState,
  PlayerView,
  Side,
} from "./types";

const rnd = Math.random;
const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const opp = (s: Side): Side => (s === 0 ? 1 : 0);
const alive = (p: PlayerState) => p.buildings.filter((b) => b.hp > 0);

function newPlayer(country: string): PlayerState {
  return {
    money: START_MONEY,
    nextId: 2,
    country,
    buildings: [{ id: 1, type: "hq", slot: 0, hp: BUILDINGS.hq.hp, stock: {}, ammo: {} }],
    intelUntil: 0,
    stats: { launched: 0, intercepted: 0, destroyed: 0, lost: 0, shotDown: 0 },
  };
}

export function createState(
  c0: string,
  c1: string,
  now: number,
  bot: { side: Side; difficulty: Difficulty } | null,
): GameState {
  return {
    startedAt: now,
    peaceUntil: now + PEACE_SECONDS * 1000,
    lastTick: now,
    tickCount: 0,
    players: [newPlayer(c0), newPlayer(c1)],
    flights: [],
    events: [],
    nextEventId: 1,
    nextFlightId: 1,
    winner: null,
    endReason: "",
    bot: bot ? { ...bot, nextAttack: now + (PEACE_SECONDS + 15) * 1000 } : null,
  };
}

export function incomeOf(p: PlayerState): number {
  let s = 0;
  for (const b of p.buildings) if (b.hp > 0) s += BUILDINGS[b.type].income;
  return s;
}

function pushEvent(
  s: GameState,
  kind: EventKind,
  side: Side,
  t: number,
  pos: [number, number],
  y: number,
  text: string,
  r = 0,
) {
  const ev: GameEvent = { id: s.nextEventId++, t, kind, side, x: pos[0], y, z: pos[1], r, text };
  s.events.push(ev);
  if (s.events.length > 60) s.events.splice(0, s.events.length - 60);
}

function bpos(side: Side, b: Building): [number, number] {
  return slotPos(side, b.slot);
}

function usedCap(s: GameState, side: Side, b: Building): number {
  let used = 0;
  for (const [wid, n] of Object.entries(b.stock)) used += (WEAPON_BY_ID[wid]?.slots ?? 1) * n;
  for (const f of s.flights) {
    if (f.side === side && f.originId === b.id) {
      const w = WEAPON_BY_ID[f.wid];
      if (w?.reusable) used += w.slots;
    }
  }
  return used;
}

// ------------------------------------------------------------------ actions
export function doBuild(s: GameState, side: Side, type: BuildingType, slot?: number): string | null {
  if (s.winner !== null) return "بازی تمام شده است";
  const spec = BUILDINGS[type];
  if (!spec || type === "hq") return "نوع ساختمان نامعتبر است";
  const p = s.players[side];
  if (p.money < spec.cost) return "پول کافی نیست";
  const occupied = new Set(alive(p).map((b) => b.slot));
  let sl = slot ?? -1;
  if (sl < 1 || sl >= SLOT_COUNT || occupied.has(sl)) {
    if (slot !== undefined && slot >= 1 && occupied.has(slot)) return "این محل اشغال است";
    sl = -1;
    for (let i = 1; i < SLOT_COUNT; i++) if (!occupied.has(i)) { sl = i; break; }
  }
  if (sl < 0) return "جای خالی در جزیره وجود ندارد";
  p.buildings = p.buildings.filter((b) => !(b.slot === sl && b.hp <= 0));
  p.money -= spec.cost;
  p.buildings.push({ id: p.nextId++, type, slot: sl, hp: spec.hp, stock: {}, ammo: {} });
  return null;
}

export function doBuy(
  s: GameState,
  side: Side,
  wid: string,
  count: number,
  buildingId?: number,
): string | null {
  if (s.winner !== null) return "بازی تمام شده است";
  const w = WEAPON_BY_ID[wid];
  if (!w) return "سلاح نامعتبر است";
  const p = s.players[side];
  const price = priceFor(p.country, w);
  const siteType = siteFor(w.kind);
  let sites = alive(p).filter((b) => b.type === siteType);
  if (buildingId !== undefined) sites = sites.filter((b) => b.id === buildingId);
  if (sites.length === 0) return `ابتدا «${BUILDINGS[siteType].fa}» بسازید`;
  let bought = 0;
  for (let i = 0; i < Math.max(1, Math.min(count, 50)); i++) {
    if (p.money < price) break;
    const site = sites.find((b) => BUILDINGS[b.type].cap - usedCap(s, side, b) >= w.slots - 1e-9);
    if (!site) break;
    p.money -= price;
    site.stock[wid] = (site.stock[wid] ?? 0) + 1;
    if (w.kind === "defense") site.ammo[wid] = (site.ammo[wid] ?? 0) + w.mag;
    bought++;
  }
  if (bought === 0) {
    if (p.money < price) return "پول کافی نیست";
    return `ظرفیت «${BUILDINGS[siteType].fa}» پر است؛ سایت جدید بسازید`;
  }
  return null;
}

export function doReload(s: GameState, side: Side, buildingId?: number): string | null {
  const p = s.players[side];
  let spent = 0;
  for (const b of alive(p)) {
    if (b.type !== "defense_site") continue;
    if (buildingId !== undefined && b.id !== buildingId) continue;
    for (const [wid, n] of Object.entries(b.stock)) {
      const w = WEAPON_BY_ID[wid];
      if (!w || n <= 0) continue;
      const full = n * w.mag;
      const have = b.ammo[wid] ?? 0;
      const unit = (priceFor(p.country, w) / w.mag) * 0.4;
      const can = Math.min(full - have, Math.floor(p.money / unit));
      if (can <= 0) continue;
      p.money -= can * unit;
      spent += can * unit;
      b.ammo[wid] = have + can;
    }
  }
  return spent > 0 ? null : "چیزی برای پر کردن نیست یا پول کافی نیست";
}

export function doRepair(s: GameState, side: Side, id: number): string | null {
  const p = s.players[side];
  const b = p.buildings.find((x) => x.id === id);
  if (!b || b.hp <= 0) return "ساختمان یافت نشد یا نابود شده است";
  const spec = BUILDINGS[b.type];
  if (b.hp >= spec.hp) return "نیازی به تعمیر نیست";
  const cost = Math.ceil((1 - b.hp / spec.hp) * spec.cost * 0.5);
  if (p.money < cost) return `پول کافی نیست (هزینه تعمیر ${cost})`;
  p.money -= cost;
  b.hp = spec.hp;
  return null;
}

export function doLaunch(
  s: GameState,
  side: Side,
  wid: string,
  targetId: number,
  count: number,
  mission: "strike" | "recon",
  now: number,
): string | null {
  if (s.winner !== null) return "بازی تمام شده است";
  if (now < s.peaceUntil) {
    return `دوران آتش‌بس: ${Math.ceil((s.peaceUntil - now) / 1000)} ثانیه دیگر`;
  }
  const w = WEAPON_BY_ID[wid];
  if (!w || w.kind === "defense") return "سلاح نامعتبر است";
  if (mission === "recon" && w.recon <= 0) return "این سلاح قابلیت شناسایی ندارد";
  if (mission === "strike" && w.dmg <= 0) return "این پهپاد فقط برای شناسایی است";
  const p = s.players[side];
  const e = s.players[opp(side)];
  let target = e.buildings.find((b) => b.id === targetId && b.hp > 0);
  if (!target && mission === "recon") target = e.buildings.find((b) => b.type === "hq");
  if (!target) return "هدف معتبر انتخاب کنید";
  const n = Math.max(1, Math.min(count, 30));
  let launched = 0;
  const tpos = bpos(opp(side), target);
  let firstPos: [number, number] | null = null;
  for (let i = 0; i < n; i++) {
    const site = alive(p)
      .filter((b) => (b.stock[wid] ?? 0) > 0)
      .sort((a, b) => (b.stock[wid] ?? 0) - (a.stock[wid] ?? 0))[0];
    if (!site) break;
    site.stock[wid]--;
    const from = bpos(side, site);
    firstPos = firstPos ?? from;
    const t0 = now + i * 350;
    const t1 = t0 + (dist(from, tpos) / w.speed) * 1000;
    s.flights.push({
      id: s.nextFlightId++, side, wid, mission, phase: "out", originId: site.id, targetId: target.id,
      home: from, a: from, b: tpos, t0, t1,
    });
    launched++;
  }
  if (launched === 0) return "موجودی کافی از این سلاح ندارید";
  p.stats.launched += launched;
  pushEvent(
    s, "launch", side, now, firstPos!, 2,
    `${launched}× ${w.name} ${mission === "recon" ? "برای شناسایی" : "به سوی «" + BUILDINGS[target.type].fa + "»"} پرتاب شد`,
  );
  return null;
}

// ------------------------------------------------------------------ combat
function interceptPk(cat: Cat, a2a: number): number {
  if (cat === "air") return a2a;
  if (cat === "drone") return Math.min(0.95, a2a * 1.15);
  if (cat === "cruise") return a2a * 0.45;
  return 0;
}

function intercept(
  s: GameState,
  defSide: Side,
  w: ReturnType<typeof getW>,
  tpos: [number, number],
  t: number,
  attackerSide: Side,
): boolean {
  const def = s.players[defSide];
  const cands: { site: Building; wid: string; pk: number; range: number; dist: number }[] = [];
  for (const site of alive(def)) {
    if (site.type !== "defense_site") continue;
    const sp = bpos(defSide, site);
    const d = dist(sp, tpos);
    for (const [wid, n] of Object.entries(site.stock)) {
      const dw = WEAPON_BY_ID[wid];
      if (!dw || n <= 0 || (site.ammo[wid] ?? 0) <= 0) continue;
      if (d > dw.range) continue;
      const pk = (dw.pk[w.cat] ?? 0) * w.evasion;
      if (pk <= 0) continue;
      cands.push({ site, wid, pk, range: dw.range, dist: d });
    }
  }
  cands.sort((a, b) => b.range - a.range);
  const ipos: [number, number] = tpos;
  let intercepted = false;
  for (const c of cands) {
    const n = Math.min(c.site.stock[c.wid] ?? 0, 2);
    for (let i = 0; i < n; i++) {
      if ((c.site.ammo[c.wid] ?? 0) <= 0) break;
      c.site.ammo[c.wid]--;
      const from = bpos(defSide, c.site);
      // visual interceptor projectile
      const t1 = t + Math.max(220, c.dist * 1000 / 80);
      s.flights.push({
        id: s.nextFlightId++, side: defSide, wid: c.wid, mission: "defense", phase: "out",
        originId: c.site.id, targetId: -1, home: from, a: from, b: tpos, t0: t, t1,
      });
      if (rnd() < c.pk) {
        def.stats.intercepted++;
        intercepted = true;
        pushEvent(s, "intercept", attackerSide, t, ipos, 11, `${WEAPON_BY_ID[c.wid].name} هدف ${w.name} را رهگیری کرد`, 2);
        return true;
      }
    }
  }
  // fighters scramble (aircraft, drones, cruise)
  if (w.cat === "air" || w.cat === "drone" || w.cat === "cruise") {
    const fighters: { site: Building; wid: string; pk: number }[] = [];
    for (const site of alive(def)) {
      if (site.type !== "airbase") continue;
      for (const [wid, n] of Object.entries(site.stock)) {
        const fw = WEAPON_BY_ID[wid];
        if (!fw || fw.a2a <= 0 || n <= 0) continue;
        const pk = interceptPk(w.cat, fw.a2a) * w.evasion;
        for (let i = 0; i < n; i++) fighters.push({ site, wid, pk });
      }
    }
    fighters.sort((a, b) => b.pk - a.pk);
    for (const f of fighters.slice(0, 3)) {
      if (rnd() < f.pk) {
        def.stats.intercepted++;
        if (rnd() < 0.03) loseUnit(f.site, f.wid);
        pushEvent(s, "intercept", attackerSide, t, ipos, 12, `جنگنده ${WEAPON_BY_ID[f.wid].name} هدف ${w.name} را سرنگون کرد`, 2);
        return true;
      }
      if (rnd() < 0.12) loseUnit(f.site, f.wid);
    }
  }
  return intercepted;
}

function loseUnit(site: Building, wid: string) {
  if ((site.stock[wid] ?? 0) > 0) site.stock[wid]--;
}

function getW(id: string) {
  return WEAPON_BY_ID[id];
}

function damage(s: GameState, defSide: Side, b: Building, amount: number, t: number): boolean {
  if (b.hp <= 0) return false;
  b.hp -= amount;
  if (b.hp <= 0) {
    b.hp = 0;
    b.stock = {};
    b.ammo = {};
    s.players[opp(defSide)].stats.destroyed++;
    s.players[defSide].stats.lost++;
    pushEvent(s, "destroyed", opp(defSide), t, bpos(defSide, b), 2, `«${BUILDINGS[b.type].fa}» نابود شد!`, 6);
    if (b.type === "hq" && s.winner === null) {
      s.winner = opp(defSide);
      s.endReason = "مرکز فرماندهی نابود شد";
      pushEvent(s, "win", opp(defSide), t, bpos(defSide, b), 2, "مرکز فرماندهی سقوط کرد — پایان بازی", 12);
    }
    return true;
  }
  return false;
}

function strike(s: GameState, f: Flight, w: ReturnType<typeof getW>, t: number) {
  const defSide = opp(f.side);
  const def = s.players[defSide];
  const target = def.buildings.find((b) => b.id === f.targetId);
  if (!target || target.hp <= 0) {
    pushEvent(s, "miss", f.side, t, f.b, 1, `${w.name} به هدفی که قبلاً نابود شده بود اصابت کرد`, 2);
    return;
  }
  const tp = bpos(defSide, target);
  if (rnd() < w.acc) {
    const amt = w.dmg * (0.85 + rnd() * 0.3);
    pushEvent(s, "hit", f.side, t, tp, 1, `اصابت ${w.name} به «${BUILDINGS[target.type].fa}» (−${Math.round(amt)})`, Math.max(2.5, w.radius));
    damage(s, defSide, target, amt, t);
    if (w.radius > 3) {
      for (const o of alive(def)) {
        if (o.id === target.id) continue;
        const d = dist(bpos(defSide, o), tp);
        if (d < w.radius * 1.6) {
          damage(s, defSide, o, amt * 0.55 * (1 - d / (w.radius * 1.6)), t);
        }
      }
    }
  } else {
    const near = alive(def).filter((o) => o.id !== target.id && dist(bpos(defSide, o), tp) < 9);
    if (near.length && rnd() < 0.5) {
      const o = near[Math.floor(rnd() * near.length)];
      const amt = w.dmg * 0.45;
      pushEvent(s, "hit", f.side, t, bpos(defSide, o), 1, `${w.name} خطا کرد و به «${BUILDINGS[o.type].fa}» خورد (−${Math.round(amt)})`, 2.5);
      damage(s, defSide, o, amt, t);
    } else {
      const off: [number, number] = [tp[0] + (rnd() - 0.5) * 8, tp[1] + (rnd() - 0.5) * 8];
      pushEvent(s, "miss", f.side, t, off, 1, `${w.name} به هدف نخورد`, 2);
    }
  }
}

function land(s: GameState, f: Flight, t: number) {
  const p = s.players[f.side];
  const w = WEAPON_BY_ID[f.wid];
  const origin = p.buildings.find((b) => b.id === f.originId && b.hp > 0);
  const other = alive(p).find(
    (b) => b.type === "airbase" && BUILDINGS[b.type].cap - usedCap(s, f.side, b) >= w.slots - 1e-9,
  );
  const home = origin ?? other;
  if (home) {
    home.stock[f.wid] = (home.stock[f.wid] ?? 0) + 1;
  } else {
    pushEvent(s, "info", f.side, t, f.home, 3, `${w.name} پایگاهی برای فرود نیافت و از دست رفت`);
  }
}

function resolveFlight(s: GameState, f: Flight): boolean {
  const t = f.t1;
  const w = WEAPON_BY_ID[f.wid];
  if (f.phase === "back") {
    land(s, f, t);
    return true;
  }
  const defSide = opp(f.side);
  if (intercept(s, defSide, w, f.b, t, f.side)) {
    s.players[f.side].stats.shotDown++;
    return true;
  }
  if (f.mission === "recon") {
    s.players[f.side].intelUntil = Math.max(s.players[f.side].intelUntil, t + w.recon * 1000);
    pushEvent(s, "recon", f.side, t, f.b, 8, `${w.name} شناسایی را انجام داد (${w.recon} ثانیه اطلاعات)`, 3);
  } else {
    strike(s, f, w, t);
  }
  if (w.reusable) {
    f.phase = "back";
    f.a = f.b;
    f.b = f.home;
    f.t0 = t;
    f.t1 = t + (dist(f.a, f.b) / w.speed) * 1000;
    return false;
  }
  return true;
}

// ------------------------------------------------------------------ simulation
const BOT_MULT: Record<Difficulty, number> = { easy: 0.8, normal: 1.0, hard: 1.35 };

function stepOnce(s: GameState, t: number) {
  s.tickCount++;
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    let inc = incomeOf(p);
    if (s.bot && s.bot.side === side) inc *= BOT_MULT[s.bot.difficulty];
    p.money += inc;
  }
  // remove completed defense projectiles (they're not resolveable - purely visual)
  s.flights = s.flights.filter((f) => !(f.mission === "defense" && f.phase === "out" && f.t1 <= t));
  const due = s.flights.filter((f) => f.t1 <= t).sort((a, b) => a.t1 - b.t1);
  if (due.length) {
    const remove = new Set<number>();
    for (const f of due) {
      if (s.winner !== null && f.phase === "out") { remove.add(f.id); continue; }
      if (resolveFlight(s, f)) remove.add(f.id);
    }
    s.flights = s.flights.filter((f) => !remove.has(f.id));
  }
  if (s.bot && s.winner === null && s.tickCount % 3 === 0) botStep(s, t);
}

export function advance(s: GameState, now: number) {
  let guard = 0;
  while (s.winner === null && s.lastTick + 1000 <= now && guard < 30000) {
    s.lastTick += 1000;
    stepOnce(s, s.lastTick);
    guard++;
  }
  if (s.winner !== null) s.lastTick = now;
}

// ------------------------------------------------------------------ bot AI
function pick<T>(arr: T[]): T | undefined {
  return arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined;
}

function botStep(s: GameState, t: number) {
  const bot = s.bot!;
  const side = bot.side;
  const p = s.players[side];
  const e = s.players[opp(side)];
  const diff = bot.difficulty;
  const minutes = (t - s.startedAt) / 60000;
  const A = alive(p);
  const count = (ty: BuildingType) => A.filter((b) => b.type === ty).length;
  const eco = A.filter((b) => BUILDINGS[b.type].group === "eco").length;
  const aggr = diff === "easy" ? 0.6 : diff === "hard" ? 1.4 : 1;

  // --- construction
  const wantEco = Math.min(9, 3 + Math.floor(minutes * 1.3 * aggr));
  const needs: BuildingType[] = [];
  if (count("defense_site") < 1 && minutes > 0.6) needs.push("defense_site");
  if (count("missile_site") < 1 && minutes > 1.2) needs.push("missile_site");
  if (count("airbase") < 1 && minutes > 2.5) needs.push("airbase");
  if (count("defense_site") < 2 && minutes > 5) needs.push("defense_site");
  if (count("missile_site") < 2 && minutes > 6) needs.push("missile_site");
  if (count("airbase") < 2 && minutes > 9 && diff !== "easy") needs.push("airbase");
  if (eco < wantEco) {
    const order = ["mine", "refinery", "port", "steel", "petrochem", "tech"] as BuildingType[];
    const ty = order[Math.min(order.length - 1, Math.floor(eco / 1.4))];
    needs.push(ty);
  }
  for (const ty of needs) {
    if (p.money >= BUILDINGS[ty].cost) {
      if (doBuild(s, side, ty) === null) break;
    }
  }

  // --- procurement
  const maxCost = (150 + minutes * 90) * aggr;
  const hasDef = count("defense_site") > 0;
  const hasMsl = count("missile_site") > 0;
  const hasAir = count("airbase") > 0;
  const defCount = A.reduce((n, b) => n + (b.type === "defense_site" ? Object.values(b.stock).reduce((x, y) => x + y, 0) : 0), 0);

  if (hasDef && defCount < 1 + minutes * 0.7 * aggr && p.money > 200) {
    const pool = WEAPONS.filter((w) => w.kind === "defense" && priceFor(p.country, w) <= Math.min(p.money * 0.6, maxCost * 1.4));
    const w = pick(pool.slice(-6)) ?? pick(pool);
    if (w) doBuy(s, side, w.id, 1);
  }
  if (hasDef && s.tickCount % 15 === 0) doReload(s, side);
  if (hasMsl && p.money > 150) {
    const pool = WEAPONS.filter((w) => w.kind === "missile" && priceFor(p.country, w) <= Math.min(p.money * 0.55, maxCost));
    const w = pick(pool.slice(-8)) ?? pick(pool);
    if (w) doBuy(s, side, w.id, w.cost < 100 ? 2 : 1);
  }
  if (hasAir && p.money > 120) {
    const oneway = WEAPONS.filter((w) => w.kind === "drone" && !w.reusable);
    const jets = WEAPONS.filter((w) => (w.kind === "aircraft" || (w.kind === "drone" && w.reusable)) && priceFor(p.country, w) <= Math.min(p.money * 0.5, maxCost));
    if (rnd() < 0.6) {
      const w = pick(oneway);
      if (w) doBuy(s, side, w.id, 3);
    } else {
      const w = pick(jets);
      if (w) doBuy(s, side, w.id, 1);
    }
  }

  // --- attack
  if (t < s.peaceUntil || t < bot.nextAttack) return;
  const targets = alive(e);
  if (!targets.length) return;
  const inv: Record<string, number> = {};
  for (const b of A) for (const [wid, n] of Object.entries(b.stock)) {
    const w = WEAPON_BY_ID[wid];
    if (w && w.kind !== "defense" && w.dmg > 0 && n > 0) inv[wid] = (inv[wid] ?? 0) + n;
  }
  const entries = Object.entries(inv);
  if (!entries.length) return;
  const weights = targets.map((b) => {
    const g = BUILDINGS[b.type];
    if (b.type === "hq") return 1 + minutes * 0.25 * aggr;
    if (b.type === "defense_site") return 3.5;
    if (g.group === "mil") return 3;
    return 2.5 + g.income * 0.3;
  });
  let r = rnd() * weights.reduce((a, b) => a + b, 0);
  let target = targets[0];
  for (let i = 0; i < targets.length; i++) { r -= weights[i]; if (r <= 0) { target = targets[i]; break; } }
  // choose weapon with biggest stock (prefer heavy hitters if target is HQ)
  entries.sort((a, b) => b[1] - a[1]);
  const [wid, have] = target.type === "hq"
    ? entries.sort((a, b) => WEAPON_BY_ID[b[0]].dmg - WEAPON_BY_ID[a[0]].dmg)[0]
    : entries[0];
  const n = Math.min(have, 1 + Math.floor(rnd() * (diff === "hard" ? 6 : 4)));
  doLaunch(s, side, wid, target.id, n, "strike", t);
  const gap = diff === "hard" ? 12000 : diff === "easy" ? 32000 : 20000;
  bot.nextAttack = t + gap * (0.7 + rnd() * 0.6);
}

// ------------------------------------------------------------------ view
export function buildView(
  s: GameState,
  viewer: Side,
  now: number,
  meta: { matchId: number; mode: "bot" | "pvp"; names: [string, string]; status: "active" | "finished" },
): GameView {
  const enemy = opp(viewer);
  const intel = s.players[viewer].intelUntil > now;
  const mkp = (side: Side, full: boolean): PlayerView => {
    const p = s.players[side];
    return {
      name: meta.names[side],
      country: p.country,
      money: full ? Math.floor(p.money) : null,
      income: full ? incomeOf(p) * (s.bot && s.bot.side === side ? BOT_MULT[s.bot.difficulty] : 1) : null,
      stats: full ? p.stats : null,
      buildings: p.buildings.map((b) => ({
        id: b.id, type: b.type, slot: b.slot, hp: Math.round(b.hp),
        stock: full ? b.stock : null,
        ammo: full ? b.ammo : null,
      })),
    };
  };
  const players: [PlayerView, PlayerView] =
    viewer === 0 ? [mkp(0, true), mkp(1, intel)] : [mkp(0, intel), mkp(1, true)];
  void enemy;
  return {
    matchId: meta.matchId,
    mode: meta.mode,
    status: meta.status,
    me: viewer,
    serverNow: now,
    startedAt: s.startedAt,
    peaceUntil: s.peaceUntil,
    winner: s.winner,
    endReason: s.endReason,
    intelUntil: s.players[viewer].intelUntil,
    players,
    flights: s.flights,
    events: s.events,
  };
}

export { ECO_TYPES };
