export type Side = 0 | 1;

export type Cat = "sbm" | "bal" | "icbm" | "cruise" | "hyper" | "air" | "drone";
export type WKind = "missile" | "aircraft" | "drone" | "defense";

export type BuildingType =
  | "hq"
  | "mine"
  | "refinery"
  | "petrochem"
  | "port"
  | "steel"
  | "tech"
  | "airbase"
  | "missile_site"
  | "defense_site";

export interface Building {
  id: number;
  type: BuildingType;
  slot: number;
  hp: number;
  stock: Record<string, number>;
  ammo: Record<string, number>;
}

export interface PlayerState {
  money: number;
  nextId: number;
  country: string;
  buildings: Building[];
  intelUntil: number;
  stats: {
    launched: number;
    intercepted: number;
    destroyed: number;
    lost: number;
    shotDown: number;
  };
}

export interface Flight {
  id: number;
  side: Side;
  wid: string;
  mission: "strike" | "recon" | "defense";
  phase: "out" | "back";
  originId: number;
  targetId: number;
  home: [number, number];
  a: [number, number];
  b: [number, number];
  t0: number;
  t1: number;
}

export type EventKind =
  | "launch"
  | "hit"
  | "miss"
  | "intercept"
  | "destroyed"
  | "recon"
  | "shotdown"
  | "info"
  | "win";

export interface GameEvent {
  id: number;
  t: number;
  kind: EventKind;
  side: Side;
  x: number;
  y: number;
  z: number;
  r: number;
  text: string;
}

export type Difficulty = "easy" | "normal" | "hard";

export interface GameState {
  startedAt: number;
  peaceUntil: number;
  lastTick: number;
  tickCount: number;
  players: [PlayerState, PlayerState];
  flights: Flight[];
  events: GameEvent[];
  nextEventId: number;
  nextFlightId: number;
  winner: Side | null;
  endReason: string;
  bot: { side: Side; difficulty: Difficulty; nextAttack: number } | null;
}

// ---------- client-facing view ----------
export interface BuildingView {
  id: number;
  type: BuildingType;
  slot: number;
  hp: number;
  stock: Record<string, number> | null;
  ammo: Record<string, number> | null;
}

export interface PlayerView {
  name: string;
  country: string;
  money: number | null;
  income: number | null;
  buildings: BuildingView[];
  stats: PlayerState["stats"] | null;
}

export interface GameView {
  matchId: number;
  mode: "bot" | "pvp";
  status: "waiting" | "active" | "finished";
  me: Side;
  serverNow: number;
  startedAt: number;
  peaceUntil: number;
  winner: Side | null;
  endReason: string;
  intelUntil: number;
  players: [PlayerView, PlayerView];
  flights: Flight[];
  events: GameEvent[];
}
