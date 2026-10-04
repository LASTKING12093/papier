import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import { command, task } from "./workbench-helpers";

test("Changing workspace or returning Home commits on-page drafts", async ({
  page,
}) => {
  await blank(page);
  await textAt(page, 85, 160, "Keep this draft");
  await task(page,'Pages');
  expect(
    (await currentObjects(page)).objects.some(
      (o: any) => o.text === "Keep this draft",
    ),
  ).toBe(true);
  await textAt(page, 85, 230, "Keep this too");
  const id = await page
    .locator(".pdf-page")
    .first()
    .getAttribute("data-document-id");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Papier", exact: true }),
  ).toBeVisible();
  const result = await page.request.post("/__engine", {
    data: { action: "inspect", id, payload: { page: 0 } },
  });
  expect(
    (await result.json()).value.some((o: any) => o.text === "Keep this too"),
  ).toBe(true);
});
async function blank(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^New document/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator(".rendered-page").first()).toBeVisible();
}
async function textAt(page: Page, x: number, y: number, value: string) {
  await command(page, "Add text");
  const b = (await page.locator(".pdf-page").first().boundingBox())!;
  await page.mouse.click(b.x + x, b.y + y);
  await page.getByRole("textbox", { name: "New text on page" }).fill(value);
}
async function currentObjects(page: Page) {
  const id = await page
    .locator(".pdf-page")
    .first()
    .getAttribute("data-document-id");
  const r = await page.request.post("/__engine", {
    data: { action: "view", id },
  });
  const doc = (await r.json()).value;
  const o = await page.request.post("/__engine", {
    data: { action: "inspect", id, payload: { page: 0 } },
  });
  return { doc, objects: (await o.json()).value };
}

test("Direct text has readable contrast, saves the pending draft, and applies edited content with typography", async ({
  page,
}) => {
  await blank(page);
  await textAt(page, 90, 170, "A direct idea");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "New text on page" });
  expect(
    await editor.evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  const download = page.waitForEvent("download");
  await editor.press("Control+s");
  const data = await fs.readFile((await (await download).path())!);
  const r = await page.request.post("/__engine", {
    data: {
      action: "import",
      payload: { name: "direct-export.pdf", data: data.toString("base64") },
    },
  });
  const imported = (await r.json()).value;
  const extracted = await page.request.post("/__engine", {
    data: { action: "text", id: imported.id },
  });
  expect((await extracted.json()).value.join(" ")).toContain("A direct idea");
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A direct idea" }),
  ).toBeVisible();
  await page
    .locator(".pdf-object")
    .filter({ hasText: "A direct idea" })
    .dblclick();
  await page
    .getByRole("textbox", { name: "Edit text on page" })
    .fill("A better idea");
  await page.getByRole("spinbutton", { name: "Toolbar font size" }).fill("24");
  await page.getByLabel("Text fill", { exact: true }).fill("#275eb1");
  await page.getByRole("button", { name: "Apply typography" }).click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A better idea" }),
  ).toBeVisible();
  const result = await currentObjects(page);
  const text = result.objects.find((o: any) => o.text === "A better idea");
  expect(text.size).toBe(24);
  expect(text.color).toEqual([39, 94, 177, 255]);
});

test("New paragraphs wrap to the text area and Escape discards a new draft", async ({
  page,
}) => {
  await blank(page);
  await textAt(
    page,
    85,
    180,
    "This paragraph contains several words and should wrap cleanly inside its text area without extending past the right edge.",
  );
  await page.getByRole("textbox", { name: "New text on page" }).press("Enter");
  await expect(page.locator(".pdf-object")).not.toHaveCount(0);
  const result = await currentObjects(page);
  expect(result.objects.length).toBeGreaterThan(2);
  for (const o of result.objects) expect(o.bounds.width).toBeLessThan(242);
  const count = result.objects.length;
  await textAt(page, 85, 310, "Discard this");
  await page.getByRole("textbox", { name: "New text on page" }).press("Escape");
  await expect(page.locator(".pdf-object")).toHaveCount(count);
});

test("Find and replace previews changes, applies them atomically and supports undo", async ({
  page,
}) => {
  await blank(page);
  await textAt(page, 85, 140, "Hello Papier");
  await page.getByRole("textbox", { name: "New text on page" }).press("Enter");
  await textAt(page, 85, 210, "Hello Papier");
  await page.getByRole("textbox", { name: "New text on page" }).press("Enter");
  await command(page, "Find & replace text");
  await page
    .getByRole("textbox", { name: "Find text", exact: true })
    .fill("Hello Papier");
  await page.getByRole("textbox", { name: "Replacement text" }).fill("");
  await expect(
    page.getByRole("button", { name: "Replace 2 objects" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Replace 2 objects" }).click();
  await expect(page.locator(".pdf-object")).toHaveCount(0);
  await page.keyboard.press("Control+z");
  await expect(
    page.locator(".pdf-object").filter({ hasText: "Hello Papier" }),
  ).toHaveCount(2);
});

test("Tool library supports Portuguese search, persistent pins and locating page contents", async ({
  page,
}) => {
  await blank(page);
  await textAt(page, 85, 180, "Find this object");
  await page.getByRole("textbox", { name: "New text on page" }).press("Enter");
  await page.keyboard.press("Control+k");
  await page.getByRole("button", { name: "Browse all tools →", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Find a function" })
    .fill("substituir");
  await expect(page.locator(".tool-library-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Pin Find & replace text", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Find a function" }).fill("");
  await page.getByRole("button", { name: "Pinned", exact: true }).click();
  await expect(page.locator(".tool-library-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await command(page, "Page contents");
  await page
    .getByRole("textbox", { name: "Search page contents" })
    .fill("Find this");
  await page
    .locator(".contents-panel")
    .getByRole("button", { name: /Find this object/ })
    .click();
  await expect(page.locator(".object-selection")).toBeVisible();
});

