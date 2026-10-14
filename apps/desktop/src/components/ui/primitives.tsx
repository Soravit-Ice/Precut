import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
const buttonVariants = cva("button", {
  variants: {
    variant: {
      default: "button-primary",
      secondary: "button-secondary",
      ghost: "button-ghost",
      outline: "button-outline",
      danger: "button-danger",
    },
    size: { default: "", sm: "button-sm", icon: "button-icon" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("input", className)} {...props} />
));
Input.displayName = "Input";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  trigger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  trigger?: React.ReactNode;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  const previousFocus = React.useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          ref={contentRef}
          className={`dialog-content ${className ?? ""}`}
          onOpenAutoFocus={(event) => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            const target = contentRef.current?.querySelector<HTMLElement>(
              "[data-dialog-autofocus]",
            );
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onCloseAutoFocus={(event) => {
            // Controlled dialogs can open without a Radix Trigger. Restore
            // keyboard focus to the button that opened them when it still exists.
            const target = previousFocus.current;
            if (!trigger && target?.isConnected && target !== document.body) {
              event.preventDefault();
              target.focus();
            }
          }}
        >
          <DialogPrimitive.Title className="dialog-title">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="dialog-description">
              {description}
            </DialogPrimitive.Description>
          )}
          <DialogPrimitive.Close className="dialog-close" aria-label="Close">
            <X size={18} />
          </DialogPrimitive.Close>
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Select({
  value,
  onValueChange,
  options,
  label,
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
}) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label;
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className="select-trigger"
        aria-label={label}
        title={selectedLabel}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon className="select-chevron">
          <ChevronDown size={14} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          hideWhenDetached
          className="select-content"
          aria-label={label}
          onKeyDown={(event) => {
            if (event.key !== "PageDown" && event.key !== "PageUp") return;
            const viewport = viewportRef.current;
            if (!viewport) return;
            const items = Array.from(
              viewport.querySelectorAll<HTMLElement>(
                '[role="option"]:not([data-disabled])',
              ),
            );
            const current = items.indexOf(
              document.activeElement as HTMLElement,
            );
            const rowHeight = items[current]?.offsetHeight || 36;
            const step = Math.max(
              1,
              Math.floor(viewport.clientHeight / rowHeight) - 1,
            );
            const next = Math.min(
              items.length - 1,
              Math.max(0, current + (event.key === "PageDown" ? step : -step)),
            );
            event.preventDefault();
            items[next]?.focus({ preventScroll: true });
            items[next]?.scrollIntoView({ block: "nearest" });
          }}
        >
          <SelectPrimitive.ScrollUpButton className="select-scroll-button">
            <ChevronUp size={15} />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport
            ref={viewportRef}
            className="select-viewport"
          >
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="select-item"
              >
                <SelectPrimitive.ItemText className="select-item-text">
                  {o.label}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="select-item-indicator">
                  <Check size={14} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="select-scroll-button">
            <ChevronDown size={15} />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  label,
}: {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}) {
  return (
    <SliderPrimitive.Root
      className="slider"
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
      aria-label={label}
    >
      <SliderPrimitive.Track className="slider-track">
        <SliderPrimitive.Range className="slider-range" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="slider-thumb" />
    </SliderPrimitive.Root>
  );
}
export function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tooltip" sideOffset={6}>
          {text}
          <TooltipPrimitive.Arrow />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export const TooltipProvider = TooltipPrimitive.Provider;
export function Checkbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="checkbox-box">
        <Check size={12} />
      </span>
      <span>{label}</span>
    </label>
  );
}
