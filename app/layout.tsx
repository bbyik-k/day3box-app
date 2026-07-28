import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Broadsheet 정본 서체 — 산세리프 금지. 한글 글리프는 없어 시스템 명조(serif 폴백)로 렌더된다
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "day3box",
  description: "하루를 계획하고 기록하는 타임박싱 플래너",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${sourceSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
