/* ═══════════════════════════════════════
   Interve AI — Component Library
   Base Components Barrel Export
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

// ── Button ──
export { InterveButton } from "./button";
export type { InterveButtonProps } from "./button";

// ── Input ──
export { InterveInput, InterveTextarea } from "./input";
export type { InterveInputProps, InterveTextareaProps } from "./input";

// ── Select ──
export { InterveSelect } from "./select";
export type { InterveSelectProps, SelectOption } from "./select";

// ── Switch ──
export { InterveSwitch } from "./switch";
export type { InterveSwitchProps } from "./switch";

// ── Slider ──
export { InterveSlider } from "./slider";
export type { InterveSliderProps } from "./slider";

// ── Tag & Badge ──
export { InterveTag, InterveBadge } from "./tag";
export type { InterveTagProps, InterveBadgeProps, TagColor } from "./tag";

// ── Modal ──
export { InterveModal, InterveConfirm } from "./modal";
export type { InterveModalProps, InterveConfirmProps } from "./modal";

// ── Drawer ──
export { InterveDrawer } from "./drawer";
export type { InterveDrawerProps } from "./drawer";

// ── Navigation ──
export {
  InterveTopNav,
  InterveNavLink,
  InterveSidebar,
  InterveSidebarItem,
  InterveBreadcrumb,
} from "./navigation";
export type {
  InterveTopNavProps,
  InterveNavLinkProps,
  InterveSidebarProps,
  InterveSidebarItemProps,
  InterveBreadcrumbProps,
  BreadcrumbItem,
} from "./navigation";

// ── Pagination ──
export { IntervePagination } from "./pagination";
export type { IntervePaginationProps } from "./pagination";

// ── Loading ──
export {
  InterveDotsLoader,
  IntervePageLoader,
  InterveSpinner,
  InterveSkeleton,
  InterveProgress,
} from "./loading";
export type {
  InterveDotsLoaderProps,
  IntervePageLoaderProps,
  InterveSpinnerProps,
  InterveSkeletonProps,
  InterveProgressProps,
} from "./loading";

// ── Empty State ──
export { InterveEmptyState, EMPTY_ICONS } from "./empty-state";
export type { InterveEmptyStateProps } from "./empty-state";

// ── Toast ──
export { InterveToastProvider, useInterveToast } from "./toast";
export type { ToastType, ToastItem } from "./toast";
