import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';
import type { Plugin } from 'vite';

// Development-only adapter. Production builds contain only native IPC.
export function devEngine(): Plugin {
  let process: ChildProcessWithoutNullStreams | undefined;
  let chain = Promise.resolve();
  const pending: { resolve: (s: string) => void; reject: (e: Error) => void }[] = [];
  return { name: 'local-native-engine', configureServer(server) {
    mkdirSync('tmp', {recursive:true});
    const executable=resolve(`tmp/pdf-worker-${Date.now()}.exe`);
    copyFileSync(resolve('target/debug/pdf-worker.exe'),executable);
    process = spawn(executable, [resolve('vendor/pdfium/bin/pdfium.dll'), resolve(globalThis.process.env.PAPIER_DEV_RECOVERY??'tmp/dev-recovery')], { windowsHide: true });
    createInterface({ input: process.stdout }).on('line', line => pending.shift()?.resolve(line));
    process.on('error', error => { for (const p of pending.splice(0)) p.reject(error); });
    process.on('exit', () => { for (const p of pending.splice(0)) p.reject(new Error('PDF worker stopped')); });
    server.httpServer?.on('close', () => process?.kill());
    server.middlewares.use('/__engine', (req, res) => {
      if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json' || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) { res.writeHead(403).end(); return; }
      let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 100_000_000) req.destroy(); });
      req.on('end', () => { chain = chain.then(async () => {
        try {
          const value = JSON.parse(body);
          if (['open', 'save'].includes(value.action)) throw new Error('Use import/export in the development browser.');
          const result = new Promise<string>((resolve, reject) => pending.push({ resolve, reject }));
          process!.stdin.write(JSON.stringify(value) + '\n');
          const response = await result;
          res.setHeader('Content-Type', 'application/json');res.end(response);
        } catch (error) { res.writeHead(500, {'Content-Type':'application/json'}).end(JSON.stringify({ok:false,error:String(error)})); }
      }); });
    });
  }};
}
