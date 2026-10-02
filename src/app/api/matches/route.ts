import { NextResponse } from "next/server";
import { and, asc, desc, eq, gt, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { COUNTRIES } from "@/game/countries";
import { createState } from "@/game/engine";
import type { Difficulty } from "@/game/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "pvp" ? "pvp" : "bot";
  const difficulty: Difficulty = ["easy", "normal", "hard"].includes(body.difficulty)
    ? body.difficulty
    : "normal";

  const existing = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        inArray(matches.status, ["waiting", "active"]),
        or(eq(matches.p1UserId, user.id), eq(matches.p2UserId, user.id)),
      ),
    )
    .orderBy(desc(matches.id))
    .limit(1);
  if (existing[0]) {
    return NextResponse.json(
      { error: "شما یک بازی در جریان دارید", matchId: existing[0].id },
      { status: 409 },
    );
  }

  if (mode === "bot") {
    const others = COUNTRIES.filter((c) => c.code !== user.country);
    const botCountry = others[Math.floor(Math.random() * others.length)].code;
    const now = Date.now();
    const state = createState(user.country, botCountry, now, { side: 1, difficulty });
    const [m] = await db
      .insert(matches)
      .values({
        mode: "bot", status: "active", difficulty, p1UserId: user.id, p1Country: user.country,
        p2Country: botCountry, state,
      })
      .returning({ id: matches.id });
    return NextResponse.json({ matchId: m.id });
  }

  // PvP matchmaking
  const result = await db.transaction(async (tx) => {
    const fresh = new Date(Date.now() - 10 * 60 * 1000);
    const waiting = await tx
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.status, "waiting"),
          eq(matches.mode, "pvp"),
          ne(matches.p1UserId, user.id),
          gt(matches.createdAt, fresh),
        ),
      )
      .orderBy(asc(matches.id))
      .limit(1)
      .for("update", { skipLocked: true });
    const w = waiting[0];
    if (w) {
      const now = Date.now();
      const state = createState(w.p1Country, user.country, now, null);
      await tx
        .update(matches)
        .set({ p2UserId: user.id, p2Country: user.country, status: "active", state, updatedAt: new Date() })
        .where(eq(matches.id, w.id));
      return w.id;
    }
    const [m] = await tx
      .insert(matches)
      .values({ mode: "pvp", status: "waiting", p1UserId: user.id, p1Country: user.country })
      .returning({ id: matches.id });
    return m.id;
  });
  return NextResponse.json({ matchId: result });
}
