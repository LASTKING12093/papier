import {task, navigation, command as workbenchCommand} from "./workbench-helpers";
import { test, expect } from "@playwright/test";
import path from "node:path";
test("real PDF opens, edits, undoes, exports, and remains usable in dark mode", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Papier", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/qa/home.png", fullPage: true });
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open PDF…", exact: false }).click();
  await (
    await chooser
  ).setFiles(path.resolve("tests/fixtures/studio-brief.pdf"));
  await expect(
    page.getByRole("tab", { name: /studio-brief.pdf/ }),
  ).toBeVisible();
  await expect(page.locator(".rendered-page").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Fit width (Ctrl+0)", exact: true })
    .click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A considered" }),
  ).toBeVisible();
  await page.locator(".pdf-object").filter({ hasText: "A considered" }).click();
  await page
    .getByRole("textbox", { name: "Selected text" })
    .fill("A thoughtful");
  await page
    .getByRole("combobox", { name: "Toolbar font", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Helvetica-Bold", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply text changes" }).click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A thoughtful" }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/qa/editor.png", fullPage: true });
  await page
    .getByRole("button", { name: "Undo Edit text (Ctrl+Z)", exact: true })
    .click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A considered" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Redo Edit text", exact: true })
    .click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "A thoughtful" }),
  ).toBeVisible();
  const saved = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Ctrl S", exact: true }).click();
  await (await saved).saveAs("tmp/qa/ui-saved.pdf");
  await page
    .getByRole("button", { name: "Settings" })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.screenshot({ path: "tmp/qa/editor-dark.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("offline OCR writes searchable text and requests no external services", async ({
  page,
}) => {
  test.setTimeout(120000);
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith(process.env.PAPIER_TEST_URL ?? "http://127.0.0.1:1420") &&
      !request.url().startsWith("data:") &&
      !request.url().startsWith("blob:")
    )
      external.push(request.url());
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open PDF…", exact: false }).click();
  await (
    await chooser
  ).setFiles(path.resolve("tests/fixtures/studio-brief.pdf"));
  await expect(page.getByRole("tab", { name: /studio-brief/ })).toBeVisible();
  await page.getByRole("button", { name: "Search all tools (Ctrl+K)" }).click();
  await page.getByRole("combobox", { name: "Search tools" }).fill("OCR");
  await page.getByRole("option", { name: /OCR searchable text/ }).click();
  await page.getByRole("textbox", { name: "Pages", exact: true }).fill("3");
  await page
    .getByRole("button", { name: "Recognize text", exact: true })
    .click();
  await expect(
    page.getByText(
      "OCR text layer added. Review recognition accuracy before saving.",
    ),
  ).toBeVisible({ timeout: 100000 });
  await navigation(page);await page.getByRole("button", { name: "Go to page 3" }).click();
  await expect(
    page.locator(".pdf-object").filter({ hasText: "SECRET_ABC_123" }),
  ).toHaveCount(2);
  expect(external).toEqual([]);
});
