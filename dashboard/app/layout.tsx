import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DataProvider } from "./components/DataProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tech Labor Economics Dashboard",
  description: "Hiring trends in the tech sector based on BLS/FRED public data",
  openGraph: {
    title: "Tech Labor Economics Dashboard",
    description: "Weekly intelligence briefing on U.S. tech labor market trends",
    images: [{ url: "/api/og?type=summary", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tech Labor Economics Dashboard",
    description: "Weekly intelligence briefing on U.S. tech labor market trends",
    images: ["/api/og?type=summary"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100`}
      >
        <DataProvider>{children}</DataProvider>
      </body>
    </html>
  );
}
