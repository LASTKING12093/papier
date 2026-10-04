import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const output=path.resolve('artifacts/licenses');
await fs.mkdir(output,{recursive:true});
const entries=[];
async function record(name,version,license,dir,source,distribution){
  const safe=(name+'-'+version).replace(/[^a-zA-Z0-9._-]/g,'_');
  const notices=[];
  for(const item of await fs.readdir(dir,{withFileTypes:true})){
    if(item.isFile() && /^(licen[sc]e|copying|notice|copyright)([._-]|$)/i.test(item.name)){
      const dest=`${safe}-${item.name}`;
      await fs.copyFile(path.join(dir,item.name),path.join(output,dest));notices.push(dest);
    }
  }
  if(!notices.length){
    const fallback=`${name}-LICENSE.txt`;
    await fs.access(`licenses/upstream/${fallback}`);
    await fs.copyFile(`licenses/upstream/${fallback}`,`${output}/${fallback}`);
    notices.push(fallback);
  }
  entries.push({name,version,license,source,distribution,notices});
}
const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));
for(const [location,info] of Object.entries(lock.packages)){
  if(!location||info.dev)continue;
  const p=JSON.parse(await fs.readFile(path.join(location,'package.json'),'utf8'));
  await record(p.name,p.version,p.license??info.license,location,`https://www.npmjs.com/package/${p.name}/v/${p.version}`,'Frontend or offline OCR runtime');
}
const result=spawnSync('cargo',['metadata','--format-version','1','--locked','--filter-platform','x86_64-pc-windows-msvc'],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
if(result.status!==0)throw Error(result.stderr);
const metadata=JSON.parse(result.stdout),nodes=new Map(metadata.resolve.nodes.map(n=>[n.id,n]));
const reachable=new Set(),todo=[...metadata.workspace_members];
while(todo.length){const id=todo.pop();if(reachable.has(id))continue;reachable.add(id);todo.push(...nodes.get(id).dependencies);}
for(const p of metadata.packages.filter(p=>p.source&&reachable.has(p.id)))await record(p.name,p.version,p.license,path.dirname(p.manifest_path),`https://crates.io/crates/${p.name}/${p.version}`,'Windows native build graph; unchanged upstream crate');
for(const name of await fs.readdir('assets/fonts'))if(/OFL\.txt$/.test(name))await fs.copyFile(`assets/fonts/${name}`,`${output}/font-${name}`);
for(const item of await fs.readdir('vendor/signature-fonts',{withFileTypes:true}))if(item.isDirectory())await fs.copyFile(`vendor/signature-fonts/${item.name}/OFL.txt`,`${output}/signature-${item.name}-OFL.txt`);
for(const name of await fs.readdir('licenses/upstream'))await fs.copyFile(`licenses/upstream/${name}`,`${output}/${name}`);
await fs.copyFile('LICENSE',`${output}/Papier-LICENSE.txt`);
await fs.copyFile('THIRD_PARTY_NOTICES.md',`${output}/THIRD_PARTY_NOTICES.md`);
entries.sort((a,b)=>a.name.localeCompare(b.name));
await fs.writeFile(`${output}/dependencies.json`,JSON.stringify(entries,null,2)+'\n');
await fs.writeFile(`${output}/INDEX.txt`,entries.map(p=>`${p.name} ${p.version}\n${p.license}\n${p.source}\n${p.notices.join(', ')}`).join('\n\n'));
const missing=entries.filter(p=>!p.license||!p.notices.length);
await fs.mkdir('licenses',{recursive:true});
await fs.writeFile('licenses/dependencies.json',JSON.stringify(entries,null,2)+'\n');
const fonts=[];
for(const name of await fs.readdir('assets/fonts'))if(name.endsWith('.ttf'))fonts.push({file:name,sha256:createHash('sha256').update(await fs.readFile(`assets/fonts/${name}`)).digest('hex')});
await fs.writeFile('licenses/font-hashes.json',JSON.stringify(fonts,null,2)+'\n');
console.log(JSON.stringify({entries:entries.length,missingNotice:missing.map(p=>({name:p.name,version:p.version,license:p.license}))}));
if(missing.length)process.exitCode=1;
