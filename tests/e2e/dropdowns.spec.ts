import { test, expect, _electron, type Page } from "@playwright/test";
import { mkdtemp, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  defaultCleanup,
  type Job,
  type Method,
  type Project,
} from "../../packages/shared/src/contracts";

async function inWindow(page: Page) {
  const menu = page.getByRole("listbox");
  await expect(menu).toBeVisible();
  await expect
    .poll(() =>
      menu.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.top >= 11 &&
          rect.left >= 11 &&
          rect.right <= innerWidth - 11 &&
          rect.bottom <= innerHeight - 11
        );
      }),
    )
    .toBe(true);
  expect(
    await menu.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
}

test("dropdowns stay in the window, scroll to every font and support keyboard selection", async () => {
  const root = await mkdtemp(join(tmpdir(), "precut-dropdowns-"));
  const app = await _electron.launch({
    executablePath: process.env.PRECUT_E2E_EXECUTABLE,
    args: process.env.PRECUT_E2E_EXECUTABLE
      ? [`--user-data-dir=${root}`]
      : [process.cwd()],
    env: { ...process.env, PRECUT_TEST_DATA: root, PRECUT_DEV_EXPORT: "1" },
  });
  try {
    const page = await app.firstWindow(),
      errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const call = <T>(method: Method, input: unknown = {}) =>
      page.evaluate(({ method, input }) => window.precut.call(method, input), {
        method,
        input,
      }) as Promise<T>;
    const finished = async (job: Job) =>
      expect
        .poll(
          async () => {
            const current = (await call<Job[]>("jobs.list")).find(
              (j) => j.id === job.id,
            )!;
            if (current.state === "failed") throw new Error(current.error);
            return current.state;
          },
          { timeout: 180000 },
        )
        .toBe("completed");
    await page
      .getByRole("heading", { name: "Projects", exact: true })
      .waitFor();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1100, 760),
    );

    await page
      .locator(".sidebar-bottom")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    for (const label of [
      "Interface language",
      "Theme",
      "Speech quality",
      "Speech language",
    ]) {
      const trigger = page.getByRole("combobox", { name: label, exact: true });
      await trigger.click();
      await inWindow(page);
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "Projects", exact: true })
      .click();
    await page.locator(".new-project-button").click();
    await page.getByLabel("Project name").fill("Dropdown usability");
    await page
      .getByRole("button", { name: "Create project", exact: true })
      .click();
    const id = (await call<Project[]>("projects.list"))[0].id;
    await finished(
      await call<Job>("media.import", {
        projectId: id,
        path: resolve("tests/fixtures/generated/english.mp4"),
      }),
    );
    await finished(
      await call<Job>("jobs.analyze", {
        projectId: id,
        options: defaultCleanup,
      }),
    );
    await page
      .getByRole("combobox", { name: "Playback speed", exact: true })
      .click();
    await inWindow(page);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Auto Edit", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Auto Edit", exact: true });
    for (const label of [
      "Speech language profile",
      "Transcription quality",
      "Auto edit caption style",
    ]) {
      const trigger = dialog.getByRole("combobox", {
        name: label,
        exact: true,
      });
      await trigger.click();
      await inWindow(page);
      await page.keyboard.press("End");
      await expect(page.getByRole("option").last()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(dialog).toBeVisible();
    }
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "Transcript", exact: true })
      .click();
    await page.getByRole("tab", { name: "Captions", exact: true }).click();
    await page
      .getByRole("group", { name: "Caption language", exact: true })
      .getByRole("button", { name: "English", exact: true })
      .click();
    // The cue selector uses the same bounded dropdown, including full sentence labels.
    await page
      .getByRole("combobox", { name: "Caption segment", exact: true })
      .click();
    await inWindow(page);
    await page.keyboard.press("End");
    await expect(page.getByRole("option").last()).toBeFocused();
    await page.keyboard.press("Escape");
    await page
      .locator(".caption-studio-tabs")
      .getByRole("button", { name: "Layout", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Caption font weight", exact: true })
      .click();
    await inWindow(page);
    await page.keyboard.press("Escape");
    const font = page.getByRole("combobox", {
      name: "Caption font",
      exact: true,
    });
    expect((await font.boundingBox())!.width).toBeGreaterThan(180);
    await font.click();
    await inWindow(page);
    expect(await page.getByRole("option").count()).toBeGreaterThan(30);
    const viewport = page.locator(".select-viewport");
    expect(
      await viewport.evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    expect(
      await viewport.evaluate((node) => getComputedStyle(node).scrollbarWidth),
    ).toBe("thin");
    await page.keyboard.press("Home");
    await expect(page.getByRole("option").first()).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(page.getByRole("option").first()).not.toBeFocused();
    await page.keyboard.press("End");
    const last = page.getByRole("option").last();
    await expect(last).toBeFocused();
    const lastLabel = (await last.innerText()).trim();
    await page.keyboard.press("Enter");
    await expect(font).toHaveText(lastLabel);
    await expect(font).toBeFocused();
    await font.click();
    await inWindow(page);
    await page.keyboard.press("Home");
    await viewport.hover();
    await page.mouse.wheel(0, 10000);
    await expect
      .poll(() =>
        viewport.evaluate(
          (node) => node.scrollTop + node.clientHeight >= node.scrollHeight - 2,
        ),
      )
      .toBe(true);
    await page.getByRole("option").last().click();
    await expect(font).toBeFocused();

    // Filtering never blanks the current font value, even with no matching names.
    await page
      .getByRole("textbox", { name: "Search fonts", exact: true })
      .fill("no-font-matches-this");
    await expect(font).toHaveText(lastLabel);
    await page
      .getByRole("textbox", { name: "Search fonts", exact: true })
      .fill("");
    await font.click();
    await page.keyboard.press("Home");
    await inWindow(page);
    await mkdir("docs/screenshots", { recursive: true });
    await page.screenshot({ path: "docs/screenshots/dropdown-font-light.png" });
    await page.keyboard.press("Escape");
    // Typeahead remains available alongside page navigation.
    await font.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.type("Roboto");
    await expect(
      page.getByRole("option", { name: "Roboto", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");

    await page
      .locator(".sidebar-bottom")
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Theme", exact: true }).click();
    await page.getByRole("option", { name: "Dark", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Interface language", exact: true })
      .click();
    await page.getByRole("option", { name: "ภาษาไทย", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Speech language", exact: true })
      .click();
    await inWindow(page);
    await page.screenshot({
      path: "docs/screenshots/dropdown-settings-th-dark.png",
    });
    await page.keyboard.press("Escape");
    await page
      .locator(".main-navigation")
      .getByRole("button", { name: "บทพูด", exact: true })
      .click();
    await page.getByRole("tab", { name: "คำบรรยาย", exact: true }).click();
    await page
      .locator(".caption-studio-tabs")
      .getByRole("button", { name: "ตำแหน่ง", exact: true })
      .click();
    await font.click();
    await inWindow(page);
    await page.keyboard.press("Home");
    await expect(page.getByRole("option").first()).toBeFocused();
    await page.screenshot({
      path: "docs/screenshots/dropdown-font-th-dark.png",
    });
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
