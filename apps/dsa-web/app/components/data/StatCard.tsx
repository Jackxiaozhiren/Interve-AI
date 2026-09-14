import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";

// Source: https://github.com/shadcndashboard/next-shadcn-dashboard (Stat grid structure, restyled to zinc minimal)
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
          {Icon ? <Icon className="h-4 w-4 text-zinc-400" aria-hidden /> : null}
        </div>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-zinc-900" title={value}>
          {value}
        </p>
        {hint ? <p className="mt-1 truncate text-xs leading-6 text-zinc-500" title={hint}>{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
