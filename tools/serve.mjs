import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost');const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '')||'index.html';
  const file=resolve(root,relative);if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Ninja Run: http://localhost:4173'));
