// @ts-nocheck
// Generated from immutable HyperFrames registry sources by scripts/build-caption-originals.mjs.
export const originalTemplates = {
"caption-pill-karaoke": { ...{"id":"caption-pill-karaoke","duration":8,"fonts":["Poppins"],"sourceSha256":"cdbbc72af7fbac440c0bf5750cf9e3d4ded20f26588b00ac79399342ca60b3e3","posterTime":3.8}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Poppins\", Arial, sans-serif;\n      }\n\n      #pill-karaoke {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      .caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 20;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .safe-zone {\n        position: absolute;\n        bottom: 100px;\n        left: 50%;\n        transform: translateX(-50%);\n        width: 1600px;\n        height: 220px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n\n      .caption-group {\n        position: absolute;\n        left: 0;\n        top: 0;\n        width: 1600px;\n        height: 220px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        opacity: 0;\n      }\n\n      .caption-pill {\n        width: auto;\n        max-width: 1600px;\n        padding: 18px 60px 20px;\n        border-radius: 22px;\n        background: #e7e5e7;\n        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);\n        text-align: center;\n        overflow: visible;\n      }\n\n      .caption-copy {\n        display: flex;\n        flex-direction: column;\n        align-items: center;\n        justify-content: center;\n        width: 100%;\n        color: #a6a6a6;\n        font-family: \"Poppins\", Arial, sans-serif;\n        font-size: 72px;\n        font-weight: 700;\n        line-height: 1.16;\n        letter-spacing: 0;\n        white-space: nowrap;\n        word-break: normal;\n        overflow: visible;\n      }\n\n      .caption-line {\n        display: flex;\n        justify-content: center;\n        gap: 16px;\n        width: 100%;\n        max-width: none;\n        line-height: 1.16;\n        white-space: nowrap;\n        overflow: visible;\n      }\n\n      .caption-word {\n        display: inline-block;\n        color: #a6a6a6;\n      }\n    ", markup:"\n    <div\n      id=\"pill-karaoke\"\n      data-composition-id=\"caption-pill-karaoke\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"caption-layer\" aria-hidden=\"true\">\n        <div id=\"caption-stage\" class=\"safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var SAFE_ZONE_WIDTH = 1400;
      var PILL_MAX_WIDTH = 1400;
      var PILL_MIN_PADDING_X = 30;
      var PILL_MAX_PADDING_X = 60;
      var FONT_WIDTH_SAFETY = 1.18;
      var FONT_FAMILY = "Poppins";
      var FONT_WEIGHT = "700";
      var BASE_FONT_SIZE = 72;
      var MIN_FONT_SIZE = 52;
      var MAX_WORDS_PER_GROUP = __ctx.words ? __ctx.words.length : (4);
      var WORD_SPACING = 16;
      var PAUSE_THRESHOLD = __ctx.words ? Infinity : (0.1);
      var GROUP_END_BUFFER = 0.3;
      var COLOR_INACTIVE = __ctx.color ?? ("#A6A6A6");
      var COLOR_ACTIVE = __ctx.activeColor ?? ("#1C1E1D");
      var COLOR_FADE_DURATION = 0.1;
      var WORD_FADE_LEAD = 0.05;

      var TRANSCRIPT = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      function normalizeWords(rawWords) {
        return rawWords
          .map(function (item) {
            var text = String(item.word || item.text || "").trim();
            return {
              text: text,
              start: Math.max(0, Number(item.start) || 0),
              end: Math.min(DURATION, Math.max(Number(item.start) || 0, Number(item.end) || 0)),
            };
          })
          .filter(function (w) {
            return w.text.length > 0;
          });
      }

      var measureCanvas = document.createElement("canvas");
      var measureContext = measureCanvas.getContext("2d");

      function measureWordWidth(text, fontSize) {
        measureContext.font = FONT_WEIGHT + " " + fontSize + "px " + FONT_FAMILY;
        return measureContext.measureText(text).width * FONT_WIDTH_SAFETY;
      }

      function measureLineWidth(words, fontSize) {
        return words.reduce(function (total, word, index) {
          return (
            total + measureWordWidth(word.text.toLowerCase(), fontSize) + (index ? WORD_SPACING : 0)
          );
        }, 0);
      }

      function splitLinesForGroup(words, fontSize) {
        var maxLineWidth = PILL_MAX_WIDTH - PILL_MIN_PADDING_X * 2;
        if (
          words.some(function (w) {
            return measureWordWidth(w.text.toLowerCase(), fontSize) > maxLineWidth;
          })
        ) {
          return null;
        }
        if (measureLineWidth(words, fontSize) <= maxLineWidth) return [words];
        var bestSplit = null;
        var bestImbalance = Infinity;
        for (var split = 1; split < words.length; split++) {
          var firstLine = words.slice(0, split);
          var secondLine = words.slice(split);
          var firstWidth = measureLineWidth(firstLine, fontSize);
          var secondWidth = measureLineWidth(secondLine, fontSize);
          if (firstWidth <= maxLineWidth && secondWidth <= maxLineWidth) {
            var imbalance = Math.abs(firstWidth - secondWidth);
            if (imbalance < bestImbalance) {
              bestSplit = [firstLine, secondLine];
              bestImbalance = imbalance;
            }
          }
        }
        return bestSplit;
      }

      function fitsInTwoLinesAtSize(words, fontSize) {
        return splitLinesForGroup(words, fontSize) !== null;
      }

      function planPillLayout(words, fontSize) {
        var lines = splitLinesForGroup(words, fontSize) || [words];
        var widestLine = lines.reduce(function (max, lineWords) {
          return Math.max(max, measureLineWidth(lineWords, fontSize));
        }, 0);
        var availablePadding = Math.floor((PILL_MAX_WIDTH - widestLine) / 2);
        var padX = Math.max(PILL_MIN_PADDING_X, Math.min(PILL_MAX_PADDING_X, availablePadding));
        var pillWidth = Math.min(PILL_MAX_WIDTH, Math.ceil(widestLine + padX * 2));
        return { lines: lines, padX: padX, pillWidth: pillWidth };
      }

      function makeGroups(words) {
        var groups = [];
        var current = [];
        words.forEach(function (word, index) {
          var testGroup = current.concat([word]);
          var nextWord = words[index + 1];
          var wouldExceedMaxWords = testGroup.length > MAX_WORDS_PER_GROUP;
          var wouldExceedTwoLines = !fitsInTwoLinesAtSize(testGroup, BASE_FONT_SIZE);
          if (wouldExceedMaxWords || wouldExceedTwoLines) {
            if (current.length) {
              groups.push({
                words: current.slice(),
                start: current[0].start,
                end: current[current.length - 1].end,
              });
            }
            current = [word];
            return;
          }
          current.push(word);
          var hasPunctuation = __ctx.words ? false : (/[,.:!?]$/.test(word.text));
          var pauseDuration = nextWord ? nextWord.start - word.end : 0;
          var hasNaturalPause = pauseDuration >= PAUSE_THRESHOLD;
          var maxWordsReached = current.length >= MAX_WORDS_PER_GROUP;
          if (maxWordsReached || !nextWord || hasPunctuation || hasNaturalPause) {
            groups.push({
              words: current.slice(),
              start: current[0].start,
              end: current[current.length - 1].end,
            });
            current = [];
          }
        });
        if (current.length)
          groups.push({
            words: current.slice(),
            start: current[0].start,
            end: current[current.length - 1].end,
          });
        return groups;
      }

      function fontSizeForGroup(words) {
        var size = BASE_FONT_SIZE;
        while (size > MIN_FONT_SIZE && !fitsInTwoLinesAtSize(words, size)) {
          size -= 2;
        }
        return size;
      }

      function buildCaptions(groups) {
        var stage = document.getElementById("caption-stage");
        groups.forEach(function (group, groupIndex) {
          var groupEl = document.createElement("div");
          var pillEl = document.createElement("div");
          var copyEl = document.createElement("div");
          var fontSize = fontSizeForGroup(group.words);
          groupEl.id = "caption-group-" + groupIndex;
          groupEl.className = "caption-group";
          pillEl.className = "caption-pill";
          copyEl.className = "caption-copy";
          copyEl.style.fontSize = fontSize + "px";
          var indexedWords = group.words.map(function (word, wordIndex) {
            return { text: word.text, start: word.start, end: word.end, wordIndex: wordIndex };
          });
          var layout = planPillLayout(indexedWords, fontSize);
          pillEl.style.width = layout.pillWidth + "px";
          pillEl.style.paddingLeft = layout.padX + "px";
          pillEl.style.paddingRight = layout.padX + "px";
          layout.lines.slice(0, 2).forEach(function (lineWords) {
            var lineEl = document.createElement("div");
            lineEl.className = "caption-line";
            lineWords.forEach(function (word) {
              var wordEl = document.createElement("span");
              wordEl.id = "caption-word-" + groupIndex + "-" + word.wordIndex;
              wordEl.className = "caption-word";
              wordEl.textContent = word.text.toLowerCase();
              lineEl.appendChild(wordEl);
            });
            copyEl.appendChild(lineEl);
          });
          pillEl.appendChild(copyEl);
          groupEl.appendChild(pillEl);
          stage.appendChild(groupEl);
        });
      }

      var WORDS = normalizeWords(TRANSCRIPT);
      var GROUPS = makeGroups(WORDS);
      buildCaptions(GROUPS);

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      GROUPS.forEach(function (group, groupIndex) {
        var groupEl = document.getElementById("caption-group-" + groupIndex);
        var nextGroup = GROUPS[groupIndex + 1];
        var isLastGroup = groupIndex === GROUPS.length - 1;
        var effectiveEnd = isLastGroup
          ? DURATION
          : Math.min(nextGroup.start, group.end + GROUP_END_BUFFER);
        var visibleStart = Math.max(0, group.start);
        var visibleEnd = Math.max(visibleStart + 0.01, effectiveEnd);

        tl.set(groupEl, { opacity: 1 }, visibleStart);
        tl.set(groupEl, { opacity: 0 }, visibleEnd);

        group.words.forEach(function (word, wordIndex) {
          var wordEl = document.getElementById("caption-word-" + groupIndex + "-" + wordIndex);
          var isFirstWord = wordIndex === 0;
          var wordStart = Math.max(visibleStart, word.start - WORD_FADE_LEAD);
          tl.set(wordEl, { color: isFirstWord ? COLOR_ACTIVE : COLOR_INACTIVE }, visibleStart);
          if (isFirstWord) return;
          tl.to(
            wordEl,
            { color: COLOR_ACTIVE, duration: COLOR_FADE_DURATION, ease: "none" },
            wordStart,
          );
        });
      });

      window.__timelines["caption-pill-karaoke"] = tl;
    
} },
"caption-highlight": { ...{"id":"caption-highlight","duration":8,"fonts":["Montserrat"],"sourceSha256":"77f877ddcef85e787453daa6724cec5e85a0678fcb098fe94f9b86ce0ef5f2f4","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #highlight {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      #hl-video {\n        position: absolute;\n        inset: 0;\n        z-index: 0;\n        width: 100%;\n        height: 100%;\n        object-fit: cover;\n      }\n      .hl-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #hl-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .hl-group {\n        position: absolute;\n        bottom: 140px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 8px;\n        padding: 0 100px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .hl-word {\n        font-family: \"Montserrat\", sans-serif;\n        font-weight: 800;\n        font-size: 80px;\n        text-transform: uppercase;\n        color: #ffffff;\n        display: inline-block;\n        letter-spacing: 0.02em;\n        line-height: 1;\n        position: relative;\n        padding: 6px 12px 8px;\n        text-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);\n        transform-origin: 50% 58%;\n        will-change: transform, filter;\n      }\n      .hl-word-bg {\n        position: absolute;\n        inset: 0;\n        background: linear-gradient(135deg, #ff1745 0%, #df1238 100%);\n        border-radius: 10px;\n        box-shadow: 0 12px 30px rgba(229, 20, 58, 0.32);\n        opacity: 0;\n        transform: scaleX(0);\n        transform-origin: 0% 50%;\n        z-index: -1;\n      }\n      .hl-word-text {\n        position: relative;\n        z-index: 1;\n      }\n    ", markup:"\n    <div\n      id=\"highlight\"\n      data-composition-id=\"caption-highlight\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"hl-overlay\"></div>\n      <div id=\"hl-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var RAW_GROUPS = __ctx.words ? [[0, __ctx.words.length - 1]] : ([
          [0, 3],
          [4, 7],
          [8, 8],
          [9, 12],
          [13, 15],
          [16, 16],
          [17, 19],
          [20, 22],
          [23, 24],
          [25, 27],
        ]);
        var GROUPS = RAW_GROUPS.map(function (pair, gi) {
          var ws = pair[0],
            we = pair[1];
          var nextStart = __ctx.words ? __ctx.duration : (gi + 1 < RAW_GROUPS.length ? WORDS[RAW_GROUPS[gi + 1][0]].start : 8.0);
          var gEnd = Math.min(WORDS[we].end + 0.5, nextStart - 0.05);
          return { wordStart: ws, wordEnd: we, start: WORDS[ws].start, end: gEnd };
        });

        var container = document.getElementById("hl-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var grp = document.createElement("div");
          grp.className = "hl-group";
          grp.id = "hl-grp-" + gi;

          var groupText = groupWords
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var computedSize = fitFontSize(groupText, 80, "800", "Montserrat", 1620);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var wordEl = document.createElement("span");
            wordEl.className = "hl-word";
            wordEl.id = "hl-w-" + wi;
            wordEl.style.fontSize = computedSize + "px";

            var bgEl = document.createElement("span");
            bgEl.className = "hl-word-bg";
            bgEl.id = "hl-bg-" + wi;

            var textEl = document.createElement("span");
            textEl.className = "hl-word-text";
            textEl.textContent = w.text.toUpperCase();

            wordEl.appendChild(bgEl);
            wordEl.appendChild(textEl);
            grp.appendChild(wordEl);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible" }, g.start);
          tl.fromTo(
            grp,
            { opacity: 0 },
            { opacity: 1, duration: 0.12, ease: "power2.out" },
            g.start,
          );

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var bgEl = document.getElementById("hl-bg-" + wi);
            var wordEl = document.getElementById("hl-w-" + wi);

            tl.to(bgEl, { opacity: 1, scaleX: 1, duration: 0.15, ease: "power2.out" }, w.start);
            tl.to(
              wordEl,
              { filter: "brightness(1.05)", duration: 0.08, ease: "power2.out" },
              w.start,
            );
            tl.to(
              wordEl,
              { filter: "brightness(1)", duration: 0.16, ease: "power2.out" },
              w.start + 0.08,
            );
            tl.to(bgEl, { opacity: 0, scaleX: 1.02, duration: 0.1, ease: "power2.in" }, w.end);
            tl.set(bgEl, { scaleX: 0 }, w.end + 0.1);
          });

          tl.to(grp, { opacity: 0, duration: 0.1, ease: "power2.in" }, g.end - 0.1);
          tl.set(grp, { opacity: 0, visibility: "hidden" }, g.end);
        });

        tl.seek(0);
        window.__timelines["caption-highlight"] = tl;
      })();
    
} },
"mk-callout-highlight": { ...{"id":"mk-callout-highlight","duration":8,"fonts":[],"sourceSha256":"ab80d94b07373fd1bb136c3560183e916876e9318729202698fd26c2e999dd46","posterTime":3.8}, css:"\n      *,\n      *::before,\n      *::after {\n        margin: 0;\n        padding: 0;\n        box-sizing: border-box;\n      }\n      body {\n        background: transparent;\n        overflow: hidden;\n      }\n      #mk-ch-root {\n        /* ---- mk tokens: override in the host to re-skin the family ---- */\n        --mk-font: \"Inter\", -apple-system, sans-serif;\n        --mk-ink: #1d1d1f;\n        /* faint = transient pre-sweep tier (tweens up to full ink) — distinct from the family --mk-ink-dim */\n        --mk-ink-faint: #bcbcc2;\n        --mk-ink-dark: #f5f5f7;\n        --mk-ink-faint-dark: rgba(245, 245, 247, 0.32);\n\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent; /* overlays footage or mk-background */\n      }\n      #mk-ch-box {\n        position: absolute;\n        font-family: var(--mk-font);\n        font-weight: 500;\n        letter-spacing: -0.015em;\n      }\n      .mk-ch-word {\n        display: inline;\n      }\n    ", markup:"\n    <div\n      id=\"mk-ch-root\"\n      data-composition-id=\"mk-callout-highlight\"\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div id=\"mk-ch-box\" data-layout-allow-occlusion></div>\n      <div\n        id=\"mk-ch-drv\"\n        class=\"clip\"\n        data-start=\"0\"\n        data-duration=\"8\"\n        data-track-index=\"0\"\n        style=\"position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none\"\n      ></div>\n    </div>\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        /* ---- published parameters (inspector-style CONFIG) ----
           The mechanic: one scalar (highlight progress 0..1) sweeps word-by-word
           emphasis across the sentence — a "highlight amount"
           slider. Tween the scalar over the speaker's sentence to follow speech. */
        var CONFIG = __ctx.callout ?? ({
          scheme: "light", // "light" (ink on light bg) | "dark" (white on footage)
          text: "Functionality was our goal from the very beginning",
          fontSize: 60,
          lineHeight: 1.3,
          maxWidth: 700, // px; sentence wraps inside this
          x: 1030, // box left edge; null = centered horizontally
          y: null, // box top edge; null = centered vertically
          align: "left",
          sweep: { start: 1.2, end: 6.2 }, // block-local seconds, linear
          animationIn: true, // fade/rise entrance before the sweep
          animationOut: true,
        });

        var DUR = __ctx.duration ?? (8);
        var root = document.getElementById("mk-ch-root");
        var box = document.getElementById("mk-ch-box");

        var FULL = __ctx.activeColor ?? (CONFIG.scheme === "dark" ? "#f5f5f7" : "#1d1d1f");
        var FAINT = __ctx.color ?? (CONFIG.scheme === "dark" ? "rgba(245,245,247,0.32)" : "#bcbcc2");

        box.style.fontSize = CONFIG.fontSize + "px";
        box.style.lineHeight = String(CONFIG.lineHeight);
        box.style.maxWidth = CONFIG.maxWidth + "px";
        box.style.textAlign = CONFIG.align;

        /* build word spans */
        var wordEls = [];
        (__ctx.words ? __ctx.words.map(w=>w.text) : CONFIG.text.split(/\s+/)).forEach(function (w, i) {
          if (i > 0) box.appendChild(document.createTextNode(__ctx.words ? (__ctx.words[i].joiner ?? " ") : " "));
          var span = document.createElement("span");
          span.id = "mk-ch-w-" + i;
          span.className = "mk-ch-word";
          span.textContent = w;
          span.style.color = FAINT;
          box.appendChild(span);
          wordEls.push(span);
        });

        /* position (measure after building) */
        var rect = box.getBoundingClientRect();
        box.style.left =
          (CONFIG.x === null ? Math.round((1920 - rect.width) / 2) : CONFIG.x) + "px";
        box.style.top =
          (CONFIG.y === null ? Math.round((1080 - rect.height) / 2) : CONFIG.y) + "px";

        /* state proxy: GSAP animates st.p, render derives every word color from it */
        var st = { p: 0 };
        var mix = gsap.utils.interpolate(FAINT, FULL);
        function render() {
          var k = st.p * wordEls.length;
          for (var i = 0; i < wordEls.length; i++) {
            var f = Math.max(0, Math.min(1, k - i));
            wordEls[i].style.color = mix(f);
          }
        }

        var tl = gsap.timeline({ paused: true });

        if (CONFIG.animationIn) {
          gsap.set(box, { opacity: 0, y: 24 });
          tl.to(box, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, 0.3);
        }

        /* the highlight sweep — one scalar, linear so it tracks speech evenly.
           To follow a real voiceover, replace with several tweens between
           per-phrase progress values (keyframes on the slider). */
        if (__ctx.words) __ctx.words.forEach((w,i)=>tl.fromTo(st,{p:i/__ctx.words.length},{p:(i+1)/__ctx.words.length,duration:Math.max(.001,w.end-w.start),ease:"none",immediateRender:false},w.start)); else tl.to(
          st,
          { p: 1, duration: CONFIG.sweep.end - CONFIG.sweep.start, ease: "none" },
          CONFIG.sweep.start,
        );

        if (CONFIG.animationOut) {
          tl.to(box, { opacity: 0, y: -16, duration: 0.4, ease: "power2.in" }, DUR - 0.5);
        }
        tl.set(root, { visibility: "hidden" }, DUR - 0.02);

        tl.eventCallback("onUpdate", render);
        render();

        window.__timelines["mk-callout-highlight"] = tl;
      })();
    
} },
"caption-clip-wipe": { ...{"id":"caption-clip-wipe","duration":8,"fonts":["Poppins"],"sourceSha256":"8b9e06353df3ea3bc0113a9c7ef3e480293a6ed75bee46744b053bf5e02dc5f6","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #clip-wipe {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .wp-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #wp-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .wp-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 24px;\n        padding: 0 100px;\n        visibility: hidden;\n      }\n      .wp-word {\n        font-family: \"Poppins\", sans-serif;\n        font-weight: 800;\n        font-size: 88px;\n        text-transform: uppercase;\n        color: #ffffff;\n        display: inline-block;\n        letter-spacing: 0.04em;\n        line-height: 1;\n        clip-path: inset(0 100% 0 0);\n        will-change: clip-path, color, opacity;\n      }\n    ", markup:"\n    <div\n      id=\"clip-wipe\"\n      data-composition-id=\"caption-clip-wipe\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"wp-overlay\"></div>\n      <div id=\"wp-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var KEYWORDS = __ctx.words ? __ctx.keywords(false) : (new Set([8, 12, 15, 24, 27])); // HyperFrames, HTML, professional, code, cinema.

        var RAW_GROUPS = __ctx.words ? [[0, __ctx.words.length - 1]] : ([
          [0, 3],
          [4, 7],
          [8, 8],
          [9, 12],
          [13, 15],
          [16, 16],
          [17, 19],
          [20, 22],
          [23, 24],
          [25, 27],
        ]);
        var GROUPS = RAW_GROUPS.map(function (pair, gi) {
          var ws = pair[0],
            we = pair[1];
          var nextStart = __ctx.words ? __ctx.duration : (gi + 1 < RAW_GROUPS.length ? WORDS[RAW_GROUPS[gi + 1][0]].start : 8.0);
          var gEnd = Math.min(WORDS[we].end + 0.5, nextStart - 0.05);
          return { wordStart: ws, wordEnd: we, start: WORDS[ws].start, end: gEnd };
        });

        var container = document.getElementById("wp-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var grp = document.createElement("div");
          grp.className = "wp-group";
          grp.id = "wp-grp-" + gi;

          var groupText = groupWords
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var computedSize = fitFontSize(groupText, 88, "800", "Poppins", 1720);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var span = document.createElement("span");
            span.className = "wp-word";
            span.id = "wp-w-" + wi;
            span.textContent = w.text.toUpperCase();
            span.style.fontSize = computedSize + "px";
            grp.appendChild(span);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible" }, g.start);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var wordEl = document.getElementById("wp-w-" + wi);
            var isKW = KEYWORDS.has(wi);

            tl.to(
              wordEl,
              { clipPath: "inset(0 0% 0 0)", duration: 0.3, ease: "power2.out" },
              w.start,
            );
            if (isKW) {
              tl.to(wordEl, { color: __ctx.colorize("#FFD700"), duration: 0.05 }, w.start + 0.1);
            }
            tl.to(wordEl, { color: __ctx.colorize("rgba(255,255,255,0.4)"), duration: 0.2 }, w.end);
          });

          var wordEls = grp.querySelectorAll(".wp-word");
          tl.to(
            wordEls,
            {
              clipPath: "inset(0 0% 0 100%)",
              duration: 0.25,
              stagger: 0.04,
              ease: "power2.in",
            },
            g.end - 0.2,
          );
          tl.set(grp, { visibility: "hidden", opacity: 0 }, g.end);
        });

        tl.seek(0);
        window.__timelines["caption-clip-wipe"] = tl;
      })();
    
} },
"caption-weight-shift": { ...{"id":"caption-weight-shift","duration":8,"fonts":["Montserrat"],"sourceSha256":"8a5294debec3eadeb7ca0a8688c31a6e8c517ebb1c55ff410aa81df3807daa55","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Montserrat\", Arial, sans-serif;\n      }\n\n      #weight-shift {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      .caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 20;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .safe-zone {\n        position: absolute;\n        bottom: 100px;\n        left: 50%;\n        transform: translateX(-50%);\n        width: 1400px;\n        height: 278px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n\n      .caption-group {\n        position: absolute;\n        left: 0;\n        top: 0;\n        width: 1400px;\n        height: 278px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        opacity: 0;\n        transform-origin: 50% 50%;\n        will-change: transform;\n        backface-visibility: hidden;\n      }\n\n      .caption-copy {\n        display: flex;\n        flex-direction: column;\n        align-items: center;\n        justify-content: center;\n        max-width: 1400px;\n        text-align: center;\n      }\n\n      .caption-line {\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        gap: 12px;\n        width: max-content;\n        max-width: 1400px;\n        line-height: 1.1;\n        white-space: nowrap;\n        color: #ffffff;\n        font-family: \"Montserrat\", Arial, sans-serif;\n        font-weight: 300;\n        font-size: 72px;\n        letter-spacing: -0.03em;\n        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);\n        text-transform: lowercase;\n      }\n    ", markup:"\n    <div\n      id=\"weight-shift\"\n      data-composition-id=\"caption-weight-shift\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"caption-layer\" aria-hidden=\"true\">\n        <div id=\"caption-stage\" class=\"safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var SAFE_ZONE_WIDTH = 1400;
      var MAX_LINE_WIDTH = SAFE_ZONE_WIDTH - 40;
      var CAPTION_FONT_SIZE = 72;
      var MAX_WORDS_PER_GROUP = __ctx.words ? __ctx.words.length : (4);
      var WORD_SPACING = 12;
      var PAUSE_THRESHOLD = __ctx.words ? Infinity : (0.1);
      var ENTRY_DURATION = 100 / 1000;
      var WEIGHT_TRANSITION = 100 / 1000;
      var FONT_WIDTH_SAFETY = 1.14;
      var FONT_WEIGHT_LIGHT = 300;
      var FONT_WEIGHT_BOLD = 700;

      var TRANSCRIPT = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      function normalizeWords(rawWords) {
        return rawWords
          .map(function (item) {
            return {
              text: String(item.word || item.text || "").trim(),
              start: Math.max(0, Number(item.start) || 0),
              end: Math.min(DURATION, Math.max(Number(item.start) || 0, Number(item.end) || 0)),
            };
          })
          .filter(function (word) {
            return word.text.length > 0;
          });
      }

      var _fitCanvas = document.createElement("canvas");
      var _fitCtx = _fitCanvas.getContext("2d");
      function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
        var size = baseFontSize;
        var minSize = Math.floor(baseFontSize * 0.45);
        while (size > minSize) {
          _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
          if (_fitCtx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      }

      var measureCanvas = document.createElement("canvas");
      var measureContext = measureCanvas.getContext("2d");
      measureContext.font = "700 " + CAPTION_FONT_SIZE + "px Montserrat";

      function measureWord(word) {
        return measureContext.measureText(word.text.toLowerCase()).width * FONT_WIDTH_SAFETY;
      }

      function measureLineWidth(words) {
        return words.reduce(function (total, word, index) {
          return total + measureWord(word) + (index ? WORD_SPACING : 0);
        }, 0);
      }

      function fitsInTwoLines(words) {
        return measureLineWidth(words) <= MAX_LINE_WIDTH * 1.8;
      }

      function splitLines(words) {
        if (words.length < 2) {
          return [{ words: words, startIndex: 0 }];
        }
        var bestSplit = Math.ceil(words.length / 2);
        var bestDiff = Infinity;
        for (var s = 1; s < words.length; s++) {
          var w1 = measureLineWidth(words.slice(0, s));
          var w2 = measureLineWidth(words.slice(s));
          if (w1 <= MAX_LINE_WIDTH && w2 <= MAX_LINE_WIDTH) {
            var diff = Math.abs(w1 - w2);
            if (diff < bestDiff) {
              bestDiff = diff;
              bestSplit = s;
            }
          }
        }
        var result = [];
        var line1 = words.slice(0, bestSplit);
        var line2 = words.slice(bestSplit);
        if (line1.length) result.push({ words: line1, startIndex: 0 });
        if (line2.length) result.push({ words: line2, startIndex: line1.length });
        return result;
      }

      function avoidSingleWordGroups(groups) {
        var out = [];
        groups.forEach(function (group) {
          if (
            group.words.length === 1 &&
            out.length > 0 &&
            out[out.length - 1].words.length < MAX_WORDS_PER_GROUP
          ) {
            out[out.length - 1] = makeGroup(out[out.length - 1].words.concat(group.words));
          } else {
            out.push(group);
          }
        });

        for (var i = 0; i < out.length; i++) {
          if (out[i].words.length !== 1) continue;
          if (i + 1 < out.length && out[i + 1].words.length < MAX_WORDS_PER_GROUP) {
            out[i] = makeGroup(out[i].words.concat(out[i + 1].words));
            out.splice(i + 1, 1);
          } else if (i > 0 && out[i - 1].words.length < MAX_WORDS_PER_GROUP) {
            out[i - 1] = makeGroup(out[i - 1].words.concat(out[i].words));
            out.splice(i, 1);
            i--;
          }
        }

        return out;
      }

      function makeGroups(words) {
        var groups = [];
        var current = [];
        words.forEach(function (word, index) {
          var nextWord = words[index + 1];
          var testGroup = current.concat([word]);
          if (testGroup.length > MAX_WORDS_PER_GROUP || !fitsInTwoLines(testGroup)) {
            if (current.length) groups.push(makeGroup(current));
            current = [word];
            return;
          }
          current.push(word);
          var punctuation = /[,.:!?]$/.test(word.text);
          var pause = nextWord ? nextWord.start - word.end : 0;
          if (
            !nextWord ||
            punctuation ||
            pause >= PAUSE_THRESHOLD ||
            current.length >= MAX_WORDS_PER_GROUP
          ) {
            groups.push(makeGroup(current));
            current = [];
          }
        });
        if (current.length) groups.push(makeGroup(current));
        return avoidSingleWordGroups(groups);
      }

      function makeGroup(words) {
        return {
          words: words.slice(),
          lines: splitLines(words),
          start: words[0].start,
          end: words[words.length - 1].end,
        };
      }

      function buildCaptions(groups) {
        var stage = document.getElementById("caption-stage");
        groups.forEach(function (group, groupIndex) {
          var groupText = group.words
            .map(function (w) {
              return w.text.toLowerCase();
            })
            .join(" ");
          var computedSize = fitFontSize(
            groupText,
            CAPTION_FONT_SIZE,
            "700",
            "Montserrat",
            MAX_LINE_WIDTH,
          );
          var groupEl = document.createElement("div");
          var copyEl = document.createElement("div");
          groupEl.id = "caption-group-" + groupIndex;
          groupEl.className = "caption-group";
          copyEl.className = "caption-copy";
          group.lines.forEach(function (line, lineIndex) {
            var lineEl = document.createElement("div");
            lineEl.className = "caption-line";
            lineEl.id = "caption-group-" + groupIndex + "-line-" + lineIndex;
            lineEl.style.fontWeight = lineIndex === 0 ? FONT_WEIGHT_BOLD : FONT_WEIGHT_LIGHT;
            lineEl.style.fontSize = computedSize + "px";
            line.words.forEach(function (word, wordIndex) {
              var wordEl = document.createElement("span");
              wordEl.textContent = word.text.toLowerCase();
              wordEl.style.display = "inline-block";
              lineEl.appendChild(wordEl);
            });
            copyEl.appendChild(lineEl);
          });
          groupEl.appendChild(copyEl);
          stage.appendChild(groupEl);
        });
      }

      var WORDS = normalizeWords(TRANSCRIPT);
      var GROUPS = makeGroups(WORDS);
      buildCaptions(GROUPS);

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var visibleStarts = GROUPS.map(function (group, groupIndex) {
        var prev = GROUPS[groupIndex - 1];
        var availableGap = prev ? Math.max(0, group.start - prev.end) : ENTRY_DURATION;
        var entryLead = Math.min(ENTRY_DURATION, availableGap);
        return Math.max(0, group.start - entryLead);
      });

      var allGroupEls = GROUPS.map(function (_, i) {
        return document.getElementById("caption-group-" + i);
      });

      GROUPS.forEach(function (group, groupIndex) {
        var groupEl = allGroupEls[groupIndex];
        var visibleStart = visibleStarts[groupIndex];
        var visibleEnd = groupIndex < GROUPS.length - 1 ? visibleStarts[groupIndex + 1] : DURATION;

        allGroupEls.forEach(function (otherEl, otherIndex) {
          if (otherIndex !== groupIndex) tl.set(otherEl, { opacity: 0 }, visibleStart);
        });

        tl.set(groupEl, { opacity: 0, scale: 0.85 }, visibleStart);
        tl.to(
          groupEl,
          { opacity: 1, scale: 1, duration: ENTRY_DURATION, ease: "power3.out", force3D: true },
          visibleStart,
        );

        if (group.lines.length === 2) {
          var line1El = document.getElementById("caption-group-" + groupIndex + "-line-0");
          var line2El = document.getElementById("caption-group-" + groupIndex + "-line-1");
          var line2FirstWord = group.lines[1].words[0];
          var switchTime = line2FirstWord.start;

          tl.to(
            line1El,
            { fontWeight: FONT_WEIGHT_LIGHT, duration: WEIGHT_TRANSITION, ease: "power2.out" },
            switchTime,
          );
          tl.to(
            line2El,
            { fontWeight: FONT_WEIGHT_BOLD, duration: WEIGHT_TRANSITION, ease: "power2.out" },
            switchTime,
          );
        }

        tl.set(groupEl, { opacity: 0 }, visibleEnd);
      });

      window.__timelines["caption-weight-shift"] = tl;
    
} },
"caption-editorial-emphasis": { ...{"id":"caption-editorial-emphasis","duration":8,"fonts":["Inter","Playfair Display"],"sourceSha256":"6144571b6c73dbdec282284fe2277d3c958e15cddaf362295ba9cca02e705d1c","posterTime":4.4}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Inter\", sans-serif;\n      }\n\n      #editorial-emphasis {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      .caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 20;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .safe-zone {\n        position: absolute;\n        top: 580px;\n        left: 60px;\n        width: 1800px;\n        height: 430px;\n        display: flex;\n        align-items: flex-start;\n        justify-content: flex-start;\n      }\n\n      .caption-block {\n        position: absolute;\n        left: 0;\n        top: 0;\n        opacity: 0;\n        transform-origin: 0% 0%;\n        will-change: transform, opacity;\n        backface-visibility: hidden;\n      }\n\n      .caption-line {\n        display: flex;\n        align-items: baseline;\n        gap: 14px;\n        line-height: 1.1;\n        white-space: nowrap;\n      }\n\n      .caption-line + .caption-line {\n        margin-top: 8px;\n      }\n\n      .word {\n        display: inline-block;\n        color: #f5f0d0;\n        text-shadow:\n          0 2px 12px rgba(0, 0, 0, 0.6),\n          0 4px 24px rgba(0, 0, 0, 0.35);\n        will-change: transform, opacity;\n        backface-visibility: hidden;\n      }\n\n      .word--normal {\n        font-family: \"Inter\", sans-serif;\n        font-size: 86px;\n        font-weight: 400;\n        font-style: normal;\n      }\n\n      .word--italic {\n        font-family: \"Inter\", sans-serif;\n        font-size: 86px;\n        font-weight: 400;\n        font-style: italic;\n      }\n\n      .word--emphasis {\n        font-family: \"Playfair Display\", serif;\n        font-size: 180px;\n        font-weight: 800;\n        font-style: italic;\n        line-height: 0.9;\n        color: #f5f0d0;\n      }\n    ", markup:"\n    <div\n      id=\"editorial-emphasis\"\n      data-composition-id=\"caption-editorial-emphasis\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"caption-layer\" aria-hidden=\"true\">\n        <div id=\"caption-stage\" class=\"safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var SAFE_WIDTH = 1800;
      var ENTRY_DUR = 0.1;
      var SLIDE_DUR = 0.2;

      var _fitCanvas = document.createElement("canvas");
      var _fitCtx = _fitCanvas.getContext("2d");
      function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
        var size = baseFontSize;
        var minSize = Math.floor(baseFontSize * 0.45);
        while (size > minSize) {
          _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
          if (_fitCtx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      }

      // Generic transcript words
      var W = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      // Block layout: [wordIndex, type] — n=normal, i=italic, e=emphasis(large)
      // Emphasis words: HyperFrames(8), HTML(12), professional(15), code(24), cinema.(27)
      var BLOCKS = __ctx.words ? __ctx.blocks("caption-editorial-emphasis") : ([
        {
          line1: [
            [0, "n"],
            [1, "n"],
            [2, "n"],
          ],
          line2: [
            [3, "n"],
            [4, "n"],
          ],
        },
        {
          line1: [
            [5, "n"],
            [6, "n"],
          ],
          line2: [[7, "e"]],
        },
        { line1: [[8, "e"]], line2: null },
        {
          line1: [
            [9, "n"],
            [10, "n"],
            [11, "n"],
          ],
          line2: [[12, "e"]],
        },
        {
          line1: [
            [13, "n"],
            [14, "n"],
          ],
          line2: [[15, "e"]],
        },
        {
          line1: [
            [16, "n"],
            [17, "n"],
          ],
          line2: null,
        },
        {
          line1: [[18, "n"]],
          line2: [
            [19, "n"],
            [20, "n"],
          ],
        },
        {
          line1: [
            [21, "n"],
            [22, "n"],
          ],
          line2: null,
        },
        {
          line1: [
            [23, "i"],
            [24, "e"],
          ],
          line2: null,
        },
        {
          line1: [
            [25, "n"],
            [26, "n"],
          ],
          line2: [[27, "e"]],
        },
      ]);

      var CLASS_MAP = { n: "word word--normal", i: "word word--italic", e: "word word--emphasis" };

      function computeLineSize(linePairs) {
        var hasEmphasis = linePairs.some(function (p) {
          return p[1] === "e";
        });
        if (hasEmphasis) {
          var lineText = linePairs
            .map(function (p) {
              return W[p[0]].text;
            })
            .join(" ");
          return fitFontSize(lineText, 180, "800", "Playfair Display", SAFE_WIDTH);
        }
        var lineText = linePairs
          .map(function (p) {
            return W[p[0]].text;
          })
          .join(" ");
        return fitFontSize(lineText, 86, "400", "Inter", SAFE_WIDTH);
      }

      function buildBlocks() {
        var stage = document.getElementById("caption-stage");
        BLOCKS.forEach(function (block, bi) {
          var el = document.createElement("div");
          el.className = "caption-block";
          el.id = "b" + bi;

          var l1Size = computeLineSize(block.line1);
          var l1 = document.createElement("div");
          l1.className = "caption-line";
          l1.id = "b" + bi + "L1";
          block.line1.forEach(function (pair, wi) {
            var span = document.createElement("span");
            span.className = CLASS_MAP[pair[1]];
            span.id = "b" + bi + "L1w" + wi;
            span.textContent = W[pair[0]].text;
            if (pair[1] === "e") {
              span.style.fontSize = l1Size + "px";
            } else {
              span.style.fontSize = l1Size + "px";
            }
            l1.appendChild(span);
          });
          el.appendChild(l1);

          if (block.line2) {
            var l2Size = computeLineSize(block.line2);
            var l2 = document.createElement("div");
            l2.className = "caption-line";
            l2.id = "b" + bi + "L2";
            block.line2.forEach(function (pair, wi) {
              var span = document.createElement("span");
              span.className = CLASS_MAP[pair[1]];
              span.id = "b" + bi + "L2w" + wi;
              span.textContent = W[pair[0]].text;
              if (pair[1] === "e") {
                span.style.fontSize = l2Size + "px";
              } else {
                span.style.fontSize = l2Size + "px";
              }
              l2.appendChild(span);
            });
            el.appendChild(l2);
          }

          stage.appendChild(el);
        });
      }

      buildBlocks();

      // Scale blocks that exceed safe width
      (function fitBlocks() {
        BLOCKS.forEach(function (block, bi) {
          var el = document.getElementById("b" + bi);
          el.style.opacity = "1";
          el.style.position = "relative";
          var lines = el.querySelectorAll(".caption-line");
          var maxW = 0;
          lines.forEach(function (line) {
            if (line.scrollWidth > maxW) maxW = line.scrollWidth;
          });
          if (maxW > SAFE_WIDTH) {
            var s = SAFE_WIDTH / maxW;
            el.style.transform = "scale(" + s + ")";
          }
          el.style.opacity = "0";
          el.style.position = "";
        });
      })();

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var allEls = BLOCKS.map(function (_, i) {
        return document.getElementById("b" + i);
      });

      function blockStart(bi) {
        return W[BLOCKS[bi].line1[0][0]].start;
      }

      BLOCKS.forEach(function (block, bi) {
        var el = allEls[bi];
        var start = blockStart(bi);
        var nextStart = bi < BLOCKS.length - 1 ? blockStart(bi + 1) : DURATION;

        allEls.forEach(function (other, oi) {
          if (oi !== bi) tl.set(other, { opacity: 0 }, start);
        });
        tl.set(el, { opacity: 1 }, start);

        block.line1.forEach(function (pair, wi) {
          var wordEl = document.getElementById("b" + bi + "L1w" + wi);
          var wordStart = W[pair[0]].start;
          tl.set(wordEl, { opacity: 0, scale: 1.12, transformOrigin: "0% 100%" }, start);
          tl.to(
            wordEl,
            { opacity: 1, scale: 1, duration: ENTRY_DUR, ease: "power2.out" },
            wordStart,
          );
        });

        if (block.line2) {
          var hasEmphasis = block.line2.some(function (p) {
            return p[1] === "e";
          });
          var l2El = document.getElementById("b" + bi + "L2");
          if (hasEmphasis) {
            var l2Start = W[block.line2[0][0]].start;
            tl.set(l2El, { opacity: 0, x: -1920 }, start);
            tl.to(l2El, { opacity: 1, x: 0, duration: SLIDE_DUR, ease: "power2.out" }, l2Start);
          } else {
            tl.set(l2El, { opacity: 1 }, start);
            block.line2.forEach(function (pair, wi) {
              var wordEl = document.getElementById("b" + bi + "L2w" + wi);
              var wordStart = W[pair[0]].start;
              tl.set(wordEl, { opacity: 0, scale: 1.12, transformOrigin: "0% 100%" }, start);
              tl.to(
                wordEl,
                { opacity: 1, scale: 1, duration: ENTRY_DUR, ease: "power2.out" },
                wordStart,
              );
            });
          }
        }

        tl.set(el, { opacity: 0 }, nextStart);
      });

      tl.to({}, { duration: DURATION }, 0);
      window.__timelines["caption-editorial-emphasis"] = tl;
    
} },
"caption-gradient-fill": { ...{"id":"caption-gradient-fill","duration":8,"fonts":["Montserrat"],"sourceSha256":"6d08dc0a9f54d25b25590721ec579a3521a0079c70f32b292bd93697384c60ff","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #gradient-fill {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      #gr-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .gr-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 24px;\n        padding: 0 80px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .gr-word {\n        font-family: \"Montserrat\", sans-serif;\n        font-weight: 900;\n        font-size: 100px;\n        display: inline-block;\n        letter-spacing: 0.04em;\n        line-height: 1.15;\n        padding-bottom: 0.05em;\n        -webkit-background-clip: text;\n        background-clip: text;\n        color: transparent;\n        background-size: 350% 100%;\n        background-position: 100% 0;\n      }\n    ", markup:"\n    <div\n      id=\"gradient-fill\"\n      data-composition-id=\"caption-gradient-fill\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div id=\"gr-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var GROUPS = __ctx.words ? [{wordStart:0,wordEnd:__ctx.words.length-1,start:__ctx.words[0].start,end:__ctx.duration}] : ([
          { wordStart: 0, wordEnd: 3, start: 0.0, end: 1.05 },
          { wordStart: 4, wordEnd: 7, start: 1.1, end: 2.05 },
          { wordStart: 8, wordEnd: 8, start: 2.1, end: 2.6 },
          { wordStart: 9, wordEnd: 12, start: 2.65, end: 3.5 },
          { wordStart: 13, wordEnd: 14, start: 3.55, end: 3.9 },
          { wordStart: 15, wordEnd: 16, start: 3.95, end: 4.75 },
          { wordStart: 17, wordEnd: 18, start: 4.9, end: 5.4 },
          { wordStart: 19, wordEnd: 22, start: 5.5, end: 6.2 },
          { wordStart: 23, wordEnd: 24, start: 6.35, end: 6.75 },
          { wordStart: 25, wordEnd: 27, start: 6.8, end: 7.8 },
        ]);

        var SIRI_GRAD =
          "linear-gradient(90deg, " +
          "#fe9f1b 0%, #f76e49 10%, #ff2063 20%, " +
          "#fd56cb 30%, #ef7aff 40%, #fe9f1b 50%, " +
          "white 50.5%, white 100%)";

        var container = document.getElementById("gr-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var groupText = groupWords
            .map(function (w) {
              return w.text;
            })
            .join(" ");
          var fontSize = fitFontSize(groupText, 100, "900", "'Montserrat', sans-serif", 1760);
          var grp = document.createElement("div");
          grp.className = "gr-group";
          grp.id = "gr-grp-" + gi;

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var span = document.createElement("span");
            span.className = "gr-word";
            span.id = "gr-w-" + wi;
            span.textContent = w.text;
            span.style.fontSize = fontSize + "px";
            span.style.background = SIRI_GRAD;
            span.style.backgroundSize = "350% 100%";
            span.style.backgroundPosition = "100% 0";
            span.style.webkitBackgroundClip = "text";
            span.style.backgroundClip = "text";
            grp.appendChild(span);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible", opacity: 1 }, g.start);

          var lastWordEnd = groupWords[groupWords.length - 1].end;
          var nextStart = gi < GROUPS.length - 1 ? GROUPS[gi + 1].start : lastWordEnd + 0.5;
          var gap = nextStart - lastWordEnd;
          var fadeDur = Math.min(0.25, gap * 0.8);
          var fadeStart = nextStart - fadeDur;
          var groupEnd = nextStart;

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var el = document.getElementById("gr-w-" + wi);
            var dur = w.end - w.start;

            tl.set(el, { backgroundPosition: "100% 0", scale: 1 }, g.start);
            tl.set(el, { scale: 1.04 }, w.start);
            tl.fromTo(
              el,
              { backgroundPosition: "45% 0" },
              { backgroundPosition: "0% 0", duration: dur, ease: "none" },
              w.start,
            );
            tl.set(el, { backgroundPosition: "100% 0" }, w.end);
            tl.to(el, { scale: 1, duration: 0.15, ease: "power2.out" }, w.end);
          });

          tl.to(grp, { opacity: 0, duration: fadeDur }, fadeStart);
          tl.set(grp, { visibility: "hidden" }, groupEnd);
        });

        window.__timelines["caption-gradient-fill"] = tl;
      })();
    
} },
"caption-kinetic-slam": { ...{"id":"caption-kinetic-slam","duration":8,"fonts":["Anton"],"sourceSha256":"86b7a54e045f626d1375636a2f1cde19c2f3cbdad1df1d7d0204fe6b4452044a","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #kinetic-slam {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .kt-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #kt-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .kt-word {\n        font-family: \"Anton\", sans-serif;\n        font-weight: 400;\n        text-transform: uppercase;\n        color: #ffffff;\n        position: absolute;\n        left: 0;\n        width: 100%;\n        text-align: center;\n        top: 50%;\n        letter-spacing: 0.04em;\n        line-height: 1;\n        opacity: 0;\n        visibility: hidden;\n      }\n    ", markup:"\n    <div\n      id=\"kinetic-slam\"\n      data-composition-id=\"caption-kinetic-slam\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"kt-overlay\"></div>\n      <div id=\"kt-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        function mulberry32(seed) {
          return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var KEYWORDS = __ctx.words ? __ctx.keywords(false) : (new Set([8, 12, 15, 24, 27])); // HyperFrames, HTML, professional, code, cinema.

        var container = document.getElementById("kt-container");
        var tl = gsap.timeline({ paused: true });

        WORDS.forEach(function (w, wi) {
          var el = document.createElement("div");
          el.className = "kt-word";
          el.id = "kt-w-" + wi;
          el.textContent = w.text.toUpperCase();
          el.style.fontSize =
            fitFontSize(w.text.toUpperCase(), 220, "400", "'Anton', sans-serif", 1720) + "px";
          if (KEYWORDS.has(wi)) el.style.color = "#FFD700";
          container.appendChild(el);

          gsap.set(el, { yPercent: -50 });

          var entranceMode = wi % 4;
          tl.set(el, { visibility: "visible" }, w.start);
          if (entranceMode === 0) {
            tl.fromTo(
              el,
              { y: -120, opacity: 0 },
              { y: 0, opacity: 1, duration: 0.22, ease: "back.out(1.7)" },
              w.start,
            );
          } else if (entranceMode === 1) {
            tl.fromTo(
              el,
              { x: -300, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.2, ease: "expo.out" },
              w.start,
            );
          } else if (entranceMode === 2) {
            tl.fromTo(
              el,
              { x: 300, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.2, ease: "expo.out" },
              w.start,
            );
          } else {
            tl.fromTo(
              el,
              { scale: 0.4, opacity: 0 },
              { scale: 1, opacity: 1, duration: 0.24, ease: "back.out(2.2)" },
              w.start,
            );
          }

          tl.to(el, { opacity: 0, duration: 0.1, ease: "power2.in" }, w.end);
          tl.set(el, { opacity: 0, visibility: "hidden" }, w.end + 0.1);
        });

        tl.seek(0);
        window.__timelines["caption-kinetic-slam"] = tl;
      })();
    
} },
"caption-camera-follow": { ...{"id":"caption-camera-follow","duration":9,"fonts":[],"sourceSha256":"4a0da1ba065882e95274468c8f3e36f1094fc598c3c93be1fc63182e9e42953c","posterTime":4.1}, css:"\n          [data-composition-id=\"caption-camera-follow\"] {\n            --cf-accent: #ffd84d;\n            --ink: #ffffff;\n            position: absolute;\n            inset: 0;\n            overflow: hidden;\n            background: transparent;\n            pointer-events: none;\n          }\n          #cf-stage {\n            position: absolute;\n            inset: 0;\n            overflow: hidden;\n          }\n          #cf-world {\n            position: absolute;\n            left: 0;\n            top: 0;\n            width: 0;\n            height: 0;\n            --amt: 0px;\n          }\n          .cf-word {\n            position: absolute;\n            white-space: nowrap;\n            font-family: \"Helvetica Neue\", Helvetica, Arial, sans-serif;\n            font-weight: 700;\n            text-transform: uppercase;\n            letter-spacing: 0.005em;\n            line-height: 0.78;\n            color: var(--ink);\n            opacity: 0;\n            --k: 0;\n            filter: blur(calc(var(--k) * var(--amt)));\n          }\n          .cf-word.is-accent {\n            color: var(--cf-accent);\n          }\n          #cf-vignette {\n            position: absolute;\n            inset: 0;\n            background: radial-gradient(\n              ellipse at 50% 50%,\n              rgba(0, 0, 0, 0) 42%,\n              rgba(0, 0, 0, 0.55) 100%\n            );\n          }\n        ", markup:"\n    \n      <div\n        id=\"root\"\n        class=\"clip cf-root\"\n        data-composition-id=\"caption-camera-follow\"\n        data-duration=\"9\"\n        data-fps=\"30\"\n        data-composition-variables='[\n          { \"id\": \"accent\", \"type\": \"enum\", \"role\": \"style\", \"label\": \"Accent\", \"description\": \"Colour of the highlighted words. gold is the original.\", \"default\": \"gold\", \"options\": [{ \"value\": \"gold\", \"label\": \"Gold\" }, { \"value\": \"green\", \"label\": \"Green\" }, { \"value\": \"blue\", \"label\": \"Blue\" }, { \"value\": \"violet\", \"label\": \"Violet\" }] },\n          { \"id\": \"framing\", \"type\": \"enum\", \"role\": \"style\", \"label\": \"Framing\", \"description\": \"Air the camera leaves around the written block, so the words land larger or smaller in frame.\", \"default\": \"standard\", \"options\": [{ \"value\": \"tight\", \"label\": \"Tight\" }, { \"value\": \"standard\", \"label\": \"Standard\" }, { \"value\": \"wide\", \"label\": \"Wide\" }] },\n          { \"id\": \"smear\", \"type\": \"enum\", \"role\": \"style\", \"label\": \"Smear\", \"description\": \"Scales the radial motion blur each camera move carries, from none to a heavy streak.\", \"default\": \"standard\", \"options\": [{ \"value\": \"off\", \"label\": \"Off\" }, { \"value\": \"subtle\", \"label\": \"Subtle\" }, { \"value\": \"standard\", \"label\": \"Standard\" }, { \"value\": \"heavy\", \"label\": \"Heavy\" }] }\n        ]'\n      >\n        \n\n        <div id=\"cf-stage\">\n          <div id=\"cf-world\"></div>\n        </div>\n        <div id=\"cf-vignette\"></div>\n\n        \n        \n      </div>\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

          (function () {
            gsap.defaults({ immediateRender: false });

            /* Cubic bezier solver. Newton first, bisection as the fallback, so it is
               exact and deterministic for every input. */
            function bezier(x1, y1, x2, y2) {
              function curve(t, a1, a2) {
                var A = 1 - 3 * a2 + 3 * a1;
                var B = 3 * a2 - 6 * a1;
                var C = 3 * a1;
                return ((A * t + B) * t + C) * t;
              }
              function slope(t, a1, a2) {
                var A = 1 - 3 * a2 + 3 * a1;
                var B = 3 * a2 - 6 * a1;
                var C = 3 * a1;
                return (3 * A * t + 2 * B) * t + C;
              }
              return function (p) {
                if (p <= 0) return 0;
                if (p >= 1) return 1;
                var t = p;
                for (var i = 0; i < 8; i++) {
                  var d = slope(t, x1, x2);
                  if (Math.abs(d) < 1e-6) break;
                  var e = curve(t, x1, x2) - p;
                  if (Math.abs(e) < 1e-7) return curve(t, y1, y2);
                  t -= e / d;
                }
                var lo = 0;
                var hi = 1;
                t = p;
                for (var j = 0; j < 24; j++) {
                  var x = curve(t, x1, x2);
                  if (Math.abs(x - p) < 1e-7) break;
                  if (x > p) hi = t;
                  else lo = t;
                  t = (lo + hi) / 2;
                }
                return curve(t, y1, y2);
              };
            }

            /* Leaves the mark fast, spends most of its time arriving. */
            var EASE_STEP = bezier(0.31, 0, 0.11, 1);
            /* The closing pull back: slower to leave, glides a long way out. */
            var EASE_WIDE = bezier(0.42, 0, 0.14, 1);
            /* Word ink coming up. */
            var EASE_INK = bezier(0.2, 0.7, 0.3, 1);
            /* Blur rising into the move and wiped off out of it. */
            var EASE_BLUR_UP = bezier(0.2, 0.8, 0.4, 1);
            var EASE_BLUR_DOWN = bezier(0.5, 0, 0.2, 1);

            var vars =
              window.__hyperframes && window.__hyperframes.getVariables
                ? window.__hyperframes.getVariables()
                : {};

            /* Unrecognised overrides return to their declared defaults. */
            function pick(table, value, fallback) {
              return Object.prototype.hasOwnProperty.call(table, value) ? value : fallback;
            }

            var ACCENTS = {
              gold: "#ffd84d",
              green: "#34d399",
              blue: "#38bdf8",
              violet: "#a78bfa",
            };
            /* Framing scales the margin every camera pose is fitted with, so one
               number moves the whole shot in or out without touching cadence. */
            var FRAMINGS = { tight: 0.82, standard: 1, wide: 1.25 };
            var SMEARS = { off: 0, subtle: 0.5, standard: 1, heavy: 1.9 };

            var ACCENT = ACCENTS[pick(ACCENTS, vars.accent, "gold")];
            var FRAMING = FRAMINGS[pick(FRAMINGS, vars.framing, "standard")];
            var SMEAR = SMEARS[pick(SMEARS, vars.smear, "standard")];

            var DUR = __ctx.duration ?? (9);
            var STEP = 0.52;
            var MOVE = 0.4;

            var WORDS = __ctx.words ?? ([
              { text: "write" },
              { text: "the" },
              { text: "html", accent: true },
              { text: "and" },
              { text: "the" },
              { text: "video", accent: true },
              { text: "renders" },
              { text: "itself" },
              { text: "no" },
              { text: "timeline" },
              { text: "no" },
              { text: "keyframes", accent: true },
              { text: "just" },
              { text: "code", accent: true },
            ]);

            var world = document.getElementById("cf-world");
            var stage = document.getElementById("cf-stage");
            /* The runtime strips the root id on clone, so reach the root through a
               descendant instead of getElementById. */
            var root = stage.parentElement;
            var FRAME_W = root.clientWidth || 1080;
            var FRAME_H = root.clientHeight || 1920;
            root.style.setProperty("--cf-accent", ACCENT);

            /* Base size is picked so the opening shot sits near 1:1. Everything after it
               is a pull back, so the world is only ever scaled down and type stays crisp. */
            var BASE = Math.max(FRAME_W, FRAME_H) * 0.16;
            /* Each new word is this fraction of the current box height. */
            var RATIO = 0.72;
            var MARGIN = 1.36 * FRAMING;

            var ruler = document.createElement("div");
            ruler.style.cssText =
              "position:absolute;left:-99999px;top:0;white-space:nowrap;visibility:hidden;" +
              'font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-weight:700;' +
              "text-transform:uppercase;letter-spacing:0.005em;line-height:0.78";
            world.appendChild(ruler);

            var box = null;
            WORDS.forEach(function (wd, i) {
              var fs = i === 0 ? BASE : (box.y1 - box.y0) * RATIO;
              ruler.style.fontSize = fs + "px";
              ruler.textContent = wd.text;
              var w = ruler.getBoundingClientRect().width;
              var h = fs * 0.78;
              var gap = fs * 0.07;

              var x, y;
              if (i === 0) {
                x = 0;
                y = 0;
              } else if ((box.x1 - box.x0) / (box.y1 - box.y0) < FRAME_W / FRAME_H) {
                /* block is narrower than the frame, so grow sideways: to the right of
                   everything, sitting on the same baseline */
                x = box.x1 + gap;
                y = box.y1 - h;
              } else {
                /* block is already wide enough, so grow downward: onto a new line under
                   everything, left edges aligned */
                x = box.x0;
                y = box.y1 + gap;
              }

              wd.fs = fs;
              wd.x = x;
              wd.y = y;

              box = box
                ? {
                    x0: Math.min(box.x0, x),
                    y0: Math.min(box.y0, y),
                    x1: Math.max(box.x1, x + w),
                    y1: Math.max(box.y1, y + h),
                  }
                : { x0: x, y0: y, x1: x + w, y1: y + h };
              wd.box = { x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 };
            });
            world.removeChild(ruler);

            var FULL = __ctx.activeColor ?? (box);

            function poseFor(b, margin) {
              var bw = (b.x1 - b.x0) * margin;
              var bh = (b.y1 - b.y0) * margin;
              var s = Math.min(FRAME_W / bw, FRAME_H / bh);
              return {
                x: FRAME_W / 2 - (s * (b.x0 + b.x1)) / 2,
                y: FRAME_H / 2 - (s * (b.y0 + b.y1)) / 2,
                scale: s,
              };
            }

            var els = WORDS.map(function (wd) {
              var el = document.createElement("div");
              el.className = "cf-word" + (wd.accent ? " is-accent" : "");
              el.textContent = wd.text;
              el.style.left = wd.x + "px";
              el.style.top = wd.y + "px";
              el.style.fontSize = wd.fs + "px";
              world.appendChild(el);
              return el;
            });

            /* Re-derive every framing box from what the browser actually laid out, so
               the camera is fitted to real ink and never to arithmetic that drifted. */
            var run = null;
            els.forEach(function (el, i) {
              var r = {
                x0: el.offsetLeft,
                y0: el.offsetTop,
                x1: el.offsetLeft + el.offsetWidth,
                y1: el.offsetTop + el.offsetHeight,
              };
              run = run
                ? {
                    x0: Math.min(run.x0, r.x0),
                    y0: Math.min(run.y0, r.y0),
                    x1: Math.max(run.x1, r.x1),
                    y1: Math.max(run.y1, r.y1),
                  }
                : r;
              WORDS[i].box = { x0: run.x0, y0: run.y0, x1: run.x1, y1: run.y1 };
            });
            FULL = run;

            /* Rest state is pinned outside the timeline. */
            var first = poseFor(WORDS[0].box, MARGIN);
            gsap.set(world, {
              transformOrigin: "0 0",
              x: first.x,
              y: first.y,
              scale: first.scale,
            });
            gsap.set(els, { opacity: 0, "--k": 0 });
            gsap.set(world, { "--amt": "0px" });
            /* The first word is already on the page when the shot opens, so frame zero
               is never empty. */
            gsap.set(els[0], { opacity: 1 });

            var tl = gsap.timeline({ paused: true });
            /* Peak smear at the rim of the frame, in screen pixels. */
            var BLUR = FRAME_W * 0.026 * SMEAR;
            var HALF_DIAG = Math.sqrt(FRAME_W * FRAME_W + FRAME_H * FRAME_H) / 2;

            /* Radial blur, the way a real zoom smears: a point far from the centre of
               the move sweeps across more of the frame than one sitting on it, so it
               streaks more. Each word gets its own share, --k, of one shared amount,
               --amt, which is the only thing that animates. The share is fixed for the
               length of a move and set with the camera, so this stays one tween per
               move rather than one per word per move. --amt is authored in world units,
               because a filter on a scaled child is applied before the scale, so the
               screen blur has to be divided back out by the camera scale. */
            function smear(centre, scale, count, at, up, down, peak) {
              for (var j = 0; j < count; j++) {
                var el = els[j];
                var cx = el.offsetLeft + el.offsetWidth / 2;
                var cy = el.offsetTop + el.offsetHeight / 2;
                var d =
                  (scale *
                    Math.sqrt(
                      (cx - centre.x) * (cx - centre.x) + (cy - centre.y) * (cy - centre.y),
                    )) /
                  HALF_DIAG;
                tl.set(el, { "--k": (0.2 + 1.15 * Math.min(1, d)).toFixed(3) }, at);
              }
              var amt = peak / scale;
              tl.fromTo(
                world,
                { "--amt": "0px" },
                { "--amt": amt + "px", duration: up, ease: EASE_BLUR_UP },
                at,
              );
              tl.to(world, { "--amt": "0px", duration: down, ease: EASE_BLUR_DOWN }, at + up);
            }

            WORDS.forEach(function (wd, i) {
              var t = __ctx.words ? wd.start : (i * STEP);
              if (i === 0) return;

              tl.fromTo(els[i], { opacity: 0 }, { opacity: 1, duration: 0.16, ease: EASE_INK }, t);

              var p = poseFor(wd.box, MARGIN);
              tl.to(world, { x: p.x, y: p.y, scale: p.scale, duration: MOVE, ease: EASE_STEP }, t);

              smear(
                { x: (wd.box.x0 + wd.box.x1) / 2, y: (wd.box.y0 + wd.box.y1) / 2 },
                p.scale,
                i + 1,
                t,
                MOVE * 0.24,
                MOVE * 0.44,
                BLUR,
              );
            });

            /* The resolve: the same pull back, carried all the way out. */
            var wide = poseFor(FULL, 1.2 * FRAMING);
            var wideAt = __ctx.words ? Math.max(__ctx.words.at(-1).start + .1, __ctx.duration - .3) : ((WORDS.length - 1) * STEP + 0.62);
            tl.to(
              world,
              {
                x: wide.x,
                y: wide.y,
                scale: wide.scale,
                duration: 0.94,
                ease: EASE_WIDE,
              },
              wideAt,
            );
            smear(
              { x: (FULL.x0 + FULL.x1) / 2, y: (FULL.y0 + FULL.y1) / 2 },
              wide.scale,
              els.length,
              wideAt,
              0.3,
              0.58,
              BLUR * 0.8,
            );

            tl.set({}, {}, DUR);
            tl.seek(0);

            window.__timelines = window.__timelines || {};
            window.__timelines["caption-camera-follow"] = tl;
          })();
        
} },
"caption-parallax-layers": { ...{"id":"caption-parallax-layers","duration":8,"fonts":["Instrument Serif"],"sourceSha256":"e1c14eb380fa7d7b8c84798e40530e946ed140547c61d2e6f5111d712cb72d78","posterTime":3.08}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Instrument Serif\", serif;\n      }\n\n      #parallax-layers {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      /* Behind captions: big red 3D text */\n      .behind-caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      /* Front captions */\n      .front-caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 30;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .behind-safe-zone {\n        position: absolute;\n        top: 40px;\n        left: 0;\n        width: 1920px;\n        height: 500px;\n      }\n\n      .front-safe-zone {\n        position: absolute;\n        top: 700px;\n        left: 0;\n        width: 1920px;\n        height: 300px;\n      }\n\n      .caption-block {\n        position: absolute;\n        left: 50%;\n        top: 0;\n        transform: translateX(-50%);\n        opacity: 0;\n        transform-origin: 50% 50%;\n        will-change: transform, opacity;\n        backface-visibility: hidden;\n      }\n\n      .caption-line {\n        display: flex;\n        align-items: baseline;\n        justify-content: center;\n        gap: 14px;\n        line-height: 1.1;\n        white-space: nowrap;\n      }\n\n      .caption-line--behind {\n        transform: scaleY(2.8);\n        transform-origin: 50% 0%;\n      }\n\n      .word {\n        display: inline-block;\n        will-change: transform, opacity;\n        backface-visibility: hidden;\n      }\n\n      .word--behind {\n        font-family: \"Instrument Serif\", serif;\n        font-size: 220px;\n        font-weight: 400;\n        font-style: normal;\n        line-height: 0.9;\n        color: #e50914;\n        -webkit-text-stroke: 5px #e50914;\n        text-shadow: 2px 4px 4px #a30610;\n      }\n\n      .word--front-normal {\n        font-family: \"Instrument Serif\", serif;\n        font-size: 130px;\n        font-weight: 400;\n        font-style: normal;\n        color: #eeeeee;\n        text-shadow:\n          0 2px 12px rgba(0, 0, 0, 0.6),\n          0 4px 24px rgba(0, 0, 0, 0.35);\n      }\n\n      .word--front-italic {\n        font-family: \"Instrument Serif\", serif;\n        font-size: 130px;\n        font-weight: 400;\n        font-style: italic;\n        color: #eeeeee;\n        text-shadow:\n          0 2px 12px rgba(0, 0, 0, 0.6),\n          0 4px 24px rgba(0, 0, 0, 0.35);\n      }\n    ", markup:"\n    <div\n      id=\"parallax-layers\"\n      data-composition-id=\"caption-parallax-layers\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"behind-caption-layer\" aria-hidden=\"true\">\n        <div id=\"behind-stage\" class=\"behind-safe-zone\"></div>\n      </div>\n\n      <div class=\"front-caption-layer\" aria-hidden=\"true\">\n        <div id=\"front-stage\" class=\"front-safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var BEHIND_WIDTH = 1800;
      var FRONT_WIDTH = 1750;
      var ENTRY_DUR = 0.1;
      var SLIDE_DUR = 0.2;

      var _fitCanvas = document.createElement("canvas");
      var _fitCtx = _fitCanvas.getContext("2d");
      function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
        var size = baseFontSize;
        var minSize = Math.floor(baseFontSize * 0.45);
        while (size > minSize) {
          _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
          if (_fitCtx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      }

      var W = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      // behind=red 3D emphasis words, front=normal white words
      var BLOCKS = __ctx.words ? __ctx.blocks("caption-parallax-layers") : ([
        { behind: null, front: [[0], [1], [2]] },
        { behind: [[3]], front: [[4], [5]] },
        { behind: [[6]], front: [[7]] },
        { behind: [[8]], front: [[9], [10], [11]] },
        { behind: [[12]], front: [[13], [14]] },
        { behind: [[15]], front: [[16]] },
        { behind: null, front: [[17], [18]] },
        { behind: null, front: [[19], [20], [21], [22]] },
        { behind: [[24]], front: [[23], [25], [26]] },
        { behind: [[27]], front: null },
      ]);

      var behindStage = document.getElementById("behind-stage");
      var frontStage = document.getElementById("front-stage");

      BLOCKS.forEach(function (block, bi) {
        var bEl = document.createElement("div");
        bEl.className = "caption-block";
        bEl.id = "bb" + bi;
        if (block.behind) {
          var behindText = block.behind
            .map(function (wi_arr) {
              return W[wi_arr[0]].text;
            })
            .join(" ");
          var behindSize = fitFontSize(behindText, 220, "400", "Instrument Serif", BEHIND_WIDTH);
          var bLine = document.createElement("div");
          bLine.className = "caption-line caption-line--behind";
          block.behind.forEach(function (wi_arr, wi) {
            var span = document.createElement("span");
            span.className = "word word--behind";
            span.id = "bb" + bi + "w" + wi;
            span.textContent = W[wi_arr[0]].text;
            span.style.fontSize = behindSize + "px";
            bLine.appendChild(span);
          });
          bEl.appendChild(bLine);
        }
        behindStage.appendChild(bEl);

        var fEl = document.createElement("div");
        fEl.className = "caption-block";
        fEl.id = "fb" + bi;
        if (block.front) {
          var frontText = block.front
            .map(function (wi_arr) {
              return W[wi_arr[0]].text;
            })
            .join(" ");
          var frontSize = fitFontSize(frontText, 130, "400", "Instrument Serif", FRONT_WIDTH);
          var fLine = document.createElement("div");
          fLine.className = "caption-line";
          block.front.forEach(function (wi_arr, wi) {
            var span = document.createElement("span");
            var isItalic = wi_arr[0] === 7 || wi_arr[0] === 18; // frame., timeline.
            span.className = "word " + (isItalic ? "word--front-italic" : "word--front-normal");
            span.id = "fb" + bi + "w" + wi;
            span.textContent = W[wi_arr[0]].text;
            span.style.fontSize = frontSize + "px";
            fLine.appendChild(span);
          });
          fEl.appendChild(fLine);
        }
        frontStage.appendChild(fEl);
      });

      var allBehind = BLOCKS.map(function (_, i) {
        return document.getElementById("bb" + i);
      });
      var allFront = BLOCKS.map(function (_, i) {
        return document.getElementById("fb" + i);
      });

      function applyBehindScales() {
        BLOCKS.forEach(function (block, bi) {
          if (block.behind) {
            var line = allBehind[bi].querySelector(".caption-line");
            if (line) {
              var natW = line.scrollWidth;
              if (natW > 0) {
                var s = BEHIND_WIDTH / natW;
                line.style.transform = "scaleX(" + s + ") scaleY(2.8)";
              }
            }
          }
        });
      }
      applyBehindScales();

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      function blockStart(bi) {
        var b = BLOCKS[bi];
        var firstIdx = __ctx.words ? 0 : (b.behind ? b.behind[0][0] : b.front[0][0]);
        return W[firstIdx].start;
      }

      BLOCKS.forEach(function (block, bi) {
        var start = blockStart(bi);
        var nextStart = bi < BLOCKS.length - 1 ? blockStart(bi + 1) : DURATION;
        var bEl = allBehind[bi];
        var fEl = allFront[bi];

        allBehind.forEach(function (other, oi) {
          if (oi !== bi) tl.set(other, { opacity: 0 }, start);
        });
        allFront.forEach(function (other, oi) {
          if (oi !== bi) tl.set(other, { opacity: 0 }, start);
        });

        if (block.behind) {
          tl.set(bEl, { opacity: 1 }, start);
          block.behind.forEach(function (wi_arr, wi) {
            var wordEl = document.getElementById("bb" + bi + "w" + wi);
            var wordStart = W[wi_arr[0]].start;
            tl.set(wordEl, { opacity: 0 }, start);
            tl.to(wordEl, { opacity: 1, duration: ENTRY_DUR, ease: "power2.out" }, wordStart);
          });
        }

        if (block.front) {
          tl.set(fEl, { opacity: 1 }, start);
          block.front.forEach(function (wi_arr, wi) {
            var wordEl = document.getElementById("fb" + bi + "w" + wi);
            var wordStart = W[wi_arr[0]].start;
            tl.set(wordEl, { opacity: 0 }, start);
            tl.set(wordEl, { opacity: 1 }, wordStart);
          });
        }

        tl.set(bEl, { opacity: 0 }, nextStart);
        tl.set(fEl, { opacity: 0 }, nextStart);
      });

      tl.to({}, { duration: DURATION }, 0);
      window.__timelines["caption-parallax-layers"] = tl;

      document.fonts.ready.then(function () {
        applyBehindScales();
      });
    
} },
"caption-emoji-pop": { ...{"id":"caption-emoji-pop","duration":8,"fonts":["Gabarito"],"sourceSha256":"79e7cad5cf54dec70e7af59c8d0583531017bacca6bc9ee057bfad386904eb9b","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Gabarito\", Arial, sans-serif;\n      }\n\n      #emoji-pop {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      .caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 20;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .safe-zone {\n        position: absolute;\n        bottom: 80px;\n        left: 50%;\n        transform: translateX(-50%);\n        width: 1400px;\n        height: 280px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n\n      .caption-group {\n        position: absolute;\n        left: 0;\n        top: 0;\n        width: 1400px;\n        height: 280px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        opacity: 0;\n        transform-origin: 50% 50%;\n        will-change: transform;\n        backface-visibility: hidden;\n      }\n\n      .caption-emoji {\n        position: absolute;\n        top: 50%;\n        left: 50%;\n        transform: translate(-50%, calc(-50% - 70px));\n        font-family: \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Noto Color Emoji\", sans-serif;\n        font-size: 56px;\n        line-height: 1;\n        text-align: center;\n      }\n\n      .caption-line {\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        gap: 14px;\n        width: max-content;\n        max-width: 1400px;\n        line-height: 1.1;\n        white-space: nowrap;\n      }\n\n      .caption-word {\n        display: inline-block;\n        color: #ffffff;\n        font-family: \"Gabarito\", Arial, sans-serif;\n        font-weight: 900;\n        font-size: 72px;\n        line-height: 1.1;\n        letter-spacing: -0.03em;\n        text-transform: uppercase;\n        -webkit-text-stroke: 3px #000000;\n        paint-order: stroke fill;\n      }\n    ", markup:"\n    <div\n      id=\"emoji-pop\"\n      data-composition-id=\"caption-emoji-pop\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"caption-layer\" aria-hidden=\"true\">\n        <div id=\"caption-stage\" class=\"safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var SAFE_ZONE_WIDTH = 1400;
      var CAPTION_FONT_SIZE = 72;
      var MAX_WORDS_PER_GROUP = __ctx.words ? __ctx.words.length : (3);
      var WORD_SPACING = 14;
      var PAUSE_THRESHOLD = __ctx.words ? Infinity : (0.1);
      var ENTRY_FRAMES = 4;
      var EXIT_FRAMES = 3;
      var FPS = 30;
      var ENTRY_DURATION = ENTRY_FRAMES / FPS;
      var EXIT_DURATION = EXIT_FRAMES / FPS;
      var FONT_WIDTH_SAFETY = 1.14;
      var PRIMARY_COLOR = __ctx.color ?? ("#FFFFFF");
      var ACCENT_COLORS = __ctx.activeColor ? [__ctx.activeColor] : (["#FF76FF", "#FF0002", "#B2F7FF"]);
      var KEYWORDS = __ctx.words ? __ctx.keywords(true) : (new Set(["hyperframes", "html", "professional", "code", "cinema"]));
      var TRANSITION_WORDS = new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "is",
        "are",
        "was",
        "were",
        "to",
        "of",
        "in",
        "on",
        "at",
        "for",
        "with",
        "by",
        "from",
        "as",
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "be",
        "been",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "can",
        "if",
        "then",
        "so",
        "just",
        "not",
        "no",
        "yes",
        "up",
        "out",
        "about",
      ]);

      // Emoji map for key words
      var WORD_EMOJI = __ctx.words ? __ctx.emojis : ({
        hyperframes: "🎬",
        html: "💻",
        professional: "✨",
        code: "⌨️",
        cinema: "🎥",
        video: "📹",
        frame: "🖼️",
      });

      var TRANSCRIPT = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      function normalizeWords(rawWords) {
        return rawWords
          .map(function (item) {
            var text = String(item.word || item.text || "").trim();
            var clean = __ctx.cleanWord(text);
            return {
              text: text,
              start: Math.max(0, Number(item.start) || 0),
              end: Math.min(DURATION, Math.max(Number(item.start) || 0, Number(item.end) || 0)),
              emoji: WORD_EMOJI[clean] || null,
            };
          })
          .filter(function (word) {
            return word.text.length > 0;
          });
      }

      function seededRandom(seed) {
        var x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
      }

      function assignWordColors(words, groupIndex) {
        return words.map(function (word, index) {
          var clean = __ctx.cleanWord(word.text);
          if (KEYWORDS.has(clean)) {
            var ci = Math.floor(seededRandom(groupIndex * 23 + index * 31) * ACCENT_COLORS.length);
            return ACCENT_COLORS[ci];
          }
          if (TRANSITION_WORDS.has(clean)) return PRIMARY_COLOR;
          var rand = seededRandom(groupIndex * 13 + index);
          if (rand > 0.55) {
            var ci2 = Math.floor(rand * ACCENT_COLORS.length) % ACCENT_COLORS.length;
            return ACCENT_COLORS[ci2];
          }
          return PRIMARY_COLOR;
        });
      }

      var _fitCanvas = document.createElement("canvas");
      var _fitCtx = _fitCanvas.getContext("2d");
      function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
        var size = baseFontSize;
        var minSize = Math.floor(baseFontSize * 0.45);
        while (size > minSize) {
          _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
          if (_fitCtx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      }

      var measureCanvas = document.createElement("canvas");
      var measureContext = measureCanvas.getContext("2d");

      function measureWord(word, fontSize) {
        measureContext.font = "900 " + fontSize + "px Gabarito";
        return measureContext.measureText(word.text.toUpperCase()).width * FONT_WIDTH_SAFETY;
      }

      function measureLineWidth(words, fontSize) {
        return words.reduce(function (total, word, index) {
          return total + measureWord(word, fontSize) + (index ? WORD_SPACING : 0);
        }, 0);
      }

      function fitsLine(words) {
        return measureLineWidth(words, CAPTION_FONT_SIZE) <= SAFE_ZONE_WIDTH;
      }

      function makeGroups(words) {
        var groups = [];
        var current = [];
        words.forEach(function (word, index) {
          var nextWord = words[index + 1];
          var testGroup = current.concat([word]);
          if (testGroup.length > MAX_WORDS_PER_GROUP || !fitsLine(testGroup)) {
            if (current.length) groups.push(makeGroup(current, groups.length));
            current = [word];
            return;
          }
          current.push(word);
          var punctuation = /[,.:!?]$/.test(word.text);
          var pause = nextWord ? nextWord.start - word.end : 0;
          if (
            !nextWord ||
            punctuation ||
            pause >= PAUSE_THRESHOLD ||
            current.length >= MAX_WORDS_PER_GROUP
          ) {
            groups.push(makeGroup(current, groups.length));
            current = [];
          }
        });
        if (current.length) groups.push(makeGroup(current, groups.length));
        return groups;
      }

      function makeGroup(words, groupIndex) {
        var colors = assignWordColors(words, groupIndex);
        var emoji = null;
        for (var i = 0; i < words.length; i++) {
          if (words[i].emoji) {
            emoji = words[i].emoji;
            break;
          }
        }
        return {
          words: words.slice(),
          colors: colors,
          emoji: emoji,
          start: words[0].start,
          end: words[words.length - 1].end,
        };
      }

      function shadowForColor(color) {
        var hex = color.replace("#", "");
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        return (
          "0 4px 8px rgba(0,0,0,0.7), 0 0 2px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",1), 0 0 8px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0.6)"
        );
      }

      function buildCaptions(groups) {
        var stage = document.getElementById("caption-stage");
        groups.forEach(function (group, groupIndex) {
          var groupText = group.words
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var computedSize = fitFontSize(
            groupText,
            CAPTION_FONT_SIZE,
            "900",
            "Gabarito",
            SAFE_ZONE_WIDTH,
          );
          var groupEl = document.createElement("div");
          groupEl.id = "caption-group-" + groupIndex;
          groupEl.className = "caption-group";

          if (group.emoji) {
            var emojiEl = document.createElement("div");
            emojiEl.className = "caption-emoji";
            emojiEl.textContent = group.emoji;
            groupEl.appendChild(emojiEl);
          }

          var lineEl = document.createElement("div");
          lineEl.className = "caption-line";
          group.words.forEach(function (word, wordIndex) {
            var color = group.colors[wordIndex] || PRIMARY_COLOR;
            var wordEl = document.createElement("span");
            wordEl.className = "caption-word";
            wordEl.textContent = word.text.toUpperCase();
            wordEl.style.color = color;
            wordEl.style.fontSize = computedSize + "px";
            wordEl.style.textShadow = shadowForColor(color);
            lineEl.appendChild(wordEl);
          });

          groupEl.appendChild(lineEl);
          stage.appendChild(groupEl);
        });
      }

      var WORDS = normalizeWords(TRANSCRIPT);
      var GROUPS = makeGroups(WORDS);
      buildCaptions(GROUPS);

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var visibleStarts = GROUPS.map(function (group, groupIndex) {
        var prev = GROUPS[groupIndex - 1];
        var availableGap = prev ? Math.max(0, group.start - prev.end) : ENTRY_DURATION;
        var entryLead = Math.min(ENTRY_DURATION, availableGap);
        return Math.max(0, group.start - entryLead);
      });

      var allGroupEls = GROUPS.map(function (_, i) {
        return document.getElementById("caption-group-" + i);
      });

      GROUPS.forEach(function (group, groupIndex) {
        var groupEl = allGroupEls[groupIndex];
        var visibleStart = visibleStarts[groupIndex];
        var visibleEnd = groupIndex < GROUPS.length - 1 ? visibleStarts[groupIndex + 1] : DURATION;
        var exitStart = Math.max(visibleStart, visibleEnd - EXIT_DURATION);

        allGroupEls.forEach(function (otherEl, otherIndex) {
          if (otherIndex !== groupIndex) tl.set(otherEl, { opacity: 0 }, visibleStart);
        });

        tl.set(groupEl, { opacity: 0, scaleX: 0.8, scaleY: 1 }, visibleStart);
        tl.to(
          groupEl,
          { opacity: 1, scaleX: 1, duration: ENTRY_DURATION, ease: "power3.out", force3D: true },
          visibleStart,
        );
        tl.to(
          groupEl,
          { scaleX: 0.75, opacity: 0.8, duration: EXIT_DURATION, ease: "power2.in", force3D: true },
          exitStart,
        );
        tl.set(groupEl, { opacity: 0 }, visibleEnd);
      });

      window.__timelines["caption-emoji-pop"] = tl;
    
} },
"caption-neon-accent": { ...{"id":"caption-neon-accent","duration":8,"fonts":["Montserrat"],"sourceSha256":"1c4af30ab35c6e3f754157cce2c364c75386f37059d47fa52446bca19200339d","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n        font-family: \"Montserrat\", Arial, sans-serif;\n      }\n\n      #neon-accent {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n\n      .caption-layer {\n        position: absolute;\n        inset: 0;\n        z-index: 20;\n        pointer-events: none;\n        transform: translateZ(0);\n      }\n\n      .safe-zone {\n        position: absolute;\n        bottom: 100px;\n        left: 50%;\n        transform: translateX(-50%);\n        width: 1400px;\n        height: 260px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n      }\n\n      .caption-group {\n        position: absolute;\n        left: 0;\n        top: 0;\n        width: 1400px;\n        height: 260px;\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        opacity: 0;\n        transform-origin: 50% 50%;\n        will-change: transform;\n        backface-visibility: hidden;\n      }\n\n      .caption-copy {\n        display: flex;\n        flex-direction: column;\n        align-items: center;\n        justify-content: center;\n        max-width: 1400px;\n        text-align: center;\n      }\n\n      .caption-line {\n        display: flex;\n        align-items: center;\n        justify-content: center;\n        gap: 16px;\n        width: max-content;\n        max-width: 1400px;\n        line-height: 1.1;\n        white-space: nowrap;\n      }\n\n      .caption-word {\n        display: inline-block;\n        color: #ffffff;\n        font-family: \"Montserrat\", Arial, sans-serif;\n        font-weight: 800;\n        font-size: 88px;\n        line-height: 1.1;\n        letter-spacing: 0;\n        text-transform: uppercase;\n      }\n\n      .caption-word.accent {\n        font-size: 106px;\n      }\n    ", markup:"\n    <div\n      id=\"neon-accent\"\n      data-composition-id=\"caption-neon-accent\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"caption-layer\" aria-hidden=\"true\">\n        <div id=\"caption-stage\" class=\"safe-zone\"></div>\n      </div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      var DURATION = __ctx.duration ?? (8);
      var SAFE_ZONE_WIDTH = 1400;
      var BASE_FONT_SIZE = 88;
      var ACCENT_FONT_SIZE = 106;
      var MIN_FONT_SIZE = 62;
      var MAX_WORDS_PER_GROUP = __ctx.words ? __ctx.words.length : (4);
      var WORD_SPACING = 16;
      var PAUSE_THRESHOLD = __ctx.words ? Infinity : (0.1);
      var ENTRY_DURATION = 7 / 30;
      var WIGGLE_DISTANCE = 14;
      var WIGGLE_CYCLE = 2 / 1.3;
      var FONT_WIDTH_SAFETY = 1.14;
      var PRIMARY_COLOR = __ctx.color ?? ("#FFFFFF");
      var ACCENT_COLORS = __ctx.activeColor ? [__ctx.activeColor] : (["#53FF01", "#FF0002", "#FCFF00"]);
      var TRANSITION_WORDS = new Set([
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "is",
        "are",
        "was",
        "were",
        "to",
        "of",
        "in",
        "on",
        "at",
        "for",
        "with",
        "by",
        "from",
        "as",
        "it",
        "its",
        "this",
        "that",
        "these",
        "those",
        "be",
        "been",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "can",
        "if",
        "then",
        "so",
        "just",
        "not",
        "no",
        "yes",
        "up",
        "out",
        "about",
        "lets",
        "you",
        "write",
        "render",
      ]);
      var KEYWORDS = __ctx.words ? __ctx.keywords(true) : (new Set(["hyperframes", "html", "professional", "code", "cinema"]));

      var TRANSCRIPT = __ctx.words ?? ([
        { text: "Every", start: 0.0, end: 0.3 },
        { text: "great", start: 0.3, end: 0.55 },
        { text: "video", start: 0.55, end: 0.85 },
        { text: "starts", start: 0.85, end: 1.1 },
        { text: "with", start: 1.1, end: 1.25 },
        { text: "a", start: 1.25, end: 1.35 },
        { text: "single", start: 1.35, end: 1.65 },
        { text: "frame.", start: 1.65, end: 2.0 },
        { text: "HyperFrames", start: 2.1, end: 2.65 },
        { text: "lets", start: 2.65, end: 2.85 },
        { text: "you", start: 2.85, end: 2.95 },
        { text: "write", start: 2.95, end: 3.15 },
        { text: "HTML", start: 3.15, end: 3.55 },
        { text: "and", start: 3.55, end: 3.65 },
        { text: "render", start: 3.65, end: 3.95 },
        { text: "professional", start: 3.95, end: 4.45 },
        { text: "video.", start: 4.45, end: 4.8 },
        { text: "No", start: 4.9, end: 5.05 },
        { text: "timeline.", start: 5.05, end: 5.45 },
        { text: "No", start: 5.5, end: 5.65 },
        { text: "drag", start: 5.65, end: 5.85 },
        { text: "and", start: 5.85, end: 5.95 },
        { text: "drop.", start: 5.95, end: 6.25 },
        { text: "Just", start: 6.35, end: 6.55 },
        { text: "code", start: 6.55, end: 6.8 },
        { text: "that", start: 6.8, end: 6.95 },
        { text: "becomes", start: 6.95, end: 7.3 },
        { text: "cinema.", start: 7.3, end: 7.7 },
      ]);

      var _fitCanvas = document.createElement("canvas");
      var _fitCtx = _fitCanvas.getContext("2d");
      function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
        var size = baseFontSize;
        var minSize = Math.floor(baseFontSize * 0.45);
        while (size > minSize) {
          _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
          if (_fitCtx.measureText(text).width <= maxWidth) return size;
          size -= 2;
        }
        return minSize;
      }

      gsap.registerPlugin && gsap.registerPlugin();

      function cleanText(text) {
        return String(text || "").trim();
      }

      function normalizeWords(rawWords) {
        return rawWords
          .map(function (item) {
            return {
              text: cleanText(item.word || item.text),
              start: Math.max(0, Number(item.start) || 0),
              end: Math.min(DURATION, Math.max(Number(item.start) || 0, Number(item.end) || 0)),
            };
          })
          .filter(function (word) {
            return word.text.length > 0;
          });
      }

      var measureCanvas = document.createElement("canvas");
      var measureContext = measureCanvas.getContext("2d");

      function seededRandom(seed) {
        var x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
      }

      function isKeyword(text) {
        return KEYWORDS.has(text.toLowerCase().replace(/[^a-z]/g, ""));
      }

      function assignWordColors(words, groupIndex) {
        return words.map(function (word) {
          if (isKeyword(word.text)) {
            var colorIndex = Math.floor(seededRandom(groupIndex * 23 + 7) * ACCENT_COLORS.length);
            return ACCENT_COLORS[colorIndex];
          }
          var clean = word.text.toLowerCase().replace(/[^a-z']/g, "");
          if (TRANSITION_WORDS.has(clean)) return PRIMARY_COLOR;
          var rand = seededRandom(groupIndex * 7 + words.indexOf(word));
          if (rand > 0.6) {
            var ci = Math.floor(rand * ACCENT_COLORS.length) % ACCENT_COLORS.length;
            return ACCENT_COLORS[ci];
          }
          return PRIMARY_COLOR;
        });
      }

      function measureWord(word, color, fontSize) {
        var size = color === PRIMARY_COLOR ? fontSize : fontSize * 1.2;
        measureContext.font = "800 " + size + "px Montserrat";
        return measureContext.measureText(word.text.toUpperCase()).width * FONT_WIDTH_SAFETY;
      }

      function measureLineWidth(words, colors, fontSize) {
        return words.reduce(function (total, word, index) {
          return (
            total +
            measureWord(word, colors[index] || PRIMARY_COLOR, fontSize) +
            (index ? WORD_SPACING : 0)
          );
        }, 0);
      }

      function splitLinesForGroup(words, colors, fontSize) {
        var maxLineWidth = SAFE_ZONE_WIDTH;
        if (
          words.some(function (word, i) {
            return measureWord(word, colors[i] || PRIMARY_COLOR, fontSize) > maxLineWidth;
          })
        )
          return null;
        if (measureLineWidth(words, colors, fontSize) <= maxLineWidth)
          return [{ words: words, colors: colors }];
        var best = null;
        var bestDiff = Infinity;
        for (var split = 1; split < words.length; split++) {
          var fw = words.slice(0, split),
            sw = words.slice(split);
          var fc = colors.slice(0, split),
            sc = colors.slice(split);
          var fW = measureLineWidth(fw, fc, fontSize);
          var sW = measureLineWidth(sw, sc, fontSize);
          if (fW <= maxLineWidth && sW <= maxLineWidth) {
            var diff = Math.abs(fW - sW);
            if (diff < bestDiff) {
              best = [
                { words: fw, colors: fc },
                { words: sw, colors: sc },
              ];
              bestDiff = diff;
            }
          }
        }
        return best;
      }

      function makeGroups(words) {
        var groups = [];
        var current = [];
        words.forEach(function (word, index) {
          var nextWord = words[index + 1];
          var testGroup = current.concat([word]);
          var exceedsWords = testGroup.length > MAX_WORDS_PER_GROUP;
          var colors = assignWordColors(testGroup, groups.length);
          var exceedsFit = !splitLinesForGroup(testGroup, colors, BASE_FONT_SIZE);
          if (exceedsWords || exceedsFit) {
            if (current.length) groups.push(makeGroup(current, groups.length));
            current = [word];
            return;
          }
          current.push(word);
          var punctuation = /[,.:!?]$/.test(word.text);
          var pause = nextWord ? nextWord.start - word.end : 0;
          if (
            !nextWord ||
            punctuation ||
            pause >= PAUSE_THRESHOLD ||
            current.length >= MAX_WORDS_PER_GROUP
          ) {
            groups.push(makeGroup(current, groups.length));
            current = [];
          }
        });
        if (current.length) groups.push(makeGroup(current, groups.length));
        return groups;
      }

      function makeGroup(words, groupIndex) {
        var colors = assignWordColors(words, groupIndex);
        var groupText = words
          .map(function (w) {
            return w.text.toUpperCase();
          })
          .join(" ");
        var fontSize = fitFontSize(groupText, BASE_FONT_SIZE, "800", "Montserrat", SAFE_ZONE_WIDTH);
        while (fontSize > MIN_FONT_SIZE && !splitLinesForGroup(words, colors, fontSize)) {
          fontSize -= 2;
        }
        return {
          words: words.slice(),
          colors: colors,
          fontSize: fontSize,
          lines: splitLinesForGroup(words, colors, fontSize) || [{ words: words, colors: colors }],
          start: words[0].start,
          end: words[words.length - 1].end,
        };
      }

      function shadowForColor(color) {
        var hex = color.replace("#", "");
        var r = parseInt(hex.slice(0, 2), 16);
        var g = parseInt(hex.slice(2, 4), 16);
        var b = parseInt(hex.slice(4, 6), 16);
        var glow =
          "0 0 4px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",1), 0 0 10px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0.9), 0 0 20px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0.7), 0 0 40px rgba(" +
          r +
          "," +
          g +
          "," +
          b +
          ",0.4)";
        return "0 8px 16px rgba(0,0,0,0.8), 0 16px 40px rgba(0,0,0,0.6), " + glow;
      }

      function buildCaptions(groups) {
        var stage = document.getElementById("caption-stage");
        groups.forEach(function (group, groupIndex) {
          var groupEl = document.createElement("div");
          var copyEl = document.createElement("div");
          groupEl.id = "caption-group-" + groupIndex;
          groupEl.className = "caption-group";
          copyEl.className = "caption-copy";
          group.lines.slice(0, 2).forEach(function (line) {
            var lineEl = document.createElement("div");
            lineEl.className = "caption-line";
            line.words.forEach(function (word, wordIndex) {
              var color = line.colors[wordIndex] || PRIMARY_COLOR;
              var wordEl = document.createElement("span");
              wordEl.className = color === PRIMARY_COLOR ? "caption-word" : "caption-word accent";
              wordEl.textContent = word.text.toUpperCase();
              wordEl.style.color = color;
              wordEl.style.fontSize =
                color === PRIMARY_COLOR ? group.fontSize + "px" : group.fontSize * 1.2 + "px";
              wordEl.style.textShadow = shadowForColor(color);
              lineEl.appendChild(wordEl);
            });
            copyEl.appendChild(lineEl);
          });
          groupEl.appendChild(copyEl);
          stage.appendChild(groupEl);
        });
      }

      var WORDS = normalizeWords(TRANSCRIPT);
      var GROUPS = makeGroups(WORDS);
      buildCaptions(GROUPS);

      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var visibleStarts = GROUPS.map(function (group, groupIndex) {
        var prev = GROUPS[groupIndex - 1];
        var availableGap = prev ? Math.max(0, group.start - prev.end) : ENTRY_DURATION;
        var entryLead = Math.min(ENTRY_DURATION, availableGap);
        return Math.max(0, group.start - entryLead);
      });

      var allGroupEls = GROUPS.map(function (_, i) {
        return document.getElementById("caption-group-" + i);
      });

      GROUPS.forEach(function (group, groupIndex) {
        var groupEl = allGroupEls[groupIndex];
        var visibleStart = visibleStarts[groupIndex];
        var visibleEnd = groupIndex < GROUPS.length - 1 ? visibleStarts[groupIndex + 1] : DURATION;
        var direction = groupIndex % 2 === 0 ? -1 : 1;
        var D = WIGGLE_DISTANCE * direction;
        var wiggleCycles = Math.max(1, Math.ceil((visibleEnd - visibleStart) / WIGGLE_CYCLE));

        allGroupEls.forEach(function (otherEl, otherIndex) {
          if (otherIndex !== groupIndex) tl.set(otherEl, { opacity: 0 }, visibleStart);
        });

        tl.set(groupEl, { opacity: 0, scale: 0.65, x: 0, y: 0 }, visibleStart);
        tl.to(
          groupEl,
          { opacity: 1, scale: 1, duration: ENTRY_DURATION, ease: "power3.out", force3D: true },
          visibleStart,
        );
        tl.to(
          groupEl,
          {
            x: D,
            y: D,
            duration: WIGGLE_CYCLE / 2,
            ease: "sine.inOut",
            yoyo: true,
            repeat: Math.max(0, wiggleCycles * 2 - 1),
            force3D: true,
          },
          visibleStart,
        );
        tl.set(groupEl, { opacity: 0 }, visibleEnd);
      });

      window.__timelines["caption-neon-accent"] = tl;
    
} },
"caption-neon-glow": { ...{"id":"caption-neon-glow","duration":8,"fonts":["Outfit"],"sourceSha256":"dc9d43d58879e1422837c213aa7f8921ca43b58f4e9c77f8463232585e05034c","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #neon-glow {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .ne-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #ne-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .ne-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 24px;\n        padding: 0 80px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .ne-word {\n        font-family: \"Outfit\", sans-serif;\n        font-weight: 900;\n        font-size: 96px;\n        text-transform: uppercase;\n        color: rgba(0, 255, 240, 0.14);\n        display: inline-block;\n        letter-spacing: 0.04em;\n        line-height: 1;\n      }\n    ", markup:"\n    <div\n      id=\"neon-glow\"\n      data-composition-id=\"caption-neon-glow\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"ne-overlay\"></div>\n      <div id=\"ne-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var GROUPS = __ctx.words ? [{wordStart:0,wordEnd:__ctx.words.length-1,start:__ctx.words[0].start,end:__ctx.duration}] : ([
          { wordStart: 0, wordEnd: 3, start: 0.0, end: 1.05 },
          { wordStart: 4, wordEnd: 7, start: 1.1, end: 2.05 },
          { wordStart: 8, wordEnd: 8, start: 2.1, end: 2.6 },
          { wordStart: 9, wordEnd: 12, start: 2.65, end: 3.5 },
          { wordStart: 13, wordEnd: 15, start: 3.55, end: 4.4 },
          { wordStart: 16, wordEnd: 16, start: 3.95, end: 4.75 },
          { wordStart: 17, wordEnd: 19, start: 4.9, end: 5.4 },
          { wordStart: 20, wordEnd: 22, start: 5.65, end: 6.2 },
          { wordStart: 23, wordEnd: 24, start: 6.35, end: 6.75 },
          { wordStart: 25, wordEnd: 27, start: 6.8, end: 7.8 },
        ]);

        // Keywords get pink glow; others get cyan glow
        var KEYWORDS = __ctx.words ? __ctx.keywords(false) : (new Set([8, 12, 15, 24, 27])); // HyperFrames, HTML, professional, code, cinema.

        var container = document.getElementById("ne-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var groupText = groupWords
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var fontSize = fitFontSize(groupText, 96, "900", "'Outfit', sans-serif", 1760);
          var grp = document.createElement("div");
          grp.className = "ne-group";
          grp.id = "ne-grp-" + gi;

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var span = document.createElement("span");
            span.className = "ne-word";
            span.id = "ne-w-" + wi;
            span.textContent = w.text;
            span.style.fontSize = fontSize + "px";
            grp.appendChild(span);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible", opacity: 0 }, g.start);
          tl.fromTo(grp, { opacity: 0 }, { opacity: 1, duration: 0.05, ease: "steps(1)" }, g.start);
          tl.fromTo(grp, { x: -8 }, { x: 0, duration: 0.14, ease: "power3.out" }, g.start + 0.05);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var el = document.getElementById("ne-w-" + wi);
            var isKW = KEYWORDS.has(wi);
            var activeColor = isKW ? "#FF0099" : "#00FFF0";
            tl.to(
              el,
              {
                color: activeColor,
                textShadow:
                  "0 0 10px " +
                  activeColor +
                  ", 0 0 35px " +
                  activeColor +
                  ", 0 0 90px " +
                  activeColor,
                duration: 0.06,
              },
              w.start,
            );
            tl.to(el, { color: __ctx.colorize("rgba(0,255,240,0.14)"), textShadow: "none", duration: 0.06 }, w.end);
          });

          tl.to(grp, { opacity: 0, x: 6, duration: 0.1, ease: "steps(1)" }, g.end - 0.1);
          tl.set(grp, { opacity: 0, visibility: "hidden" }, g.end);
        });

        window.__timelines["caption-neon-glow"] = tl;
      })();
    
} },
"caption-particle-burst": { ...{"id":"caption-particle-burst","duration":8,"fonts":["Outfit"],"sourceSha256":"48ec0a000e9c40cff891c2ca0e66ed4cf33c358bbeb2ca76fb3bdc8288bf5936","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #particle-burst {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .bs-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #bs-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .bs-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 24px;\n        padding: 0 100px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .bs-word {\n        font-family: \"Outfit\", sans-serif;\n        font-weight: 900;\n        font-size: 88px;\n        text-transform: uppercase;\n        color: rgba(255, 255, 255, 0.45);\n        display: inline-block;\n        letter-spacing: 0.05em;\n        line-height: 1;\n      }\n      .bs-particle {\n        position: absolute;\n        width: 10px;\n        height: 10px;\n        border-radius: 50%;\n        opacity: 0;\n        pointer-events: none;\n        z-index: 20;\n        left: 960px;\n        bottom: 180px;\n      }\n    ", markup:"\n    <div\n      id=\"particle-burst\"\n      data-composition-id=\"caption-particle-burst\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"bs-overlay\"></div>\n      <div id=\"bs-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        function mulberry32(seed) {
          return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        // Keywords get particle burst + gold color
        var KEYWORDS = __ctx.words ? __ctx.keywords(false) : (new Set([8, 12, 15, 24, 27])); // HyperFrames, HTML, professional, code, cinema.

        var RAW_GROUPS = __ctx.words ? [[0, __ctx.words.length - 1]] : ([
          [0, 3],
          [4, 7],
          [8, 8],
          [9, 12],
          [13, 15],
          [16, 16],
          [17, 19],
          [20, 22],
          [23, 24],
          [25, 27],
        ]);
        var GROUPS = RAW_GROUPS.map(function (pair, gi) {
          var ws = pair[0],
            we = pair[1];
          var nextStart = __ctx.words ? __ctx.duration : (gi + 1 < RAW_GROUPS.length ? WORDS[RAW_GROUPS[gi + 1][0]].start : 8.0);
          var gEnd = Math.min(WORDS[we].end + 0.35, nextStart - 0.05);
          return { wordStart: ws, wordEnd: we, start: WORDS[ws].start, end: gEnd };
        });

        var PARTICLE_COLORS = [
          "#FFD700",
          "#FF6B35",
          "#FF3C78",
          "#9B5DE5",
          "#00BBF9",
          "#00F5D4",
          "#ffffff",
          "#F15BB5",
        ];
        var NUM_PARTICLES = 10;

        var container = document.getElementById("bs-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var groupText = groupWords
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var fontSize = fitFontSize(groupText, 88, "900", "'Outfit', sans-serif", 1720);
          var grp = document.createElement("div");
          grp.className = "bs-group";
          grp.id = "bs-grp-" + gi;

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var span = document.createElement("span");
            span.className = "bs-word";
            span.id = "bs-w-" + wi;
            span.textContent = w.text.toUpperCase();
            span.style.fontSize = fontSize + "px";
            grp.appendChild(span);
          });

          container.appendChild(grp);
        });

        // Create particles for keyword words
        var particleData = {};
        WORDS.forEach(function (w, wi) {
          if (!KEYWORDS.has(wi)) return;
          var rng = mulberry32(wi * 137 + 99);
          particleData[wi] = [];
          for (var p = 0; p < NUM_PARTICLES; p++) {
            var angle = (p / NUM_PARTICLES) * Math.PI * 2 + rng() * 0.6;
            var dist = 120 + rng() * 200;
            var sz = 4 + rng() * 8;
            var dx = Math.cos(angle) * dist;
            var dy = -Math.sin(angle) * dist;
            var dot = document.createElement("div");
            dot.className = "bs-particle";
            dot.id = "bs-p-" + wi + "-" + p;
            dot.style.backgroundColor = PARTICLE_COLORS[p % PARTICLE_COLORS.length];
            dot.style.width = sz.toFixed(1) + "px";
            dot.style.height = sz.toFixed(1) + "px";
            container.appendChild(dot);
            particleData[wi].push({ el: dot, dx: dx, dy: dy });
          }
        });

        GROUPS.forEach(function (g, gi) {
          var grp = document.getElementById("bs-grp-" + gi);
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);

          tl.set(grp, { visibility: "visible" }, g.start);
          tl.fromTo(
            grp,
            { opacity: 0, scale: 0.92 },
            { opacity: 1, scale: 1, duration: 0.2, ease: "back.out(1.5)" },
            g.start,
          );

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var wordEl = document.getElementById("bs-w-" + wi);
            var isKW = KEYWORDS.has(wi);

            tl.to(
              wordEl,
              { color: isKW ? "#FFD700" : "#ffffff", scale: isKW ? 1.12 : 1.05, duration: 0.08 },
              w.start,
            );
            tl.to(wordEl, { color: __ctx.colorize("rgba(255,255,255,0.4)"), scale: 1.0, duration: 0.1 }, w.end);

            if (isKW && particleData[wi]) {
              particleData[wi].forEach(function (pd, pi) {
                tl.set(pd.el, { x: 0, y: 0, opacity: 0 }, w.start);
                tl.to(
                  pd.el,
                  { x: pd.dx, y: pd.dy, opacity: 1, duration: 0.12, ease: "power3.out" },
                  w.start + pi * 0.018,
                );
                tl.to(
                  pd.el,
                  { opacity: 0, duration: 0.45, ease: "power1.in" },
                  w.start + 0.12 + pi * 0.018,
                );
                tl.set(pd.el, { opacity: 0, x: 0, y: 0 }, w.start + 0.7);
              });
            }
          });

          tl.to(grp, { opacity: 0, duration: 0.14, ease: "power2.in" }, g.end - 0.14);
          tl.set(grp, { opacity: 0, visibility: "hidden" }, g.end);
        });

        tl.seek(0);
        window.__timelines["caption-particle-burst"] = tl;
      })();
    
} },
"caption-matrix-decode": { ...{"id":"caption-matrix-decode","duration":8,"fonts":["Space Grotesk"],"sourceSha256":"c8f703cbe6e8dd547107f2e6298f27c287a9d08b133ceab128e874ce88d36e78","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #matrix-decode {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .sc-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #sc-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .sc-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 24px;\n        padding: 0 80px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .sc-word-wrap {\n        font-family: \"Space Grotesk\", sans-serif;\n        font-weight: 700;\n        font-size: 96px;\n        color: #00ff41;\n        display: inline-block;\n        letter-spacing: 0.04em;\n        line-height: 1;\n        position: relative;\n      }\n      .sc-real {\n        opacity: 0;\n        visibility: hidden;\n      }\n      .sc-scr0,\n      .sc-scr1 {\n        position: absolute;\n        left: 0;\n        top: 0;\n        white-space: nowrap;\n        opacity: 0;\n        visibility: hidden;\n      }\n    ", markup:"\n    <div\n      id=\"matrix-decode\"\n      data-composition-id=\"caption-matrix-decode\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"sc-overlay\"></div>\n      <div id=\"sc-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        function mulberry32(seed) {
          return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }

        var ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        function scrambleChars(seed, length) {
          var rng = mulberry32(seed);
          var result = "";
          for (var i = 0; i < length; i++) {
            result += ALPHANUM[Math.floor(rng() * ALPHANUM.length)];
          }
          return result;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var GROUPS = __ctx.words ? [{wordStart:0,wordEnd:__ctx.words.length-1,start:__ctx.words[0].start,end:__ctx.duration}] : ([
          { wordStart: 0, wordEnd: 3, start: 0.0, end: 1.35 },
          { wordStart: 4, wordEnd: 7, start: 1.1, end: 2.35 },
          { wordStart: 8, wordEnd: 8, start: 2.1, end: 2.9 },
          { wordStart: 9, wordEnd: 12, start: 2.65, end: 3.8 },
          { wordStart: 13, wordEnd: 15, start: 3.55, end: 4.7 },
          { wordStart: 16, wordEnd: 16, start: 3.95, end: 5.0 },
          { wordStart: 17, wordEnd: 19, start: 4.9, end: 5.7 },
          { wordStart: 20, wordEnd: 22, start: 5.65, end: 6.5 },
          { wordStart: 23, wordEnd: 24, start: 6.35, end: 7.05 },
          { wordStart: 25, wordEnd: 27, start: 6.8, end: 7.9 },
        ]);

        var container = document.getElementById("sc-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = WORDS.slice(g.wordStart, g.wordEnd + 1);
          var groupText = groupWords
            .map(function (w) {
              return w.text;
            })
            .join(" ");
          var fontSize = fitFontSize(groupText, 96, "700", "'Space Grotesk', sans-serif", 1760);
          var grp = document.createElement("div");
          grp.className = "sc-group";
          grp.id = "sc-grp-" + gi;

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var wordWrap = document.createElement("span");
            wordWrap.className = "sc-word-wrap";
            wordWrap.id = "sc-ww-" + wi;
            wordWrap.style.fontSize = fontSize + "px";

            var real = document.createElement("span");
            real.className = "sc-real";
            real.id = "sc-real-" + wi;
            real.textContent = w.text;
            wordWrap.appendChild(real);

            var scr0 = document.createElement("span");
            scr0.className = "sc-scr0";
            scr0.id = "sc-scr0-" + wi;
            scr0.textContent = scrambleChars(wi * 1000 + 0, __ctx.graphemeCount(w.text));
            wordWrap.appendChild(scr0);

            var scr1 = document.createElement("span");
            scr1.className = "sc-scr1";
            scr1.id = "sc-scr1-" + wi;
            scr1.textContent = scrambleChars(wi * 1000 + 1, __ctx.graphemeCount(w.text));
            wordWrap.appendChild(scr1);

            grp.appendChild(wordWrap);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible", opacity: 0 }, g.start);
          tl.fromTo(grp, { opacity: 0 }, { opacity: 1, duration: 0.1 }, g.start);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var realEl = document.getElementById("sc-real-" + wi);
            var scr0El = document.getElementById("sc-scr0-" + wi);
            var scr1El = document.getElementById("sc-scr1-" + wi);

            tl.set(scr0El, { autoAlpha: 1 }, w.start);
            tl.set(scr1El, { autoAlpha: 1 }, w.start + 0.1);
            tl.set(scr0El, { autoAlpha: 0 }, w.start + 0.1);
            tl.set(realEl, { autoAlpha: 1 }, w.start + 0.2);
            tl.set(scr1El, { autoAlpha: 0 }, w.start + 0.2);
          });

          tl.to(grp, { opacity: 0, duration: 0.12 }, g.end - 0.12);
          tl.set(grp, { opacity: 0, visibility: "hidden" }, g.end);
        });

        window.__timelines["caption-matrix-decode"] = tl;
      })();
    
} },
"caption-glitch-rgb": { ...{"id":"caption-glitch-rgb","duration":8,"fonts":["Space Grotesk"],"sourceSha256":"65e588d27515cde0e361cddd6034a3dad647a86f50c02847c6cc453619d58648","posterTime":4.25}, css:"\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #caption-glitch-rgb {\n        pointer-events: none;\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .gl-overlay {\n        position: absolute;\n        inset: 0;\n        z-index: 1;\n        background: linear-gradient(\n          to bottom,\n          rgba(0, 0, 0, 0.08) 0%,\n          rgba(0, 0, 0, 0.16) 54%,\n          rgba(0, 0, 0, 0.5) 100%\n        );\n        pointer-events: none;\n      }\n      .gl-scanlines {\n        position: absolute;\n        inset: 0;\n        z-index: 5;\n        pointer-events: none;\n        background: repeating-linear-gradient(\n          to bottom,\n          transparent 0px,\n          transparent 3px,\n          rgba(0, 0, 0, 0.16) 3px,\n          rgba(0, 0, 0, 0.16) 4px\n        );\n        opacity: 0.55;\n      }\n      #gl-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n      .gl-group {\n        position: absolute;\n        bottom: 120px;\n        left: 0;\n        width: 100%;\n        display: flex;\n        flex-wrap: wrap;\n        align-items: flex-end;\n        justify-content: center;\n        gap: 14px;\n        padding: 0 100px;\n        opacity: 0;\n        visibility: hidden;\n      }\n      .gl-word {\n        font-family: \"Space Grotesk\", sans-serif;\n        font-weight: 700;\n        font-size: 88px;\n        text-transform: uppercase;\n        color: #ffffff;\n        display: inline-block;\n        letter-spacing: 0.03em;\n        line-height: 0.96;\n        text-shadow: 0 5px 18px rgba(0, 0, 0, 0.52);\n        will-change: transform, text-shadow;\n      }\n    ", markup:"\n    <div\n      id=\"caption-glitch-rgb\"\n      data-composition-id=\"caption-glitch-rgb\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n    >\n      <div class=\"gl-overlay\"></div>\n      <div class=\"gl-scanlines\"></div>\n      <div id=\"gl-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var TRANSCRIPT = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        function mulberry32(seed) {
          return function () {
            seed |= 0;
            seed = (seed + 0x6d2b79f5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        }

        function buildGroups(words) {
          var groups = [];
          var start = 0;
          var chars = 0;
          for (var i = 0; i < words.length; i++) {
            chars += words[i].text.length + 1;
            var endsSentence = /[.!?]$/.test(words[i].text);
            var nextGap = i + 1 < words.length ? words[i + 1].start - words[i].end : 0;
            var full = i - start >= 3 || chars >= 21;
            if (endsSentence || nextGap > 0.28 || full || i === words.length - 1) {
              groups.push([start, i]);
              start = i + 1;
              chars = 0;
            }
          }
          return groups;
        }

        function glitchPlan(word, nextWord) {
          var nextStart = nextWord ? nextWord.start : word.end + 0.3;
          var available = Math.min(word.end, nextStart) - word.start - 0.02;
          var total = Math.min(0.24, Math.max(0.08, available));
          return {
            d1: total * 0.35,
            d2: total * 0.65,
          };
        }

        function shouldAftershock(word) {
          return /\d|\$|%/.test(word.text) || word.text.replace(/[^\w]/g, "").length >= 7;
        }

        var RAW_GROUPS = __ctx.words ? [[0, __ctx.words.length - 1]] : (buildGroups(TRANSCRIPT));
        var GROUPS = RAW_GROUPS.map(function (pair, gi) {
          var ws = pair[0];
          var we = pair[1];
          var nextStart =
            __ctx.words ? __ctx.duration : (gi + 1 < RAW_GROUPS.length ? TRANSCRIPT[RAW_GROUPS[gi + 1][0]].start : 8.0);
          var end = Math.min(TRANSCRIPT[we].end + 0.24, nextStart - 0.04);
          return { wordStart: ws, wordEnd: we, start: TRANSCRIPT[ws].start, end: end };
        });

        var BASE_FONT = 88;
        var container = document.getElementById("gl-container");
        var tl = gsap.timeline({ paused: true });

        GROUPS.forEach(function (g, gi) {
          var groupWords = TRANSCRIPT.slice(g.wordStart, g.wordEnd + 1);
          var grp = document.createElement("div");
          grp.className = "gl-group";
          grp.id = "gl-grp-" + gi;

          var groupText = groupWords
            .map(function (w) {
              return w.text.toUpperCase();
            })
            .join(" ");
          var computedSize = fitFontSize(groupText, BASE_FONT, "700", "Space Grotesk", 1720);

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var span = document.createElement("span");
            span.className = "gl-word";
            span.id = "gl-w-" + wi;
            span.textContent = w.text.toUpperCase();
            span.style.fontSize = computedSize + "px";
            grp.appendChild(span);
          });

          container.appendChild(grp);

          tl.set(grp, { visibility: "visible" }, g.start);
          tl.fromTo(
            grp,
            { opacity: 0 },
            { opacity: 1, duration: 0.12, ease: "power2.out" },
            g.start,
          );

          groupWords.forEach(function (w, i) {
            var wi = g.wordStart + i;
            var wordEl = document.getElementById("gl-w-" + wi);
            var plan = glitchPlan(w, TRANSCRIPT[wi + 1]);

            var rng = mulberry32(wi * 777 + 13);
            var travel = -(8 + rng() * 8);
            var shadowMag = 5 + rng() * 7;
            var sm = shadowMag.toFixed(1);
            var nextWord = TRANSCRIPT[wi + 1];
            var nextStart = nextWord ? nextWord.start : g.end;
            var aftershockEnd = Math.min(g.end - 0.08, nextStart - 0.04);

            tl.to(
              wordEl,
              {
                x: travel,
                textShadow:
                  sm + "px 0 #ff003c, -" + sm + "px 0 #00e5ff, 0 5px 18px rgba(0,0,0,0.52)",
                duration: plan.d1,
                ease: "none",
              },
              w.start,
            );
            tl.to(
              wordEl,
              {
                x: 0,
                textShadow: "0 5px 18px rgba(0,0,0,0.52)",
                duration: plan.d2,
                ease: "power3.out",
              },
              w.start + plan.d1,
            );

            if (shouldAftershock(w) && aftershockEnd - w.end > 0.22) {
              var pulseStart = w.end + 0.08;
              var pulseIndex = 0;
              while (pulseStart + 0.1 < aftershockEnd) {
                var pulseTravel = -(3 + rng() * 5);
                var pulseShadow = (3 + rng() * 5).toFixed(1);
                tl.to(
                  wordEl,
                  {
                    x: pulseTravel,
                    textShadow:
                      pulseShadow +
                      "px 0 #ff003c, -" +
                      pulseShadow +
                      "px 0 #00e5ff, 0 5px 18px rgba(0,0,0,0.52)",
                    duration: 0.045,
                    ease: "none",
                  },
                  pulseStart,
                );
                tl.to(
                  wordEl,
                  {
                    x: 0,
                    textShadow: "0 5px 18px rgba(0,0,0,0.52)",
                    duration: 0.075,
                    ease: "power3.out",
                  },
                  pulseStart + 0.045,
                );
                pulseIndex++;
                pulseStart += pulseIndex % 2 === 0 ? 0.18 : 0.24;
              }
            }
          });

          tl.to(grp, { opacity: 0, duration: 0.1, ease: "power2.in" }, g.end - 0.1);
          tl.set(grp, { opacity: 0, visibility: "hidden" }, g.end);
        });

        tl.seek(0);
        window.__timelines["caption-glitch-rgb"] = tl;
      })();
    
} },
"caption-texture": { ...{"id":"caption-texture","duration":8,"fonts":["Anton"],"sourceSha256":"dcd2c9c9ba068507c559171264748c129981253fd61ce933c5d0f461431b0d7f","posterTime":4.25}, css:"\n      .hf-texture-text {\n        color: #fff;\n        -webkit-mask-size: var(--mask-size, cover);\n        mask-size: var(--mask-size, cover);\n        -webkit-mask-position: var(--mask-position, center);\n        mask-position: var(--mask-position, center);\n        -webkit-mask-mode: luminance;\n        mask-mode: luminance;\n        filter: contrast(var(--mask-contrast, 1));\n      }\n\n      *,\n      *::before,\n      *::after {\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        width: 1920px;\n        height: 1080px;\n        margin: 0;\n        overflow: hidden;\n        background: transparent;\n      }\n      #texture-lava {\n        position: relative;\n        width: 1920px;\n        height: 1080px;\n        overflow: hidden;\n        background: transparent;\n      }\n      .lv-overlay {\n        position: absolute;\n        inset: 0;\n        background: transparent;\n        z-index: 1;\n        pointer-events: none;\n      }\n      #lv-container {\n        position: absolute;\n        inset: 0;\n        z-index: 10;\n        pointer-events: none;\n      }\n\n      .lv-texture-override {\n        -webkit-mask-size: 200% 200%;\n        mask-size: 200% 200%;\n        -webkit-mask-position: 0% 50%;\n        mask-position: 0% 50%;\n        -webkit-mask-mode: luminance;\n        mask-mode: luminance;\n        filter: contrast(1.2);\n      }\n\n      .lv-shadow {\n        position: absolute;\n        left: 0;\n        width: 100%;\n        text-align: center;\n        top: 50%;\n        filter: drop-shadow(0 4px 24px rgba(255, 100, 20, 0.55));\n        opacity: 0;\n        visibility: hidden;\n      }\n      .lv-word {\n        font-family: \"Anton\", sans-serif;\n        font-weight: 400;\n        text-transform: uppercase;\n        color: #ffd0a0;\n        display: inline-block;\n        letter-spacing: 0.04em;\n        line-height: 1;\n      }\n    ", markup:"\n    <div\n      id=\"caption-texture\"\n      data-composition-id=\"caption-texture\"\n      data-timeline-locked\n      data-start=\"0\"\n      data-duration=\"8\"\n      data-fps=\"30\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n      data-composition-variables='[{\"id\":\"texture\",\"type\":\"string\",\"label\":\"Texture\",\"default\":\"lava\"}]'\n    >\n      <div class=\"lv-overlay\"></div>\n      <div id=\"lv-container\"></div>\n    </div>\n\n    \n  ", create: function(__ctx) { const {document,window,gsap} = __ctx;

      (function () {
        window.__timelines = window.__timelines || {};

        var vars =
          window.__hyperframes && window.__hyperframes.getVariables
            ? window.__hyperframes.getVariables()
            : {};
        var TEXTURE = vars.texture || "lava";
        var TEXTURE_URL = __ctx.asset("textures/" + TEXTURE + ".png");

        var _fitCanvas = document.createElement("canvas");
        var _fitCtx = _fitCanvas.getContext("2d");
        function fitFontSize(text, baseFontSize, fontWeight, fontFamily, maxWidth) {
          var size = baseFontSize;
          var minSize = Math.floor(baseFontSize * 0.45);
          while (size > minSize) {
            _fitCtx.font = fontWeight + " " + size + "px " + fontFamily;
            if (_fitCtx.measureText(text).width <= maxWidth) return size;
            size -= 2;
          }
          return minSize;
        }

        var WORDS = __ctx.words ?? ([
          { text: "Every", start: 0.0, end: 0.3 },
          { text: "great", start: 0.3, end: 0.55 },
          { text: "video", start: 0.55, end: 0.85 },
          { text: "starts", start: 0.85, end: 1.1 },
          { text: "with", start: 1.1, end: 1.25 },
          { text: "a", start: 1.25, end: 1.35 },
          { text: "single", start: 1.35, end: 1.65 },
          { text: "frame.", start: 1.65, end: 2.0 },
          { text: "HyperFrames", start: 2.1, end: 2.65 },
          { text: "lets", start: 2.65, end: 2.85 },
          { text: "you", start: 2.85, end: 2.95 },
          { text: "write", start: 2.95, end: 3.15 },
          { text: "HTML", start: 3.15, end: 3.55 },
          { text: "and", start: 3.55, end: 3.65 },
          { text: "render", start: 3.65, end: 3.95 },
          { text: "professional", start: 3.95, end: 4.45 },
          { text: "video.", start: 4.45, end: 4.8 },
          { text: "No", start: 4.9, end: 5.05 },
          { text: "timeline.", start: 5.05, end: 5.45 },
          { text: "No", start: 5.5, end: 5.65 },
          { text: "drag", start: 5.65, end: 5.85 },
          { text: "and", start: 5.85, end: 5.95 },
          { text: "drop.", start: 5.95, end: 6.25 },
          { text: "Just", start: 6.35, end: 6.55 },
          { text: "code", start: 6.55, end: 6.8 },
          { text: "that", start: 6.8, end: 6.95 },
          { text: "becomes", start: 6.95, end: 7.3 },
          { text: "cinema.", start: 7.3, end: 7.7 },
        ]);

        var KEYWORDS = __ctx.words ? __ctx.keywords(false) : (new Set([8, 12, 15, 24, 27]));

        var container = document.getElementById("lv-container");
        var tl = gsap.timeline({ paused: true });

        WORDS.forEach(function (w, wi) {
          var txt = w.text.toUpperCase();
          var fontSize = fitFontSize(txt, 200, "400", "'Anton', sans-serif", 1720);

          var shadow = document.createElement("div");
          shadow.className = "lv-shadow";
          shadow.id = "lv-shadow-" + wi;
          gsap.set(shadow, { yPercent: -50 });

          var wordEl = document.createElement("div");
          wordEl.className = "hf-texture-text lv-texture-override lv-word";
          wordEl.id = "lv-word-" + wi;
          wordEl.textContent = txt;
          wordEl.style.fontSize = fontSize + "px";
          wordEl.style.webkitMaskImage = "url('" + TEXTURE_URL + "')";
          wordEl.style.maskImage = "url('" + TEXTURE_URL + "')";
          if (KEYWORDS.has(wi)) wordEl.style.color = "#FFAA44";

          shadow.appendChild(wordEl);
          container.appendChild(shadow);

          var dur = Math.max(w.end - w.start + 0.3, 0.4);

          tl.set(shadow, { visibility: "visible", opacity: 0 }, w.start);
          tl.fromTo(
            shadow,
            { opacity: 0, scale: 0.88 },
            { opacity: 1, scale: 1, duration: 0.18, ease: "power3.out" },
            w.start,
          );
          tl.set(wordEl, { "--mask-position": "0% 50%" }, w.start);
          tl.to(
            wordEl,
            { "--mask-position": "100% 50%", duration: dur, ease: "sine.inOut" },
            w.start,
          );

          tl.to(shadow, { opacity: 0, scale: 1.08, duration: 0.1, ease: "power2.in" }, w.end);
          tl.set(shadow, { opacity: 0, visibility: "hidden" }, w.end + 0.1);
        });

        tl.seek(0);
        window.__timelines["caption-texture"] = tl;
      })();
    
} }
};
