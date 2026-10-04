import {test,expect} from '@playwright/test';
import {task} from './workbench-helpers';
import path from 'node:path';
test('signature collections change visible geometry and Previous restores the exact collection',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Your signature, your style/}).click();await page.getByPlaceholder('Enter your name').fill('Alex Almeida');
 await page.getByRole('button',{name:'Explore 8 styles'}).click();
 const candidates=page.locator('.signature-candidates button');await expect(candidates).toHaveCount(8);
 const paths=()=>candidates.locator('svg.signature-vector').evaluateAll(nodes=>nodes.map(n=>n.innerHTML));const before=await paths();
 const raster=()=>candidates.locator('svg.signature-vector').evaluateAll(async nodes=>Promise.all(nodes.map(async n=>{const svg=n.cloneNode(true) as SVGElement;svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('width','300');svg.setAttribute('height','120');svg.style.color='#000';const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(new XMLSerializer().serializeToString(svg));await img.decode();const c=document.createElement('canvas');c.width=300;c.height=120;const ctx=c.getContext('2d')!;ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,300,120).data;return Array.from({length:36000},(_,i)=>data[i*4+3]>40?1:0);})));const masks=await raster();
 await page.getByRole('button',{name:'Generate variations',exact:true}).click();await expect(page.locator('.signature-batch-bar')).toContainText('Collection 2');const next=await raster();const difference=masks.map((mask,i)=>{let union=0,changed=0;for(let j=0;j<mask.length;j++){if(mask[j]||next[i][j])union++;if(mask[j]!==next[i][j])changed++;}return changed/Math.max(1,union);});expect(difference.filter(d=>d>.35).length).toBeGreaterThanOrEqual(6);
 await page.getByRole('button',{name:'← Previous',exact:true}).click();expect(await paths()).toEqual(before);
 await page.getByRole('button',{name:'Hide styles'}).click();
 for(const viewport of [{width:1100,height:740},{width:820,height:600}]){await page.setViewportSize(viewport);await expect(page.getByRole('button',{name:'Generate variations',exact:true})).toBeInViewport();const generate=await page.getByRole('button',{name:'Generate variations',exact:true}).boundingBox();const place=await page.getByRole('button',{name:'Place signature',exact:true}).boundingBox();expect(generate!.y).toBeGreaterThan(0);expect(generate!.y+generate!.height).toBeLessThan(viewport.height);expect(place!.y+place!.height).toBeLessThan(viewport.height);}
});
test('minimal home has six nonoverlapping recent rows and panels open on demand',async({page})=>{
 await page.goto('/');await page.locator('.quiet-file').first().waitFor();for(const viewport of [{width:1440,height:960},{width:820,height:600}]){await page.setViewportSize(viewport);await expect(page.getByRole('button',{name:/^New document/})).toBeInViewport();const items=await page.locator('.quiet-file').evaluateAll(nodes=>nodes.slice(0,10).map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height}}));for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j];expect(a.x+a.w<=b.x+1||b.x+b.w<=a.x+1||a.y+a.h<=b.y+1||b.y+b.h<=a.y+1).toBe(true);}}
 await page.setViewportSize({width:1440,height:960});const pick=page.waitForEvent('filechooser');await page.getByRole('button',{name:/Open PDF…/}).click();await(await pick).setFiles(path.resolve('tests/fixtures/studio-brief.pdf'));await page.locator('.pdf-page').first().waitFor();
 await expect(page.locator('.navigation-panel')).toHaveCount(0);await expect(page.locator('.inspector')).toHaveCount(0);
 await task(page,'Review');await page.locator('.navigation-panel').evaluate(async el=>{await Promise.all(el.getAnimations().map(a=>a.finished));});const column=await page.locator('.navigation-panel').boundingBox(),content=await page.locator('.editor').boundingBox();expect(column!.x+column!.width).toBeLessThanOrEqual(content!.x+1);await task(page,'Pages');await expect(page.getByLabel('Page organizer')).toBeVisible();
});


