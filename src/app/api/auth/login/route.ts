import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  const u = rows[0];
  if (!u || !verifyPassword(password, u.passwordHash)) {
    return NextResponse.json({ error: "نام کاربری یا رمز عبور اشتباه است" }, { status: 401 });
  }
  await createSession(u.id);
  return NextResponse.json({ ok: true });
}
