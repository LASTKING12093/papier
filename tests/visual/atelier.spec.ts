import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs/promises";

async function savedPaths(page: Page) {
  await expect(page.locator(".object-selection")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.keyboard.press("Control+s");
  const file = await (await download).path();
  const data = await fs.readFile(file!);
  const response = await page.request.post("/__engine", {
    data: {
      action: "import",
      payload: { name: "atelier-roundtrip.pdf", data: data.toString("base64") },
    },
  });
  const doc = (await response.json()).value;
  const inspection = await page.request.post("/__engine", {
    data: { action: "inspect", id: doc.id, payload: { page: 0 } },
  });
  expect(
    (await inspection.json()).value.some((o: any) => o.kind === "path"),
  ).toBe(true);
}

test("Home signature studio has eight directions, new collections and real vector export", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /Your signature, your style/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Place signature" }),
  ).toBeDisabled();
  await page.getByPlaceholder("Enter your name").fill("Alex Almeida");
  await page.getByRole('button',{name:'Explore 8 styles'}).click();
  const tiles = page.locator(".signature-candidates>button");
  await expect(tiles).toHaveCount(8);
  const previews = () =>
    tiles.evaluateAll((nodes) =>
      nodes.map((n) => n.querySelector("svg")!.innerHTML),
    );
  const before = await previews();
  expect(new Set(before).size).toBe(8);
  await page.getByRole("button", { name: "Generate variations" }).click();
  expect(await previews()).not.toEqual(before);
  await expect(tiles).toHaveCount(8);
  await tiles.filter({ hasText: "Personal" }).first().click();
  await page.getByRole('button',{name:'Customize',exact:true}).click();
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transparent SVG" }).click();
  const svg = await fs.readFile((await (await exported).path())!, "utf8");
  expect(svg).toContain("<path");
  expect(svg).not.toContain("<image");
  await page
    .getByRole("button", { name: "Save to library", exact: true })
    .click();
  await expect(tiles).toHaveCount(1);
  await page.getByRole("button", { name: "Place signature" }).click();
  await savedPaths(page);
});

test("Ink Studio reconstructs a rough ellipse, comparison is read-only and drawing survives PDF save", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /From rough to refined/ }).click();
  await expect(page.getByRole("heading", { name: "Ink Studio" })).toBeVisible();
  await page.getByRole("combobox", { name: "Ink reconstruction" }).click();
  await page.getByRole("option", { name: "Smart shapes", exact: true }).click();
  const box = (await page.locator(".signature-draw svg").boundingBox())!;
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx + 115, cy);
  await page.mouse.down();
  for (let i = 1; i <= 80; i++) {
    const a = (i * Math.PI) / 40;
    await page.mouse.move(
      cx + (115 + Math.sin(i * 2) * 2) * Math.cos(a),
      cy + (48 + Math.cos(i * 3)) * Math.sin(a),
    );
  }
  await page.mouse.up();
  await expect(page.locator(".ink-reconstruction small")).toHaveText("Ellipse");
  const refined = await page
    .locator(".ink-reconstruction svg path")
    .getAttribute("d");
  const getSvg = async () => {
    const d = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export transparent SVG" }).click();
    return fs.readFile((await (await d).path())!, "utf8");
  };
  const output = await getSvg();
  await page.getByRole("button", { name: "Compare original" }).click();
  expect(
    await page.locator(".ink-reconstruction svg path").getAttribute("d"),
  ).not.toBe(refined);
  expect(await getSvg()).toBe(output);
  await page.getByRole("button", { name: "Place drawing" }).click();
  await savedPaths(page);
});

test("Home template shortcut opens the intended editable preset", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('.quiet-templates summary').click();
  await page
    .locator(".home-template-line")
    .getByRole("button", { name: "Weekly Focus" })
    .click();
  await expect(
    page.getByRole("dialog").locator("button.selected"),
  ).toContainText("Weekly Focus");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page
      .locator(".pdf-object")
      .filter({ hasText: "A week with intention" })
      .first(),
  ).toBeVisible();
});

test('Studio keeps drawing coordinates and footer stable in a smaller window',async({page})=>{
  await page.setViewportSize({width:1100,height:740});await page.goto('/');
  await page.getByRole('button',{name:/From rough to refined/}).click();
  await page.getByRole('combobox',{name:'Ink reconstruction'}).click();await page.getByRole('option',{name:'Original',exact:true}).click();
  const surface=page.locator('.signature-draw svg');const before=(await surface.boundingBox())!;
  await page.mouse.move(before.x+60,before.y+50);await page.mouse.down();await page.mouse.move(before.x+180,before.y+50,{steps:15});await page.mouse.up();
  const after=(await surface.boundingBox())!;expect(Math.abs(after.y-before.y)).toBeLessThan(1);
  const place=page.getByRole('button',{name:'Place drawing'});const button=(await place.boundingBox())!;expect(button.y+button.height).toBeLessThan(740);await place.click({trial:true});
  await page.getByRole('button',{name:'Type',exact:true}).click();await page.getByPlaceholder('Enter your name').fill('João Silva');
  const signature=page.getByRole('button',{name:'Place signature'});await signature.click({trial:true});
  await page.getByRole('button',{name:'Customize',exact:true}).click();
  await page.getByRole('button',{name:'Export transparent SVG'}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Export transparent SVG'}).click({trial:true});
});

