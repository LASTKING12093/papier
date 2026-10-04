import {task, navigation, command as workbenchCommand} from "./workbench-helpers";
import {test,expect} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
test.use({actionTimeout:15000});
const dir='tmp/qa/productivity';
async function ready(page:any){await expect(page.locator('.statusbar .spin')).toHaveCount(0);await expect.poll(()=>page.locator('#page-0 .pdf-page').evaluate((el:any)=>el.dataset.renderRequired===el.dataset.rendered)).toBe(true);}
test('mouse text resizing, cancel, double click and style transfer survive saving',async({page})=>{
 test.setTimeout(150000);await fs.mkdir(dir,{recursive:true});await page.goto('/');
 const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF…/}).click();await(await choose).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));
 await expect(page.getByRole('combobox',{name:'Workspace mode'})).toBeVisible();
 const obj=page.locator('#page-0 .pdf-object').filter({hasText:'A considered'});await obj.click();await ready(page);await page.waitForTimeout(500);
 const original=(await obj.boundingBox())!;const size=Number(await page.getByRole('spinbutton',{name:'Toolbar font size'}).inputValue());
 const handle=page.getByRole('button',{name:'Resize s',exact:true});const h=(await handle.boundingBox())!;
 await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+h.height/2+original.height*.35,{steps:10});
 await expect(page.locator('.object-live-composite')).toBeVisible();await page.screenshot({path:`${dir}/text-resizing.png`});await page.mouse.up();await ready(page);await expect(page.locator('.object-live-composite')).toHaveCount(0);
 const resized=(await obj.boundingBox())!;expect(resized.width/original.width).toBeCloseTo(1.35,1);expect(resized.height/original.height).toBeCloseTo(1.35,1);
 expect(Number(await page.getByRole('spinbutton',{name:'Toolbar font size'}).inputValue())).toBeCloseTo(size*1.35,0);
 // Escape cancels without committing a revision, including after the actual pixels have moved.
 await page.mouse.move(resized.x+30,resized.y+8);await page.mouse.down();await page.mouse.move(resized.x+130,resized.y+58,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();await expect.poll(async()=>Math.round((await obj.boundingBox())!.x)).toBe(Math.round(resized.x));
 await obj.dblclick({position:{x:30,y:8}});await expect(page.getByRole('textbox',{name:'Edit text on page'})).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('spinbutton',{name:'Toolbar font size'}).fill('28');await page.getByRole('button',{name:'Apply typography'}).click();await ready(page);await expect(page.getByRole('spinbutton',{name:'Toolbar font size'})).toHaveValue('28');
 await page.getByRole('button',{name:'Copy style',exact:true}).click();
 const other=page.locator('#page-0 .pdf-object').filter({hasText:'workspace.'});await other.click();await page.getByRole('button',{name:'Apply style',exact:true}).click();await ready(page);await expect(page.getByRole('spinbutton',{name:'Toolbar font size'})).toHaveValue('28');
 await page.getByRole('button',{name:'Center object on page'}).click();await ready(page);await page.screenshot({path:`${dir}/workspace.png`});
 const download=page.waitForEvent('download');await page.keyboard.press('Control+s');await(await download).saveAs(`${dir}/resized.pdf`);
 const data=(await fs.readFile(`${dir}/resized.pdf`)).toString('base64');const response=await page.request.post('/__engine',{data:{action:'import',payload:{name:'resized.pdf',data}}});const state=(await response.json()).value;
 const inspected=await page.request.post('/__engine',{data:{action:'inspect',id:state.id,payload:{page:0}}});const objects=(await inspected.json()).value;
 expect(objects.find((o:any)=>o.text==='A considered').size).toBeCloseTo(28,1);expect(objects.find((o:any)=>o.text==='workspace.').size).toBeCloseTo(28,1);
});
test('new intake preset creates actual fillable PDF fields',async({page})=>{
 test.setTimeout(90000);await page.goto('/');await page.getByRole('button',{name:/^New document/}).click();await page.getByRole('textbox',{name:'Search templates'}).fill('Client Intake');await page.getByRole('dialog').getByRole('button',{name:/Client Intake/}).click();await page.screenshot({path:`${dir}/templates.png`});await page.getByRole('button',{name:'Create',exact:true}).click();await ready(page);
 await task(page,"Forms");await expect(page.getByRole('textbox',{name:'Value for Contact name'})).toBeVisible();await page.getByRole('textbox',{name:'Value for Contact name'}).fill('Papier QA');await page.getByRole('textbox',{name:'Value for Email'}).focus();await ready(page);await page.screenshot({path:`${dir}/intake.png`});
});
