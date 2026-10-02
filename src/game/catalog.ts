import type { BuildingType, Cat, Side, WKind } from "./types";

// ---------------------------------------------------------------- constants
export const START_MONEY = 3000;
export const PEACE_SECONDS = 60;
export const SLOT_COUNT = 17; // slot 0 = HQ, 1..16 free
export const ISLAND_X = 78;
export const ISLAND_R = 30;

export function localSlot(i: number): [number, number] {
  if (i === 0) return [0, 0];
  if (i <= 6) {
    const a = ((i - 1) / 6) * Math.PI * 2 + 0.3;
    return [Math.cos(a) * 12, Math.sin(a) * 12];
  }
  const a = ((i - 7) / 10) * Math.PI * 2;
  return [Math.cos(a) * 22, Math.sin(a) * 22];
}

export function slotPos(side: Side, i: number): [number, number] {
  const [lx, lz] = localSlot(i);
  return side === 0 ? [-ISLAND_X + lx, lz] : [ISLAND_X - lx, lz];
}

// ---------------------------------------------------------------- buildings
export interface BuildingSpec {
  type: BuildingType;
  fa: string;
  en: string;
  cost: number;
  income: number; // $M per second
  hp: number;
  cap: number; // storage capacity in slot-units
  capKind: WKind[] | null;
  group: "core" | "eco" | "mil";
  desc: string;
}

export const BUILDINGS: Record<BuildingType, BuildingSpec> = {
  hq: {
    type: "hq", fa: "مرکز فرماندهی", en: "Command HQ", cost: 1600, income: 2, hp: 700,
    cap: 0, capKind: null, group: "core",
    desc: "قلب کشور شما. نابودی آن یعنی شکست. درآمد پایه می‌دهد.",
  },
  mine: {
    type: "mine", fa: "معدن", en: "Mine", cost: 250, income: 1.2, hp: 100,
    cap: 0, capKind: null, group: "eco", desc: "ارزان‌ترین منبع درآمد؛ بازگشت سرمایه سریع.",
  },
  refinery: {
    type: "refinery", fa: "پالایشگاه نفت", en: "Oil Refinery", cost: 500, income: 2.8, hp: 140,
    cap: 0, capKind: null, group: "eco", desc: "درآمد خوب نفتی، هدف جذاب برای دشمن.",
  },
  port: {
    type: "port", fa: "بندر تجاری", en: "Trade Port", cost: 600, income: 3.2, hp: 150,
    cap: 0, capKind: null, group: "eco", desc: "تجارت دریایی و گمرک.",
  },
  steel: {
    type: "steel", fa: "ذوب‌آهن و فولاد", en: "Steel Mill", cost: 700, income: 4.0, hp: 150,
    cap: 0, capKind: null, group: "eco", desc: "صنعت سنگین با درآمد پایدار.",
  },
  petrochem: {
    type: "petrochem", fa: "پتروشیمی", en: "Petrochemical", cost: 900, income: 5.5, hp: 160,
    cap: 0, capKind: null, group: "eco", desc: "درآمد بالا، سرمایه‌گذاری سنگین.",
  },
  tech: {
    type: "tech", fa: "پارک فناوری", en: "Tech Park", cost: 1400, income: 9.0, hp: 120,
    cap: 0, capKind: null, group: "eco", desc: "بیشترین درآمد؛ شکننده در برابر حمله.",
  },
  airbase: {
    type: "airbase", fa: "فرودگاه نظامی", en: "Military Airbase", cost: 700, income: 0, hp: 220,
    cap: 8, capKind: ["aircraft", "drone"], group: "mil",
    desc: "جنگنده، بمب‌افکن و پهپاد نگهداری می‌کند (ظرفیت ۸ واحد). جنگنده‌ها خودکار از آسمان دفاع می‌کنند.",
  },
  missile_site: {
    type: "missile_site", fa: "سایت موشکی", en: "Missile Site", cost: 600, income: 0, hp: 200,
    cap: 10, capKind: ["missile"], group: "mil",
    desc: "موشک‌های بالستیک و کروز را نگه می‌دارد (ظرفیت ۱۰ واحد).",
  },
  defense_site: {
    type: "defense_site", fa: "سایت پدافندی", en: "Air Defense Site", cost: 500, income: 0, hp: 200,
    cap: 6, capKind: ["defense"], group: "mil",
    desc: "سامانه‌های پدافند را در خود جا می‌دهد (ظرفیت ۶ واحد). برد هر سامانه از موقعیت این سایت محاسبه می‌شود.",
  },
};

export const ECO_TYPES: BuildingType[] = ["mine", "refinery", "port", "steel", "petrochem", "tech"];
export const MIL_TYPES: BuildingType[] = ["airbase", "missile_site", "defense_site"];

// ---------------------------------------------------------------- weapons
export interface Weapon {
  id: string;
  name: string;
  country: string;
  kind: WKind;
  role: string;
  cost: number;
  slots: number;
  speed: number; // units / second
  dmg: number;
  radius: number;
  acc: number;
  cat: Cat;
  evasion: number; // multiplies interceptor kill probability
  reusable: boolean;
  recon: number; // seconds of intel given (0 = cannot recon)
  a2a: number; // fighter interception skill
  range: number; // defense range (world units)
  mag: number; // interceptors per battery
  pk: Partial<Record<Cat, number>>;
  km: string; // real-world range flavor
  desc: string;
}

type Base = Partial<Weapon> & Pick<Weapon, "id" | "name" | "country" | "cost" | "desc">;

function mk(kind: WKind, cat: Cat, role: string, b: Base): Weapon {
  return {
    kind, cat, role,
    slots: 1, speed: 1, dmg: 0, radius: 2, acc: 0.8, evasion: 1,
    reusable: false, recon: 0, a2a: 0, range: 0, mag: 0, pk: {}, km: "",
    ...b,
  } as Weapon;
}

const missile = (cat: Cat, role: string, b: Base) => mk("missile", cat, role, b);
const jet = (role: string, b: Base) => mk("aircraft", "air", role, { reusable: true, speed: 2.2, ...b });
const uav = (role: string, b: Base) => mk("drone", "drone", role, { speed: 0.9, ...b });
const sam = (role: string, b: Base) => mk("defense", "air", role, { ...b });

export const WEAPONS: Weapon[] = [
  // ---------------------------------------------------------- BALLISTIC / CRUISE MISSILES
  missile("sbm", "بالستیک برد کوتاه", { id: "scud-b", name: "Scud-B", country: "RU", cost: 45, speed: 6, dmg: 38, radius: 3, acc: 0.45, km: "300 km", desc: "موشک قدیمی و ارزان؛ دقت پایین." }),
  missile("sbm", "بالستیک برد کوتاه", { id: "fateh-110", name: "Fateh-110", country: "IR", cost: 60, speed: 7, dmg: 45, radius: 3, acc: 0.8, km: "300 km", desc: "بالستیک سوخت جامد با دقت خوب." }),
  missile("sbm", "بالستیک برد کوتاه", { id: "qiam-1", name: "Qiam-1", country: "IR", cost: 70, speed: 7, dmg: 55, radius: 3, acc: 0.55, km: "800 km", desc: "بالستیک بدون باله، دقت متوسط." }),
  missile("sbm", "بالستیک برد کوتاه", { id: "zolfaghar", name: "Zolfaghar", country: "IR", cost: 78, speed: 7, dmg: 55, radius: 3, acc: 0.87, km: "700 km", desc: "نسخه دقیق‌تر خانواده فاتح." }),
  missile("sbm", "بالستیک تاکتیکی", { id: "atacms", name: "MGM-140 ATACMS", country: "US", cost: 120, speed: 7, dmg: 55, radius: 4, acc: 0.9, km: "300 km", desc: "بالستیک تاکتیکی آمریکایی با دقت بالا." }),
  missile("sbm", "بالستیک تاکتیکی", { id: "iskander", name: "9K720 Iskander-M", country: "RU", cost: 170, speed: 7, dmg: 70, radius: 4, acc: 0.92, evasion: 0.55, km: "500 km", desc: "مسیر مانوردار؛ رهگیری آن بسیار سخت است." }),
  missile("bal", "بالستیک میان‌برد", { id: "shahab-3", name: "Shahab-3", country: "IR", cost: 90, slots: 2, speed: 8, dmg: 80, radius: 5, acc: 0.5, km: "1300 km", desc: "بالستیک مایع با کلاهک سنگین." }),
  missile("bal", "بالستیک میان‌برد", { id: "sejjil", name: "Sejjil-2", country: "IR", cost: 160, slots: 2, speed: 9, dmg: 95, radius: 5, acc: 0.7, km: "2000 km", desc: "دو مرحله‌ای سوخت جامد." }),
  missile("bal", "بالستیک سنگین", { id: "khorramshahr", name: "Khorramshahr-4", country: "IR", cost: 220, slots: 2, speed: 8, dmg: 135, radius: 6, acc: 0.72, km: "2000 km", desc: "کلاهک ۱۵۰۰ کیلوگرمی؛ تخریب گسترده." }),
  missile("bal", "بالستیک ضدناو/میان‌برد", { id: "df-21d", name: "DF-21D", country: "CN", cost: 330, slots: 2, speed: 9, dmg: 110, radius: 5, acc: 0.82, km: "1500 km", desc: "بالستیک دقیق چینی." }),
  missile("icbm", "بالستیک قاره‌پیما", { id: "df-41", name: "DF-41", country: "CN", cost: 900, slots: 4, speed: 11, dmg: 300, radius: 12, acc: 0.85, km: "12000 km", desc: "ICBM با قدرت ویرانگر." }),
  missile("icbm", "بالستیک قاره‌پیما", { id: "minuteman", name: "LGM-30 Minuteman III", country: "US", cost: 1000, slots: 4, speed: 11, dmg: 330, radius: 13, acc: 0.9, km: "13000 km", desc: "ICBM آمریکایی با دقت بالا." }),
  missile("icbm", "بالستیک قاره‌پیما", { id: "sarmat", name: "RS-28 Sarmat", country: "RU", cost: 1200, slots: 4, speed: 12, dmg: 380, radius: 15, acc: 0.88, km: "18000 km", desc: "سنگین‌ترین ICBM جهان." }),
  missile("cruise", "کروز زمین‌پایه", { id: "paveh", name: "Paveh", country: "IR", cost: 80, speed: 1.5, dmg: 50, radius: 3, acc: 0.7, km: "1650 km", desc: "کروز ایرانی ارزان." }),
  missile("cruise", "کروز", { id: "kalibr", name: "3M-14 Kalibr", country: "RU", cost: 120, speed: 1.9, dmg: 60, radius: 3, acc: 0.9, km: "1500 km", desc: "کروز روسی با دقت خوب." }),
  missile("cruise", "کروز", { id: "tomahawk", name: "BGM-109 Tomahawk", country: "US", cost: 130, speed: 1.8, dmg: 60, radius: 3, acc: 0.92, km: "1600 km", desc: "کروز کلاسیک آمریکایی." }),
  missile("cruise", "کروز نفوذگر", { id: "storm-shadow", name: "Storm Shadow", country: "GB", cost: 150, speed: 1.9, dmg: 75, radius: 3, acc: 0.94, km: "560 km", desc: "کروز نفوذی برای مراکز مستحکم." }),
  missile("cruise", "کروز راهبردی", { id: "kh-101", name: "Kh-101", country: "RU", cost: 180, speed: 1.8, dmg: 85, radius: 4, acc: 0.93, km: "2500 km", desc: "کروز برد بلند با کلاهک سنگین." }),
  missile("cruise", "کروز مافوق صوت", { id: "brahmos", name: "BrahMos", country: "IN", cost: 190, speed: 4, dmg: 85, radius: 4, acc: 0.93, evasion: 0.6, km: "450 km", desc: "کروز مافوق صوت؛ رهگیری دشوار." }),
  missile("hyper", "مافوق صوت", { id: "fattah", name: "Fattah", country: "IR", cost: 380, slots: 2, speed: 11, dmg: 100, radius: 5, acc: 0.8, km: "1400 km", desc: "موشک مافوق صوت ایرانی." }),
  missile("hyper", "مافوق صوت", { id: "kinzhal", name: "Kh-47M2 Kinzhal", country: "RU", cost: 450, slots: 2, speed: 12, dmg: 110, radius: 5, acc: 0.9, km: "2000 km", desc: "هایپرسونیک هوا‌پرتاب؛ تقریباً رهگیری‌ناپذیر." }),

  // ---------------------------------------------------------- AIRCRAFT
  jet("چندمنظوره قدیمی", { id: "f4", name: "F-4 Phantom II", country: "US", cost: 120, dmg: 40, radius: 2, acc: 0.7, a2a: 0.35, km: "2600 km", desc: "افسانه جنگ سرد؛ ارزان و همه‌کاره." }),
  jet("هوا به هوا", { id: "f14", name: "F-14 Tomcat", country: "US", cost: 220, dmg: 15, radius: 2, acc: 0.6, a2a: 0.6, km: "2900 km", desc: "رهگیر بالگردان؛ دفاع هوایی قوی." }),
  jet("هوا به هوا", { id: "mig-29", name: "MiG-29 Fulcrum", country: "RU", cost: 200, dmg: 20, acc: 0.6, a2a: 0.5, km: "1500 km", desc: "جنگنده چابک روسی." }),
  jet("چندمنظوره", { id: "f16", name: "F-16C Fighting Falcon", country: "US", cost: 260, dmg: 45, acc: 0.8, a2a: 0.55, km: "4200 km", desc: "همه‌کاره و پرتعداد." }),
  jet("چندمنظوره", { id: "rafale", name: "Dassault Rafale", country: "FR", cost: 380, dmg: 55, acc: 0.85, a2a: 0.65, evasion: 0.9, km: "3700 km", desc: "چندمنظوره فرانسوی." }),
  jet("چندمنظوره", { id: "typhoon", name: "Eurofighter Typhoon", country: "GB", cost: 420, dmg: 50, acc: 0.85, a2a: 0.7, evasion: 0.85, km: "3790 km", desc: "برتری هوایی اروپایی." }),
  jet("هوا به هوا", { id: "su-35", name: "Su-35S", country: "RU", cost: 450, dmg: 40, acc: 0.8, a2a: 0.75, evasion: 0.8, km: "3600 km", desc: "فوق‌مانور روسی." }),
  jet("بمب‌افکن تاکتیکی", { id: "su-24", name: "Su-24 Fencer", country: "RU", cost: 220, slots: 2, dmg: 70, radius: 3, acc: 0.65, km: "2800 km", desc: "بمب‌افکن تاکتیکی با بار بمب زیاد." }),
  jet("حمله زمینی", { id: "f15e", name: "F-15E Strike Eagle", country: "US", cost: 350, dmg: 65, radius: 3, acc: 0.85, a2a: 0.5, km: "3900 km", desc: "حمله دوربرد با توان هوایی." }),
  jet("نامرئی چندمنظوره", { id: "f35", name: "F-35A Lightning II", country: "US", cost: 600, dmg: 60, acc: 0.9, a2a: 0.6, evasion: 0.4, km: "2200 km", desc: "رادارگریز؛ پدافند سخت می‌بیند." }),
  jet("نامرئی چندمنظوره", { id: "j-20", name: "Chengdu J-20", country: "CN", cost: 650, dmg: 50, acc: 0.85, a2a: 0.75, evasion: 0.5, km: "5500 km", desc: "رادارگریز چینی." }),
  jet("نامرئی چندمنظوره", { id: "su-57", name: "Su-57 Felon", country: "RU", cost: 650, dmg: 55, acc: 0.85, a2a: 0.8, evasion: 0.5, km: "3500 km", desc: "نسل پنجم روسی." }),
  jet("برتری هوایی", { id: "f22", name: "F-22 Raptor", country: "US", cost: 700, dmg: 20, acc: 0.85, a2a: 0.88, evasion: 0.35, km: "3000 km", desc: "فرمانروای آسمان؛ بهترین رهگیر." }),
  jet("بمب‌افکن سنگین", { id: "tu-22m3", name: "Tu-22M3 Backfire", country: "RU", cost: 600, slots: 3, speed: 9, dmg: 140, radius: 6, acc: 0.7, km: "6800 km", desc: "بمب‌افکن مافوق صوت سنگین." }),
  jet("بمب‌افکن سنگین", { id: "b-52", name: "B-52H Stratofortress", country: "US", cost: 800, slots: 3, speed: 6, dmg: 160, radius: 7, acc: 0.6, km: "14000 km", desc: "فرش بمب؛ کند و آسیب‌پذیر." }),
  jet("بمب‌افکن رادارگریز", { id: "b-2", name: "B-2 Spirit", country: "US", cost: 1400, slots: 3, speed: 7, dmg: 190, radius: 6, acc: 0.95, evasion: 0.3, km: "11000 km", desc: "نامرئی‌ترین بمب‌افکن جهان." }),

  // ---------------------------------------------------------- DRONES
  uav("پهپاد انتحاری", { id: "shahed-136", name: "Shahed-136", country: "IR", cost: 25, slots: 0.5, dmg: 18, radius: 2, acc: 0.65, km: "2500 km", desc: "پهپاد انتحاری ارزان؛ با انبوه پرتاب موثر است." }),
  uav("پهپاد انتحاری", { id: "geran-2", name: "Geran-2", country: "RU", cost: 30, slots: 0.5, dmg: 20, radius: 2, acc: 0.7, km: "2000 km", desc: "نسخه روسی شاهد-۱۳۶." }),
  uav("شناسایی", { id: "orlan-10", name: "Orlan-10", country: "RU", cost: 40, slots: 0.5, speed: 0.8, reusable: true, recon: 60, evasion: 1, km: "120 km", desc: "پهپاد شناسایی سبک؛ ۶۰ ثانیه اطلاعات." }),
  uav("شناسایی/حمله", { id: "mohajer-6", name: "Mohajer-6", country: "IR", cost: 140, reusable: true, recon: 80, dmg: 12, acc: 0.8, km: "2000 km", desc: "شناسایی و حمله سبک؛ بازگشت‌پذیر." }),
  uav("پهپاد رزمی", { id: "tb2", name: "Bayraktar TB2", country: "TR", cost: 160, reusable: true, recon: 80, dmg: 18, acc: 0.88, km: "150 km", desc: "پهپاد رزمی دقیق ترک." }),
  uav("شناسایی/حمله", { id: "wing-loong", name: "Wing Loong II", country: "CN", cost: 180, reusable: true, recon: 90, dmg: 16, acc: 0.85, km: "4000 km", desc: "پهپاد چینی چندمنظوره." }),
  uav("شناسایی/حمله", { id: "mq-9", name: "MQ-9 Reaper", country: "US", cost: 380, reusable: true, speed: 1.1, recon: 110, dmg: 25, acc: 0.92, evasion: 0.9, km: "1850 km", desc: "پهپاد شکارچی-کشنده آمریکایی." }),
  uav("شناسایی راهبردی", { id: "rq-4", name: "RQ-4 Global Hawk", country: "US", cost: 700, slots: 1.5, speed: 1.6, reusable: true, recon: 180, evasion: 0.8, km: "22000 km", desc: "شناسایی ارتفاع بالا؛ ۱۸۰ ثانیه اطلاعات کامل." }),

  // ---------------------------------------------------------- AIR DEFENSE
  sam("پدافند ضدهوایی توپی", { id: "zu-23", name: "ZU-23-2", country: "RU", cost: 30, range: 8, mag: 40, pk: { air: 0.12, drone: 0.3, cruise: 0.1 }, km: "2.5 km", desc: "توپ ضدهوایی؛ ارزان و کم‌دقت — مناسب پهپادهای انتحاری." }),
  sam("پدافند قدیمی برد متوسط", { id: "s-125", name: "S-125 Neva/Pechora", country: "RU", cost: 90, range: 18, mag: 8, pk: { air: 0.35, cruise: 0.2, drone: 0.2 }, km: "35 km", desc: "سامانه قدیمی با دقت پایین." }),
  sam("پدافند برد کوتاه", { id: "pantsir", name: "Pantsir-S1", country: "RU", cost: 160, range: 12, mag: 12, pk: { air: 0.55, drone: 0.65, cruise: 0.5, sbm: 0.12 }, km: "20 km", desc: "توپ-موشک؛ ضد پهپاد و کروز." }),
  sam("پدافند برد کوتاه", { id: "tor-m2", name: "9K331 Tor-M2", country: "RU", cost: 170, range: 12, mag: 8, pk: { air: 0.6, drone: 0.65, cruise: 0.6, sbm: 0.1 }, km: "12 km", desc: "دقیق برای مقابله با کروز و هواپیما." }),
  sam("پدافند ضدموشک کوتاه", { id: "iron-dome", name: "Iron Dome", country: "IL", cost: 200, range: 14, mag: 20, pk: { sbm: 0.7, drone: 0.7, cruise: 0.55, air: 0.3 }, km: "70 km", desc: "رهگیری راکت و بالستیک کوتاه‌برد." }),
  sam("پدافند برد متوسط", { id: "hawk", name: "MIM-23 Hawk", country: "US", cost: 220, range: 20, mag: 6, pk: { air: 0.6, cruise: 0.45, drone: 0.4, sbm: 0.1 }, km: "50 km", desc: "پدافند آزموده برد متوسط." }),
  sam("پدافند برد متوسط", { id: "buk-m3", name: "9K317 Buk-M3", country: "RU", cost: 280, range: 22, mag: 6, pk: { air: 0.65, cruise: 0.6, drone: 0.55, sbm: 0.2 }, km: "70 km", desc: "پدافند متحرک روسی." }),
  sam("پدافند برد متوسط", { id: "nasams", name: "NASAMS", country: "US", cost: 300, range: 22, mag: 6, pk: { air: 0.7, cruise: 0.7, drone: 0.7, sbm: 0.1 }, km: "40 km", desc: "دقیق در برابر هواپیما و کروز." }),
  sam("پدافند برد متوسط", { id: "khordad-15", name: "Khordad-15", country: "IR", cost: 320, range: 24, mag: 6, pk: { air: 0.7, cruise: 0.6, drone: 0.5, sbm: 0.25 }, km: "120 km", desc: "پدافند ایرانی با پوشش گسترده." }),
  sam("پدافند چندلایه", { id: "davids-sling", name: "David's Sling", country: "IL", cost: 650, slots: 2, range: 30, mag: 4, pk: { cruise: 0.8, sbm: 0.75, air: 0.6, drone: 0.6, bal: 0.3 }, km: "300 km", desc: "ضد کروز و بالستیک کوتاه‌برد." }),
  sam("پدافند برد بلند", { id: "bavar-373", name: "Bavar-373", country: "IR", cost: 520, slots: 2, range: 40, mag: 6, pk: { air: 0.7, cruise: 0.6, drone: 0.5, sbm: 0.4, bal: 0.35 }, km: "200 km", desc: "پدافند دوربرد ایرانی." }),
  sam("پدافند برد بلند", { id: "s-300", name: "S-300PMU2", country: "RU", cost: 600, slots: 2, range: 40, mag: 6, pk: { air: 0.75, cruise: 0.6, sbm: 0.55, bal: 0.45, drone: 0.5, hyper: 0.05 }, km: "200 km", desc: "پدافند دوربرد با توان ضدبالستیک." }),
  sam("پدافند برد بلند", { id: "hq-9", name: "HQ-9B", country: "CN", cost: 620, slots: 2, range: 40, mag: 6, pk: { air: 0.75, cruise: 0.65, sbm: 0.5, bal: 0.4, drone: 0.5 }, km: "260 km", desc: "پدافند دوربرد چینی." }),
  sam("پدافند برد بلند", { id: "patriot", name: "MIM-104 Patriot PAC-3", country: "US", cost: 800, slots: 2, range: 40, mag: 6, pk: { air: 0.8, cruise: 0.7, sbm: 0.8, bal: 0.7, drone: 0.6, hyper: 0.15, icbm: 0.05 }, km: "160 km", desc: "دقیق و ضدبالستیک." }),
  sam("پدافند برد بلند", { id: "s-400", name: "S-400 Triumf", country: "RU", cost: 950, slots: 2, range: 44, mag: 6, pk: { air: 0.85, cruise: 0.75, sbm: 0.8, bal: 0.7, hyper: 0.2, drone: 0.65, icbm: 0.1 }, km: "400 km", desc: "قوی‌ترین پدافند چندمنظوره." }),
  sam("ضدبالستیک", { id: "thaad", name: "THAAD", country: "US", cost: 1100, slots: 2, range: 44, mag: 4, pk: { bal: 0.85, sbm: 0.6, icbm: 0.35, hyper: 0.1 }, km: "200 km", desc: "فقط بالستیک — اما بسیار دقیق." }),
  sam("ضدبالستیک فرااتمسفری", { id: "arrow-3", name: "Arrow-3", country: "IL", cost: 1300, slots: 2, range: 50, mag: 4, pk: { bal: 0.85, icbm: 0.7, hyper: 0.15, sbm: 0.4 }, km: "2400 km", desc: "رهگیر فرااتمسفری؛ تنها امید برابر ICBM." }),
];

export const WEAPON_BY_ID: Record<string, Weapon> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);

export function priceFor(country: string, w: Weapon): number {
  return Math.round(w.cost * (w.country === country ? 0.8 : 1));
}

export function siteFor(kind: WKind): BuildingType {
  if (kind === "missile") return "missile_site";
  if (kind === "defense") return "defense_site";
  return "airbase";
}

export const CAT_FA: Record<Cat, string> = {
  sbm: "بالستیک کوتاه",
  bal: "بالستیک",
  icbm: "قاره‌پیما",
  cruise: "کروز",
  hyper: "مافوق صوت",
  air: "هواپیما",
  drone: "پهپاد",
};

export const KIND_FA: Record<WKind, string> = {
  missile: "موشک",
  aircraft: "هواپیما",
  drone: "پهپاد",
  defense: "پدافند",
};
