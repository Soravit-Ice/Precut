import { Scissors, Subtitles } from "lucide-react";
import { CleanupInspector, CaptionInspector } from "./Inspector";
import { useStore } from "../lib/store";
import { useT } from "../lib/i18n";

export function TranscriptInspector() {
  const tool = useStore((s) => s.transcriptTool),
    t = useT();
  return (
    <div className="transcript-inspector">
      <div
        className="transcript-tool-tabs"
        role="tablist"
        aria-label={t("Transcript tools")}
      >
        {(
          [
            { id: "cleanup", label: "Review edits", icon: Scissors },
            { id: "captions", label: "Captions", icon: Subtitles },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            id={`transcript-tool-${id}`}
            aria-selected={tool === id}
            tabIndex={tool === id ? 0 : -1}
            aria-controls="transcript-tool-panel"
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              event.stopPropagation();
              const next =
                event.key === "Home"
                  ? "cleanup"
                  : event.key === "End"
                    ? "captions"
                    : tool === "cleanup"
                      ? "captions"
                      : "cleanup";
              useStore.getState().set({ transcriptTool: next });
              document.getElementById(`transcript-tool-${next}`)?.focus();
            }}
            onClick={() => useStore.getState().set({ transcriptTool: id })}
          >
            <Icon size={14} />
            {t(label)}
          </button>
        ))}
      </div>
      <div
        className="transcript-tool-panel"
        id="transcript-tool-panel"
        role="tabpanel"
        aria-labelledby={`transcript-tool-${tool}`}
      >
        {tool === "captions" ? <CaptionInspector /> : <CleanupInspector />}
      </div>
    </div>
  );
}
