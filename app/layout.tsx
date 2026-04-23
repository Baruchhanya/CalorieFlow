import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CalorieFlow – יומן תזונה אישי",
  description: "עקוב אחר התזונה שלך בעזרת AI. הזן טקסט, תמונה, או קול.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={inter.className}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
