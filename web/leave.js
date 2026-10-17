const leaveElement=id=>document.getElementById(id);
const leaveLive=typeof google!=='undefined'&&google.script&&google.script.run;
let leaveBusy=false,leaveView,leaveKeys={};
function leaveNode(tag,text,parent,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;if(parent)parent.appendChild(n);return n;}
function leaveDemoContext(){
  const main=JSON.parse(localStorage.getItem('allo-studio-v2')||'null');
  if(!main)throw Error('Open the operations workspace first to initialize its demo records.');
  return {...main,requests:JSON.parse(localStorage.getItem('allo-leave-v1')||'[]')};
}
function leaveCall(method,args,success){
  if(leaveBusy)return;leaveBusy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);leaveElement('leave-message').textContent='Checking records…';
  const finish=()=>{leaveBusy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);};
  const done=result=>{finish();success(result);};
  const fail=error=>{finish();leaveElement('leave-message').textContent=String(error.message||error);};
  if(leaveLive){google.script.run.withSuccessHandler(done).withFailureHandler(fail)[method](...args);return;}
  try{
    const data=leaveDemoContext(),actor=leaveElement('leave-demo-role').value,cfg=data.settingsState,now=new Date(data.now);
    let rows=data.requests;
    if(method==='submitLeaveRequest'){
      const r=leaveCreate(rows,args[0],actor,data.tasks,cfg,now);if(!rows.some(x=>x.RequestID===r.RequestID))rows.push(r);
    }else if(method==='decideLeaveRequest'){
      const r=leaveDecision(rows,args[0],args[1],actor,cfg,now,args[2]);rows=rows.map(x=>x.RequestID===r.RequestID?r:x);
    }
    localStorage.setItem('allo-leave-v1',JSON.stringify(rows));
    const year=Number(leaveElement('leave-year').value),manager=[cfg.ManagerEmail,activeManager(cfg,now)].includes(actor);
    const emails=[...new Set(data.tasks.map(t=>t.EmployeeEmail))];
    if(!manager&&!emails.includes(actor))throw Error('No authorized demo role.');
    done({mode:'demo',actor,manager,today:dayKey(now),year,balances:(manager?emails:[actor]).map(email=>({email,...leaveBalance(rows,email,year,cfg)})),requests:rows.filter(r=>Number(r.Year)===year&&(manager||r.EmployeeEmail===actor)),policy:'50 days by default per unique email and calendar year. Full working days; configured holidays excluded. No carryover or half-days.'});
  }catch(e){fail(e);}
}
function renderLeave(view){
  leaveView=view;leaveElement('leave-year').value=view.year;leaveElement('leave-mode').textContent=(view.mode==='live'?'Google Sheets · ':'Website demo · ')+view.actor+' · as of '+view.today+' IST';
  leaveElement('leave-policy').textContent=view.policy;leaveElement('leave-start').min=view.today;leaveElement('leave-end').min=view.today;
  const balances=leaveElement('leave-balances');balances.replaceChildren();
  view.balances.forEach(b=>{const row=leaveNode('div','',balances,'balance');leaveNode('b',b.email,row);leaveNode('p',b.remaining+' / '+b.entitlement+' days available',row);leaveNode('small',b.approved+' approved/reserved · '+b.pending+' pending',row);});
  const list=leaveElement('leave-requests');list.replaceChildren();
  if(!view.requests.length)leaveNode('p','No requests recorded for this year.',list,'muted');
  view.requests.slice().reverse().forEach(r=>{
    const row=leaveNode('article','',list,'request');leaveNode('span',r.Status,row,'badge');leaveNode('h3',r.EmployeeEmail,row);leaveNode('p',r.StartDate+' to '+r.EndDate+' · '+r.Days+' working day(s)',row);leaveNode('small',r.RequestID,row);
    if(r.DecidedBy)leaveNode('p','Decision: '+r.DecidedBy+' · '+r.DecidedAt+(r.DecisionNote?' · '+r.DecisionNote:''),row,'muted');
    const actions=leaveNode('div','',row,'actions');
    const add=(label,status)=>{const b=leaveNode('button',label,actions);b.onclick=()=>decideLeaveForm(r.RequestID,status);};
    if(view.manager&&r.Status==='PENDING'&&r.EmployeeEmail!==view.actor){add('Approve','APPROVED');add('Reject','REJECTED');}
    if(r.Status==='PENDING'&&(view.manager||r.EmployeeEmail===view.actor)||view.manager&&r.Status==='APPROVED'&&r.StartDate>view.today)add('Cancel request','CANCELLED');
  });
  leaveElement('leave-message').textContent=view.notice||'Records loaded. No messages or emails are sent by leave actions.';
}
function refreshLeave(){leaveCall('getLeaveOverview',[Number(leaveElement('leave-year').value)],renderLeave);}
function submitLeaveForm(){
  const StartDate=leaveElement('leave-start').value,EndDate=leaveElement('leave-end').value,key=StartDate+':'+EndDate;
  const RequestID=leaveKeys[key]||(leaveKeys[key]='LR-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  leaveCall('submitLeaveRequest',[{RequestID,StartDate,EndDate}],view=>{delete leaveKeys[key];leaveElement('leave-year').value=Number(StartDate.slice(0,4));if(view.year!==Number(StartDate.slice(0,4)))refreshLeave();else renderLeave(view);leaveElement('leave-message').textContent=view.mode==='live'?(view.notice||'Queued for owner automation. Refresh after processing.'):'Request submitted for review. It is not approved yet.';});
}
function decideLeaveForm(id,action){
  const note=action==='APPROVED'?'':prompt('Short decision note (no sensitive details):');if(note===null)return;
  leaveCall('decideLeaveRequest',[id,action,note],renderLeave);
}
try{
  if(leaveLive){document.body.classList.add('live');leaveElement('leave-year').value=new Date().getFullYear();}
  else{const data=leaveDemoContext(),select=leaveElement('leave-demo-role');[...new Set([...data.tasks.map(t=>t.EmployeeEmail),data.settingsState.ManagerEmail,data.settingsState.BackupManagerEmail].filter(Boolean))].forEach(email=>{const option=leaveNode('option',email,select);option.value=email;});leaveElement('leave-year').value=Number(dayKey(new Date(data.now)).slice(0,4));}
  refreshLeave();
}catch(e){leaveElement('leave-message').textContent=e.message;}
