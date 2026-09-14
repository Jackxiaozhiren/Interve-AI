import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research · DSA",
  description: "How DSA keeps every claim traceable and reproducible.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
