import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const publicBase=process.argv[2];let checked=0;
const walk=async(dir)=>{const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.name.startsWith('.')||['node_modules','tests','tools'].includes(entry.name))continue;
  const path=resolve(dir,entry.name);if(entry.isDirectory())result.push(...await walk(path));else result.push(path);}return result;};
for(const file of await walk(root)){
  if(!['.html','.css','.js','.svg','.md'].includes(extname(file)))continue;
  const content=await readFile(file,'utf8');const dependencies=[];
  if(extname(file)==='.js')for(const match of content.matchAll(/(?:from\s*|import\s*|new URL\()(['"])(\.\.?\/[^'"]+)\1/g))dependencies.push(match[2]);
  if(extname(file)==='.html')for(const match of content.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))dependencies.push(match[1]);
  for(const path of dependencies){if(path==='./')continue;await readFile(resolve(file,'..',path.split('?')[0]));}
  if(publicBase){const url=new URL(relative(root,file).replaceAll('\\','/'),publicBase);const response=await fetch(url);
    if(!response.ok)throw Error(`${url}: ${response.status}`);
    const remote=await response.text();if(remote.replaceAll('\r\n','\n')!==content.replaceAll('\r\n','\n'))throw Error(`${url}: deployed content differs`);}
  checked++;
}
console.log(`${checked} static files checked${publicBase?' against GitHub Pages':''}; all imports and assets exist.`);
