import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { advance, buildView } from "@/game/engine";
import type { GameState, GameView, Side } from "@/game/types";

export type MatchResult =
  | { ok: true; waiting: true; matchId: number; mode: string }
  | { ok: true; waiting: false; view: GameView; error: string | null }
  | { ok: false; status: number; error: string };

const DIFF_FA: Record<string, string> = { easy: "آسان", normal: "متوسط", hard: "سخت" };

export async function withMatch(
  matchId: number,
  userId: number,
  mutate?: (s: GameState, side: Side, now: number) => string | null,
): Promise<MatchResult> {
  return db.transaction(async (tx): Promise<MatchResult> => {
    const rows = await tx.select().from(matches).where(eq(matches.id, matchId)).for("update").limit(1);
    const m = rows[0];
    if (!m) return { ok: false, status: 404, error: "بازی یافت نشد" };
    const side: Side | null = m.p1UserId === userId ? 0 : m.p2UserId === userId ? 1 : null;
    if (side === null) return { ok: false, status: 403, error: "شما عضو این بازی نیستید" };
    if (m.status === "waiting" || !m.state) {
      return { ok: true, waiting: true, matchId: m.id, mode: m.mode };
    }

    const s = m.state;
    const now = Date.now();
    let err: string | null = null;
    if (m.status === "active") {
      advance(s, now);
      if (mutate) err = mutate(s, side, now);
    } else if (mutate) {
      err = "بازی تمام شده است";
    }

    let status = m.status;
    if (s.winner !== null && m.status === "active") {
      status = "finished";
      const winnerId = s.winner === 0 ? m.p1UserId : m.p2UserId;
      const loserId = s.winner === 0 ? m.p2UserId : m.p1UserId;
      if (winnerId) await tx.update(users).set({ wins: sql`${users.wins} + 1` }).where(eq(users.id, winnerId));
      if (loserId) await tx.update(users).set({ losses: sql`${users.losses} + 1` }).where(eq(users.id, loserId));
    }
    if (m.status !== "finished") {
      await tx
        .update(matches)
        .set({ state: s, status, winnerSide: s.winner, updatedAt: new Date() })
        .where(eq(matches.id, m.id));
    }

    const ids = [m.p1UserId, m.p2UserId].filter((x): x is number => x !== null);
    const names = ids.length
      ? await tx.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, ids))
      : [];
    const nm = (id: number | null, fallback: string) => names.find((n) => n.id === id)?.username ?? fallback;
    const botName = `🤖 ربات (${DIFF_FA[m.difficulty] ?? m.difficulty})`;
    const view = buildView(s, side, now, {
      matchId: m.id,
      mode: m.mode as "bot" | "pvp",
      names: [nm(m.p1UserId, "—"), m.mode === "bot" ? botName : nm(m.p2UserId, "—")],
      status: status === "finished" ? "finished" : "active",
    });
    return { ok: true, waiting: false, view, error: err };
  });
}
