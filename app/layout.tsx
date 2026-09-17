import type { Metadata } from "next";
import "./globals.css";
import "./atelier.css";

export const metadata: Metadata = {
  title: "A Wish for You · 生日烛光",
  description: "布置专属生日桌，点亮蜡烛，留下愿望与祝福。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
