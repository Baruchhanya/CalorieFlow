import type { Metadata } from "next";
import "./globals.css";
import { LangProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "CalorieFlow – יומן תזונה אישי",
  description: "עקוב אחר התזונה שלך בעזרת AI. הזן טקסט, תמונה, או קול.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
