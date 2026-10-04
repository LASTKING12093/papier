import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const result=spawnSync('cargo',['metadata','--format-version','1','--locked','--filter-platform','x86_64-pc-windows-msvc'],{encoding:'utf8',maxBuffer:16*1024*1024,windowsHide:true});
if(result.status!==0)throw Error(result.stderr);
const metadata=JSON.parse(result.stdout);
const inventory=JSON.parse(await fs.readFile('licenses/dependencies.json','utf8'));
await fs.mkdir('tmp',{recursive:true});
await fs.mkdir('artifacts',{recursive:true});
const stage=await fs.mkdtemp(path.resolve('tmp')+path.sep+'mpl-sources-');
for(const entry of inventory.filter(p=>p.license==='MPL-2.0')){
 const pkg=metadata.packages.find(p=>p.name===entry.name&&p.version===entry.version);
 await fs.cp(path.dirname(pkg.manifest_path),path.join(stage,`${entry.name}-${entry.version}`),{recursive:true,filter:src=>!['.cargo-ok','.cargo_vcs_info.json'].includes(path.basename(src))});
}
await fs.writeFile(path.join(stage,'README.txt'),'Unmodified MPL-2.0 sources distributed with Papier. Each component retains its original license. Exact versions and URLs: licenses/dependencies.json in the Papier repository.\n');
const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
const output=path.resolve(`artifacts/Papier-${version}-MPL-Sources.zip`);
const archive=spawnSync('tar',['-a','-cf',output,'-C',stage,'.'],{stdio:'inherit',windowsHide:true});
if(archive.status!==0)throw Error('MPL source archive failed');
console.log(path.basename(output));
