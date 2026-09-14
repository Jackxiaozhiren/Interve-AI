import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Runs · DSA",
  description: "Every analysis run with status, evidence, and replay.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
