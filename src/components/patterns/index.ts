/**
 * Pattern layer (§12.10) — combinations of primitives with layout conventions.
 * A pattern may import from primitives/ (and ui/ while the physical home is
 * there); a primitive must never import from patterns/ or any domain. Enforced
 * by tests/unit/s2-layering.test.ts.
 */
export { SpotlightCard } from "@/components/ui/spotlight-card";
export { PageHeader } from "@/components/data/PageHeader";
export { StatusBadge } from "@/components/data/StatusBadge";
export { InterveEmptyState, EMPTY_ICONS } from "@/components/interve-ui/empty-state";
