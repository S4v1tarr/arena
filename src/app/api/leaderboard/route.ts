import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db
    .select({ username: users.username, country: users.country, wins: users.wins, losses: users.losses })
    .from(users)
    .orderBy(desc(users.wins), users.losses)
    .limit(10);
  return NextResponse.json({ rows });
}
