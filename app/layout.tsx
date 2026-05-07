import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin", "hebrew"], display: "swap" });

export const metadata: Metadata = {
  title: "CalorieFlow – יומן תזונה אישי",
  description: "עקוב אחר התזונה שלך בעזרת AI. הזן טקסט, תמונה, או קול.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-visual",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={rubik.className}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
