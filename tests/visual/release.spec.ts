import {test,expect} from '@playwright/test';
import path from 'node:path';
test('opening properties during pointer selection does not move PDF content',async({page})=>{
 await page.goto('/');const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF/}).click();await(await chooser).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));
 const node=page.locator('.pdf-object').filter({hasText:'A considered'});await node.waitFor();
 const id=await page.locator('.pdf-page').first().getAttribute('data-document-id');
 const inspect=async()=>{const r=await page.request.post('/__engine',{data:{action:'inspect',id,payload:{page:0}}});return(await r.json()).value.find((o:any)=>o.text==='A considered');};
 const before=await inspect();const b=(await node.boundingBox())!;const x=b.x+b.width/2,y=b.y+b.height/2;
 await page.mouse.move(x,y);await page.mouse.down();await expect(page.locator('.inspector')).toBeVisible();await page.waitForTimeout(400);await page.mouse.move(x+1,y);await page.mouse.up();await page.waitForTimeout(350);
 expect((await inspect()).bounds).toEqual(before.bounds);
});
