import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const prefixes=[root,process.env.CARGO_HOME??path.join(os.homedir(),'.cargo'),os.homedir()];
const flags=(process.env.CARGO_ENCODED_RUSTFLAGS??'').split('\x1f').filter(Boolean);
for(const [i,p]of prefixes.entries())flags.push(`--remap-path-prefix=${p}=${i===0?'.':`/build-dependency-${i}`}`);
const env={...process.env,CARGO_ENCODED_RUSTFLAGS:flags.join('\x1f')};
function run(exe,args){const r=spawnSync(exe,args,{env,stdio:'inherit',windowsHide:true});if(r.status!==0)process.exit(r.status??1);}
run(process.execPath,['scripts/licenses.mjs']);
run(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','build','--config','apps/desktop/src-tauri/tauri.conf.json','--config',JSON.stringify({build:{devUrl:null,beforeDevCommand:null}})]);
run(process.execPath,['scripts/package-studio-installer.mjs']);
const version=JSON.parse(await fs.readFile('apps/desktop/src-tauri/tauri.conf.json','utf8')).version;
console.log(`Production package ready: Papier-${version}-Setup-x64.exe`);
