import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Failures · DSA",
  description: "Failure cases and what they teach about evidence quality.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
