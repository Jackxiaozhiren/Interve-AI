"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* 轻量 Tabs（shadcn/ui Tabs 行为子集，无障碍：role=tablist/tab/tabpanel，
   方向键切换）。来源：shadcn/ui Tabs。
   https://ui.shadcn.com/docs/components/base/tabs */

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  idPrefix: string;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [inner, setInner] = React.useState(defaultValue ?? "");
  const idPrefix = React.useId();
  const current = value ?? inner;
  const setValue = React.useCallback(
    (v: string) => {
      setInner(v);
      onValueChange?.(v);
    },
    [onValueChange]
  );
  return (
    <TabsContext.Provider value={{ value: current, setValue, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger/TabsContent 必须在 <Tabs> 内使用");
  return ctx;
}

export function TabsList({ children, className, ...props }: React.ComponentProps<"div">) {
  const { value, setValue } = useTabs();
  const triggers = React.Children.toArray(children);
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      tabIndex={0}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1",
        className
      )}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const values = triggers
          .filter((c) => React.isValidElement(c))
          .map((c) => (c as React.ReactElement<{ value: string }>).props.value);
        const idx = values.indexOf(value);
        const next =
          e.key === "ArrowRight"
            ? values[(idx + 1) % values.length]
            : values[(idx - 1 + values.length) % values.length];
        if (next) {
          e.preventDefault();
          setValue(next);
          document.getElementById(`tab-${next}`)?.focus();
        }
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  ...props
}: { value: string } & Omit<React.ComponentProps<"button">, "value">) {
  const { value: current, setValue, idPrefix } = useTabs();
  const selected = current === value;
  return (
    <button
      id={`tab-${value}`}
      role="tab"
      type="button"
      aria-selected={selected}
      aria-controls={`${idPrefix}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        selected ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
  ...props
}: { value: string } & React.ComponentProps<"div">) {
  const { value: current, idPrefix } = useTabs();
  if (current !== value) return null;
  return (
    /* eslint-disable jsx-a11y/no-noninteractive-tabindex -- WAI-APG tabpanel pattern: focusable panel keeps keyboard scroll available; tablist arrow-key handling is untouched. */
    <div
      id={`${idPrefix}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`tab-${value}`}
      tabIndex={0}
      className={cn("pt-4 focus-visible:outline-none", className)}
      {...props}
    >
      {children}
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-tabindex */
  );
}
