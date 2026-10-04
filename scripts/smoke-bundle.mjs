import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'target/release');
const child=spawn(path.join(root,'pdf-editor.exe'),['--pdf-worker',path.join(root,'pdfium.dll'),path.resolve('tmp/bundle-smoke-recovery')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();let stderr='';child.stderr.on('data',b=>stderr+=b);
const timeout=setTimeout(()=>child.kill(),30000);
async function request(action,id,payload){child.stdin.write(JSON.stringify({action,id,payload})+'\n');const next=await lines.next();if(next.done)throw Error('Worker exited: '+stderr);const result=JSON.parse(next.value);if(!result.ok)throw Error(result.error);return result.value}
try{
 const doc=await request('create');if(doc.info.pages.length!==1)throw Error('Expected a blank page');
 const png=await request('render',doc.id,{page:0,width:200});if(!png.startsWith('data:image/png;base64,iVBOR'))throw Error('Invalid rendered PNG');
 const check=await request('validate',doc.id);if(!check.valid)throw Error('qpdf validation failed');
 const fixture=await fs.readFile('tests/fixtures/studio-brief.pdf');
 const imported=await request('import',undefined,{name:'Release typography check.pdf',data:fixture.toString('base64')});
 const objects=await request('inspect',imported.id,{page:0});const text=objects.find(o=>o.text==='A considered');
 const edited=await request('edit',imported.id,{revision:imported.revision,command:{kind:'edit_text',page:0,object:text.index,text:'Precisão editorial',font:'Manrope',size:32,color:[31,98,207,255]}});
 const changed=(await request('inspect',edited.id,{page:0}))[text.index];if(changed.text!=='Precisão editorial'||changed.size!==32||changed.color.join(',')!=='31,98,207,255')throw Error('Packaged typography roundtrip failed');
 const layers=await request('object_layers',edited.id,{page:0,object:text.index,width:600,revision:edited.revision});if(layers.length!==3||!layers.every(p=>p.startsWith('data:image/png;base64,')))throw Error('Packaged live layers failed');
 const points=[[80,100],[280,100],[280,220],[80,220],[80,100]].flatMap(p=>[p,p,p]);
 const ink=await request('edit',doc.id,{revision:doc.revision,command:{kind:'signature',page:0,paths:[points],color:[20,20,20,255],width:1}});
 const contour=(await request('inspect',ink.id,{page:0}))[0];if(contour.kind!=='path'||Math.abs(contour.bounds.width-202)>.1||Math.abs(contour.bounds.height-122)>.1)throw Error('Packaged reconstructed corners create unwanted loops');
 const paragraph=await request('edit',doc.id,{revision:ink.revision,command:{kind:'add_paragraph',page:0,rect:{x:60,y:280,width:200,height:30},text:'Local text wraps to the chosen width and remains editable in the packaged application.',font:'Noto Sans',size:16,color:[30,50,80,255]}});
 const wrapped=(await request('inspect',paragraph.id,{page:0})).filter(o=>o.kind==='text');if(wrapped.length<3||wrapped.some(o=>o.bounds.width>201))throw Error('Packaged paragraph wrapping failed');
 const filled=await request('edit',doc.id,{revision:paragraph.revision,command:{kind:'filled_mark',page:0,paths:[[[50,450],[180,450],[180,490],[50,490]],[[80,460],[80,480],[150,480],[150,460]]],color:[25,40,60,255],width:.2}});
 const mark=(await request('inspect',filled.id,{page:0})).at(-1);if(mark.kind!=='path')throw Error('Packaged filled signature failed');
 const actual=await request('render',filled.id,{page:0,width:500});if(!actual.startsWith('data:image/png;base64,'))throw Error('Packaged filled signature render failed');
 await request('close',edited.id,{discard:true});
 await request('close',doc.id,{discard:true});const ended=once(child,'exit');child.stdin.end();await ended;
 const report={executable:'pdf-editor.exe',configuration:'release',checks:['Worker startup','Create PDF','Render using bundled PDFium','Validate using bundled qpdf','Close session','Bundled Manrope text/font/size/color persistence','Three live object preview layers','Reconstructed vector corners without loops','Paragraph wrapping with actual bundled font metrics','Filled vector signatures with compound contours'],passed:true};
 await fs.writeFile('artifacts/bundle-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{clearTimeout(timeout);if(child.exitCode===null)child.kill()}
