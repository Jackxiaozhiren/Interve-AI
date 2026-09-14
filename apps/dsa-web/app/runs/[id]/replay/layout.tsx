import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Replay · DSA",
  description: "Replay a run end-to-end and compare the trace.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
