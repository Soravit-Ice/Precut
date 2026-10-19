import { clock } from "../lib/source-clock";
import {
  sequenceEntries,
  toSequence,
  timelineFor,
  wordSelectionRange,
} from "../../../../packages/core/src/sequence";
import { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Search,
  Trash2,
  FileText,
  X,
  Pencil,
  Replace,
  Play,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  Button,
  Input,
  Checkbox,
  Dialog,
  Tooltip,
} from "../components/ui/primitives";
import { useStore, mutate, safe } from "../lib/store";
import { useT } from "../lib/i18n";
import { clock as sequenceClock } from "../lib/store";
import { formatTime } from "../../../../packages/core/src/timeline";
import { wordReplacements } from "../../../../packages/core/src/transcript";
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
  const [editMode, setEditMode] = useState(false),
    [timingOpen, setTimingOpen] = useState(false),
    [replaceOpen, setReplaceOpen] = useState(false),
    [findText, setFindText] = useState(""),
    [replacement, setReplacement] = useState(""),
    [matchCase, setMatchCase] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const textInput = useRef<HTMLInputElement>(null);
  const [timingDialog, setTimingDialog] = useState(false);
  const composing = useRef(false),
    savingWord = useRef(false),
    cancelledWord = useRef(false),
    listenTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wordDrag = useRef<{ first: Word; moved: boolean } | undefined>(
    undefined,
  );
  const full = useStore((s) => s.projectSnapshot),
    activeClipId = useStore((s) => s.activeClipId),
    sharedSelection = useStore((s) => s.selection);
  useLayoutEffect(() => {
    setSelected([]);
    setCorrecting(undefined);
    setTime(clock.currentUs);
    return () => clearTimeout(listenTimer.current);
  }, [activeClipId]);
  useEffect(() => {
    if (!full || !activeClipId || sharedSelection?.kind !== "range") {
      clearTimeout(listenTimer.current);
      setSelected([]);
      return;
    }
    const entries = sequenceEntries(full);
    if (sharedSelection.clipId && sharedSelection.clipId !== activeClipId) {
      setSelected([]);
      return;
    }
    if (sharedSelection.wordIds) {
      const ids = new Set(sharedSelection.wordIds);
      setSelected(snap.words.filter((w) => ids.has(w.id)));
      return;
    }
    setSelected(
      snap.words.filter((w) => {
        const start = toSequence(entries, activeClipId, w.startUs),
          end = toSequence(entries, activeClipId, w.endUs);
        return end > sharedSelection.startUs && start < sharedSelection.endUs;
      }),
    );
  }, [sharedSelection, full, activeClipId]);
  const beginCorrection = (word: Word) => {
    cancelledWord.current = false;
    clearTimeout(listenTimer.current);
    clock.pause();
    setTimingDialog(false);
    word =
      useStore.getState().snapshot?.words.find((w) => w.id === word.id) ?? word;
    setCorrecting(word);
    setCorrectText(word.text);
    setStartMs(Math.round(word.startUs / 1000));
    setEndMs(Math.round(word.endUs / 1000));
    setTimingOpen(false);
  };
  useLayoutEffect(() => {
    if (correcting) {
      textInput.current?.focus({ preventScroll: true });
      textInput.current?.select();
    }
  }, [correcting?.id]);
  const cutWords = async (words: Word[]) => {
    if (busy || savingWord.current || !words.length || !full || !activeClipId)
      return;
    const range = wordSelectionRange(
      full,
      activeClipId,
      words.map((w) => w.id),
    );
    if (!range || range.endUs <= range.startUs) return;
    clearTimeout(listenTimer.current);
    clock.pause();
    cancelledWord.current = true;
    savingWord.current = true;
    setBusy(true);
    try {
      await mutate("timeline.command", {
        projectId: snap.project.id,
        command: { type: "range.remove", ...range },
      });
      setCorrecting(undefined);
      setSelected([]);
      useStore.getState().set({ selection: undefined });
      setNotice(t("Word cut · Undo available"));
      return true;
    } finally {
      savingWord.current = false;
      setBusy(false);
    }
  };
  const saveCorrection = async (close = true) => {
    if (
      !correcting ||
      busy ||
      savingWord.current ||
      cancelledWord.current ||
      (timingOpen &&
        (!Number.isFinite(startMs) ||
          !Number.isFinite(endMs) ||
          startMs < 0 ||
          endMs <= startMs ||
          endMs * 1000 > snap.project.durationUs))
    )
      return;
    if (!correctText.trim()) return cutWords([correcting]);
    setBusy(true);
    savingWord.current = true;
    try {
      const timingChanged =
        timingOpen &&
        (startMs !== Math.round(correcting.startUs / 1000) ||
          endMs !== Math.round(correcting.endUs / 1000));
      if (correctText.trim() !== correcting.text || timingChanged)
        await mutate("captions.correct", {
          projectId: snap.project.id,
          wordId: correcting.id,
          text: correctText.trim(),
          ...(timingChanged
            ? {
                startUs: Math.round(startMs * 1000),
                endUs: Math.round(endMs * 1000),
              }
            : {}),
        });
      if (close) {
        setCorrecting(undefined);
        setSelected([]);
        useStore.getState().set({ selection: undefined });
        setNotice(t("Word updated · Undo available"));
      }
      return true;
    } finally {
      savingWord.current = false;
      setBusy(false);
    }
  };
  const replacements = useMemo(
    () => wordReplacements(snap.words, findText, replacement, matchCase),
    [snap.words, findText, replacement, matchCase],
  );
  const changes = replacements.filter((r) => r.text !== r.word.text);
  const context = snap.words.filter(
    (w) => w.segmentId === correcting?.segmentId,
  );
  const scroll = useRef<HTMLDivElement>(null);
  const removed = (w: Word) =>
    (full &&
      activeClipId &&
      timelineFor(full)
        .clips.find((c) => c.id === activeClipId)
        ?.removed.some((r) => w.startUs < r.endUs && w.endUs > r.startUs)) ||
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
    full?.timeline,
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
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        (e.target.closest('input, textarea, select, [role="dialog"]') ||
          e.target.isContentEditable)
      )
        return;
      if ((e.key === "F2" || e.key === "Enter") && selected.length) {
        e.preventDefault();
        beginCorrection(selected[0]);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setFindText(selected[0]?.text ?? query);
        setReplaceOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, query]);
  const select = (w: Word, shift: boolean) => {
    clock.seek?.(w.startUs);
    let next: Word[];
    if (shift && selected[0]) {
      const first = Math.min(selected[0].index, w.index),
        last = Math.max(selected[0].index, w.index);
      next = snap.words.filter((w) => w.index >= first && w.index <= last);
    } else next = [w];
    setSelected(next);
    if (full && activeClipId) {
      const entries = sequenceEntries(full);
      useStore.getState().set({
        selection: {
          kind: "range",
          clipId: activeClipId,
          wordIds: next.map((w) => w.id),
          startUs: toSequence(entries, activeClipId, next[0].startUs),
          endUs: toSequence(entries, activeClipId, next.at(-1)!.endUs),
        },
      });
    }
    const suggestion = snap.suggestions.find(
      (s) => w.startUs < s.endUs && w.endUs > s.startUs,
    );
    if (suggestion)
      useStore
        .getState()
        .set({ reviewId: suggestion.id, transcriptTool: "cleanup" });
  };
  return (
    <section className="transcript-section">
      {full && timelineFor(full).clips.length > 1 && (
        <label className="transcript-source-picker">
          <span>{t("Clip")}</span>
          <select
            aria-label={t("Transcript clip")}
            value={activeClipId}
            onChange={(event) => {
              const id = event.target.value;
              cancelledWord.current = true;
              clearTimeout(listenTimer.current);
              setCorrecting(undefined);
              setSelected([]);
              const fullSnap = useStore.getState().projectSnapshot ?? full;
              useStore.getState().set({
                activeClipId: id,
                selection: { kind: "clip", clipId: id },
              });
              const first = fullSnap
                ? sequenceEntries(fullSnap).find((e) => e.clipId === id)
                : undefined;
              if (first) sequenceClock.seek?.(first.startUs);
            }}
          >
            {timelineFor(full).clips.map((clip, i) => (
              <option key={clip.id} value={clip.id}>
                {i + 1}. {full.assets.find((a) => a.id === clip.assetId)?.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="transcript-toolbar">
        <div className="transcript-tabs">
          <span className="selected">{t("Transcript")}</span>
          <span>{snap.words.length.toLocaleString()} words</span>
        </div>
        <div className="transcript-actions">
          <Button
            size="sm"
            variant={editMode ? "outline" : "ghost"}
            aria-pressed={editMode}
            onClick={() => setEditMode(!editMode)}
          >
            <Pencil size={13} />
            {t("Edit text")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!snap.words.length}
            onClick={() => {
              setFindText(selected[0]?.text ?? query);
              setReplaceOpen(true);
            }}
          >
            <Replace size={13} />
            {t("Find & replace")}
          </Button>
          {snap.analysisSummary?.reviewWords ? (
            <Button
              size="sm"
              variant={reviewOnly ? "outline" : "ghost"}
              onClick={() => setReviewOnly(!reviewOnly)}
            >
              {t("Needs review")} · {snap.analysisSummary.reviewWords}
            </Button>
          ) : null}
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
      {(editMode || notice) && (
        <div className="transcript-edit-hint" role="status">
          {notice ? <Check size={12} /> : <Pencil size={12} />}
          <span>
            {notice ||
              t(
                "Click any word to change it. Your audio timing stays the same.",
              )}
          </span>
          {notice && (
            <button aria-label={t("Dismiss")} onClick={() => setNotice("")}>
              <X size={12} />
            </button>
          )}
        </div>
      )}
      <div className="transcript-scroll" ref={scroll}>
        {!rows.length ? (
          <div className="transcript-empty">
            <FileText size={25} />
            <h3>
              {t(
                query || reviewOnly
                  ? "No matching words"
                  : snap.analysis?.complete
                    ? "No speech detected"
                    : "No transcript yet",
              )}
            </h3>
            <p>
              {t(
                query || reviewOnly
                  ? "Try another search or turn off the review filter."
                  : snap.analysis?.complete
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
                      {row.words
                        .filter((w) => showRemoved || !removed(w))
                        .map((w) =>
                          correcting?.id === w.id && !timingDialog ? (
                            <span key={w.id} className="inline-word-editor">
                              {w.joiner}
                              <input
                                ref={textInput}
                                autoFocus
                                aria-label={t("Correct word")}
                                aria-description={t(
                                  "Clear the word and press Enter to cut it. Escape cancels.",
                                )}
                                value={correctText}
                                maxLength={200}
                                disabled={busy}
                                onChange={(event) =>
                                  setCorrectText(event.target.value)
                                }
                                onCompositionStart={() => {
                                  composing.current = true;
                                }}
                                onCompositionEnd={() => {
                                  composing.current = false;
                                }}
                                onBlur={(event) => {
                                  if (
                                    event.relatedTarget !== null &&
                                    !composing.current &&
                                    correctText.trim() &&
                                    !busy
                                  )
                                    safe(saveCorrection);
                                }}
                                onKeyDown={(event) => {
                                  event.stopPropagation();
                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    cancelledWord.current = true;
                                    setCorrecting(undefined);
                                  }
                                  if (
                                    event.key === "Enter" &&
                                    !event.nativeEvent.isComposing &&
                                    !composing.current
                                  ) {
                                    event.preventDefault();
                                    safe(saveCorrection);
                                  }
                                }}
                              />
                              <button
                                aria-label={t("Cut word")}
                                title={t("Cut word")}
                                disabled={busy}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => safe(() => cutWords([w]))}
                              >
                                <Trash2 size={12} />
                              </button>
                              <button
                                aria-label={t("Adjust word timing")}
                                disabled={busy}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setTimingDialog(true);
                                  setTimingOpen(true);
                                }}
                              >
                                ⋯
                              </button>
                            </span>
                          ) : (
                            <button
                              key={w.id}
                              title={
                                w.reviewReason ??
                                `${w.timingQuality === "estimated" ? t("Estimated timing · Review before precise word animations") : t("Word timing · Review against the audio")} · ${w.timingSource ?? "token"}`
                              }
                              className={`transcript-word ${w.reviewReason || (!w.corrected && w.confidence < 0.55) || w.timingQuality === "estimated" ? "uncertain" : ""} ${removed(w) ? "removed" : ""} ${time >= w.startUs && time < w.endUs ? "spoken" : ""} ${selected.some((s) => s.id === w.id) ? "word-selected" : ""} ${snap.suggestions.some((s) => s.status === "pending" && s.category === "filler" && s.wordIds.includes(w.id)) ? "filler-word" : ""}`}
                              onClick={(e) => {
                                if (wordDrag.current?.moved) return;
                                select(w, e.shiftKey);
                                if (editMode && !e.shiftKey) beginCorrection(w);
                                else if (e.detail >= 2) {
                                  clearTimeout(listenTimer.current);
                                  beginCorrection(w);
                                } else if (!e.shiftKey && e.detail === 1) {
                                  clearTimeout(listenTimer.current);
                                  listenTimer.current = setTimeout(
                                    () =>
                                      clock.preview(
                                        w.startUs,
                                        Math.min(
                                          snap.project.durationUs,
                                          w.endUs + 450000,
                                        ),
                                        removed(w),
                                      ),
                                    250,
                                  );
                                }
                              }}
                              onPointerDown={(event) => {
                                if (event.button === 0) {
                                  clearTimeout(listenTimer.current);
                                  wordDrag.current = { first: w, moved: false };
                                }
                              }}
                              onPointerEnter={(event) => {
                                const drag = wordDrag.current;
                                if (
                                  drag &&
                                  event.buttons & 1 &&
                                  drag.first.id !== w.id
                                ) {
                                  drag.moved = true;
                                  const low = Math.min(
                                      w.index,
                                      drag.first.index,
                                    ),
                                    high = Math.max(w.index, drag.first.index),
                                    next = snap.words.filter(
                                      (word) =>
                                        word.index >= low && word.index <= high,
                                    );
                                  setSelected(next);
                                  clearTimeout(listenTimer.current);
                                  if (full && activeClipId) {
                                    const entries = sequenceEntries(full);
                                    useStore.getState().set({
                                      selection: {
                                        kind: "range",
                                        clipId: activeClipId,
                                        wordIds: next.map((w) => w.id),
                                        startUs: toSequence(
                                          entries,
                                          activeClipId,
                                          next[0].startUs,
                                        ),
                                        endUs: toSequence(
                                          entries,
                                          activeClipId,
                                          next.at(-1)!.endUs,
                                        ),
                                      },
                                    });
                                  }
                                }
                              }}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                beginCorrection(w);
                              }}
                              aria-label={`${editMode ? t("Edit word") : t("Select word")}: ${w.text}`}
                              aria-pressed={selected.some((s) => s.id === w.id)}
                            >
                              {w.joiner}
                              {w.text}
                            </button>
                          ),
                        )}
                    </p>
                    {labels.length > 0 && (
                      <div className="transcript-labels">
                        {labels.map((s) => (
                          <button
                            key={s.id}
                            className={`transcript-category ${s.status === "accepted" ? "applied" : ""}`}
                            onClick={() => {
                              useStore.getState().set({
                                reviewId: s.id,
                                transcriptTool: "cleanup",
                              });
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
                  <Tooltip text={t("Edit words in this sentence")}>
                    <button
                      className="transcript-row-edit"
                      aria-label={`${t("Edit words in this sentence")}: ${formatTime(row.segment.startUs)}`}
                      onClick={() => {
                        if (row.words.length) beginCorrection(row.words[0]);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  </Tooltip>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div
          className="word-selection-toolbar"
          aria-label={t("Selected words")}
        >
          <span>
            {selected.length} {t("words")}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              clock.preview(selected[0].startUs, selected.at(-1)!.endUs, false)
            }
          >
            <Play size={13} />
            {t("Listen")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={
              busy ||
              !full ||
              !activeClipId ||
              !wordSelectionRange(
                full,
                activeClipId,
                selected.map((w) => w.id),
              )
            }
            title={t("Cut selected words · Delete / Backspace")}
            onClick={() => safe(() => cutWords(selected))}
          >
            <Trash2 size={13} />
            {t("Cut")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              activeClipId &&
              safe(() =>
                mutate("timeline.command", {
                  projectId: snap.project.id,
                  command: {
                    type: "range.restore",
                    clipId: activeClipId,
                    startUs: selected[0].startUs,
                    endUs: selected.at(-1)!.endUs,
                  },
                }),
              )
            }
          >
            {t("Keep")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => beginCorrection(selected[0])}
          >
            <Pencil size={13} />
            {t("Edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t("Find & replace selected words")}
            onClick={() => {
              setFindText(
                selected
                  .map((w) => w.joiner + w.text)
                  .join("")
                  .trim(),
              );
              setReplaceOpen(true);
            }}
          >
            <Replace size={13} />
            {t("Replace")}
          </Button>
        </div>
      )}
      <div className="transcript-footer">
        <span>
          <span className="status-dot" />
          {t("Local transcript")}
        </span>
        <span>
          {t("Click to seek · Shift-click to select · Edit text to correct")}
        </span>
      </div>
      <Dialog
        open={Boolean(correcting) && timingDialog}
        onOpenChange={(open) => {
          if (!open && !busy) setCorrecting(undefined);
        }}
        title={t("Correct word")}
        description={t(
          "Choose a word below, type the correction, then press Enter.",
        )}
        className="word-correction-dialog"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setCorrecting(undefined)}
            >
              {t("Cancel")}
            </Button>
            <Button
              disabled={
                busy ||
                (timingOpen &&
                  (!Number.isFinite(startMs) ||
                    !Number.isFinite(endMs) ||
                    startMs < 0 ||
                    endMs <= startMs ||
                    endMs * 1000 > snap.project.durationUs))
              }
              onClick={() => safe(saveCorrection)}
            >
              <Check size={14} />
              {t(correctText.trim() ? "Save word" : "Cut word")}
            </Button>
          </>
        }
      >
        <div className="correction-context" aria-label={t("Sentence context")}>
          {context.map((w) => (
            <button
              key={w.id}
              className={w.id === correcting?.id ? "selected" : ""}
              aria-pressed={w.id === correcting?.id}
              disabled={busy}
              onClick={() =>
                safe(async () => {
                  if (w.id !== correcting?.id && (await saveCorrection(false)))
                    beginCorrection(w);
                })
              }
            >
              {w.joiner}
              {w.id === correcting?.id ? correctText || w.text : w.text}
            </button>
          ))}
        </div>
        <label className="dialog-field">
          <span>{t("Word")}</span>
          <Input
            ref={textInput}
            data-dialog-autofocus
            value={correctText}
            onChange={(event) => setCorrectText(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                safe(saveCorrection);
              }
            }}
            maxLength={200}
          />
        </label>
        <div className="correction-listen-row">
          <Button
            variant="outline"
            onClick={() => {
              if (correcting)
                clock.preview?.(
                  Math.max(0, correcting.startUs - 500000),
                  Math.min(snap.project.durationUs, correcting.endUs + 650000),
                  true,
                );
            }}
          >
            <Play size={14} />
            {t("Listen in context")}
          </Button>
          <span>{t("Text only · Original timing preserved")}</span>
        </div>
        <button
          className="advanced-toggle"
          onClick={() => setTimingOpen(!timingOpen)}
          aria-expanded={timingOpen}
        >
          {t("Adjust word timing")}
          <ChevronDown
            size={14}
            style={{ transform: timingOpen ? "rotate(180deg)" : "" }}
          />
        </button>
        {timingOpen && (
          <>
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
          </>
        )}
      </Dialog>
      <Dialog
        open={replaceOpen}
        onOpenChange={(open) => {
          if (!busy) setReplaceOpen(open);
        }}
        title={t("Find & replace")}
        description={t(
          "Replace text throughout this source. All changes share one Undo step.",
        )}
        className="replace-dialog"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setReplaceOpen(false)}
            >
              {t("Cancel")}
            </Button>
            <Button
              disabled={
                busy ||
                !replacement.trim() ||
                !changes.length ||
                changes.length > 10000 ||
                replacements.some((r) => !r.valid)
              }
              onClick={() =>
                safe(async () => {
                  setBusy(true);
                  try {
                    await mutate("captions.correctMany", {
                      projectId: snap.project.id,
                      corrections: changes.map((r) => ({
                        wordId: r.word.id,
                        text: r.text,
                      })),
                    });
                    setNotice(
                      `${changes.length} ${t("words updated · Undo available")}`,
                    );
                    setReplaceOpen(false);
                  } finally {
                    setBusy(false);
                  }
                })
              }
            >
              <Replace size={14} />
              {t("Replace all")}
              {changes.length > 0 && ` (${changes.length})`}
            </Button>
          </>
        }
      >
        <label className="dialog-field">
          <span>{t("Find")}</span>
          <Input
            data-dialog-autofocus
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            maxLength={200}
            placeholder={t("Word to find")}
          />
        </label>
        <label className="dialog-field">
          <span>{t("Replace with")}</span>
          <Input
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            maxLength={200}
            placeholder={t("Correct spelling")}
          />
        </label>
        <Checkbox
          checked={matchCase}
          onCheckedChange={setMatchCase}
          label={t("Match case")}
        />
        <div className="replace-preview-heading">
          <strong>{t("Preview changes")}</strong>
          <span>
            {replacements.length} {t("matching words")}
          </span>
        </div>
        <div className="replace-preview">
          {replacements.slice(0, 60).map((r) => (
            <div key={r.word.id}>
              <small>{formatTime(r.word.startUs)}</small>
              <del>{r.word.text}</del>
              <span>→</span>
              <strong className={!r.valid ? "invalid" : ""}>
                {r.text || "—"}
              </strong>
            </div>
          ))}
          {!replacements.length && (
            <p className="muted">
              {t(
                findText
                  ? "No matching words"
                  : "Type a word to see where it will change.",
              )}
            </p>
          )}
          {replacements.length > 60 && (
            <p className="muted">
              {t(
                "Showing the first 60 matches. Replace all updates every match.",
              )}
            </p>
          )}
        </div>
        {replacements.some((r) => !r.valid) && (
          <p className="muted">
            {t("Each replacement must contain 1–200 characters.")}
          </p>
        )}
      </Dialog>
    </section>
  );
}
