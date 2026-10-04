import {task, navigation, command as workbenchCommand} from "./workbench-helpers";
import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
test.use({actionTimeout:15000});
test('real text pixels follow drag and typography survives export',async({page})=>{
 test.setTimeout(120000);await fs.mkdir('tmp/qa/refinement',{recursive:true});await page.goto('/');
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF…/}).click();await(await choose).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));
 const obj=page.locator('#page-0 .pdf-object').filter({hasText:'A considered'});await obj.click();await page.waitForTimeout(600);
 await page.screenshot({path:'tmp/qa/refinement/text-selected.png'});const b=(await obj.boundingBox())!;
 await page.mouse.move(b.x+15,b.y+15);await page.mouse.down();await page.mouse.move(b.x+65,b.y+115,{steps:12});
 await expect(page.locator('.object-live-composite')).toBeVisible();await page.screenshot({path:'tmp/qa/refinement/text-during-drag.png'});
 // Compare the actual composited pixels, excluding selection chrome. A box-only preview fails.
 const moved=await page.locator('.object-live-content').evaluate((img:HTMLImageElement)=>{
   const m=new DOMMatrix(getComputedStyle(img).transform);const c=document.createElement('canvas');c.width=img.clientWidth;c.height=img.clientHeight;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i]>32)ink++;return {x:m.e,y:m.f,ink};
 });expect(moved.x).toBeGreaterThan(30);expect(moved.y).toBeGreaterThan(80);expect(moved.ink).toBeGreaterThan(500);
 await page.mouse.up();await expect(page.locator('.object-live-composite')).toHaveCount(0);await expect.poll(async()=>Math.round((await obj.boundingBox())!.y)).toBeGreaterThan(b.y+80);await page.screenshot({path:'tmp/qa/refinement/text-moved.png'});
 await page.getByLabel("Text fill",{exact:true}).fill('#1f62cf');await page.getByRole("spinbutton",{name:"Toolbar font size"}).fill('36');await page.getByRole('button',{name:'Apply text changes',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Selected text'})).toHaveValue(/A considered/);await expect(page.locator('.statusbar .spin')).toHaveCount(0);await page.waitForTimeout(400);await page.screenshot({path:'tmp/qa/refinement/text-color-applied.png'});
 const save=page.waitForEvent('download');await page.keyboard.press('Control+s');await(await save).saveAs('tmp/qa/refinement/styled.pdf');const data=(await fs.readFile('tmp/qa/refinement/styled.pdf')).toString('base64');
 const imported=await page.request.post('/__engine',{data:{action:'import',payload:{name:'style-roundtrip.pdf',data}}});const state=(await imported.json()).value;
 const inspected=await page.request.post('/__engine',{data:{action:'inspect',id:state.id,payload:{page:0}}});const result=(await inspected.json()).value.find((o:any)=>o.text?.includes('A considered'));
 expect(result.color).toEqual([31,98,207,255]);expect(result.size).toBeCloseTo(36,1);
});
test('preferences persist, fonts search and replace, inspection locates objects',async({page})=>{
 test.setTimeout(120000);await page.goto('/');await expect(page.getByRole('heading',{name:'Papier',exact:true})).toBeVisible();await page.keyboard.press('Control+,');await page.getByRole('button',{name:'Motion',exact:true}).click();await page.getByRole('combobox',{name:'Motion language'}).click();await page.getByRole('option',{name:'Reduced',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 await page.getByRole('button',{name:'Editing',exact:true}).click();await page.getByRole('combobox',{name:'Default text font'}).click();await page.getByRole('textbox',{name:'Search fonts'}).fill('Manrope');await page.getByRole('option',{name:'Manrope',exact:true}).click();await page.getByRole('combobox',{name:'Default text font'}).click();await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Editing',exact:true})).toBeVisible();await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF…/}).click();await(await choose).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));await page.locator('#page-0 .pdf-object').filter({hasText:'A considered'}).click();
 await page.getByRole('combobox',{name:'Toolbar font',exact:true}).click();await page.getByRole('textbox',{name:'Search fonts'}).fill('Manrope');await page.screenshot({path:'tmp/qa/refinement/font-search.png'});await page.getByRole('option',{name:'Manrope',exact:true}).click();await page.getByRole('button',{name:'Apply text changes',exact:true}).click();await expect(page.locator('.inspector')).toContainText('Original: Manrope');
 await page.getByRole('textbox',{name:'Selected text'}).fill('Precisão · João');await page.getByRole('button',{name:'Apply text changes',exact:true}).click();await expect(page.locator('.pdf-object').filter({hasText:'Precisão · João'})).toBeVisible();
 await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search tools'}).fill('Inspect document');await page.getByRole('option',{name:/Inspect document fonts/}).click();await expect(page.getByText(/Inspection complete/)).toBeVisible();await page.screenshot({path:'tmp/qa/refinement/document-inspection.png'});await page.locator('.font-inventory button').filter({hasText:'Manrope'}).click();await expect(page.getByRole('textbox',{name:'Selected text'})).toHaveValue('Precisão · João');
 const image=page.locator('#page-0 .pdf-object[title="image"]').first();await image.click();const before=(await image.boundingBox())!;await page.getByRole('button',{name:'Flip horizontal',exact:true}).click();await expect(page.getByRole('heading',{name:'image properties',exact:true})).toBeVisible();await expect(page.locator('.statusbar .spin')).toHaveCount(0);const after=(await image.boundingBox())!;expect(after.x).toBeCloseTo(before.x,0);expect(after.width).toBeCloseTo(before.width,0);
 await page.keyboard.press('Control+,');await page.getByRole('button',{name:'Advanced',exact:true}).click();await page.getByRole('button',{name:'Restore workspace defaults'}).click();await expect(page.locator('html')).toHaveAttribute('data-motion','full');
});

