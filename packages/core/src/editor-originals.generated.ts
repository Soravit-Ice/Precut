// @ts-nocheck
// Generated from hash-verified upstream templates. Do not hand edit.
export const editorOriginals = {
"lt-clean-bar":{css:"\n      * {\n        margin: 0;\n        padding: 0;\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        background: transparent;\n        overflow: hidden;\n      }\n      body {\n        width: 1920px;\n        height: 1080px;\n        font-family: \"Montserrat\", sans-serif;\n      }\n\n      #root .lt {\n        position: absolute;\n        left: 120px;\n        bottom: 110px;\n        display: flex;\n        align-items: stretch;\n        border-radius: 16px;\n        overflow: hidden;\n        box-shadow: 0 14px 44px rgba(15, 17, 21, 0.18);\n        will-change: clip-path;\n      }\n      #root .lt-tab {\n        width: 12px;\n        background: #ff5a36;\n        flex-shrink: 0;\n      }\n      #root .lt-body {\n        background: #ffffff;\n        padding: 22px 40px 24px 30px;\n        display: flex;\n        flex-direction: column;\n        gap: 7px;\n      }\n      #root .lt-name {\n        font-size: 52px;\n        font-weight: 700;\n        color: #0f1115;\n        line-height: 1.06;\n        letter-spacing: -0.015em;\n        white-space: nowrap;\n      }\n      #root .lt-role {\n        font-size: 27px;\n        font-weight: 400;\n        color: #5a6170;\n        line-height: 1.2;\n        letter-spacing: 0.01em;\n        white-space: nowrap;\n      }\n    ",markup:"\n    <div\n      id=\"root\"\n      data-composition-id=\"lt-clean-bar\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n      data-start=\"0\"\n      data-duration=\"4.8\"\n    >\n      <div id=\"lt-clip\" class=\"clip\" data-start=\"0\" data-duration=\"4.8\" data-track-index=\"0\">\n        <div id=\"lt\" class=\"lt\">\n          <div id=\"lt-tab\" class=\"lt-tab\"></div>\n          <div class=\"lt-body\">\n            <div id=\"lt-name\" class=\"lt-name\">Dr. Maya Chen</div>\n            <div id=\"lt-role\" class=\"lt-role\">Host · Neuroscientist</div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    \n  ",sha256:"6648b428ea74128368545a5cdf8d83a82e75dc468e9d3bbbac933e1463df5a67",create:function(__ctx){const {document,window,gsap}=__ctx;
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var card = document.getElementById("lt");
      var tab = document.getElementById("lt-tab");
      var nameEl = document.getElementById("lt-name");
      var role = document.getElementById("lt-role");

      // Card wipes in from the left (clip-path), accent tab grows, text rises with a small stagger.
      gsap.set(card, { clipPath: "inset(0 100% 0 0)" });
      gsap.set(tab, { scaleY: 0, transformOrigin: "50% 0%" });
      gsap.set(nameEl, { y: 22, opacity: 0 });
      gsap.set(role, { y: 22, opacity: 0 });

      tl.to(card, { clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: "power3.out" }, 0.1);
      tl.to(tab, { scaleY: 1, duration: 0.45, ease: "power2.out" }, 0.28);
      tl.to(nameEl, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.34);
      tl.to(role, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.44);

      // Exit: settle out, then hard kill the inner element.
      tl.to(card, { y: 18, opacity: 0, duration: 0.35, ease: "power2.in" }, 4.3);
      tl.set(card, { visibility: "hidden" }, 4.75);

      window.__timelines["lt-clean-bar"] = tl;
return window.__timelines["lt-clean-bar"];}},
"lt-soft-pill":{css:"\n      * {\n        margin: 0;\n        padding: 0;\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        background: transparent;\n        overflow: hidden;\n      }\n      body {\n        width: 1920px;\n        height: 1080px;\n        font-family: \"Montserrat\", sans-serif;\n      }\n\n      #root .lt {\n        position: absolute;\n        left: 120px;\n        bottom: 120px;\n      }\n      #root .lt-pill {\n        display: flex;\n        align-items: center;\n        gap: 22px;\n        background: #ffffff;\n        border-radius: 999px;\n        padding: 20px 40px 20px 26px;\n        box-shadow: 0 16px 46px rgba(15, 17, 21, 0.2);\n        transform-origin: 0% 100%;\n        will-change: transform;\n      }\n      #root .lt-dot {\n        width: 18px;\n        height: 18px;\n        border-radius: 50%;\n        background: #ff5a36;\n        flex-shrink: 0;\n      }\n      #root .lt-text {\n        display: flex;\n        flex-direction: column;\n        gap: 4px;\n      }\n      #root .lt-name {\n        font-size: 46px;\n        font-weight: 700;\n        color: #0f1115;\n        line-height: 1.04;\n        letter-spacing: -0.015em;\n        white-space: nowrap;\n      }\n      #root .lt-role {\n        font-size: 25px;\n        font-weight: 400;\n        color: #5a6170;\n        line-height: 1.2;\n        letter-spacing: 0.01em;\n        white-space: nowrap;\n      }\n    ",markup:"\n    <div\n      id=\"root\"\n      data-composition-id=\"lt-soft-pill\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n      data-start=\"0\"\n      data-duration=\"4.8\"\n    >\n      <div id=\"lt-clip\" class=\"clip\" data-start=\"0\" data-duration=\"4.8\" data-track-index=\"0\">\n        <div id=\"lt\" class=\"lt\">\n          <div id=\"lt-pill\" class=\"lt-pill\">\n            <div id=\"lt-dot\" class=\"lt-dot\"></div>\n            <div class=\"lt-text\">\n              <div id=\"lt-name\" class=\"lt-name\">Dr. Maya Chen</div>\n              <div id=\"lt-role\" class=\"lt-role\">Host · Neuroscientist</div>\n            </div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    \n  ",sha256:"e1f14e3b482622e6005beec80678bc70ad661e15f3db3e3461fae414a81d5c83",create:function(__ctx){const {document,window,gsap}=__ctx;
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var wrap = document.getElementById("lt");
      var pill = document.getElementById("lt-pill");
      var dot = document.getElementById("lt-dot");
      var nameEl = document.getElementById("lt-name");
      var role = document.getElementById("lt-role");

      // Pill scales up from the lower-left anchor, dot pulses in, text settles.
      gsap.set(pill, { scale: 0.88, y: 18, opacity: 0 });
      gsap.set(dot, { scale: 0 });
      gsap.set([nameEl, role], { opacity: 0, x: -10 });

      tl.to(pill, { scale: 1, y: 0, opacity: 1, duration: 0.55, ease: "back.out(1.7)" }, 0.1);
      tl.to(dot, { scale: 1, duration: 0.4, ease: "back.out(3)" }, 0.4);
      tl.to(nameEl, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, 0.42);
      tl.to(role, { opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }, 0.5);

      // Exit: settle down + hard kill.
      tl.to(pill, { scale: 0.94, y: 14, opacity: 0, duration: 0.35, ease: "power2.in" }, 4.3);
      tl.set(wrap, { visibility: "hidden" }, 4.75);

      window.__timelines["lt-soft-pill"] = tl;
return window.__timelines["lt-soft-pill"];}},
"lt-side-rule":{css:"\n      * {\n        margin: 0;\n        padding: 0;\n        box-sizing: border-box;\n      }\n      html,\n      body {\n        background: transparent;\n        overflow: hidden;\n      }\n      body {\n        width: 1920px;\n        height: 1080px;\n      }\n\n      #root .lt {\n        position: absolute;\n        left: 130px;\n        bottom: 120px;\n        display: flex;\n        align-items: stretch;\n        gap: 26px;\n      }\n      #root .lt-bar {\n        width: 8px;\n        background: #46e5b7;\n        border-radius: 4px;\n        transform-origin: 50% 0%;\n        flex-shrink: 0;\n      }\n      #root .lt-text {\n        display: flex;\n        flex-direction: column;\n        justify-content: center;\n        gap: 12px;\n      }\n      #root .lt-name {\n        font-family: \"League Gothic\", sans-serif;\n        font-size: 92px;\n        font-weight: 400;\n        color: #ffffff;\n        line-height: 0.86;\n        letter-spacing: 0.01em;\n        text-transform: uppercase;\n        white-space: nowrap;\n        text-shadow: 0 2px 22px rgba(0, 0, 0, 0.5);\n      }\n      #root .lt-role {\n        font-family: \"JetBrains Mono\", monospace;\n        font-size: 26px;\n        font-weight: 400;\n        color: #e7eaf0;\n        line-height: 1.2;\n        letter-spacing: 0.04em;\n        white-space: nowrap;\n        text-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);\n      }\n    ",markup:"\n    <div\n      id=\"root\"\n      data-composition-id=\"lt-side-rule\"\n      data-width=\"1920\"\n      data-height=\"1080\"\n      data-start=\"0\"\n      data-duration=\"4.8\"\n    >\n      <div id=\"lt-clip\" class=\"clip\" data-start=\"0\" data-duration=\"4.8\" data-track-index=\"0\">\n        <div id=\"lt\" class=\"lt\">\n          <div id=\"lt-bar\" class=\"lt-bar\"></div>\n          <div class=\"lt-text\">\n            <div id=\"lt-name\" class=\"lt-name\">Dr. Maya Chen</div>\n            <div id=\"lt-role\" class=\"lt-role\">Host · Neuroscientist</div>\n          </div>\n        </div>\n      </div>\n    </div>\n\n    \n  ",sha256:"faa20504273f478a470bb1fa99fc5ea81fb5709b279a9acee8b15b4996917527",create:function(__ctx){const {document,window,gsap}=__ctx;
      window.__timelines = window.__timelines || {};
      var tl = gsap.timeline({ paused: true });

      var wrap = document.getElementById("lt");
      var bar = document.getElementById("lt-bar");
      var nameEl = document.getElementById("lt-name");
      var role = document.getElementById("lt-role");

      // Vertical accent bar draws top→down, name and role slide in from the left.
      gsap.set(bar, { scaleY: 0 });
      gsap.set(nameEl, { x: -24, opacity: 0 });
      gsap.set(role, { x: -24, opacity: 0 });

      tl.to(bar, { scaleY: 1, duration: 0.5, ease: "power3.out" }, 0.1);
      tl.to(nameEl, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.26);
      tl.to(role, { x: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, 0.38);

      // Exit: bar retracts, text lifts, hard kill.
      tl.to(role, { opacity: 0, duration: 0.3, ease: "power2.in" }, 4.25);
      tl.to(nameEl, { y: -14, opacity: 0, duration: 0.32, ease: "power2.in" }, 4.3);
      tl.to(bar, { scaleY: 0, duration: 0.32, ease: "power2.in" }, 4.32);
      tl.set(wrap, { visibility: "hidden" }, 4.75);

      window.__timelines["lt-side-rule"] = tl;
return window.__timelines["lt-side-rule"];}},
"titlecard-calm":{css:"\n          *,\n          *::before,\n          *::after {\n            box-sizing: border-box;\n          }\n\n          #root {\n            position: absolute;\n            inset: 0;\n            overflow: hidden;\n            container-type: size;\n            isolation: isolate;\n            color: var(--fg, #f7f7f2);\n            font-family: var(--font-display, \"Helvetica Neue\", Helvetica, Arial, sans-serif);\n            pointer-events: none;\n          }\n\n          .tc-clip {\n            position: absolute;\n            inset: 0;\n            display: grid;\n            place-items: center;\n            overflow: hidden;\n          }\n\n          .tc-lockup {\n            display: flex;\n            width: 78cqw;\n            flex-direction: column;\n            align-items: flex-start;\n            gap: 6cqh;\n            transform-origin: 50% 50%;\n            will-change: transform, opacity;\n          }\n\n          .tc-kicker {\n            display: block;\n            width: 100%;\n            color: var(--muted, #b8c0cc);\n            font-family: var(--font-mono, ui-monospace, \"SF Mono\", Menlo, Consolas, monospace);\n            font-size: 3.2cqmin;\n            font-weight: 600;\n            line-height: 1;\n            letter-spacing: 0.18em;\n            text-transform: uppercase;\n            will-change: transform, opacity;\n          }\n\n          .tc-headline {\n            display: block;\n            width: 100%;\n            color: var(--fg, #f7f7f2);\n            font-family: var(--font-display, \"Helvetica Neue\", Helvetica, Arial, sans-serif);\n            font-size: 17cqmin;\n            font-weight: 600;\n            line-height: 0.94;\n            letter-spacing: -0.055em;\n            overflow-wrap: anywhere;\n            text-wrap: balance;\n            will-change: transform, opacity;\n          }\n        ",markup:"\n    \n      <div id=\"root\" data-composition-id=\"titlecard-calm\" data-duration=\"4\" data-fps=\"30\">\n        \n\n        <div\n          id=\"titlecard-calm-clip\"\n          class=\"tc-clip clip\"\n          data-start=\"0\"\n          data-duration=\"4\"\n          data-track-index=\"0\"\n        >\n          <div class=\"tc-lockup\">\n            <span class=\"tc-kicker\"></span>\n            <span class=\"tc-headline\"></span>\n          </div>\n        </div>\n\n        \n        \n      </div>\n    \n  ",sha256:"5d6833d8bf512352e67d39a7b1f4133fe1bd84a9d0c76f528c6f40eea9e950ae",create:function(__ctx){const {document,window,gsap}=__ctx;
          (function () {
            "use strict";

            var root = document.getElementById("root");
            var lockup = root.querySelector(".tc-lockup");
            var kicker = root.querySelector(".tc-kicker");
            var headline = root.querySelector(".tc-headline");
            var vars =
              window.__hyperframes && window.__hyperframes.getVariables
                ? window.__hyperframes.getVariables()
                : {};

            var headlineText = vars.headline == null ? "Less, but better" : String(vars.headline);
            var kickerText = vars.kicker == null ? "DESIGN PRINCIPLE" : String(vars.kicker);

            headline.textContent = headlineText;
            kicker.textContent = kickerText;

            var IN_BASE = 1.2;
            var OUT_BASE = 0.55;
            var parsedDuration = Number.parseFloat(root.dataset.duration);
            var duration = Number.isFinite(parsedDuration) ? Math.max(0.001, parsedDuration) : 4;
            var totalBase = IN_BASE + OUT_BASE;
            var phaseScale = duration < totalBase ? duration / totalBase : 1;
            var IN = IN_BASE * phaseScale;
            var OUT = OUT_BASE * phaseScale;
            var HOLD = Math.max(0, duration - IN - OUT);
            var HOLD_START = IN;
            var OUT_START = IN + HOLD;
            var KICKER_IN = 0.5 * phaseScale;
            var HEADLINE_AT = 0.28 * phaseScale;
            var HEADLINE_IN = 0.72 * phaseScale;

            gsap.set(lockup, { opacity: 1, y: "0cqh" });

            var tl = gsap.timeline({ paused: true });

            tl.fromTo(
              kicker,
              { opacity: 0, y: "2.2cqh" },
              { opacity: 1, y: "0cqh", duration: KICKER_IN, ease: "power2.out" },
              0,
            );
            tl.fromTo(
              headline,
              { opacity: 0, y: "3.2cqh" },
              { opacity: 1, y: "0cqh", duration: HEADLINE_IN, ease: "power3.out" },
              HEADLINE_AT,
            );

            if (HOLD > 0) {
              tl.to(lockup, { y: "-0.65cqh", duration: HOLD, ease: "sine.inOut" }, HOLD_START);
            }

            tl.to(
              lockup,
              { opacity: 0, y: "-2.1cqh", duration: OUT, ease: "power2.in" },
              OUT_START,
            );

            tl.seek(0);
            window.__timelines = window.__timelines || {};
            window.__timelines["titlecard-calm"] = tl;
          })();
return window.__timelines["titlecard-calm"];}},
"line-by-line-slide":{css:"\n  .hf-catalog-line-by-line-slide {\n    color: var(--hf-line-color, #18181b);\n    font-family: Inter, system-ui, sans-serif;\n    font-weight: 900;\n    letter-spacing: -0.04em;\n  }\n  .hf-catalog-line-by-line-slide {\n    display: grid;\n    gap: var(--hf-line-gap, 10px);\n    font-size: var(--hf-line-size, 52px);\n    line-height: 1;\n    overflow: hidden;\n  }\n  .hf-catalog-line-by-line-slide span {\n    display: block;\n    transform: translate(\n      calc(var(--hf-line-x, 0px) * var(--hf-line-axis-x, 1)),\n      var(--hf-line-y, 0px)\n    );\n    filter: blur(var(--hf-line-blur, 0px));\n    will-change: transform, filter, opacity;\n  }\n",markup:"<div id=\"root\">\n\n<div\n  class=\"hf-catalog-line-by-line-slide\"\n  data-composition-variables='[\n    {\"id\": \"size\", \"type\": \"enum\", \"role\": \"layout\", \"label\": \"Size\", \"description\": \"Type size of the whole stack.\", \"default\": \"standard\", \"options\": [{\"value\": \"compact\", \"label\": \"Compact\"}, {\"value\": \"standard\", \"label\": \"Standard\"}, {\"value\": \"display\", \"label\": \"Display\"}]},\n    {\"id\": \"tone\", \"type\": \"enum\", \"role\": \"style\", \"label\": \"Tone\", \"description\": \"Line colour: ink for light frames, paper for dark ones, accent rides the brand token.\", \"default\": \"ink\", \"options\": [{\"value\": \"ink\", \"label\": \"Ink\"}, {\"value\": \"paper\", \"label\": \"Paper\"}, {\"value\": \"accent\", \"label\": \"Accent\"}]},\n    {\"id\": \"density\", \"type\": \"enum\", \"role\": \"layout\", \"label\": \"Density\", \"description\": \"The gap between lines, from a tight block to an airy stack.\", \"default\": \"standard\", \"options\": [{\"value\": \"fine\", \"label\": \"Fine\"}, {\"value\": \"standard\", \"label\": \"Standard\"}, {\"value\": \"coarse\", \"label\": \"Coarse\"}]},\n    {\"id\": \"direction\", \"type\": \"enum\", \"role\": \"motion\", \"label\": \"Direction\", \"description\": \"Which side the lines slide in from as the timeline drives the offset.\", \"default\": \"left\", \"options\": [{\"value\": \"left\", \"label\": \"Left\"}, {\"value\": \"right\", \"label\": \"Right\"}]}\n  ]'\n>\n  <span>Design faster</span><span>Render cleaner</span><span>Ship louder</span>\n</div>\n\n\n\n\n\n\n</div>",sha256:"4d6ce6381540c89e971dcebff09a48be031177455ceddacac41886113afe3f44",create:function(__ctx){const {document,window,gsap}=__ctx;
  (function () {
    "use strict";

    var vars =
      window.__hyperframes && window.__hyperframes.getVariables
        ? window.__hyperframes.getVariables()
        : {};

    // Unrecognised overrides return to their declared defaults.
    function pick(table, value, fallback) {
      return Object.prototype.hasOwnProperty.call(table, value) ? value : fallback;
    }

    var sizes = { compact: "40px", standard: "52px", display: "68px" };
    var tones = {
      ink: "#18181b",
      paper: "#fafafa",
      accent: "var(--brand, #34d399)",
    };
    var gaps = { fine: "4px", standard: "10px", coarse: "20px" };
    var axes = { left: 1, right: -1 };

    var size = sizes[pick(sizes, vars.size, "standard")];
    var tone = tones[pick(tones, vars.tone, "ink")];
    var gap = gaps[pick(gaps, vars.density, "standard")];
    var axis = axes[pick(axes, vars.direction, "left")];

    var roots = document.querySelectorAll(".hf-catalog-line-by-line-slide");
    for (var i = 0; i < roots.length; i += 1) {
      var root = roots[i];
      root.style.setProperty("--hf-line-size", size);
      root.style.setProperty("--hf-line-color", tone);
      root.style.setProperty("--hf-line-gap", gap);
      root.style.setProperty("--hf-line-axis-x", String(axis));
    }
  })();
return window.__timelines["line-by-line-slide"];}},
"headline-slam":{css:"\n          *,\n          *::before,\n          *::after {\n            box-sizing: border-box;\n          }\n\n          #root {\n            position: absolute;\n            inset: 0;\n            overflow: hidden;\n            container-type: size;\n            isolation: isolate;\n            color: var(--fg, #f8fafc);\n            font-family: var(--font-display, Inter, system-ui, sans-serif);\n            pointer-events: none;\n          }\n\n          .hs-clip,\n          .hs-stage {\n            position: absolute;\n            inset: 0;\n            width: 100cqw;\n            height: 100cqh;\n          }\n\n          .hs-clip {\n            overflow: hidden;\n          }\n\n          .hs-stage {\n            display: grid;\n            place-items: center;\n            will-change: transform;\n          }\n\n          .hs-headline {\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            gap: 2cqw;\n            width: 90cqw;\n            min-height: 22cqh;\n            color: var(--fg, #f8fafc);\n            font-size: var(--hs-font-size, 10.5cqw);\n            font-weight: 900;\n            line-height: 0.88;\n            letter-spacing: -0.5cqw;\n            text-align: center;\n            white-space: nowrap;\n            transform-origin: 50% 50%;\n            will-change: transform, opacity;\n          }\n\n          /* Shadow is on by default; the shadow variable opts out of it. */\n          .hs-headline.hs-shadow {\n            text-shadow: 0 1.2cqh 4.5cqh color-mix(in srgb, #000 52%, transparent);\n          }\n\n          .hs-word {\n            display: inline-block;\n          }\n\n          .hs-word-accent {\n            color: var(--hs-accent, #71f5a7);\n          }\n        ",markup:"\n    \n      <div id=\"root\" data-composition-id=\"headline-slam\" data-duration=\"3.5\" data-fps=\"30\">\n        \n\n        <div\n          id=\"headline-slam-clip\"\n          class=\"hs-clip clip\"\n          data-start=\"0\"\n          data-duration=\"3.5\"\n          data-track-index=\"0\"\n        >\n          <div class=\"hs-stage\">\n            <div class=\"hs-headline\" role=\"heading\" aria-level=\"1\"></div>\n          </div>\n        </div>\n\n        \n        \n      </div>\n    \n  ",sha256:"b16ac28b01bf7f352d6a3f267838253de85794cd9bedd8065b48d7675e9295cd",create:function(__ctx){const {document,window,gsap}=__ctx;
          (function () {
            "use strict";

            var root = document.getElementById("root");
            var stage = root.querySelector(".hs-stage");
            var headline = root.querySelector(".hs-headline");
            var vars =
              window.__hyperframes && window.__hyperframes.getVariables
                ? window.__hyperframes.getVariables()
                : {};

            var text = vars.text == null ? "Ship it today" : String(vars.text);
            var indexValue = Number(vars.accent_word_index);
            var accentWordIndex = Number.isFinite(indexValue) ? Math.trunc(indexValue) : 1;
            var accentColors = {
              green: "var(--brand, #71f5a7)",
              blue: "var(--accent, #61a8ff)",
              violet: "var(--accent-2, #b895ff)",
            };
            var accent = Object.prototype.hasOwnProperty.call(accentColors, vars.accent)
              ? vars.accent
              : "green";
            var shadow = !(vars.shadow === false || vars.shadow === "false");
            var words = text.trim() === "" ? [] : text.trim().split(/\s+/);

            root.style.setProperty("--hs-accent", accentColors[accent]);
            headline.classList.toggle("hs-shadow", shadow);
            headline.setAttribute("aria-label", text);

            words.forEach(function (word, index) {
              var span = document.createElement("span");
              span.className = index === accentWordIndex ? "hs-word hs-word-accent" : "hs-word";
              span.textContent = word;
              span.setAttribute("aria-hidden", "true");
              headline.appendChild(span);
            });

            // Deterministic fit from character count: DOM measurement is zero at
            // mount time (the template is not laid out yet), so it never fires.
            // 0.62 approximates the average glyph/em width of the bold face; the
            // 56cqw rest-state cap keeps the 1.6x overshoot peak inside 90cqw.
            var approxWidthCqw = text.length * 10.5 * 0.62;
            if (approxWidthCqw > 56) {
              var fitted = Math.max(3.5, 56 / (text.length * 0.62));
              root.style.setProperty("--hs-font-size", fitted.toFixed(2) + "cqw");
            }

            var IN_BASE = 0.72;
            var OUT_BASE = 0.46;
            var LAND_AT_BASE = 0.58;
            var SHAKE_FRAME_BASE = 1 / 30;
            var duration = Math.max(0.001, parseFloat(root.dataset.duration || "3.5"));
            var baseTotal = IN_BASE + OUT_BASE;
            var envelopeScale = duration < baseTotal ? duration / baseTotal : 1;
            var IN = IN_BASE * envelopeScale;
            var OUT = OUT_BASE * envelopeScale;
            var LAND_AT = LAND_AT_BASE * envelopeScale;
            var SHAKE_FRAME = SHAKE_FRAME_BASE * envelopeScale;
            var HOLD = Math.max(0, duration - IN - OUT);
            var HOLD_START = IN;
            var OUT_START = IN + HOLD;

            var tl = gsap.timeline({ paused: true });

            tl.fromTo(
              headline,
              { scale: 1.6, opacity: 0, y: 0 },
              { scale: 1, opacity: 1, y: 0, duration: LAND_AT, ease: "expo.out" },
              0,
            );

            tl.to(
              stage,
              { x: "0.55cqw", y: "-0.3cqh", duration: SHAKE_FRAME, ease: "power2.out" },
              LAND_AT,
            );
            tl.to(stage, {
              x: "-0.38cqw",
              y: "0.2cqh",
              duration: SHAKE_FRAME,
              ease: "power2.out",
            });
            tl.to(stage, { x: 0, y: 0, duration: SHAKE_FRAME, ease: "power2.out" });

            if (HOLD > 0) {
              tl.fromTo(
                headline,
                { y: 0 },
                {
                  y: "-0.55cqh",
                  duration: HOLD / 2,
                  ease: "sine.inOut",
                  yoyo: true,
                  repeat: 1,
                  immediateRender: false,
                },
                HOLD_START,
              );
            }

            tl.to(headline, { y: "-120cqh", duration: OUT, ease: "power4.in" }, OUT_START);

            tl.seek(0);
            window.__timelines = window.__timelines || {};
            window.__timelines["headline-slam"] = tl;
          })();
return window.__timelines["headline-slam"];}}
};
