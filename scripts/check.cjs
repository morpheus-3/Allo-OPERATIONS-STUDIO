const fs=require('node:fs'),vm=require('node:vm');
for(const name of ['Engine.gs','Code.gs','Diagnostics.gs']) {new vm.Script(fs.readFileSync('src/'+name,'utf8'),{filename:name});console.log(name+': syntax OK');}
JSON.parse(fs.readFileSync('src/appsscript.json','utf8'));console.log('Manifest: OK');
