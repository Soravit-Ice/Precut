import { useMemo, useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Trash2, FileText, X } from "lucide-react";
import { Button, Input, Checkbox, Dialog } from "../components/ui/primitives";
import { clock, useStore, mutate, safe } from "../lib/store";
import { useT } from "../lib/i18n";
import { formatTime } from "../../../../packages/core/src/timeline";
import type { Word } from "../../../../packages/shared/src/contracts";
export function Transcript() {
  const snap = useStore((s) => s.snapshot)!,
    t = useT();
  const [query, setQuery] = useState(""),
    [reviewOnly, setReviewOnly] = useState(false),
    [showRemoved, setShowRemoved] = useState(true),
    [selected, setSelected] = useState<Word[]>([]),
    [time, setTime] = useState(0);
  const [correcting, setCorrecting] = useState<Word | undefined>(),
    [correctText, setCorrectText] = useState(""),
    [startMs, setStartMs] = useState(0),
    [endMs, setEndMs] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const removed = (w: Word) =>
    snap.suggestions.some(
      (s) =>
        s.status === "accepted" && w.startUs < s.endUs && w.endUs > s.startUs,
    );
  const rows = useMemo(() => {
    const grouped = new Map<string, Word[]>();
    for (const word of snap.words) {
      const group = grouped.get(word.segmentId) ?? [];
      group.push(word);
      grouped.set(word.segmentId, group);
    }
    return snap.segments
      .map((segment) => ({ segment, words: grouped.get(segment.id) ?? [] }))
      .filter(
        (row) =>
          (!reviewOnly ||
            row.words.some(
              (w) =>
                w.reviewReason ||
                (!w.corrected && w.confidence < 0.55) ||
                w.timingQuality === "estimated",
            )) &&
          (!query ||
            row.words
              .map((word) => word.joiner + word.text)
              .join("")
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (showRemoved || row.words.some((word) => !removed(word))),
      );
  }, [
    snap.segments,
    snap.words,
    snap.suggestions,
    query,
    showRemoved,
    reviewOnly,
  ]);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroll.current,
    estimateSize: () => 91,
    overscan: 5,
  });
  useEffect(() => {
    let last = 0;
    return clock.subscribe(() => {
      if (performance.now() - last > 150) {
        last = performance.now();
        setTime(clock.currentUs);
      }
    });
  }, []);
  const select = (w: Word, shift: boolean) => {
    clock.seek?.(w.startUs);
    if (shift && selected[0]) {
      const first = Math.min(selected[0].index, w.index),
        last = Math.max(selected[0].index, w.index);
      setSelected(
        snap.words.filter((w) => w.index >= first && w.index <= last),
      );
    } else setSelected([w]);
    const suggestion = snap.suggestions.find(
      (s) => w.startUs < s.endUs && w.endUs > s.startUs,
    );
    if (suggestion) useStore.getState().set({ reviewId: suggestion.id });
  };
  return (
    <section className="transcript-section">
      <div className="transcript-toolbar">
        <div className="transcript-tabs">
          <span className="selected">{t("Transcript")}</span>
          <span>{snap.words.length.toLocaleString()} words</span>
        </div>
        <div className="transcript-actions">
          {snap.analysisSummary?.reviewWords ? (
            <Button
              size="sm"
              variant={reviewOnly ? "outline" : "ghost"}
              onClick={() => setReviewOnly(!reviewOnly)}
            >
              {t("Needs review")} · {snap.analysisSummary.reviewWords}
            </Button>
          ) : null}
          {selected.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                safe(async () => {
                  await mutate("edits.manual", {
                    projectId: snap.project.id,
                    startUs: selected[0].startUs,
                    endUs: selected.at(-1)!.endUs,
                  });
                  setSelected([]);
                })
              }
            >
              <Trash2 size={13} />
              {t("Remove selection")}
            </Button>
          )}
          <Checkbox
            checked={showRemoved}
            onCheckedChange={setShowRemoved}
            label={t("Show removed")}
          />
          <div className="transcript-search">
            <Search size={13} />
            <Input
              placeholder={t("Search transcript")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label={t("Clear search")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="transcript-scroll" ref={scroll}>
        {!rows.length ? (
          <div className="transcript-empty">
            <FileText size={25} />
            <h3>
              {t(
                snap.analysis?.complete
                  ? "No speech detected"
                  : "No transcript yet",
              )}
            </h3>
            <p>
              {t(
                snap.analysis?.complete
                  ? "Review silence cuts in Cleanup."
                  : "Speech appears here as your recording is analyzed.",
              )}
            </p>
          </div>
        ) : (
          <div style={{ height: virtual.getTotalSize(), position: "relative" }}>
            {virtual.getVirtualItems().map((item) => {
              const row = rows[item.index];
              const labels = snap.suggestions.filter(
                (s) =>
                  s.startUs < row.segment.endUs &&
                  s.endUs > row.segment.startUs &&
                  s.category !== "pause" &&
                  s.category !== "silence",
              );
              return (
                <div
                  key={row.segment.id}
                  data-index={item.index}
                  ref={virtual.measureElement}
                  className="transcript-row"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <button
                    className="transcript-timestamp"
                    onClick={() => clock.seek?.(row.segment.startUs)}
                  >
                    {formatTime(row.segment.startUs)}
                  </button>
                  <div className="transcript-line">
                    <p>
                      {row.words.map((w) => (
                        <button
                          key={w.id}
                          title={
                            w.reviewReason ??
                            `${w.timingQuality === "estimated" ? t("Estimated timing · Review before precise word animations") : t("Word timing · Review against the audio")} · ${w.timingSource ?? "token"}`
                          }
                          className={`transcript-word ${w.reviewReason || (!w.corrected && w.confidence < 0.55) || w.timingQuality === "estimated" ? "uncertain" : ""} ${removed(w) ? "removed" : ""} ${time >= w.startUs && time < w.endUs ? "spoken" : ""} ${selected.some((s) => s.id === w.id) ? "word-selected" : ""} ${snap.suggestions.some((s) => s.status === "pending" && s.category === "filler" && s.wordIds.includes(w.id)) ? "filler-word" : ""}`}
                          onClick={(e) => select(w, e.shiftKey)}
                          onDoubleClick={() => {
                            setCorrecting(w);
                            setCorrectText(w.text);
                            setStartMs(Math.round(w.startUs / 1000));
                            setEndMs(Math.round(w.endUs / 1000));
                          }}
                        >
                          {w.joiner}
                          {w.text}
                        </button>
                      ))}
                    </p>
                    {labels.length > 0 && (
                      <div className="transcript-labels">
                        {labels.map((s) => (
                          <button
                            key={s.id}
                            className={`transcript-category ${s.status === "accepted" ? "applied" : ""}`}
                            onClick={() => {
                              useStore.getState().set({ reviewId: s.id });
                              clock.seek?.(s.startUs);
                            }}
                          >
                            {s.category.replace("-", " ")}
                            {s.status === "accepted" ? " · removed" : ""}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="transcript-footer">
        <span>
          <span className="status-dot" />
          {t("Local transcript")}
        </span>
        <span>
          {t(
            "Click to seek \u00b7 Shift-click to select \u00b7 Double-click to correct",
          )}
        </span>
      </div>
      <Dialog
        open={Boolean(correcting)}
        onOpenChange={(open) => {
          if (!open) setCorrecting(undefined);
        }}
        title={t("Correct word")}
        description={t("Check the word and its timing against your recording.")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCorrecting(undefined)}>
              {t("Cancel")}
            </Button>
            <Button
              disabled={!correctText.trim() || endMs <= startMs}
              onClick={() =>
                safe(async () => {
                  await mutate("captions.correct", {
                    projectId: snap.project.id,
                    wordId: correcting!.id,
                    text: correctText.trim(),
                    startUs: Math.round(startMs * 1000),
                    endUs: Math.round(endMs * 1000),
                  });
                  setCorrecting(undefined);
                })
              }
            >
              {t("Save")}
            </Button>
          </>
        }
      >
        <label className="dialog-field">
          <span>{t("Word")}</span>
          <Input
            value={correctText}
            onChange={(event) => setCorrectText(event.target.value)}
            maxLength={200}
          />
        </label>
        <div className="timing-fields">
          <label>
            {t("Start (ms)")}
            <Input
              type="number"
              min={0}
              value={startMs}
              onChange={(event) => setStartMs(Number(event.target.value))}
            />
          </label>
          <label>
            {t("End (ms)")}
            <Input
              type="number"
              min={0}
              value={endMs}
              onChange={(event) => setEndMs(Number(event.target.value))}
            />
          </label>
        </div>
        <p className="muted">
          {t(
            correcting?.timingQuality === "estimated"
              ? "Estimated timing · Review before precise word animations"
              : "Word timing · Review against the audio",
          )}{" "}
          · {Math.round((correcting?.confidence ?? 0) * 100)}%
        </p>
        <Button
          variant="outline"
          onClick={() => clock.seek?.(Math.max(0, startMs * 1000 - 200000))}
        >
          {t("Listen in context")}
        </Button>
      </Dialog>
    </section>
  );
}
