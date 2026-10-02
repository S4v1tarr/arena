import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "جزایر نبرد — بازی جنگی اقتصادی سه‌بعدی",
  description:
    "دو جزیره، دو فرمانده. اقتصاد بسازید، سلاح‌های واقعی بخرید و تاسیسات دشمن را نابود کنید.",
};

export const viewport: Viewport = {
  themeColor: "#0b1318",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Vazirmatn:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
