"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════
   Interve AI — Input Component
   Text / Textarea / Password
   Luminous Light Design System v1.0
   ═══════════════════════════════════════ */

export interface InterveInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Visual size */
  inputSize?: "lg" | "md" | "sm";
  /** Validation state */
  state?: "default" | "focus" | "error" | "success" | "disabled";
  /** Error message text */
  errorMessage?: string;
  /** Hint text below input */
  hint?: string;
  /** Left icon */
  prefixIcon?: React.ReactNode;
  /** Right icon */
  suffixIcon?: React.ReactNode;
  /** Show clear button when input has value */
  allowClear?: boolean;
  /** Show character count (for textarea variant, use InterveTextarea) */
  showCount?: boolean;
  /** Max character count */
  maxCount?: number;
  /** Label above input */
  label?: string;
}

const sizeMap = {
  lg: "h-12 px-4 text-[15px] rounded-[var(--radius-md)]",
  md: "h-10 px-3.5 text-[14px] rounded-[var(--radius-md)]",
  sm: "h-8 px-3 text-[13px] rounded-[var(--radius-sm)]",
};

const iconSizeMap = {
  lg: "w-5 h-5",
  md: "w-4 h-4",
  sm: "w-3.5 h-3.5",
};

export const InterveInput = React.forwardRef<
  HTMLInputElement,
  InterveInputProps
>(
  (
    {
      inputSize = "md",
      state = "default",
      errorMessage,
      hint,
      prefixIcon,
      suffixIcon,
      allowClear = false,
      showCount = false,
      maxCount,
      label,
      className,
      disabled,
      onChange,
      value: controlledValue,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState(
      defaultValue?.toString() ?? ""
    );
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled
      ? controlledValue?.toString() ?? ""
      : internalValue;

    const computedState = disabled ? "disabled" : state;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternalValue(e.target.value);
      onChange?.(e);
    };

    const handleClear = () => {
      if (!isControlled) setInternalValue("");
      const nativeEvent = new Event("input", { bubbles: true });
      const syntheticEvent = {
        target: { value: "" },
        currentTarget: { value: "" },
        nativeEvent,
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      onChange?.(syntheticEvent);
    };

    const stateStyles: Record<string, string> = {
      default:
        "border-[var(--interve-border)] bg-white/90 text-[var(--interve-text-title)] hover:border-[var(--interve-border-hover)] hover:bg-white",
      focus: "border-[var(--interve-border-focus)] bg-white",
      error:
        "border-[var(--interve-danger-text)]/30 bg-[var(--interve-danger-surface)]/30",
      success:
        "border-[var(--interve-success-text)]/30 bg-[var(--interve-success-surface)]/30",
      disabled:
        "border-[var(--interve-border)] bg-[#F7F8FA] text-[var(--interve-text-disabled)] cursor-not-allowed",
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-[13px] font-medium text-[var(--interve-text-body)]">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {prefixIcon && (
            <span
              className={cn(
                "absolute left-3 text-[var(--interve-text-secondary)] pointer-events-none",
                iconSizeMap[inputSize]
              )}
            >
              {prefixIcon}
            </span>
          )}

          <input
            ref={ref}
            disabled={disabled}
            value={currentValue}
            onChange={handleChange}
            maxLength={maxCount}
            className={cn(
              "w-full border outline-none",
              "backdrop-filter blur-[16px]",
              "transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
              "placeholder:text-[var(--interve-text-placeholder)]",
              "interve-focus-glow",
              sizeMap[inputSize],
              stateStyles[computedState],
              prefixIcon && "pl-10",
              (suffixIcon || allowClear) && "pr-10",
              className
            )}
            {...props}
          />

          {allowClear && currentValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 text-[var(--interve-text-placeholder)] hover:text-[var(--interve-text-secondary)] transition-colors duration-[var(--motion-micro)]"
              aria-label="Clear input"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 6L6 18M6 6l12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}

          {suffixIcon && !allowClear && (
            <span
              className={cn(
                "absolute right-3 text-[var(--interve-text-secondary)]",
                iconSizeMap[inputSize]
              )}
            >
              {suffixIcon}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          {computedState === "error" && errorMessage && (
            <span className="text-[12px] text-[var(--interve-danger-text)]">
              {errorMessage}
            </span>
          )}
          {computedState !== "error" && hint && (
            <span className="text-[12px] text-[var(--interve-text-secondary)]">
              {hint}
            </span>
          )}
          {showCount && maxCount && (
            <span className="text-[12px] text-[var(--interve-text-secondary)] ml-auto">
              {currentValue.length}/{maxCount}
            </span>
          )}
        </div>
      </div>
    );
  }
);

InterveInput.displayName = "InterveInput";

/* ═══════════════════════════════════════
   Textarea variant
   ═══════════════════════════════════════ */
export interface InterveTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  inputSize?: "lg" | "md" | "sm";
  state?: "default" | "error" | "success" | "disabled";
  errorMessage?: string;
  hint?: string;
  showCount?: boolean;
  maxCount?: number;
  label?: string;
  /** Auto-resize height */
  autoResize?: boolean;
}

export const InterveTextarea = React.forwardRef<
  HTMLTextAreaElement,
  InterveTextareaProps
>(
  (
    {
      inputSize = "md",
      state = "default",
      errorMessage,
      hint,
      showCount = false,
      maxCount,
      label,
      autoResize = false,
      className,
      disabled,
      onChange,
      value: controlledValue,
      defaultValue,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;
    const [internalValue, setInternalValue] = React.useState(
      defaultValue?.toString() ?? ""
    );
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled
      ? controlledValue?.toString() ?? ""
      : internalValue;

    const computedState = disabled ? "disabled" : state;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) setInternalValue(e.target.value);
      onChange?.(e);

      if (autoResize && textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 300)}px`;
      }
    };

    const fontSizeMap = {
      lg: "text-[15px]",
      md: "text-[14px]",
      sm: "text-[13px]",
    };

    const stateStyles: Record<string, string> = {
      default:
        "border-[var(--interve-border)] bg-white/90 hover:border-[var(--interve-border-hover)]",
      error:
        "border-[var(--interve-danger-text)]/30 bg-[var(--interve-danger-surface)]/30",
      success:
        "border-[var(--interve-success-text)]/30 bg-[var(--interve-success-surface)]/30",
      disabled:
        "border-[var(--interve-border)] bg-[#F7F8FA] text-[var(--interve-text-disabled)] cursor-not-allowed",
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-[13px] font-medium text-[var(--interve-text-body)]">
            {label}
          </label>
        )}

        <textarea
          ref={textareaRef}
          disabled={disabled}
          value={currentValue}
          onChange={handleChange}
          maxLength={maxCount}
          className={cn(
            "w-full min-h-[100px] border outline-none resize-y",
            "p-3.5 rounded-[var(--radius-md)]",
            "backdrop-filter blur-[16px]",
            "transition-all duration-[var(--motion-fast)] ease-[var(--ease-primary)]",
            "placeholder:text-[var(--interve-text-placeholder)]",
            "interve-focus-glow",
            "text-[var(--interve-text-title)]",
            fontSizeMap[inputSize],
            stateStyles[computedState],
            autoResize && "resize-none overflow-hidden",
            className
          )}
          {...props}
        />

        <div className="flex items-center justify-between">
          {computedState === "error" && errorMessage && (
            <span className="text-[12px] text-[var(--interve-danger-text)]">
              {errorMessage}
            </span>
          )}
          {computedState !== "error" && hint && (
            <span className="text-[12px] text-[var(--interve-text-secondary)]">
              {hint}
            </span>
          )}
          {showCount && maxCount && (
            <span className="text-[12px] text-[var(--interve-text-secondary)] ml-auto">
              {currentValue.length}/{maxCount}
            </span>
          )}
        </div>
      </div>
    );
  }
);

InterveTextarea.displayName = "InterveTextarea";
