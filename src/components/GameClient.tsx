"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BUILDINGS,
  CAT_FA,
  ECO_TYPES,
  KIND_FA,
  MIL_TYPES,
  SLOT_COUNT,
  WEAPONS,
  WEAPON_BY_ID,
  priceFor,
  siteFor,
  type Weapon,
} from "@/game/catalog";
import { countryName, flagEmoji } from "@/game/countries";
import type { BuildingType, BuildingView, Cat, GameView, Side, WKind } from "@/game/types";
import type { CamMode, HoverInfo } from "./GameScene";

const GameScene = dynamic(() => import("./GameScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 grid place-items-center text-sm text-[var(--dim)]">بارگذاری صحنه سه‌بعدی…</div>,
});

type Tab = "build" | "shop" | "ops" | "intel" | "log";
const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
const FLIGHT_DIST = 68;

export default function GameClient({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [view, setView] = useState<GameView | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [fatal, setFatal] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [tab, setTab] = useState<Tab>("build");
  const [open, setOpen] = useState(true);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [showRanges, setShowRanges] = useState(true);
  const [camCmd, setCamCmd] = useState<{ mode: CamMode; n: number }>({ mode: "me", n: 0 });
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [tick, setTick] = useState(0);
  const [placing, setPlacing] = useState<BuildingType | null>(null);
  const offsetRef = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const recvAt = useRef(Date.now());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyView = useCallback((v: GameView) => {
    const measured = v.serverNow - Date.now();
    offsetRef.current = offsetRef.current === null ? measured : offsetRef.current * 0.7 + measured * 0.3;
    setOffset(offsetRef.current);
    recvAt.current = Date.now();
    setView(v);
    setWaiting(false);
  }, []);

  const showToast = useCallback((msg: string, ok = false) => {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  // polling
  const finishedRef = useRef(false);
  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const r = await fetch(`/api/matches/${matchId}`, { cache: "no-store" });
        if (r.status === 401) return router.replace("/");
        const d = await r.json();
        if (stop) return;
        if (!r.ok) return setFatal(d.error ?? "خطا");
        if (d.waiting) setWaiting(true);
        else if (d.view) {
          applyView(d.view);
          if (d.view.status === "finished") finishedRef.current = true;
        }
      } catch {
        /* retry on next tick */
      }
    }
    poll();
    const iv = setInterval(() => {
      if (!finishedRef.current) poll();
    }, 1000);
    return () => { stop = true; clearInterval(iv); };
  }, [matchId, applyView, router]);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(iv);
  }, []);

  async function act(body: Record<string, unknown>, okMsg?: string) {
    const r = await fetch(`/api/matches/${matchId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (d.view) applyView(d.view);
    if (d.error) showToast(d.error);
    else if (okMsg) showToast(okMsg, true);
  }

  async function surrender() {
    if (!confirm("آیا واقعاً تسلیم می‌شوید؟")) return;
    await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    finishedRef.current = false;
  }

  async function cancelWaiting() {
    await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
    router.push("/");
  }

  // ---------------------------------------------------------------- derived
  const me: Side = view?.me ?? 0;
  const foe: Side = me === 0 ? 1 : 0;
  const mine = view?.players[me];
  const enemy = view?.players[foe];
  void tick;
  const now = Date.now() + offset;
  const sinceRecv = (Date.now() - recvAt.current) / 1000;
  const money = mine && mine.money !== null ? mine.money + (mine.income ?? 0) * sinceRecv * (view?.status === "active" ? 1 : 0) : 0;
  const peaceLeft = view ? Math.max(0, Math.ceil((view.peaceUntil - now) / 1000)) : 0;
  const intelLeft = view ? Math.max(0, Math.ceil((view.intelUntil - now) / 1000)) : 0;

  const threats = useMemo(() => (view ? view.flights.filter((f) => f.side !== me && f.phase === "out") : []), [view, me]);
  const nextImpact = threats.length ? Math.max(0, Math.ceil((Math.min(...threats.map((f) => f.t1)) - now) / 1000)) : 0;

  const myAlive = useMemo(() => (mine ? mine.buildings.filter((b) => b.hp > 0) : []), [mine]);
  const enemyAlive = useMemo(() => (enemy ? enemy.buildings.filter((b) => b.hp > 0) : []), [enemy]);
  const freeSlots = SLOT_COUNT - 1 - myAlive.filter((b) => b.type !== "hq").length;
  const target = enemyAlive.find((b) => b.id === targetId) ?? null;

  const usedCap = useCallback(
    (b: BuildingView) => {
      let u = 0;
      for (const [wid, n] of Object.entries(b.stock ?? {})) u += (WEAPON_BY_ID[wid]?.slots ?? 1) * n;
      if (view) for (const f of view.flights) if (f.side === me && f.originId === b.id && WEAPON_BY_ID[f.wid]?.reusable) u += WEAPON_BY_ID[f.wid].slots;
      return u;
    },
    [view, me],
  );

  const inventory = useMemo(() => {
    const inv: Record<string, { n: number; away: number }> = {};
    if (mine) for (const b of myAlive) for (const [wid, n] of Object.entries(b.stock ?? {})) {
      const w = WEAPON_BY_ID[wid];
      if (w && w.kind !== "defense" && n > 0) inv[wid] = { n: (inv[wid]?.n ?? 0) + n, away: inv[wid]?.away ?? 0 };
    }
    if (view) for (const f of view.flights) if (f.side === me && WEAPON_BY_ID[f.wid]?.reusable) {
      inv[f.wid] = { n: inv[f.wid]?.n ?? 0, away: (inv[f.wid]?.away ?? 0) + 1 };
    }
    return inv;
  }, [mine, myAlive, view, me]);

  const pickEnemy = useCallback((id: number) => { setTargetId(id); setOpen(true); setTab("ops"); }, []);
  const pickOwn = useCallback(() => { setOpen(true); setTab("build"); }, []);
  const buildAt = useCallback((slot: number) => {
    if (!placing) return;
    void act({ type: "build", buildingType: placing, slot }, `${BUILDINGS[placing].fa} ساخته شد`);
    setPlacing(null);
  }, [placing]);

  // ---------------------------------------------------------------- screens
  if (fatal) {
    return (
      <Center>
        <div className="panel p-8 text-center">
          <div className="mb-4 text-[var(--foe)]">{fatal}</div>
          <button className="btn btn-primary" onClick={() => router.push("/")}>بازگشت به لابی</button>
        </div>
      </Center>
    );
  }
  if (waiting) {
    return (
      <Center>
        <div className="panel max-w-sm p-8 text-center">
          <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-2 border-[var(--line-strong)] border-t-[var(--amber)]" />
          <div className="text-lg font-bold">در جستجوی حریف…</div>
          <p className="mt-2 text-sm leading-7 text-[var(--dim)]">
            به محض ورود فرمانده دیگر، بازی شروع می‌شود. این صفحه را باز نگه دارید یا بعداً از لابی ادامه دهید.
          </p>
          <button className="btn btn-danger mt-5" onClick={cancelWaiting}>لغو جستجو</button>
        </div>
      </Center>
    );
  }
  if (!view || !mine || !enemy) {
    return <Center><div className="text-sm text-[var(--dim)]">در حال اتصال به میدان نبرد…</div></Center>;
  }

  const finished = view.status === "finished";
  const won = view.winner === me;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg)]">
      <GameScene
        view={view}
        clockOffset={offset}
        selectedId={targetId}
        showRanges={showRanges}
        camCmd={camCmd}
        placing={placing}
        onPickEnemy={pickEnemy}
        onPickOwn={pickOwn}
        onHover={setHover}
        onPickSlot={(slot) => buildAt(slot)}
      />

      {/* ------------------------------------------------ top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start gap-2 p-2 sm:p-3">
        <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2" style={{ borderColor: "var(--me)" }}>
          <span className="text-2xl">{flagEmoji(mine.country)}</span>
          <div className="leading-tight">
            <div className="text-xs font-bold">{mine.name}</div>
            <div className="text-[10px] text-[var(--dim)]">{countryName(mine.country)}</div>
          </div>
          <div className="mx-1 h-8 w-px bg-[var(--line-strong)]" />
          <div>
            <div className="mono text-lg font-bold leading-none" style={{ color: "var(--amber)" }}>${fmt(money)}M</div>
            <div className="mono mt-1 text-[10px] text-[var(--ok)]">+{(mine.income ?? 0).toFixed(1)} /s</div>
          </div>
        </div>

        <div className="pointer-events-none mx-auto flex flex-col items-center gap-2 order-last w-full sm:order-none sm:w-auto">
          {peaceLeft > 0 && !finished && (
            <div className="panel pointer-events-auto px-4 py-1.5 text-xs" style={{ borderColor: "var(--ok)" }}>
              🕊️ دوران آتش‌بس — حمله ممکن می‌شود تا <b className="mono">{peaceLeft}</b> ثانیه دیگر
            </div>
          )}
          {threats.length > 0 && !finished && (
            <div className="panel blink pointer-events-auto px-4 py-1.5 text-xs font-bold" style={{ borderColor: "var(--foe)", color: "var(--foe)" }}>
              ⚠️ {threats.length} تهدید در حال نزدیک شدن — اولین برخورد <span className="mono">{nextImpact}s</span>
            </div>
          )}
          {intelLeft > 0 && !finished && (
            <div className="panel pointer-events-auto px-4 py-1.5 text-xs" style={{ borderColor: "#55aaff", color: "#8fc4ff" }}>
              📡 اطلاعات دشمن فعال: <span className="mono">{intelLeft}s</span>
            </div>
          )}
        </div>

        <div className="panel pointer-events-auto ms-auto flex items-center gap-3 px-3 py-2" style={{ borderColor: "var(--foe)" }}>
          <div className="leading-tight text-end">
            <div className="text-xs font-bold">{enemy.name}</div>
            <div className="text-[10px] text-[var(--dim)]">{countryName(enemy.country)}</div>
          </div>
          <span className="text-2xl">{flagEmoji(enemy.country)}</span>
          <div className="mono text-[10px] text-[var(--dim)]">
            {enemy.money !== null ? <span style={{ color: "var(--amber)" }}>${fmt(enemy.money)}M</span> : "$???"}
          </div>
        </div>
      </div>

      {/* camera + utility buttons */}
      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-2">
        <div className="panel flex gap-1 p-1">
          {([["me", "جزیره من"], ["enemy", "دشمن"], ["center", "نمای کلی"], ["top", "بالا"]] as [CamMode, string][]).map(([m, l]) => (
            <button key={m} className="btn !px-2 !py-1 text-[11px]" onClick={() => setCamCmd((c) => ({ mode: m, n: c.n + 1 }))}>{l}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <button className="btn text-[11px]" onClick={() => setShowRanges((v) => !v)} style={{ borderColor: showRanges ? "var(--me)" : undefined }}>
            ◎ برد پدافند {showRanges ? "روشن" : "خاموش"}
          </button>
          {!finished && <button className="btn btn-danger text-[11px]" onClick={surrender}>تسلیم</button>}
          <button className="btn text-[11px]" onClick={() => router.push("/")}>لابی</button>
        </div>
      </div>

      {/* ticker */}
      <div className="pointer-events-none absolute bottom-24 left-3 z-10 hidden w-80 flex-col gap-1 sm:flex">
        {view.events.slice(-4).map((e) => (
          <div key={e.id} className="slide-in rounded-md border bg-[oklch(0.14_0.015_225/0.8)] px-2 py-1 text-[11px]" style={{ borderColor: evColor(e.side === me, e.kind) }}>
            {evIcon(e.kind)} {e.text}
          </div>
        ))}
      </div>

      {/* target card */}
      {target && !finished && (
        <div className="panel absolute bottom-3 left-1/2 z-20 w-72 -translate-x-1/2 p-3 text-xs sm:w-80" style={{ borderColor: "var(--foe)" }}>
          <div className="flex items-center justify-between">
            <b>🎯 {BUILDINGS[target.type].fa}</b>
            <button className="text-[var(--dim)]" onClick={() => setTargetId(null)}>✕</button>
          </div>
          <HpBar hp={target.hp} max={BUILDINGS[target.type].hp} />
          {target.stock ? <StockLine stock={target.stock} /> : <div className="mt-1 text-[10px] text-[var(--dim)]">محتویات نامشخص — پهپاد شناسایی بفرستید</div>}
          <button className="btn btn-primary mt-2 w-full" onClick={() => { setOpen(true); setTab("ops"); }}>انتخاب سلاح برای حمله</button>
        </div>
      )}

      {/* hover tooltip */}
      {hover && (() => {
        const hb = view.players[hover.side].buildings.find((b) => b.id === hover.id);
        if (!hb) return null;
        return (
          <div className="pointer-events-none absolute z-30 rounded-md border bg-[oklch(0.13_0.015_225/0.92)] px-2.5 py-1.5 text-[11px]"
            style={{ left: hover.x + 14, top: hover.y + 14, borderColor: hover.side === me ? "var(--me)" : "var(--foe)" }}>
            <div className="font-bold">{hover.side === me ? "" : "دشمن · "}{BUILDINGS[hb.type].fa}</div>
            <div className="mono text-[var(--dim)]">HP {hb.hp}/{BUILDINGS[hb.type].hp}</div>
          </div>
        );
      })()}

      {/* placement banner */}
      {placing && !finished && (
        <div className="slide-in absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-lg border bg-[oklch(0.15_0.02_225/0.95)] px-4 py-2 text-sm font-bold flex items-center gap-3"
          style={{ borderColor: "var(--amber)" }}>
          <span style={{ color: "var(--amber)" }}>📍</span>
          روی یکی از محل‌های خالی سبز جزیره‌تان کلیک کنید تا «{BUILDINGS[placing].fa}» آنجا ساخته شود.
          <button className="btn !px-2 !py-1 text-[11px]" onClick={() => setPlacing(null)}>لغو</button>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="slide-in absolute left-1/2 top-32 z-40 -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-bold"
          style={{ background: "oklch(0.15 0.02 225 / 0.95)", borderColor: toast.ok ? "var(--ok)" : "var(--foe)", color: toast.ok ? "var(--ok)" : "var(--foe)" }}>
          {toast.msg}
        </div>
      )}

      {/* ------------------------------------------------ side panel */}
      <div className="absolute bottom-0 right-0 top-[88px] z-20 flex w-[min(400px,100vw)] flex-col sm:bottom-3 sm:right-3 sm:top-[76px]">
        <button className="btn mb-1 self-end !py-1 text-[11px]" onClick={() => setOpen((o) => !o)}>{open ? "بستن پنل ▸" : "◂ باز کردن پنل"}</button>
        {open && (
          <div className="panel flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="grid grid-cols-5 border-b border-[var(--line)] text-[11px]">
              {([["build", "ساخت"], ["shop", "تسلیحات"], ["ops", "عملیات"], ["intel", "اطلاعات"], ["log", "گزارش"]] as [Tab, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className="py-2.5 font-bold transition"
                  style={{ background: tab === k ? "oklch(0.3 0.06 80 / 0.3)" : "transparent", color: tab === k ? "var(--amber)" : "var(--dim)", borderBottom: tab === k ? "2px solid var(--amber)" : "2px solid transparent" }}>
                  {l}
                </button>
              ))}
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
              {tab === "build" && (
                <BuildTab money={money} freeSlots={freeSlots} myAlive={myAlive} mineBuildings={mine.buildings} usedCap={usedCap}
                  onPlace={(t) => { setPlacing(t); setCamCmd((c) => ({ mode: "me", n: c.n + 1 })); }}
                  onCancel={() => setPlacing(null)}
                  onRepair={(id) => act({ type: "repair", buildingId: id }, "تعمیر شد")}
                  onReload={(id) => act({ type: "reload", buildingId: id }, "مهمات پر شد")} />
              )}
              {tab === "shop" && <ShopTab country={mine.country} money={money} myAlive={myAlive} usedCap={usedCap}
                onBuy={(wid, count, bid) => act({ type: "buy", wid, count, buildingId: bid }, "خرید انجام شد")} />}
              {tab === "ops" && (
                <OpsTab inventory={inventory} target={target} enemyAlive={enemyAlive} setTarget={setTargetId} peaceLeft={peaceLeft}
                  onLaunch={(wid, count, mission) => act({ type: "launch", wid, count, targetId: targetId ?? -1, mission }, mission === "recon" ? "پهپاد شناسایی اعزام شد" : "شلیک انجام شد!")}
                  myAlive={myAlive} />
              )}
              {tab === "intel" && <IntelTab enemy={enemy} intelLeft={intelLeft} />}
              {tab === "log" && (
                <div className="flex flex-col gap-1.5">
                  {[...view.events].reverse().map((e) => (
                    <div key={e.id} className="rounded-md border bg-[oklch(0.15_0.015_225)] px-2 py-1.5 text-[11px]" style={{ borderColor: evColor(e.side === me, e.kind) }}>
                      <span className="mono me-2 text-[10px] text-[var(--dim)]">{Math.max(0, Math.round((e.t - view.startedAt) / 1000))}s</span>
                      {evIcon(e.kind)} {e.side === me ? "" : "(دشمن) "}{e.text}
                    </div>
                  ))}
                  {view.events.length === 0 && <div className="py-6 text-center text-xs text-[var(--dim)]">هنوز رویدادی ثبت نشده</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ game over */}
      {finished && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
          <div className="panel slide-in max-w-md p-8 text-center" style={{ borderColor: won ? "var(--ok)" : "var(--foe)" }}>
            <div className="text-6xl">{won ? "🏆" : "💥"}</div>
            <h2 className="mt-3 text-3xl font-extrabold" style={{ color: won ? "var(--ok)" : "var(--foe)" }}>{won ? "پیروزی!" : "شکست"}</h2>
            <p className="mt-2 text-sm text-[var(--dim)]">{view.endReason}</p>
            {mine.stats && (
              <div className="mono mt-5 grid grid-cols-4 gap-2 text-center text-xs">
                {[["شلیک", mine.stats.launched], ["رهگیری", mine.stats.intercepted], ["نابودی", mine.stats.destroyed], ["تلفات", mine.stats.lost]].map(([l, v]) => (
                  <div key={l as string} className="rounded-md border border-[var(--line)] p-2">
                    <div className="text-base font-bold">{v}</div>
                    <div className="text-[10px] text-[var(--dim)]">{l}</div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-primary mt-6 w-full py-3" onClick={() => router.push("/")}>بازگشت به لابی</button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
function Center({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 grid place-items-center bg-[var(--bg)] p-4">{children}</div>;
}

function evColor(mine: boolean, kind: string) {
  if (kind === "intercept") return "oklch(0.75 0.1 200 / 0.6)";
  if (kind === "recon" || kind === "info") return "oklch(0.6 0.08 250 / 0.6)";
  return mine ? "oklch(0.8 0.12 185 / 0.55)" : "oklch(0.7 0.19 35 / 0.6)";
}
function evIcon(kind: string) {
  return ({ launch: "🚀", hit: "💥", miss: "💨", intercept: "🛡️", destroyed: "☠️", recon: "📡", shotdown: "✈️", info: "ℹ️", win: "🏁" } as Record<string, string>)[kind] ?? "•";
}

function HpBar({ hp, max }: { hp: number; max: number }) {
  const r = Math.max(0, Math.min(1, hp / max));
  return (
    <div className="mt-2">
      <div className="h-1.5 overflow-hidden rounded bg-[oklch(0.12_0.01_225)]">
        <div className="h-full rounded" style={{ width: `${r * 100}%`, background: r > 0.6 ? "var(--ok)" : r > 0.3 ? "var(--amber)" : "var(--foe)" }} />
      </div>
      <div className="mono mt-0.5 text-[10px] text-[var(--dim)]">{hp}/{max}</div>
    </div>
  );
}

function StockLine({ stock }: { stock: Record<string, number> }) {
  const ents = Object.entries(stock).filter(([, n]) => n > 0);
  if (!ents.length) return <div className="mt-1 text-[10px] text-[var(--dim)]">خالی</div>;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {ents.map(([wid, n]) => <span key={wid} className="chip mono">{n}× {WEAPON_BY_ID[wid]?.name}</span>)}
    </div>
  );
}

// ----------------------------------------------------------------- build tab
function BuildTab({
  money, freeSlots, myAlive, mineBuildings, usedCap, onPlace, onCancel, onRepair, onReload,
}: {
  money: number; freeSlots: number; myAlive: BuildingView[]; mineBuildings: BuildingView[];
  usedCap: (b: BuildingView) => number;
  onPlace: (t: BuildingType) => void; onCancel: () => void; onRepair: (id: number) => void; onReload: (id: number) => void;
}) {
  void mineBuildings;
  const row = (t: BuildingType) => {
    const s = BUILDINGS[t];
    const payback = s.income > 0 ? Math.round(s.cost / s.income) : 0;
    return (
      <div key={t} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">{s.fa} <span className="mono text-[10px] font-normal text-[var(--dim)]">{s.en}</span></div>
          <div className="mt-0.5 text-[11px] leading-5 text-[var(--dim)]">{s.desc}</div>
          <div className="mono mt-1 flex flex-wrap gap-2 text-[10px]">
            {s.income > 0 && <span style={{ color: "var(--ok)" }}>+{s.income}/s · بازگشت {payback}s</span>}
            {s.cap > 0 && <span className="text-[var(--dim)]">ظرفیت {s.cap}</span>}
            <span className="text-[var(--dim)]">HP {s.hp}</span>
          </div>
        </div>
        <button className="btn btn-primary shrink-0 flex-col !gap-0 !px-3 !py-1.5" disabled={money < s.cost || freeSlots <= 0} onClick={() => onPlace(t)}>
          <span>انتخاب مکان</span>
          <span className="mono text-[11px]">${fmt(s.cost)}</span>
        </button>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--dim)]">جای خالی جزیره</span>
        <span className="mono font-bold">{freeSlots} / {SLOT_COUNT - 1}</span>
      </div>
      <Section title="اقتصاد">{ECO_TYPES.map(row)}</Section>
      <Section title="نظامی">{MIL_TYPES.map(row)}</Section>
      <Section title="سازه‌های شما">
        {myAlive.map((b) => {
          const s = BUILDINGS[b.type];
          const dmg = b.hp < s.hp;
          const cost = Math.ceil((1 - b.hp / s.hp) * s.cost * 0.5);
          return (
            <div key={b.id} className="rounded-lg border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <b>{s.fa} <span className="mono text-[10px] font-normal text-[var(--dim)]">#{b.slot}</span></b>
                <div className="flex gap-1">
                  {b.type === "defense_site" && <button className="btn !px-2 !py-0.5 text-[10px]" onClick={() => onReload(b.id)}>پر کردن مهمات</button>}
                  {dmg && <button className="btn !px-2 !py-0.5 text-[10px]" disabled={false} onClick={() => onRepair(b.id)}>تعمیر ${cost}</button>}
                </div>
              </div>
              <HpBar hp={b.hp} max={s.hp} />
              {s.cap > 0 && (
                <div className="mt-1.5">
                  <div className="mono text-[10px] text-[var(--dim)]">ظرفیت {usedCap(b)}/{s.cap}</div>
                  {b.stock && Object.entries(b.stock).filter(([, n]) => n > 0).map(([wid, n]) => {
                    const w = WEAPON_BY_ID[wid];
                    const ammo = b.ammo?.[wid];
                    return (
                      <div key={wid} className="mono mt-0.5 flex justify-between text-[10px]">
                        <span>{n}× {w?.name}</span>
                        {w?.kind === "defense" && <span style={{ color: (ammo ?? 0) < n * w.mag * 0.3 ? "var(--foe)" : "var(--dim)" }}>مهمات {ammo}/{n * w.mag}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold tracking-wide text-[var(--amber)]">{title}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------- shop tab
const SHOP_CATS: { k: WKind; label: string }[] = [
  { k: "missile", label: "موشک" },
  { k: "aircraft", label: "جنگنده/بمب‌افکن" },
  { k: "drone", label: "پهپاد" },
  { k: "defense", label: "پدافند" },
];

function ShopTab({
  country, money, myAlive, usedCap, onBuy,
}: {
  country: string; money: number; myAlive: BuildingView[]; usedCap: (b: BuildingView) => number;
  onBuy: (wid: string, count: number, buildingId?: number) => void;
}) {
  const [cat, setCat] = useState<WKind>("missile");
  const [site, setSite] = useState<number | "auto">("auto");
  const [onlyMine, setOnlyMine] = useState(false);
  const siteType = siteFor(cat);
  const sites = myAlive.filter((b) => b.type === siteType);
  const list = WEAPONS.filter((w) => w.kind === cat && (!onlyMine || w.country === country)).sort((a, b) => a.cost - b.cost);
  const effSite = sites.some((s) => s.id === site) ? site : "auto";
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1">
        {SHOP_CATS.map((c) => (
          <button key={c.k} onClick={() => setCat(c.k)} className="rounded-md border px-1 py-1.5 text-[11px] font-bold"
            style={{ borderColor: cat === c.k ? "var(--amber)" : "var(--line)", background: cat === c.k ? "oklch(0.3 0.06 80 / 0.3)" : "transparent" }}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[var(--dim)]">نگهداری در:</span>
        <select className="input !py-1 !text-[11px]" value={effSite} onChange={(e) => setSite(e.target.value === "auto" ? "auto" : Number(e.target.value))}>
          <option value="auto">خودکار</option>
          {sites.map((s) => <option key={s.id} value={s.id}>{BUILDINGS[s.type].fa} #{s.slot} ({usedCap(s)}/{BUILDINGS[s.type].cap})</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-[var(--dim)]">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
        فقط ساخت کشور من ({flagEmoji(country)} ۲۰٪ تخفیف)
      </label>
      {sites.length === 0 && (
        <div className="rounded-md border border-[var(--amber)] bg-[oklch(0.3_0.06_80/0.15)] p-2 text-[11px]">
          ابتدا در تب «ساخت»، یک «{BUILDINGS[siteType].fa}» بسازید.
        </div>
      )}
      {list.map((w) => <WeaponCard key={w.id} w={w} country={country} money={money} disabled={sites.length === 0}
        onBuy={(n) => onBuy(w.id, n, effSite === "auto" ? undefined : effSite)} />)}
    </div>
  );
}

function WeaponCard({ w, country, money, disabled, onBuy }: { w: Weapon; country: string; money: number; disabled: boolean; onBuy: (n: number) => void }) {
  const price = priceFor(country, w);
  const disc = w.country === country;
  const eta = Math.round(FLIGHT_DIST / w.speed);
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mono text-sm font-bold">{flagEmoji(w.country)} {w.name}</div>
          <div className="text-[10px] text-[var(--dim)]">{w.role} · {w.km}</div>
        </div>
        <div className="text-end">
          <div className="mono text-sm font-bold" style={{ color: "var(--amber)" }}>${fmt(price)}</div>
          {disc && <div className="text-[9px] text-[var(--ok)]">۲۰٪ تخفیف</div>}
        </div>
      </div>
      <div className="mt-1 text-[11px] leading-5 text-[var(--dim)]">{w.desc}</div>
      <div className="mono mt-1.5 flex flex-wrap gap-1 text-[10px]">
        {w.kind === "defense" ? (
          <>
            <span className="chip">برد {w.range}</span>
            <span className="chip">مهمات {w.mag}</span>
            {(Object.entries(w.pk) as [Cat, number][]).map(([c, p]) => <span key={c} className="chip">{CAT_FA[c]} {Math.round(p * 100)}%</span>)}
          </>
        ) : (
          <>
            {w.dmg > 0 && <span className="chip">💥 {w.dmg}</span>}
            {w.dmg > 0 && <span className="chip">🎯 {Math.round(w.acc * 100)}%</span>}
            <span className="chip">⏱ {eta}s</span>
            {w.evasion < 1 && <span className="chip" style={{ color: "var(--ok)" }}>رهگیری‌گریز</span>}
            {w.a2a > 0 && <span className="chip" style={{ color: "#8fc4ff" }}>هوا‌به‌هوا {Math.round(w.a2a * 100)}%</span>}
            {w.recon > 0 && <span className="chip" style={{ color: "#8fc4ff" }}>📡 {w.recon}s</span>}
            {w.reusable && <span className="chip">بازگشت‌پذیر</span>}
            <span className="chip">{KIND_FA[w.kind]} · {w.slots} جا</span>
          </>
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        {[1, 5, 10].map((n) => (
          <button key={n} className="btn flex-1 !py-1 text-[11px]" disabled={disabled || money < price} onClick={() => onBuy(n)}>
            خرید ×{n}
          </button>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- ops tab
function OpsTab({
  inventory, target, enemyAlive, setTarget, peaceLeft, onLaunch, myAlive,
}: {
  inventory: Record<string, { n: number; away: number }>;
  target: BuildingView | null; enemyAlive: BuildingView[]; setTarget: (id: number | null) => void;
  peaceLeft: number; onLaunch: (wid: string, count: number, mission: "strike" | "recon") => void; myAlive: BuildingView[];
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const ents = Object.entries(inventory).sort((a, b) => WEAPON_BY_ID[b[0]].cost - WEAPON_BY_ID[a[0]].cost);
  const defs: Record<string, { n: number; ammo: number }> = {};
  for (const b of myAlive) if (b.type === "defense_site" && b.stock) for (const [wid, n] of Object.entries(b.stock)) {
    if (n <= 0) continue;
    defs[wid] = { n: (defs[wid]?.n ?? 0) + n, ammo: (defs[wid]?.ammo ?? 0) + (b.ammo?.[wid] ?? 0) };
  }
  return (
    <div className="flex flex-col gap-3">
      <Section title="هدف">
        <div className="grid grid-cols-2 gap-1.5">
          {enemyAlive.map((b) => (
            <button key={b.id} onClick={() => setTarget(b.id)} className="rounded-md border px-2 py-1.5 text-start text-[11px]"
              style={{ borderColor: target?.id === b.id ? "var(--foe)" : "var(--line)", background: target?.id === b.id ? "oklch(0.35 0.12 30 / 0.3)" : "oklch(0.15 0.015 225)" }}>
              <div className="font-bold">{BUILDINGS[b.type].fa}</div>
              <div className="mono text-[10px] text-[var(--dim)]">HP {b.hp}</div>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-[var(--dim)]">یا روی ساختمان دشمن در صحنه سه‌بعدی کلیک کنید.</div>
      </Section>

      <Section title={`آماده شلیک ${peaceLeft > 0 ? `· آتش‌بس ${peaceLeft}s` : ""}`}>
        {ents.length === 0 && <div className="py-3 text-center text-xs text-[var(--dim)]">موجودی تهاجمی ندارید — از تب «تسلیحات» بخرید.</div>}
        {ents.map(([wid, { n, away }]) => {
          const w = WEAPON_BY_ID[wid];
          const q = Math.max(1, Math.min(qty[wid] ?? 1, n || 1));
          const set = (v: number) => setQty((s) => ({ ...s, [wid]: Math.max(1, Math.min(v, n)) }));
          return (
            <div key={wid} className="rounded-lg border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2.5">
              <div className="flex items-center justify-between">
                <div className="mono text-sm font-bold">{flagEmoji(w.country)} {w.name}</div>
                <div className="mono text-xs"><b>{n}</b>{away > 0 && <span className="text-[var(--dim)]"> (+{away} در پرواز)</span>}</div>
              </div>
              <div className="text-[10px] text-[var(--dim)]">{w.role}</div>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="flex items-center overflow-hidden rounded-md border border-[var(--line-strong)]">
                  <button className="px-2 py-1 text-sm" onClick={() => set(q - 1)}>−</button>
                  <span className="mono w-7 text-center text-xs">{q}</span>
                  <button className="px-2 py-1 text-sm" onClick={() => set(q + 1)}>+</button>
                </div>
                <button className="btn !px-2 !py-1 text-[10px]" onClick={() => set(n)}>همه</button>
                {w.dmg > 0 && (
                  <button className="btn btn-danger flex-1 !py-1.5" disabled={n <= 0 || !target || peaceLeft > 0} onClick={() => onLaunch(wid, q, "strike")}>
                    {w.kind === "missile" ? "🚀 شلیک" : "💣 حمله"}
                  </button>
                )}
                {w.recon > 0 && (
                  <button className="btn flex-1 !py-1.5" style={{ borderColor: "#55aaff" }} disabled={n <= 0 || peaceLeft > 0} onClick={() => onLaunch(wid, 1, "recon")}>
                    📡 شناسایی
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="وضعیت پدافند شما">
        {Object.keys(defs).length === 0 && <div className="py-2 text-center text-xs text-[var(--foe)]">پدافندی ندارید! جزیره بی‌دفاع است.</div>}
        {Object.entries(defs).map(([wid, d]) => {
          const w = WEAPON_BY_ID[wid];
          const full = d.n * w.mag;
          return (
            <div key={wid} className="rounded-md border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2 text-[11px]">
              <div className="mono flex justify-between"><b>{d.n}× {w.name}</b><span>برد {w.range}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-[oklch(0.12_0.01_225)]">
                <div className="h-full" style={{ width: `${(d.ammo / full) * 100}%`, background: d.ammo / full > 0.3 ? "var(--me)" : "var(--foe)" }} />
              </div>
              <div className="mono mt-0.5 text-[10px] text-[var(--dim)]">مهمات {d.ammo}/{full}</div>
            </div>
          );
        })}
      </Section>
    </div>
  );
}

// ----------------------------------------------------------------- intel tab
function IntelTab({ enemy, intelLeft }: { enemy: GameView["players"][number]; intelLeft: number }) {
  const active = enemy.money !== null;
  const alive = enemy.buildings.filter((b) => b.hp > 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border p-3 text-xs" style={{ borderColor: active ? "#55aaff" : "var(--line)" }}>
        {active ? (
          <>
            <div className="font-bold" style={{ color: "#8fc4ff" }}>📡 اطلاعات زنده — {intelLeft} ثانیه</div>
            <div className="mono mt-1">موجودی: <span style={{ color: "var(--amber)" }}>${fmt(enemy.money ?? 0)}M</span> · درآمد +{(enemy.income ?? 0).toFixed(1)}/s</div>
          </>
        ) : (
          <div className="leading-6 text-[var(--dim)]">
            در حال حاضر نمی‌دانید دشمن چه دارد. با <b className="mono text-[var(--text)]">RQ-4 / MQ-9 / Mohajer-6 / Orlan-10</b> شناسایی کنید تا موجودی، پدافندها و مهمات دشمن مدتی نمایش داده شود. در این حالت برد پدافند دشمن روی نقشه رسم می‌شود.
          </div>
        )}
      </div>
      {alive.map((b) => (
        <div key={b.id} className="rounded-lg border border-[var(--line)] bg-[oklch(0.15_0.015_225)] p-2 text-xs">
          <div className="flex justify-between"><b>{BUILDINGS[b.type].fa}</b><span className="mono text-[10px] text-[var(--dim)]">#{b.slot}</span></div>
          <HpBar hp={b.hp} max={BUILDINGS[b.type].hp} />
          {b.stock && <StockLine stock={b.stock} />}
          {b.stock && b.type === "defense_site" && Object.entries(b.stock).filter(([, n]) => n > 0).map(([wid, n]) => (
            <div key={wid} className="mono mt-0.5 text-[10px] text-[var(--dim)]">{WEAPON_BY_ID[wid]?.name}: مهمات {b.ammo?.[wid] ?? 0}/{n * (WEAPON_BY_ID[wid]?.mag ?? 0)} · برد {WEAPON_BY_ID[wid]?.range}</div>
          ))}
        </div>
      ))}
    </div>
  );
}
