"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CountryPicker from "@/components/CountryPicker";
import { countryName, flagEmoji } from "@/game/countries";

interface Me {
  id: number;
  username: string;
  country: string;
  wins: number;
  losses: number;
}
interface Active {
  id: number;
  status: string;
  mode: string;
}
interface Row {
  username: string;
  country: string;
  wins: number;
  losses: number;
}

async function api(path: string, method: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/me", { cache: "no-store" });
    const d = await r.json();
    setMe(d.user);
    setActive(d.activeMatch ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="radar">
        <div className="radar-sweep" />
        {[320, 560, 800, 1040].map((s) => (
          <div key={s} className="radar-ring" style={{ width: s, height: s, marginLeft: -s / 2 + 300 }} />
        ))}
      </div>

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_1fr]">
        <Hero />
        {loading ? (
          <div className="panel p-8 text-center text-sm text-[var(--dim)]">در حال بارگذاری…</div>
        ) : me ? (
          <Lobby me={me} active={active} onChange={refresh} />
        ) : (
          <Auth onDone={refresh} />
        )}
      </div>
    </main>
  );
}

function Hero() {
  return (
    <section>
      <div className="mono mb-4 flex items-center gap-2 text-xs tracking-[0.25em] text-[var(--amber)]">
        <span className="blink inline-block h-2 w-2 rounded-full bg-[var(--foe)]" />
        THEATER-01 · LIVE
      </div>
      <h1 className="text-5xl font-extrabold leading-[1.15] sm:text-7xl">
        جزایر <span style={{ color: "var(--amber)" }}>نبرد</span>
      </h1>
      <p className="mt-5 max-w-lg text-base leading-8 text-[var(--dim)]">
        دو جزیره روی اقیانوس. دو فرمانده. با پالایشگاه، معدن و پتروشیمی اقتصاد بسازید؛ سپس
        فرودگاه نظامی، سایت موشکی و پدافند راه بیندازید و با سلاح‌های واقعی جهان —
        <span className="mono mx-1 text-[var(--text)]">F-4 Phantom · Shahed-136 · MQ-9 · Patriot · S-400</span>
        — تاسیسات دشمن را هدف بگیرید یا از جزیره‌تان دفاع کنید.
      </p>
      <div className="mt-8 grid max-w-lg grid-cols-3 gap-3">
        {[
          ["۶", "نوع سازه اقتصادی"],
          ["۶۰+", "سلاح واقعی"],
          ["۳D", "نبرد زنده"],
        ].map(([n, l]) => (
          <div key={l} className="panel p-3">
            <div className="text-2xl font-extrabold" style={{ color: "var(--me)" }}>{n}</div>
            <div className="mt-1 text-xs text-[var(--dim)]">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Auth({ onDone }: { onDone: () => void }) {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("IR");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await api(`/api/auth/${tab}`, "POST", { username, password, country });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "خطا");
    onDone();
  }

  return (
    <form onSubmit={submit} className="panel slide-in p-6">
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-[var(--line)] p-1 text-sm">
        {(["register", "login"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => { setTab(t); setErr(""); }}
            className="rounded-md py-2 font-bold transition"
            style={{
              background: tab === t ? "var(--amber)" : "transparent",
              color: tab === t ? "oklch(0.2 0.03 80)" : "var(--dim)",
            }}
          >
            {t === "register" ? "ثبت‌نام" : "ورود"}
          </button>
        ))}
      </div>

      <label className="label">نام فرمانده</label>
      <input className="input mb-3" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      <label className="label">رمز عبور</label>
      <input className="input mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={tab === "login" ? "current-password" : "new-password"} required />

      {tab === "register" && (
        <>
          <label className="label">
            کشور شما: <b className="text-[var(--text)]">{flagEmoji(country)} {countryName(country)}</b>
          </label>
          <CountryPicker value={country} onChange={setCountry} compact />
        </>
      )}

      {err && <div className="mt-3 rounded-md border border-[var(--foe)] px-3 py-2 text-xs text-[var(--foe)]">{err}</div>}
      <button className="btn btn-primary mt-5 w-full py-3 text-base" disabled={busy}>
        {busy ? "…" : tab === "register" ? "ساخت حساب و ورود به جبهه" : "ورود به مرکز فرماندهی"}
      </button>
    </form>
  );
}

function Lobby({ me, active, onChange }: { me: Me; active: Active | null; onChange: () => void }) {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [board, setBoard] = useState<Row[]>([]);
  const [showPick, setShowPick] = useState(false);

  useEffect(() => {
    fetch("/api/leaderboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setBoard(d.rows ?? []))
      .catch(() => {});
  }, []);

  async function start(mode: "bot" | "pvp") {
    setBusy(true);
    setErr("");
    const r = await api("/api/matches", "POST", { mode, difficulty });
    setBusy(false);
    if (r.ok || r.status === 409) return router.push(`/game/${r.data.matchId}`);
    setErr(r.data.error ?? "خطا");
  }

  async function setCountry(code: string) {
    await api("/api/me", "PATCH", { country: code });
    onChange();
    setShowPick(false);
  }

  async function abandon() {
    if (!active) return;
    await api(`/api/matches/${active.id}`, "DELETE");
    onChange();
  }

  async function logout() {
    await api("/api/auth/logout", "POST");
    onChange();
  }

  return (
    <section className="panel slide-in p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-[var(--dim)]">فرمانده</div>
          <div className="text-xl font-extrabold">{me.username}</div>
          <div className="mono mt-1 text-xs text-[var(--dim)]">
            <span style={{ color: "var(--ok)" }}>{me.wins}W</span> / <span style={{ color: "var(--foe)" }}>{me.losses}L</span>
          </div>
        </div>
        <button className="btn" onClick={logout}>خروج</button>
      </div>

      <button
        onClick={() => setShowPick((v) => !v)}
        className="mb-4 flex w-full items-center justify-between rounded-lg border border-[var(--line-strong)] bg-[oklch(0.15_0.015_225)] px-4 py-3"
      >
        <span className="flex items-center gap-3">
          <span className="text-3xl">{flagEmoji(me.country)}</span>
          <span className="text-start">
            <span className="block text-[11px] text-[var(--dim)]">کشور انتخابی (سلاح‌های ساخت این کشور ۲۰٪ ارزان‌ترند)</span>
            <span className="font-bold">{countryName(me.country)}</span>
          </span>
        </span>
        <span className="text-xs text-[var(--amber)]">{showPick ? "بستن" : "تغییر"}</span>
      </button>
      {showPick && (
        <div className="mb-4">
          <CountryPicker value={me.country} onChange={setCountry} compact />
        </div>
      )}

      {active && (
        <div className="mb-4 rounded-lg border border-[var(--amber)] bg-[oklch(0.3_0.06_80/0.2)] p-3">
          <div className="mb-2 text-sm font-bold">
            یک بازی {active.status === "waiting" ? "در انتظار حریف" : "در جریان"} دارید
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={() => router.push(`/game/${active.id}`)}>ادامه بازی</button>
            <button className="btn btn-danger" onClick={abandon}>{active.status === "waiting" ? "لغو" : "تسلیم"}</button>
          </div>
        </div>
      )}

      <div className="mb-2 text-xs text-[var(--dim)]">سطح ربات</div>
      <div className="mb-4 grid grid-cols-3 gap-2">
        {([["easy", "آسان"], ["normal", "متوسط"], ["hard", "سخت"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setDifficulty(k)}
            className="rounded-lg border py-2 text-sm font-bold transition"
            style={{
              borderColor: difficulty === k ? "var(--amber)" : "var(--line)",
              background: difficulty === k ? "oklch(0.3 0.06 80 / 0.3)" : "transparent",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button className="btn btn-primary py-4 text-base" disabled={busy || !!active} onClick={() => start("bot")}>
          🤖 مبارزه با ربات
        </button>
        <button className="btn py-4 text-base" style={{ borderColor: "var(--me)" }} disabled={busy || !!active} onClick={() => start("pvp")}>
          ⚔️ مبارزه با بازیکن
        </button>
      </div>
      {err && <div className="mt-3 text-xs text-[var(--foe)]">{err}</div>}

      <div className="mt-6">
        <div className="mb-2 text-xs text-[var(--dim)]">برترین فرمانده‌ها</div>
        <div className="divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] text-sm">
          {board.length === 0 && <div className="p-3 text-center text-xs text-[var(--dim)]">هنوز کسی ثبت نشده</div>}
          {board.map((r, i) => (
            <div key={r.username} className="flex items-center gap-3 px-3 py-2">
              <span className="mono w-5 text-xs text-[var(--dim)]">{i + 1}</span>
              <span>{flagEmoji(r.country)}</span>
              <span className="flex-1 truncate">{r.username}</span>
              <span className="mono text-xs">
                <span style={{ color: "var(--ok)" }}>{r.wins}</span>-<span style={{ color: "var(--foe)" }}>{r.losses}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
