import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datasets · DSA",
  description: "Upload CSV or JSON once, then reuse rows, columns, format, and hash.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
