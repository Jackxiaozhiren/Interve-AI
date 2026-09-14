"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Card } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/data/StateBlocks";
import { cn } from "@/lib/utils";

// Source: https://ui.shadcn.com/docs/components/table (sortable wrapper, Tailwind v3)
export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "No data yet",
  emptyDescription = "There is nothing to show here.",
  emptyAction,
  ariaLabel = "Data table",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  ariaLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const fallback = (r: T): string => {
        const rec = r as unknown as Record<string, unknown>;
        const v = rec[col.key];
        return String(v ?? "");
      };
      const av = col.sortValue ? col.sortValue(a) : fallback(a);
      const bv = col.sortValue ? col.sortValue(b) : fallback(b);
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  if (rows.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="w-full overflow-x-auto">
        <Table aria-label={ariaLabel}>
          <TableHeader>
            <TableRow className="bg-zinc-50/80">
              {columns.map((c) => (
                <TableHead key={c.key} className={cn("whitespace-nowrap", c.className)}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (sortKey !== c.key) {
                          setSortKey(c.key);
                          setSortDir("asc");
                        } else {
                          setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        }
                      }}
                      className="inline-flex items-center gap-1 hover:text-zinc-900"
                      aria-label={`Sort by ${c.header}`}
                    >
                      {c.header}
                      <ArrowUpDown className="h-3 w-3" aria-hidden />
                    </button>
                  ) : (
                    c.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow key={rowKey(row, i)}>{columns.map((c) => (
                <TableCell key={c.key} className={cn("whitespace-nowrap", c.className)}>
                  {c.render(row)}
                </TableCell>
              ))}</TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
