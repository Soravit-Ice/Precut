import type { Page } from "@playwright/test";
import type { Snapshot } from "../../packages/shared/src/contracts";
import { clipSnapshot, timelineFor } from "../../packages/core/src/sequence";
// Assertions about a selected caption use the same clip-scoped projection as the editor.
export function displayedProject(snapshot: Snapshot) {
  const clip = timelineFor(snapshot).clips[0];
  return clip ? clipSnapshot(snapshot, clip.id) : snapshot;
}
export async function seekTimeline(page: Page, us: number) {
  const ruler = page.getByRole("slider", {
      name: "Timeline playhead",
      exact: true,
    }),
    duration = Number(await ruler.getAttribute("aria-valuemax")),
    box = (await ruler.boundingBox())!;
  await ruler.click({
    position: {
      x: Math.max(
        1,
        Math.min(box.width - 2, (us / Math.max(1, duration)) * box.width),
      ),
      y: 12,
    },
  });
}
export async function chooseCaptionScope(
  page: Page,
  name: "This caption" | "This clip" | "Whole project",
) {
  const toggle = page.getByRole("button", {
    name: "Toggle inspector",
    exact: true,
  });
  if ((await toggle.getAttribute("aria-pressed")) === "false")
    await toggle.click();
  await page
    .getByRole("combobox", { name: "Caption application scope", exact: true })
    .click();
  await page.getByRole("option", { name, exact: true }).click();
}
