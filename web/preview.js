const Utilities={formatDate:d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)};
let tasks,cycles,events,now,activeTab='overview';
const fmt=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function persist(){try{localStorage.setItem('allo-demo-v1.1',JSON.stringify({tasks,cycles,events,now,activeTab}));}catch{}}
function message(text){document.getElementById('message').textContent=text;}
function reset(){
  now=dateAt('2026-10-08',16);activeTab='overview';
  tasks=['Daily Operations Update','Portal Task A','Portal Task B','Portal Task C'].map((Task,i)=>({TaskID:'TASK-'+(i+1),Task,Employee:'Employee '+String.fromCharCode(65+i),EmployeeEmail:'employee'+i+'@demo.test',IntervalDays:[1,7,15,30][i],ProofType:i?'TICKET':'DAILY',DueHour:17}));
  cycles=tasks.map(t=>cycleFor(t,dateAt('2026-10-08',17)));events=[];
  document.getElementById('person').value='';message('');render();
}
function setTab(tab){activeTab=tab;if(tab==='manager')document.getElementById('person').value='';render();}
function showEmployee(employee){document.getElementById('person').value=employee;setTab('workboard');}
function advance(h){now=new Date(+now+h*3600000);run();render();}
function run(){cycles.forEach(c=>{const stage=alertFor(c,now,4,24);if(stage){c[stage==='MANAGER'?'ManagerAlertAt':'LeadershipAlertAt']=new Date(now);events.unshift({at:new Date(now),stage,cycle:c.CycleID,text:(stage==='MANAGER'?'Manager notified':'Leadership escalation')+' · '+c.Task+' · '+c.Employee});}});persist();}
function draft(i,field,value){cycles[i][field]=value;persist();}
function complete(i){
  const c=cycles[i];c.Proof=String(c.Proof||'').trim();const err=completionError(c);
  if(err){message(err);return;}
  if(dayKey(c.DueAt)>dayKey(now)){message('This cycle is not due yet.');return;}
  if(c.CompletedAt)return;
  c.CompletedAt=new Date(now);c.CompletedBy=c.EmployeeEmail;c.Complete=true;
  events.unshift({at:new Date(now),stage:'COMPLETED',cycle:c.CycleID,text:'Completed · '+c.Task+' · '+(c.Proof||'Daily update confirmed')});
  const t=tasks.find(t=>t.TaskID===c.TaskID);cycles.push(cycleFor(t,nextDue(t,now)));
  message('Cycle completed. Next due date calculated automatically.');render();
}
function acknowledge(i){
  const c=cycles[i],note=String(c.ManagerNote||'').trim();
  if(!c.ManagerAlertAt || c.AcknowledgedAt)return;
  if(!note){message('Add a manager action note before acknowledging.');return;}
  c.ManagerNote=note;c.AcknowledgedAt=new Date(now);c.AcknowledgedBy='manager@demo.test';
  events.unshift({at:new Date(now),stage:'ACKNOWLEDGED',cycle:c.CycleID,text:'Manager acknowledged · '+c.Task+' · '+note});render();
}
function exportDemo(){const blob=new Blob([JSON.stringify({simulation:true,timezone:'Asia/Kolkata',tasks,cycles,events,now},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='allo-demo-evidence.json';a.click();URL.revokeObjectURL(a.href);}
function render(){
  persist();document.getElementById('clock').textContent=fmt(now);
  const titles={overview:'Operations overview',workboard:'Recurring workboard',manager:'Manager review',alerts:'Escalation log'};
  document.getElementById('page-title').textContent=titles[activeTab];
  const descriptions={overview:'Track your team, spot delays, and keep the next cycle moving.',workboard:'See what is due, add proof, and close the current cycle from one place.',manager:'Review overdue work, record a recovery action, and follow unresolved items.',alerts:'Inspect every alert, acknowledgement and completion in one audit trail.'};
  document.getElementById('page-description').textContent=descriptions[activeTab];
  for(const t of Object.keys(titles))document.getElementById('nav-'+t).className=t===activeTab?'active':'';
  document.getElementById('overview-panel').hidden=activeTab!=='overview';
  document.getElementById('manager-panel').hidden=activeTab!=='manager';
  document.getElementById('work-panel').hidden=activeTab!=='workboard';
  document.getElementById('log-panel').hidden=activeTab==='workboard'||activeTab==='manager';
  document.getElementById('log-title').textContent=activeTab==='alerts'?'Activity & escalation log':'Recent activity';
  document.getElementById('table-title').textContent=activeTab==='manager'?'Pending work & outstanding reviews':'Team workboard';
  const statuses=cycles.map(c=>statusFor(c,now));
  document.getElementById('stats').innerHTML=[['Open cycles',cycles.filter(c=>!c.CompletedAt).length],['Overdue',statuses.filter(s=>s==='Overdue').length],['Completed cycles',cycles.filter(c=>c.CompletedAt).length],['Leadership alerts',cycles.filter(c=>c.LeadershipAlertAt).length]].map(([label,n])=>'<div class="stat"><span>'+label+'</span><strong>'+n+'</strong></div>').join('');
  const person=document.getElementById('person').value;
  document.getElementById('cycle-count').textContent=cycles.filter(c=>!person||c.Employee===person).length+' tracked cycles';
  document.getElementById('team-cards').innerHTML=tasks.filter(t=>!person||t.Employee===person).map(t=>{
    const own=cycles.filter(c=>c.TaskID===t.TaskID),open=own.find(c=>!c.CompletedAt),done=own.filter(c=>c.CompletedAt).length;
    const status=open?statusFor(open,now):'Completed';
    return '<article class="person-card"><div class="person-head"><span class="avatar">'+escape(t.Employee.slice(-1))+'</span><div><b>'+escape(t.Employee)+'</b><div class="eyebrow">'+(t.ProofType==='DAILY'?'Daily routine':t.IntervalDays+'-day cycle')+'</div></div></div><b>'+escape(t.Task)+'</b><p>'+(open?'Next due '+fmt(open.DueAt):'No open cycle')+'</p><span class="badge '+status.split(' ')[0]+'">'+status+'</span><p>'+done+' completed cycle'+(done===1?'':'s')+'</p><button onclick="showEmployee(\''+escape(t.Employee)+'\')">Open workboard</button></article>';
  }).join('');
  const reviews=cycles.map((c,i)=>({c,i})).filter(({c})=>c.ManagerAlertAt&&(!person||c.Employee===person));
  const outstanding=reviews.filter(({c})=>!c.AcknowledgedAt);
  document.getElementById('review-count').textContent=outstanding.length+' awaiting review';
  document.getElementById('review-cards').innerHTML=reviews.length?reviews.map(({c,i})=>{
    const status=statusFor(c,now);
    return '<article class="review-card"><div><span class="badge '+status.split(' ')[0]+'">'+status+'</span><h3 style="margin-top:10px">'+escape(c.Task)+'</h3><p>'+escape(c.Employee)+' &middot; Due '+fmt(c.DueAt)+'</p><p>Alerted '+fmt(c.ManagerAlertAt)+'<br>Review deadline '+fmt(new Date(+new Date(c.ManagerAlertAt)+4*3600000))+'</p>'+(c.LeadershipAlertAt?'<span class="badge Overdue">Escalated to leadership</span>':'')+'</div><div>'+(c.AcknowledgedAt?'<span class="badge Completed">Acknowledged '+fmt(c.AcknowledgedAt)+'</span><p>'+escape(c.ManagerNote)+'</p>':'<label for="review'+i+'" class="proof-help">Recovery action / follow-up plan</label><input id="review'+i+'" maxlength="2000" value="'+escape(c.ManagerNote||'')+'" oninput="draft('+i+',\'ManagerNote\',this.value)" placeholder="e.g. Contacted owner; agreed completion by 18:00"><button class="primary" onclick="acknowledge('+i+')">Acknowledge review</button>')+'<p>'+(c.CompletedAt?'Employee completed at '+fmt(c.CompletedAt):'Employee completion is still outstanding.')+'</p></div></article>';
  }).join(''):'<div class="empty"><strong>No manager reviews requested yet.</strong>Tasks are due at 17:00. When a task passes its deadline, automation creates a review request here.<div class="empty-actions"><button onclick="advance(1)">Advance the clock by 1 hour</button><button onclick="setTab(\'workboard\')">View employee tasks</button></div></div>';
  const rows=cycles.map((c,i)=>{
    if(person&&c.Employee!==person)return '';
    const status=statusFor(c,now);
    if(activeTab==='manager' && !['Overdue','Due today'].includes(status) && !(c.ManagerAlertAt&&!c.AcknowledgedAt))return '';
    const input=c.CompletedAt?escape(c.Proof||'Daily update confirmed')+'<small>'+fmt(c.CompletedAt)+'</small>':status==='Upcoming'?'<small>Next cycle prepared</small>':'<label class="proof-help" for="proof'+i+'">'+(c.ProofType==='TICKET'?'Portal Ticket ID (required)':'Daily update confirmation; evidence optional')+'</label><input aria-label="Proof for '+escape(c.Task)+'" maxlength="2000" id="proof'+i+'" value="'+escape(c.Proof||'')+'" oninput="draft('+i+',\'Proof\',this.value)" placeholder="'+(c.ProofType==='TICKET'?'e.g. PORTAL-1042':'Evidence link or short note')+'"> <button onclick="complete('+i+')">'+(c.ProofType==='TICKET'?'Complete cycle':'Confirm daily update')+'</button>';
    const review=c.AcknowledgedAt?'<span class="badge Completed">Acknowledged</span><small>'+escape(c.ManagerNote)+'</small>':c.ManagerAlertAt&&!person?'<input aria-label="Manager action for '+escape(c.Task)+'" id="note'+i+'" value="'+escape(c.ManagerNote||'')+'" oninput="draft('+i+',\'ManagerNote\',this.value)" placeholder="Manager action note"> <button onclick="acknowledge('+i+')">Acknowledge</button>':c.ManagerAlertAt?'<small>Review requested</small>':'<small>No review required</small>';
    return '<tr><td><b>'+escape(c.Task)+'</b><small>'+escape(c.CycleID)+'</small></td><td>'+escape(c.Employee)+'</td><td>'+fmt(c.DueAt)+'</td><td><span class="badge '+status.split(' ')[0]+'">'+status+'</span></td><td>'+input+'</td><td>'+review+'</td></tr>';
  }).join('');
  document.getElementById('rows').innerHTML=rows||'<tr><td colspan="6">No pending work in this view.</td></tr>';
  const eventFilter=document.getElementById('event-filter').value;
  let visibleEvents=events.filter(e=>(!eventFilter||e.stage===eventFilter)&&(!person||cycles.some(c=>c.CycleID===e.cycle&&c.Employee===person)));
  if(activeTab==='overview')visibleEvents=visibleEvents.slice(0,5);
  document.getElementById('events').innerHTML=visibleEvents.length?visibleEvents.map(e=>'<div class="event"><time>'+fmt(e.at)+' IST</time><span class="badge '+(e.stage==='LEADERSHIP'?'Overdue':e.stage==='COMPLETED'?'Completed':'')+'">'+escape({MANAGER:'Manager alert',LEADERSHIP:'Leadership',COMPLETED:'Completion',ACKNOWLEDGED:'Review'}[e.stage]||'Activity')+'</span> &nbsp; '+escape(e.text)+'</div>').join(''):'<div class="empty"><strong>'+(events.length?'No activity matches this filter.':'No activity recorded yet.')+'</strong>'+(events.length?'Choose another activity type or employee.':'Complete a task from the workboard, or advance to 17:00 to see the alert flow.')+'</div>';
}
function initialize(){
  try{const state=JSON.parse(localStorage.getItem('allo-demo-v1.1'));if(state&&Array.isArray(state.tasks)&&Array.isArray(state.cycles)&&Array.isArray(state.events)&&Number.isFinite(new Date(state.now).getTime())){tasks=state.tasks;cycles=state.cycles;events=state.events;now=new Date(state.now);activeTab=['overview','workboard','manager','alerts'].includes(state.activeTab)?state.activeTab:'overview';render();return;}}catch{}
  reset();
}
initialize();
