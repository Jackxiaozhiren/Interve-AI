import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Benchmarks · DSA",
  description: "V1 vs V2 on task success, evidence accuracy, and SQL accuracy.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
