import {mkdir,copyFile,readdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='apps/desktop/public/ocr';await mkdir(`${root}/core`,{recursive:true});await mkdir(`${root}/data`,{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js',`${root}/worker.min.js`);
for(const file of await readdir('node_modules/tesseract.js-core'))if(/\.wasm(?:\.js)?$/.test(file))await copyFile(`node_modules/tesseract.js-core/${file}`,`${root}/core/${file}`);
const inventory=JSON.parse(await readFile('vendor/ocr-languages.json','utf8'));
for(const {language,url,sha256} of inventory){
 const response=await fetch(url);if(!response.ok)throw new Error(`Language download failed: ${language}`);const data=Buffer.from(await response.arrayBuffer());
 if(createHash('sha256').update(data).digest('hex')!==sha256)throw new Error(`OCR language checksum mismatch: ${language}`);
 await writeFile(`${root}/data/${language}.traineddata`,data);
}
process.stdout.write('Local OCR worker, WASM runtime and English, Portuguese, Spanish language packs prepared.\n');
