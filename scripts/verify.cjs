const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),crypto=require('node:crypto');
process.chdir(path.resolve(__dirname,'..'));fs.mkdirSync('evidence',{recursive:true});
function run(args){return execFileSync(process.execPath,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
try{
  const build=run(['scripts/build-preview.cjs']),check=run(['scripts/check.cjs']);
  const files=fs.readdirSync('tests').filter(f=>f.endsWith('.test.cjs')).sort().map(f=>'tests/'+f);
  const tests=run(['--test','--test-reporter=tap',...files]);fs.writeFileSync('evidence/TEST_RESULTS.tap',tests);
  const demo=run(['scripts/demo-report.cjs']);
  const summary={release:'1.1.0',verifiedAtUTC:new Date().toISOString(),runtime:process.version,tests:Number(tests.match(/# tests (\d+)/)?.[1]),passed:Number(tests.match(/# pass (\d+)/)?.[1]),failed:Number(tests.match(/# fail (\d+)/)?.[1]),realGoogleServicesVerified:false,sourceHashes:{}};
  for(const f of fs.readdirSync('src').sort())summary.sourceHashes[f]=crypto.createHash('sha256').update(fs.readFileSync('src/'+f)).digest('hex');
  fs.writeFileSync('evidence/VERIFICATION.json',JSON.stringify(summary,null,2)+'\n');
  fs.writeFileSync('evidence/VERIFICATION.md','# Local verification\n\nRelease: '+summary.release+'\n\nRuntime: '+summary.runtime+'\n\nTests: '+summary.passed+'/'+summary.tests+' passed; '+summary.failed+' failed.\n\n'+build+'\n'+check+'\n'+demo+'\nThese results use local adapters. Live Google identity, permissions and actual email receipt remain separate acceptance gates. Source hashes are recorded in VERIFICATION.json.\n');
  console.log(build+check+demo+summary.passed+'/'+summary.tests+' tests passed. Evidence captured.');
}catch(err){if(err.stdout)fs.writeFileSync('evidence/FAILED_VERIFICATION.txt',String(err.stdout));console.error(String(err.stdout||err.message));process.exit(1);}
