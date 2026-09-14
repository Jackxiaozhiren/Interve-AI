import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evaluations · DSA",
  description: "Scored evaluation suites for DSA runs.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
