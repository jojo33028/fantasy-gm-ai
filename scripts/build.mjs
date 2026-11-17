import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const files={'index.html':'text/html; charset=utf-8','styles.css':'text/css; charset=utf-8','app.js':'text/javascript; charset=utf-8','core.mjs':'text/javascript; charset=utf-8','favicon.svg':'image/svg+xml'};
export async function readAssets(){const entries=await Promise.all(Object.entries(files).map(async([name,type])=>['/'+name,{body:await readFile(resolve(root,name),'utf8'),type}]));return Object.fromEntries(entries);}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const assets=await readAssets(),source=await readFile(resolve(root,'src/worker.mjs'),'utf8');
 const manifest=JSON.parse(await readFile(resolve(root,'.openai/hosting.json'),'utf8'));
 if(!manifest.project_id)throw Error('Register the Site before building.');
 if(manifest.static)throw Error('A server-backed build must not declare static.directory.');
 await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});
 await writeFile(resolve(root,'dist/server/index.js'),source.replace('export const staticAssets={};','export const staticAssets='+JSON.stringify(assets)+';'));
 await copyFile(resolve(root,'.openai/hosting.json'),resolve(root,'dist/.openai/hosting.json'));
 console.log('Built Worker and '+Object.keys(assets).length+' embedded assets.');
}
