import { useRef } from "react";
export function Resizer({
  value,
  min,
  max,
  onChange,
  orientation,
  label,
  invert = false,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  orientation: "horizontal" | "vertical";
  label: string;
  invert?: boolean;
}) {
  const drag = useRef<{ coordinate: number; value: number } | undefined>(
    undefined,
  );
  const clamp = (next: number) =>
    Math.round(Math.max(min, Math.min(max, next)));
  return (
    <div
      className={`pane-resizer ${orientation}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={(event) => {
        drag.current = {
          coordinate:
            orientation === "vertical" ? event.clientX : event.clientY,
          value,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const coordinate =
          orientation === "vertical" ? event.clientX : event.clientY;
        onChange(
          clamp(
            drag.current.value +
              (coordinate - drag.current.coordinate) * (invert ? -1 : 1),
          ),
        );
      }}
      onPointerUp={() => {
        drag.current = undefined;
      }}
      onKeyDown={(event) => {
        if (
          ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          onChange(
            clamp(
              value +
                (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1) *
                  (invert ? -1 : 1) *
                  20,
            ),
          );
        }
      }}
    />
  );
}
