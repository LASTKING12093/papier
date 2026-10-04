import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/visual',timeout:60000,workers:1,use:{baseURL:process.env.PAPIER_TEST_URL??'http://127.0.0.1:1420',viewport:{width:1440,height:1000},channel:'msedge',headless:true},reporter:[['list'],['json',{outputFile:'tmp/qa/browser-results.json'}]]});
