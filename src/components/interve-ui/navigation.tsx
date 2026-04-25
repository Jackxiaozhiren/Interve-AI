"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Navigation Components
   TopNav + Sidebar + Breadcrumb
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

/* ─── Top Navigation Bar ─── */
export interface InterveTopNavProps {
  logo?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  transparent?: boolean;
  className?: string;
}

export function InterveTopNav({
  logo,
  children,
  actions,
  transparent = false,
  className,
}: InterveTopNavProps) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 h-16 flex items-center px-6 lg:px-16",
        "transition-all duration-[var(--motion-moderate)] ease-[var(--ease-primary)]",
        transparent && !scrolled
          ? "bg-transparent"
          : "interve-glass-nav",
        className
      )}
    >
      {/* Logo */}
      <div className="shrink-0">{logo}</div>

      {/* Center nav items */}
      <nav className="flex-1 flex items-center justify-center gap-1">
        {children}
      </nav>

      {/* Right actions */}
      <div className="shrink-0 flex items-center gap-2">{actions}</div>
    </header>
  );
}

/* ─── Nav Link ─── */
export interface InterveNavLinkProps {
  href?: string;
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function InterveNavLink({
  href,
  active = false,
  children,
  onClick,
  className,
}: InterveNavLinkProps) {
  const Tag = href ? "a" : "button";

  const handleClick = (e: React.MouseEvent) => {
    if (onClick && href?.startsWith("#")) {
      e.preventDefault();
    }
    onClick?.();
  };

  return (
    <Tag
      href={href}
      onClick={handleClick}
      className={cn(
        "px-3 py-1.5 text-[14px] font-medium rounded-[var(--radius-sm)]",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
        active
          ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]"
          : "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)] hover:text-[var(--interve-text-title)]",
        className
      )}
    >
      {children}
    </Tag>
  );
}

/* ─── Sidebar ─── */
export interface InterveSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  header?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function InterveSidebar({
  collapsed = false,
  onToggle,
  header,
  children,
  footer,
  className,
}: InterveSidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col h-full w-[280px] interve-glass border-r border-[var(--interve-divider)]",
        "transition-[transform,box-shadow] duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]",
        collapsed
          ? "transform -translate-x-[216px] shadow-none"
          : "transform translate-x-0 shadow-[var(--interve-shadow-md)]",
        className
      )}
    >
      {/* Header */}
      {header && (
        <div
          className={cn(
            "px-4 py-4 border-b border-[var(--interve-divider)]",
            "transition-opacity duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]",
            collapsed ? "opacity-0" : "opacity-100"
          )}
        >
          {header}
        </div>
      )}

      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "mt-2 mb-1 flex items-center justify-center w-8 h-8",
          "rounded-[var(--radius-sm)] text-[var(--interve-text-secondary)]",
          "hover:bg-[var(--interve-bg-accent)] hover:text-[var(--interve-text-body)]",
          "transition-colors duration-[var(--motion-micro)]",
          collapsed ? "ml-auto mr-3" : "mx-3"
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={cn("transition-transform duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]", collapsed && "rotate-180")}>
          <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Content — staggered item animation */}
      <div
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden px-3 py-1",
          "transition-opacity duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]",
          collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
      >
        {React.Children.map(children, (child, index) => (
          <div
            className={cn(
              "transition-all duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]",
              collapsed
                ? "opacity-0 translate-x-5"
                : "opacity-100 translate-x-0"
            )}
            style={{
              transitionDelay: collapsed ? "0ms" : `${index * 50}ms`,
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className={cn(
            "px-4 py-3 border-t border-[var(--interve-divider)]",
            "transition-opacity duration-[350ms] ease-[cubic-bezier(0.2,0,0,1)]",
            collapsed ? "opacity-0" : "opacity-100"
          )}
        >
          {footer}
        </div>
      )}
    </aside>
  );
}

/* ─── Sidebar Item ─── */
export interface InterveSidebarItemProps {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  className?: string;
}

export function InterveSidebarItem({
  icon,
  label,
  active = false,
  collapsed = false,
  onClick,
  className,
}: InterveSidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-3 h-9 rounded-[var(--radius-sm)]",
        "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
        active
          ? "bg-[var(--interve-brand-surface)] text-[var(--interve-brand-accent)]"
          : "text-[var(--interve-text-body)] hover:bg-[var(--interve-bg-accent)]",
        collapsed ? "justify-center px-0" : "px-3",
        className
      )}
    >
      {icon && <span className="shrink-0 w-4 h-4">{icon}</span>}
      {!collapsed && (
        <span className="text-[14px] truncate">{label}</span>
      )}
    </button>
  );
}

/* ─── Breadcrumb ─── */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface InterveBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function InterveBreadcrumb({
  items,
  className,
}: InterveBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5", className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <React.Fragment key={i}>
            {item.href && !isLast ? (
              <a
                href={item.href}
                className="text-[13px] text-[var(--interve-text-secondary)] hover:text-[var(--interve-text-body)] transition-colors"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={cn(
                  "text-[13px]",
                  isLast
                    ? "text-[var(--interve-text-title)] font-medium"
                    : "text-[var(--interve-text-secondary)]"
                )}
              >
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-[var(--interve-text-placeholder)] text-[12px]">/</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
