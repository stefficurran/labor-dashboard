import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Growing Markets | Labor Dashboard",
  openGraph: {
    images: [{ url: "/api/og?type=kpi&id=growth", width: 1200, height: 630 }],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
