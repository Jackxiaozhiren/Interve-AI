import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reports · DSA",
  description: "Markdown reports generated from verified runs.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
