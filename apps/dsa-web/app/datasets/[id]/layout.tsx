import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dataset · DSA",
  description: "Profile, schema, preview, and lineage for one dataset.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
