const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),port=Number(process.env.PORT||8765);
const types={'.html':'text/html; charset=utf-8','.md':'text/plain; charset=utf-8','.json':'application/json','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.tap':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Bad request');return;}
  if(pathname==='/')pathname='/demo.html';
  const allowed=pathname==='/demo.html'||/^\/(README|CHECKPOINTS|REQUIREMENTS|DEMO)\.md$/.test(pathname)||/^\/(submission|evidence)\/[A-Za-z0-9_.-]+$/.test(pathname);
  if(!allowed){res.writeHead(404).end('Not found');return;}
  const file=path.join(root,pathname);
  fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
});
server.on('error',err=>{console.error(err.code==='EADDRINUSE'?'Port '+port+' is already in use. Use the existing preview or set PORT to another port.':err.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>console.log('Allo Operations preview: http://127.0.0.1:'+port+'/demo.html\nPress Ctrl+C to stop.'));
