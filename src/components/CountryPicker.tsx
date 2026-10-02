"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, flagEmoji } from "@/game/countries";

export default function CountryPicker({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (code: string) => void;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.fa.includes(s) || c.en.toLowerCase().includes(s) || c.code.toLowerCase() === s,
    );
  }, [q]);
  return (
    <div>
      <input
        className="input mb-2"
        placeholder="جستجوی کشور…  (Iran, USA, روسیه)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div
        className={`scroll-thin grid grid-cols-2 gap-1.5 overflow-y-auto pe-1 sm:grid-cols-3 ${compact ? "max-h-40" : "max-h-56"}`}
      >
        {list.map((c) => {
          const sel = c.code === value;
          return (
            <button
              type="button"
              key={c.code}
              onClick={() => onChange(c.code)}
              className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-xs transition"
              style={{
                borderColor: sel ? "var(--amber)" : "var(--line)",
                background: sel ? "oklch(0.3 0.06 80 / 0.35)" : "oklch(0.15 0.015 225)",
              }}
            >
              <span className="text-lg leading-none">{flagEmoji(c.code)}</span>
              <span className="truncate">{c.fa}</span>
            </button>
          );
        })}
        {list.length === 0 && <div className="col-span-full py-3 text-center text-xs text-[var(--dim)]">کشوری پیدا نشد</div>}
      </div>
    </div>
  );
}
