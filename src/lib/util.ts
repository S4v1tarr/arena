import type { Side } from "@/game/types";

export function opponentOf(s: Side): Side {
  return s === 0 ? 1 : 0;
}
