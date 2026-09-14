import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ask · DSA",
  description: "Pick a dataset, ask in plain English, and get a traced, evidence-linked answer.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
