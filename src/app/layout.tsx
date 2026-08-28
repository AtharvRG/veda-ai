import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VedaAI - Teacher's Toolkit",
  description: "AI Assessment Extraction & Answer Mapping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={bricolage.variable}>
      <body className="antialiased overflow-hidden w-screen h-screen flex">
        {children}
        <Analytics />
      </body>
    </html>
  );
}