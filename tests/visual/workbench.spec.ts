import {test,expect} from '@playwright/test';
import path from 'node:path';
import {task,navigation} from './workbench-helpers';
test('optional panels reserve space and modes retain keyboard access',async({page})=>{
 await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF…/}).click();await(await chooser).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));
 await expect(page.getByRole('combobox',{name:'Workspace mode'})).toBeVisible();await expect(page.locator('.navigation-panel')).toHaveCount(0);
 await navigation(page);await page.locator('.pdf-object').filter({hasText:'A considered'}).click();await expect(page.locator('.inspector')).toBeVisible();
 for(const width of [1440,1100]){await page.setViewportSize({width,height:860});await page.locator('.inspector').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});const editor=(await page.locator('.editor').boundingBox())!,nav=(await page.locator('.navigation-panel').boundingBox())!,props=(await page.locator('.inspector').boundingBox())!;expect(nav.x+nav.width).toBeLessThanOrEqual(editor.x+1);expect(editor.x+editor.width).toBeLessThanOrEqual(props.x+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.keyboard.press('Alt+2');await expect(page.getByRole('combobox',{name:'Workspace mode'})).toContainText('Insert');await task(page,'Pages');await expect(page.getByLabel('Page organizer')).toBeVisible();await task(page,'Edit');await expect(page.locator('.navigation-panel')).toHaveCount(0);
});
test('recent document browsing does not create sessions',async({page})=>{
 await page.goto('/');await page.locator('.quiet-file').first().waitFor();expect(await page.locator('.quiet-file').count()).toBeLessThanOrEqual(6);const before=await page.request.post('/__engine',{data:{action:'sessions'}});const sessions=(await before.json()).value;
 await page.locator('.quiet-file').first().hover();await page.getByRole('button',{name:'See all',exact:true}).click();await page.getByRole('textbox',{name:'Search recent documents'}).fill('studio');const after=await page.request.post('/__engine',{data:{action:'sessions'}});expect((await after.json()).value).toEqual(sessions);
});

