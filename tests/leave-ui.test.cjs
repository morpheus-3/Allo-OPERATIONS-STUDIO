const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('leave website supports employee submission, manager approval and refreshed balances from persisted records',()=>{
  const elements={},node=(tag='div')=>({tag,value:'',textContent:'',children:[],appendChild(n){this.children.push(n);if(tag==='select'&&!this.value)this.value=n.value||n.textContent;},replaceChildren(){this.children=[];},classList:{add(){}}});
  const document={getElementById:id=>elements[id]??=(node(id==='leave-demo-role'?'select':'div')),createElement:node,querySelectorAll:()=>[],body:node()};
  const store=new Map([['allo-studio-v2',JSON.stringify({now:'2026-10-08T17:00:00+05:30',settingsState:{ManagerEmail:'manager@allo.test',WorkingDays:'1,2,3,4,5'},tasks:[{EmployeeEmail:'employee@allo.test',Active:true}]})]]);
  const ctx=vm.createContext({document,Intl,console,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},prompt:()=> 'Plans changed'});
  vm.runInContext(fs.readFileSync('leave.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
  elements['leave-start'].value='2026-10-12';elements['leave-end'].value='2026-10-13';ctx.submitLeaveForm();
  let rows=JSON.parse(store.get('allo-leave-v1'));assert.equal(rows.length,1);assert.equal(rows[0].Status,'PENDING');
  assert.match(elements['leave-message'].textContent,/not approved/);
  elements['leave-demo-role'].value='manager@allo.test';ctx.refreshLeave();ctx.decideLeaveForm(rows[0].RequestID,'APPROVED');
  assert.equal(JSON.parse(store.get('allo-leave-v1'))[0].Status,'APPROVED');
  elements['leave-demo-role'].value='employee@allo.test';ctx.refreshLeave();assert.match(elements['leave-balances'].children[0].children[1].textContent,/48 \/ 50/);
  ctx.decideLeaveForm(rows[0].RequestID,'CANCELLED');assert.match(elements['leave-message'].textContent,/Only managers/);
});
