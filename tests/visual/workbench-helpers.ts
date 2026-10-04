import {expect,type Page} from '@playwright/test';
export async function task(page:Page,name:string){
 await page.getByRole('combobox',{name:'Workspace mode',exact:true}).click();
 await page.getByRole('option',{name,exact:true}).click();
}
export async function navigation(page:Page){
 if(!(await page.locator('.navigation-panel').isVisible()))await page.getByRole('button',{name:'Show navigation',exact:true}).click();
 await expect(page.locator('.navigation-panel')).toBeVisible();
}
export async function command(page:Page,name:string){
 await page.keyboard.press('Control+k');await page.getByRole('combobox',{name:'Search tools'}).fill(name);
 await page.getByRole('option',{name:new RegExp(name,'i')}).first().click();
}
