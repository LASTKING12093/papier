import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve('apps/desktop/src-tauri/installer/studio');
const version=JSON.parse(await fs.readFile('apps/desktop/src-tauri/tauri.conf.json','utf8')).version;
const payload=path.resolve(process.argv[2]??`target/release/bundle/nsis/Papier_${version}_x64-setup.exe`);
const output=path.resolve(process.argv[3]??`artifacts/Papier-${version}-Setup-x64.exe`);
await fs.access(payload);await fs.mkdir(path.dirname(output),{recursive:true});
const net=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319');
const args=['/nologo','/target:winexe','/platform:x64','/optimize+',`/out:${output}`,`/win32icon:${path.resolve('apps/desktop/src-tauri/icons/icon.ico')}`,`/win32manifest:${root}/app.manifest`,
 ...['System.Xaml.dll','System.Windows.Forms.dll','System.Drawing.dll'].map(n=>`/r:${net}/${n}`),
 ...['WindowsBase.dll','PresentationCore.dll','PresentationFramework.dll'].map(n=>`/r:${net}/WPF/${n}`),
 `/resource:${root}/Installer.xaml,Installer.xaml`,`/resource:${path.resolve('apps/desktop/src-tauri/icons/icon.ico')},papier.ico`,`/resource:${payload},engine.exe`,`${root}/Installer.cs`];
const normalized=args.map(arg=>arg.includes(':')?arg[0]==='/'?arg.slice(0,arg.indexOf(':')+1)+arg.slice(arg.indexOf(':')+1).replaceAll('/','\\'):arg.replaceAll('/','\\'):arg);
const result=spawnSync(path.join(net,'csc.exe'),normalized,{encoding:'utf8',windowsHide:true});process.stdout.write(result.stdout);process.stderr.write(result.stderr);if(result.status)process.exit(result.status);
console.log(`Custom WPF installer: ${output}`);
