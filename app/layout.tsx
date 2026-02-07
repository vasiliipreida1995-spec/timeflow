import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import PublicShell from "../components/PublicShell";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Timeflow        ",
  description:
    "    ,     ,   .",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
