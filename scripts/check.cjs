const fs=require('node:fs'),vm=require('node:vm');
for(const name of ['Engine.gs','Code.gs','Diagnostics.gs','Assistant.gs','Leave.gs']) {new vm.Script(fs.readFileSync('src/'+name,'utf8'),{filename:name});console.log(name+': syntax OK');}
JSON.parse(fs.readFileSync('src/appsscript.json','utf8'));console.log('Manifest: OK');
new vm.Script(fs.readFileSync('scripts/google-sheets-acceptance.gs','utf8'),{filename:'google-sheets-acceptance.gs'});
console.log('Optional Google formula acceptance helper: syntax OK (not executed against Google)');
