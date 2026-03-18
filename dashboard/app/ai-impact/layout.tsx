import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Release Impact | Labor Dashboard",
  openGraph: {
    images: [{ url: "/api/og?type=summary", width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
