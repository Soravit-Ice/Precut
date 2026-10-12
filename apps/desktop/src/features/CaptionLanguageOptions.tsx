import type { CaptionStyle } from "../../../../packages/shared/src/contracts";
import { useT } from "../lib/i18n";

export function CaptionLanguageOptions({
  value,
  onChange,
}: {
  value?: CaptionStyle["languageMode"];
  onChange: (mode: NonNullable<CaptionStyle["languageMode"]>) => void;
}) {
  const t = useT();
  return (
    <div
      className="caption-language-options"
      role="group"
      aria-label={t("Caption language")}
    >
      {(["th", "th-en", "en"] as const).map((mode, i) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          {["ไทย", "ไทย + English", "English"][i]}
        </button>
      ))}
    </div>
  );
}
