export interface Country {
  code: string;
  fa: string;
  en: string;
}

export const COUNTRIES: Country[] = [
  { code: "IR", fa: "ایران", en: "Iran" },
  { code: "US", fa: "ایالات متحده", en: "United States" },
  { code: "RU", fa: "روسیه", en: "Russia" },
  { code: "CN", fa: "چین", en: "China" },
  { code: "IL", fa: "اسرائیل", en: "Israel" },
  { code: "TR", fa: "ترکیه", en: "Türkiye" },
  { code: "GB", fa: "بریتانیا", en: "United Kingdom" },
  { code: "FR", fa: "فرانسه", en: "France" },
  { code: "DE", fa: "آلمان", en: "Germany" },
  { code: "IN", fa: "هند", en: "India" },
  { code: "PK", fa: "پاکستان", en: "Pakistan" },
  { code: "KP", fa: "کره شمالی", en: "North Korea" },
  { code: "KR", fa: "کره جنوبی", en: "South Korea" },
  { code: "JP", fa: "ژاپن", en: "Japan" },
  { code: "UA", fa: "اوکراین", en: "Ukraine" },
  { code: "SA", fa: "عربستان سعودی", en: "Saudi Arabia" },
  { code: "AE", fa: "امارات", en: "UAE" },
  { code: "QA", fa: "قطر", en: "Qatar" },
  { code: "IQ", fa: "عراق", en: "Iraq" },
  { code: "SY", fa: "سوریه", en: "Syria" },
  { code: "EG", fa: "مصر", en: "Egypt" },
  { code: "AF", fa: "افغانستان", en: "Afghanistan" },
  { code: "AZ", fa: "آذربایجان", en: "Azerbaijan" },
  { code: "AM", fa: "ارمنستان", en: "Armenia" },
  { code: "IT", fa: "ایتالیا", en: "Italy" },
  { code: "ES", fa: "اسپانیا", en: "Spain" },
  { code: "PL", fa: "لهستان", en: "Poland" },
  { code: "SE", fa: "سوئد", en: "Sweden" },
  { code: "NO", fa: "نروژ", en: "Norway" },
  { code: "NL", fa: "هلند", en: "Netherlands" },
  { code: "GR", fa: "یونان", en: "Greece" },
  { code: "CA", fa: "کانادا", en: "Canada" },
  { code: "AU", fa: "استرالیا", en: "Australia" },
  { code: "BR", fa: "برزیل", en: "Brazil" },
  { code: "AR", fa: "آرژانتین", en: "Argentina" },
  { code: "MX", fa: "مکزیک", en: "Mexico" },
  { code: "CU", fa: "کوبا", en: "Cuba" },
  { code: "VE", fa: "ونزوئلا", en: "Venezuela" },
  { code: "ZA", fa: "آفریقای جنوبی", en: "South Africa" },
  { code: "NG", fa: "نیجریه", en: "Nigeria" },
  { code: "ET", fa: "اتیوپی", en: "Ethiopia" },
  { code: "DZ", fa: "الجزایر", en: "Algeria" },
  { code: "ID", fa: "اندونزی", en: "Indonesia" },
  { code: "VN", fa: "ویتنام", en: "Vietnam" },
  { code: "TH", fa: "تایلند", en: "Thailand" },
  { code: "TW", fa: "تایوان", en: "Taiwan" },
  { code: "BY", fa: "بلاروس", en: "Belarus" },
  { code: "KZ", fa: "قزاقستان", en: "Kazakhstan" },
  { code: "FI", fa: "فنلاند", en: "Finland" },
];

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(
    ...code.split("").map((c) => 127397 + c.charCodeAt(0)),
  );
}

export function countryName(code: string): string {
  return COUNTRIES.find((c) => c.code === code)?.fa ?? code;
}

export function isValidCountry(code: unknown): code is string {
  return typeof code === "string" && COUNTRIES.some((c) => c.code === code);
}

// Deterministic accent hue per country (for 3D banner tint)
export function countryColor(code: string): string {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
}
