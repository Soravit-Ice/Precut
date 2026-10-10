import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Input } from "../components/ui/primitives";
const swatches = [
  "#FFFFFF",
  "#36C5FF",
  "#FFE066",
  "#A3E635",
  "#FB7185",
  "#C4B5FD",
  "#111827",
];
export function CaptionColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const commit = (raw: string) => {
    const color = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      onChange(color.toUpperCase());
      setHex(color.toUpperCase());
    } else setHex(value);
  };
  return (
    <div className="caption-color-control">
      <div className="caption-color-heading">
        <span>{label}</span>
        <div>
          <input
            className="color-input"
            type="color"
            aria-label={label}
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
          />
          <Input
            value={hex}
            aria-label={`${label} hex`}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              setHex(e.target.value);
              if (/^#[0-9a-f]{6}$/i.test(e.target.value))
                onChange(e.target.value.toUpperCase());
            }}
            onBlur={() => commit(hex)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(hex);
            }}
          />
        </div>
      </div>
      <div className="caption-color-swatches">
        {swatches.map((color) => (
          <button
            key={color}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`${label} ${color}`}
            aria-pressed={value.toUpperCase() === color}
            onClick={() => onChange(color)}
          >
            {value.toUpperCase() === color && (
              <Check
                size={13}
                color={color === "#111827" ? "white" : "#111827"}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
