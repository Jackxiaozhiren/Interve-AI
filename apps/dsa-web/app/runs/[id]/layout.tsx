import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Run · DSA",
  description: "Inspect one run: plan, evidence, and artifacts.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
