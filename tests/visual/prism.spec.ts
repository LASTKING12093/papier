import {task, navigation, command as workbenchCommand} from "./workbench-helpers";
import {test,expect,type Page} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
const folder='tmp/qa/prism';
test.use({actionTimeout:15000});
async function shot(page:Page,name:string){await page.screenshot({path:`${folder}/${name}.png`,animations:'disabled'});}
async function ready(page:Page){await expect(page.locator('.statusbar .spin')).toHaveCount(0);await expect.poll(()=>page.locator('.pdf-page').first().evaluate(el=>el.getAttribute('data-render-required')===el.getAttribute('data-rendered')&&!!el.querySelector('img')?.complete)).toBe(true);}
async function close(page:Page){await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);}
async function fixture(page:Page){const c=page.waitForEvent('filechooser');await page.getByRole('button',{name:/^Open PDF/}).click();await(await c).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));await expect(page.locator('.pdf-object').filter({hasText:'A considered'})).toBeVisible();await ready(page);}
test('Prism review: fifteen states, contextual actions and independent motion',async({page})=>{
 test.setTimeout(150000);await fs.mkdir(folder,{recursive:true});await page.goto('/');await expect(page.getByRole('heading',{name:'Papier',exact:true})).toBeVisible();const light=page.locator('.quiet-brand linearGradient').first();const firstLight=await light.evaluate((g:SVGLinearGradientElement)=>g.x1.animVal.value);await expect.poll(()=>light.evaluate((g:SVGLinearGradientElement)=>g.x1.animVal.value)).not.toBe(firstLight);await fixture(page);await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.quiet-file').first()).toBeVisible();await shot(page,'01-home');await page.locator('.quiet-file').first().hover();await expect(page.locator('.quiet-file-more').first()).toBeVisible();await shot(page,'02-home-hover');
 await page.keyboard.press('Control+n');await shot(page,'03-new-document');await page.getByRole('dialog').getByRole('button',{name:/ABNT Academic/}).click();await shot(page,'04-selected-template');await page.getByRole('dialog').getByRole('button',{name:/Blank A4/}).click();await page.getByRole('button',{name:'Create',exact:true}).click();await ready(page);await shot(page,'05-blank-document');
 await fixture(page);await shot(page,'06-open-pdf');const obj=page.locator('.pdf-object').filter({hasText:'A considered'});await obj.click();await shot(page,'07-object-selected');await page.getByRole('button',{name:'Duplicate selected object'}).click();await ready(page);await expect(page.locator('.statusbar')).toContainText('Unsaved');await page.keyboard.press('Control+z');await ready(page);
 await task(page,"Pages");await shot(page,'08-pages');await task(page,"Sign");await page.getByPlaceholder('Enter your name').fill('José Alex Xavier');await shot(page,'09-signature-studio');await page.getByRole('button',{name:'Rubric',exact:true}).click();await shot(page,'10-rubric');await close(page);
 await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search tools'}).fill('comp');await shot(page,'11-command-palette');await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
 await task(page,"Edit");await obj.click({button:'right'});await shot(page,'12-context-menu');await page.keyboard.press('Escape');
 await page.keyboard.press('Control+Shift+s');await shot(page,'13-save-as');await close(page);
 await page.getByRole('button',{name:'Settings'}).click();await shot(page,'15-settings');await page.getByRole('button',{name:'About Papier',exact:true}).click();await shot(page,'14-about');await close(page);
 await task(page,"Insert");await expect(page.locator('.editor-toolbar')).toContainText('PDF pages');await shot(page,'16-insert-mode');
 await task(page,"Export");await expect(page.locator('.editor-toolbar')).toContainText('Compress PDF');
 await task(page,"Review");await expect(page.locator('.editor-toolbar')).toContainText('Recognize text');
 await task(page,"Edit");await obj.click();await page.getByRole('button',{name:'Text style',exact:true}).click();await expect(page.getByRole('button',{name:'Text style',exact:true})).toHaveAttribute('aria-expanded','false');await page.getByRole('button',{name:'Text style',exact:true}).click();
 await page.setViewportSize({width:1366,height:768});await shot(page,'17-compact-editor');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Settings'}).click();await page.getByRole('button',{name:'Light',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');await shot(page,'18-light-settings');await page.getByRole('button',{name:'Dark',exact:true}).click();await close(page);
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.quiet-brand animate')).toHaveCount(2);await shot(page,'19-compact-home');await page.keyboard.press('Control+n');await shot(page,'20-compact-new-document');expect(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true);
});
