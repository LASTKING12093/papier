import {task, navigation, command as workbenchCommand} from "./workbench-helpers";
import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
const shots = "tmp/qa/redesign";
test("creative workspace: all ten requested states and keyboard interactions", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fs.mkdir(shots, { recursive: true });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Papier", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/01-home.png`,
  });
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open PDF…", exact: false }).click();
  await (
    await choose
  ).setFiles(path.resolve("tests/fixtures/studio-brief.pdf"));
  await expect(page.locator("#page-0 .rendered-page")).toBeVisible();
  await expect(
    page.locator("#page-0 .pdf-object").filter({ hasText: "A considered" }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/02-editor.png`,
  });
  await page
    .locator("#page-0 .pdf-object")
    .filter({ hasText: "A considered" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Selected text" }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/03-text.png`,
  });
  await page
    .getByRole("combobox", { name: "Toolbar font", exact: true })
    .focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("combobox", { name: "Toolbar font", exact: true }),
  ).toHaveText("Caveat");
  await page
    .getByRole("combobox", { name: "Toolbar font", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/11-dropdown.png`,
  });
  await page.keyboard.press("Escape");
  await page.locator('#page-0 .pdf-object[title="image"]').click();
  await expect(
    page.getByRole("heading", { name: "image properties", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/04-image.png`,
  });
  await task(page,"Annotate");
  let bounds = (await page.locator("#page-0 .pdf-page").boundingBox())!;
  await page.mouse.move(bounds.x + 48, bounds.y + 170);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 260, bounds.y + 195, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".comment")).toHaveCount(2);
  await expect(page.locator(".statusbar .spin")).toHaveCount(0);
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/05-annotation.png`,
  });
  await task(page,"Pages");
  await expect(page.getByLabel("Page organizer")).toBeVisible();
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click({ modifiers: ["Control"] });
  await expect(page.locator(".organizer .thumbnail.selected")).toHaveCount(2);
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/06-pages.png`,
  });
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click({ button: "right" });
  await expect(page.getByRole("menu")).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/12-context-menu.png`,
  });
  await page.keyboard.press("Escape");
  await task(page,"Forms");
  await page.getByRole("spinbutton", { name: "Page number" }).fill("2");
  await page.locator("#page-1").scrollIntoViewIfNeeded();
  await page
    .getByRole("textbox", { name: "Value for reviewer" })
    .fill("Alex Morgan");
  await page.getByRole("textbox", { name: "Value for reviewer" }).press("Tab");
  await expect(
    page.getByRole("textbox", { name: "Value for reviewer" }),
  ).toHaveValue("Alex Morgan");
  await expect(page.locator(".statusbar .spin")).toHaveCount(0);
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/07-forms.png`,
  });
  await task(page,"Sign");
  await page.getByRole("button", { name: "Close dialog", exact:true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Navigation panel" }).click();
  await page.getByRole("option", { name: "Pages", exact: true }).click();
  await page.getByRole("button", { name: "Go to page 2", exact: true }).click();
  bounds = (await page.locator("#page-1 .pdf-page").boundingBox())!;
  const y = Math.max(150, bounds.y + 400);
  await page.mouse.move(bounds.x + 90, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 110, y - 30, { steps: 5 });
  await page.mouse.move(bounds.x + 115, y + 10, { steps: 5 });
  await page.mouse.move(bounds.x + 140, y - 10, { steps: 5 });
  await page.mouse.move(bounds.x + 190, y + 5, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".statusbar .spin")).toHaveCount(0);
  await expect
    .poll(async () =>
      page.locator("#page-1 .rendered-page").getAttribute("src"),
    )
    .not.toBe(null);
  await page
    .locator("#page-1 .rendered-page")
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
    });
  await page.getByRole("button", { name: "Toggle properties", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Signature", exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/08-signature.png`,
  });
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search tools" }).fill("comp");
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/09-palette.png`,
  });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Settings" })
    .click();
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/10-settings.png`,
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.keyboard.press("Control+Shift+p");
  await page
    .getByRole("combobox", { name: "Search tools" })
    .fill("Document properties");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Document properties" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search tools" }).fill("Compress");
  await page.keyboard.press("Enter");
  await expect
    .poll(
      () =>
        page.locator("[data-render-required]").evaluateAll((nodes) =>
          nodes.every((el) => {
            const r = el.getBoundingClientRect();
            const clip = el
              .closest(".canvas,.thumbnails")
              ?.getBoundingClientRect();
            if (
              r.bottom <= Math.max(0, clip?.top ?? 0) ||
              r.top >= Math.min(innerHeight, clip?.bottom ?? innerHeight) ||
              r.right <= 0 ||
              r.left >= innerWidth
            )
              return true;
            const img = el.querySelector("img");
            return (
              el.getAttribute("data-render-required") ===
                el.getAttribute("data-rendered") &&
              !!img &&
              img.complete &&
              img.naturalWidth > 0
            );
          }),
        ),
      { timeout: 20000 },
    )
    .toBe(true);
  await page.screenshot({
    animations: "disabled",
    path: `${shots}/13-compress.png`,
  });
  await page.getByRole("button", { name: "Compress", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Lossless compression complete",
  );
  expect(errors).toEqual([]);
});

test("image geometry and multi-page drag change real PDF objects", async ({
  page,
}) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open PDF…", exact: false }).click();
  await (
    await chooser
  ).setFiles(path.resolve("tests/fixtures/studio-brief.pdf"));
  await page.locator('#page-0 .pdf-object[title="image"]').click();
  await page
    .getByRole("spinbutton", { name: "Object width", exact: true })
    .fill("450");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect
    .poll(async () =>
      Math.round(
        (await page.locator('#page-0 .pdf-object[title="image"]').boundingBox())
          ?.width ?? 0,
      ),
    )
    .toBe(450);
  await page
    .getByRole("button", {
      name: "Undo Transform object (Ctrl+Z)",
      exact: true,
    })
    .click();
  await expect
    .poll(async () =>
      Math.round(
        (await page.locator('#page-0 .pdf-object[title="image"]').boundingBox())
          ?.width ?? 0,
      ),
    )
    .toBe(491);
  await task(page,"Pages");
  await page
    .getByRole("button", { name: "Select page 2", exact: true })
    .click({ modifiers: ["Control"] });
  await page
    .getByRole("button", { name: "Select page 1", exact: true })
    .dragTo(page.getByRole("button", { name: "Select page 3", exact: true }));
  await expect(page.locator(".statusbar .spin")).toHaveCount(0);
  await task(page,"Edit"); await navigation(page);
  await page.getByRole("button", { name: "Go to page 1", exact: true }).click();
  await expect(
    page.locator("#page-0 .pdf-object").filter({ hasText: "SECRET_ABC_123" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1100, height: 760 });
  if(!(await page.locator(".inspector").isVisible()))await page.getByRole("button",{name:"Toggle properties",exact:true}).click();
  await expect(page.locator(".inspector")).toBeVisible();
  expect(
    await page
      .locator(".editor")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(650);
});


