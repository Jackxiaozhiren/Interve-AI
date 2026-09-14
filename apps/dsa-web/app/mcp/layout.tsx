import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP · DSA",
  description: "Model Context Protocol surface for DSA tools.",
};

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
