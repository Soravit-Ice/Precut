import { existsSync } from "node:fs";
import { join } from "node:path";
import { missingCaptionTranslations } from "../../../packages/core/src/captions";
import type { Snapshot } from "../../../packages/shared/src/contracts";
import type { EngineTask, Context } from "./engine";
import { runTranslation, TRANSLATION_MODEL } from "./translation";

export async function finishAutoEditCaptions(task: EngineTask, ctx: Context) {
  ctx.signal.throwIfAborted();
  if (task.captionLanguage) {
    // Read the committed cut: removed speech must not be translated or exported.
    const snapshot = await ctx.db<Snapshot>("projects.open", {
      id: task.projectId,
    });
    if (missingCaptionTranslations(snapshot).length) {
      if (!existsSync(join(task.modelsRoot, TRANSLATION_MODEL.file))) {
        ctx.stage("First cut saved · subtitles await translation model", 1);
        return;
      }
      await runTranslation(
        { ...task, snapshot },
        {
          ...ctx,
          stage: (stage, progress) => ctx.stage(stage, 0.7 + progress * 0.28),
        },
      );
    }
  }
  ctx.signal.throwIfAborted();
  ctx.stage("Saving subtitles", 0.99);
  ctx.stage("Ready to review", 1);
}
