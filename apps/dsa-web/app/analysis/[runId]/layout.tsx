import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Run · DSA",
  description: "Inspect plan, tool trace, evidence confidence, and report Markdown for one run.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
