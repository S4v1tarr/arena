import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isValidCountry } from "@/game/countries";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  const active = await db
    .select({ id: matches.id, status: matches.status, mode: matches.mode })
    .from(matches)
    .where(
      and(
        inArray(matches.status, ["waiting", "active"]),
        or(eq(matches.p1UserId, user.id), eq(matches.p2UserId, user.id)),
      ),
    )
    .orderBy(desc(matches.id))
    .limit(1);
  return NextResponse.json({ user, activeMatch: active[0] ?? null });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "وارد شوید" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!isValidCountry(body.country)) {
    return NextResponse.json({ error: "کشور نامعتبر" }, { status: 400 });
  }
  await db.update(users).set({ country: body.country }).where(eq(users.id, user.id));
  return NextResponse.json({ ok: true });
}
