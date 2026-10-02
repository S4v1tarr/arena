import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { isValidCountry } from "@/game/countries";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const country = body.country;
  if (!/^[\p{L}\p{N}_\-. ]{3,20}$/u.test(username)) {
    return NextResponse.json({ error: "نام کاربری باید ۳ تا ۲۰ نویسه باشد" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "رمز عبور حداقل ۶ نویسه باشد" }, { status: 400 });
  }
  if (!isValidCountry(country)) {
    return NextResponse.json({ error: "یک کشور انتخاب کنید" }, { status: 400 });
  }
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (exists.length) {
    return NextResponse.json({ error: "این نام کاربری قبلاً گرفته شده است" }, { status: 409 });
  }
  const [u] = await db
    .insert(users)
    .values({ username, passwordHash: hashPassword(password), country })
    .returning({ id: users.id });
  await createSession(u.id);
  return NextResponse.json({ ok: true });
}
