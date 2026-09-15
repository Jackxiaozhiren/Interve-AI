"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ─── DataTable ────────────────────────────────────────────────
   全站统一数据表：排序 + 空态 + 横滚（移动端 390px 无溢出）。
   来源：shadcn/ui Table。
   https://ui.shadcn.com/docs/components/base/table
---------------------------------------------------------------- */

export interface DataTableColumn<T> {
  key: string;
  label: string;
  /** 允许点击表头排序（按行数据的该字段字符串/数字比较） */
  sortable?: boolean;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** 行唯一键 */
  rowKey: (row: T, index: number) => string;
  /** 空态文案 */
  emptyTitle?: string;
  emptyDescription?: string;
  /** 行点击（如打开详情抽屉） */
  onRowClick?: (row: T) => void;
  caption?: string;
  className?: string;
}

type SortDir = "asc" | "desc";

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  emptyTitle = "暂无数据",
  emptyDescription,
  onRowClick,
  caption,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const sorted = React.useMemo(() => {
    if (!sortKey) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return sortDir === "asc" ? copy : copy.reverse();
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className} aria-sort={sortKey === col.key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}>
                {col.sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 uppercase hover:text-slate-900"
                    aria-label={`按${col.label}排序`}
                  >
                    {col.label}
                    <span aria-hidden="true" className="text-[10px]">
                      {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "△"}
                    </span>
                  </button>
                ) : (
                  col.label
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? "button" : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-10 text-center">
                <p className="font-medium text-slate-700">{emptyTitle}</p>
                {emptyDescription && <p className="mt-1 text-slate-400">{emptyDescription}</p>}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
