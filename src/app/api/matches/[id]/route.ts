import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { withMatch } from "@/lib/matchService";
import { opponentOf } from "@/lib/util";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  const { id } = await ctx.params;
  const res = await withMatch(Number(id), user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.waiting) return NextResponse.json({ waiting: true, matchId: res.matchId });
  return NextResponse.json({ view: res.view });
}

// Cancel a waiting match, or surrender an active one.
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  const { id } = await ctx.params;
  const mid = Number(id);
  const del = await db
    .delete(matches)
    .where(and(eq(matches.id, mid), eq(matches.status, "waiting"), eq(matches.p1UserId, user.id)))
    .returning({ id: matches.id });
  if (del.length) return NextResponse.json({ ok: true, cancelled: true });
  const res = await withMatch(mid, user.id, (s, side) => {
    if (s.winner === null) {
      s.winner = opponentOf(side);
      s.endReason = "تسلیم";
    }
    return null;
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true });
}
