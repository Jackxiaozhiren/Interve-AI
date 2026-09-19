// F1-2: dashboard 静态壳（server）。交互（auth 门、modal context、
// pathname 导航、动效）收拢于 ./dashboard-shell 岛；行为与拆分前一致。
import type { ReactNode } from "react";
import { DashboardShell } from "./dashboard-shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
