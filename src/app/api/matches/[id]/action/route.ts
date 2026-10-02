import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withMatch } from "@/lib/matchService";
import { doBuild, doBuy, doLaunch, doRepair, doReload } from "@/game/engine";
import type { BuildingType } from "@/game/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ابتدا وارد شوید" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const num = (v: unknown, d?: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

  const res = await withMatch(Number(id), user.id, (s, side, now) => {
    switch (body.type) {
      case "build":
        return doBuild(s, side, String(body.buildingType) as BuildingType, num(body.slot));
      case "buy":
        return doBuy(s, side, String(body.wid), num(body.count, 1)!, num(body.buildingId));
      case "reload":
        return doReload(s, side, num(body.buildingId));
      case "repair":
        return doRepair(s, side, num(body.buildingId, -1)!);
      case "launch":
        return doLaunch(
          s, side, String(body.wid), num(body.targetId, -1)!, num(body.count, 1)!,
          body.mission === "recon" ? "recon" : "strike", now,
        );
      default:
        return "دستور نامعتبر";
    }
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  if (res.waiting) return NextResponse.json({ error: "بازی هنوز شروع نشده" }, { status: 400 });
  return NextResponse.json({ view: res.view, error: res.error });
}
