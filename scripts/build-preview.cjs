const fs=require('node:fs'),vm=require('node:vm');
const template=fs.readFileSync('web/demo.template.html','utf8');
const engine=fs.readFileSync('src/Engine.gs','utf8');
const preview=fs.readFileSync('web/preview.js','utf8');
new vm.Script(engine+'\n'+preview);
fs.writeFileSync('demo.html',template.replace('__ENGINE__',engine).replace('__PREVIEW__',preview));
console.log('Built standalone demo.html from shared engine and preview source.');
