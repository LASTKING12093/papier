import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devEngine } from '../../scripts/dev-engine';
export default defineConfig(({command})=>({ root: 'apps/desktop', plugins: [react(), ...(command==='serve'?[devEngine()]:[])], server: { host: '127.0.0.1', port: 1420, strictPort: true }, clearScreen: false, build: { target: 'es2022' } }));
