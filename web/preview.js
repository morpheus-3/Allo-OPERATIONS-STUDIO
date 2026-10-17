const Utilities={formatDate:(d,zone,pattern)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone||'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)+(pattern==='yyyy-MM-dd HH:mm'?' '+new Intl.DateTimeFormat('en-GB',{timeZone:zone||'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'')};
const STORAGE_KEY='allo-studio-v2';
let tasks,cycles,events,now,recoveryHistory,settingsState,activeTab='overview',selectedRecovery=-1,returnFocus;
const $=id=>document.getElementById(id);
const fmt=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(d));
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=status=>'<span class="badge '+status.split(' ')[0]+'">'+escape(status)+'</span>';
const percent=r=>r===null?'N/A':Math.round(r*100)+'%';
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({tasks,cycles,events,now,recoveryHistory,settingsState,activeTab}));}catch{}}
function message(text){$('message').textContent=text;}
function reset(){
  closeRecovery();now=dateAt('2026-10-08',16);activeTab='overview';
  settingsState={ManagerEmail:'manager@demo.test',LeadershipEmail:'leadership@demo.test',BackupManagerEmail:'',ManagerLeaveStart:'',ManagerLeaveEnd:'',WorkingDays:'1,2,3,4,5',HolidayDates:'',AckHours:4,ResolveHours:24,DryRun:true};
  tasks=['Daily Operations Update','Portal Task A','Portal Task B','Portal Task C'].map((Task,i)=>({TaskID:'TASK-'+(i+1),Task,Employee:'Employee '+String.fromCharCode(65+i),EmployeeEmail:'employee'+i+'@demo.test',IntervalDays:[1,7,15,30][i],ProofType:i?'TICKET':'DAILY',DueHour:17,StartDate:'2026-10-08',RecurrenceMode:'COMPLETION',CalendarPolicy:i?'CALENDAR':'WORKING'}));
  cycles=tasks.map(t=>cycleFor(t,dateAt('2026-10-08',17)));events=[];recoveryHistory=[];
  ['person','task-search','status-filter','event-filter','week-start'].forEach(id=>$(id).value='');message('');render();
}
function setTab(tab){
  if(!['overview','workboard','manager','weekly','settings','alerts'].includes(tab))return;
  activeTab=tab;if(tab==='manager')$('person').value='';message('');render();
}
function showEmployee(employee){$('person').value=employee;setTab('workboard');}
function advance(h){now=new Date(+now+h*3600000);run();render();}
function addEvent(stage,c,text){events.unshift({at:new Date(now),stage,cycle:c.CycleID,text});}
function run(){
  cycles.forEach(c=>{const stage=alertFor(c,now,Number(settingsState.AckHours),Number(settingsState.ResolveHours));if(stage){
    c[stage==='MANAGER'?'ManagerAlertAt':'LeadershipAlertAt']=new Date(now);
    const recipient=stage==='MANAGER'?activeManager(settingsState,now):settingsState.LeadershipEmail;
    if(stage==='MANAGER')c.ReviewOwnerEmail=recipient;
    addEvent(stage,c,(stage==='MANAGER'?'Manager alert':'Leadership escalation')+' · '+c.Task+' · '+recipient);
  }});persist();
}
function draft(i,field,value){if(!cycles[i])return;cycles[i][field]=value;persist();}
function complete(i){
  const c=cycles[i];if(!c||c.CompletedAt)return;
  c.Proof=String(c.Proof||'').trim();const err=completionError(c);
  if(err){message(err);return;}if(dayKey(c.DueAt)>dayKey(now)){message('This cycle is not due yet.');return;}
  c.CompletedAt=new Date(now);c.CompletedBy=c.EmployeeEmail;c.Complete=true;
  addEvent('COMPLETED',c,'Completed · '+c.Task+' · '+(c.Proof||'Daily update confirmed'));
  const t=tasks.find(t=>t.TaskID===c.TaskID),schedule=nextSchedule(t,now,c.DueAt,calendarFor(settingsState));
  const next=cycleFor(t,schedule.due);next.SkippedOccurrences=schedule.skipped;
  if(!cycles.some(x=>x.CycleID===next.CycleID))cycles.push(next);
  message('Cycle completed. Next due date calculated automatically.');render();
}
function acknowledge(i){
  const c=cycles[i],note=String(c.ManagerNote||'').trim();if(!c.ManagerAlertAt||c.AcknowledgedAt)return;
  if(!note){message('Add a manager action note before acknowledging.');return;}
  c.ManagerNote=note;c.AcknowledgedAt=new Date(now);c.AcknowledgedBy=activeManager(settingsState,now);
  addEvent('ACKNOWLEDGED',c,'Manager acknowledged · '+c.Task+' · '+note);render();
}
function openRecovery(i){
  const c=cycles[i];if(!c)return;returnFocus=document.activeElement;selectedRecovery=i;
  $('recovery-title').textContent=c.Task;$('recovery-subtitle').textContent=c.CycleID+' · '+c.Employee+' · Simulated manager '+activeManager(settingsState,now);
  [['r-blocker','Blocker'],['r-owner','RecoveryOwner'],['r-action','NextAction'],['r-resolution','ResolutionNote']].forEach(([id,k])=>$(id).value=c[k]||'');
  const local=c.RecoveryTargetAt?new Date(+new Date(c.RecoveryTargetAt)+19800000).toISOString().slice(0,16):'';
  $('r-target').value=local;$('r-resolution').disabled=!c.CompletedAt;$('recovery-error').textContent='';
  const history=recoveryHistory.filter(h=>h.CycleID===c.CycleID).sort((a,b)=>b.Revision-a.Revision);
  $('recovery-history').innerHTML='<h3>Retained change history</h3>'+(history.length?history.map(h=>'<div class="timeline-item"><strong>Version '+h.Revision+' · '+escape(h.UpdatedBy)+'</strong><small>'+fmt(h.UpdatedAt)+' IST</small><p><b>Blocker:</b> '+escape(h.Blocker)+'<br><b>Owner:</b> '+escape(h.RecoveryOwner)+' · Target '+fmt(h.RecoveryTargetAt)+'<br><b>Action:</b> '+escape(h.NextAction)+(h.ResolutionNote?'<br><b>Resolution:</b> '+escape(h.ResolutionNote):'')+'</p></div>').join(''):'<p class="definition">No recovery versions saved. The first save records the manager, time and complete plan.</p>');
  $('recovery-drawer').hidden=false;document.body?.classList?.add('drawer-open');$('r-blocker').focus?.();
}
function closeRecovery(){
  $('recovery-drawer').hidden=true;document.body?.classList?.remove('drawer-open');selectedRecovery=-1;returnFocus?.focus?.();
}
function saveRecoveryDraft(){
  if(selectedRecovery<0)return;
  const c=cycles[selectedRecovery],target=$('r-target').value;
  const candidate={...c,Blocker:$('r-blocker').value.trim(),RecoveryOwner:$('r-owner').value.trim(),NextAction:$('r-action').value.trim(),ResolutionNote:$('r-resolution').value.trim(),RecoveryTargetAt:target?new Date(target+(target.length===16?':00':'')+'+05:30'):''};
  const err=recoveryError(candidate);if(err){$('recovery-error').textContent=err;return;}
  const previous=recoveryHistory.filter(h=>h.CycleID===c.CycleID).sort((a,b)=>b.Revision-a.Revision)[0];
  const fields=['Blocker','RecoveryOwner','RecoveryTargetAt','NextAction','ResolutionNote'];
  const value=(o,k)=>k==='RecoveryTargetAt'?new Date(o[k]).toISOString():String(o[k]||'');
  const changes=fields.filter(k=>!previous||value(previous,k)!==value(candidate,k));
  if(!changes.length){$('recovery-error').textContent='No changes to save. The existing version is retained.';return;}
  const revision=previous?previous.Revision+1:1;
  const entry={EntryID:c.CycleID+':RECOVERY:'+revision,CycleID:c.CycleID,Revision:revision,UpdatedAt:new Date(now),UpdatedBy:activeManager(settingsState,now),ChangeSummary:changes.join(', ')};
  fields.forEach(k=>entry[k]=candidate[k]);recoveryHistory.push(entry);fields.forEach(k=>c[k]=candidate[k]);c.RecoveryRevision=revision;
  addEvent('RECOVERY',c,'Recovery version '+revision+' · '+c.Task+' · '+candidate.NextAction);closeRecovery();render();message('Recovery version '+revision+' saved. Earlier versions are retained.');
}
function saveCalendar(){
  const days=[0,1,2,3,4,5,6].filter(n=>$('day-'+n).checked);
  const next={...settingsState,WorkingDays:days.join(','),HolidayDates:$('holidays').value.trim()};
  try{validateSettings(next);}catch(e){message(e.message);return;}settingsState=next;render();message('Calendar saved for future scheduling. Existing due dates remain unchanged.');
}
function saveCoverage(){
  const next={...settingsState,BackupManagerEmail:$('backup-email').value.trim().toLowerCase(),ManagerLeaveStart:$('coverage-start').value,ManagerLeaveEnd:$('coverage-end').value};
  try{validateSettings(next);}catch(e){message(e.message);return;}settingsState=next;render();message('Coverage saved. Routing returns automatically after the inclusive leave end date.');
}
function setTaskPolicy(i,field,value){
  const next={...tasks[i],[field]:value};try{validateTask(next);}catch(e){message(e.message);return;}
  tasks[i]=next;render();message('Policy saved for future cycles; retained dates and evidence are unchanged.');
}
function reportForView(){
  const person=$('person').value,rows=cycles.filter(c=>!person||c.Employee===person);
  let start=$('week-start').value;
  if(start&&validDay(start)){const wd=new Date(dateAt(start,12).getTime()+19800000).getUTCDay();start=addDays(start,-((wd+6)%7));}else start=undefined;
  return weeklySummary(rows,recoveryHistory,now,Number(settingsState.AckHours),start);
}
function exportFile(name,text,type){const blob=new Blob([text],{type});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();URL.revokeObjectURL(a.href);}
function exportDemo(){exportFile('allo-studio-evidence.json',JSON.stringify({simulation:true,release:'2.1.0',timezone:'Asia/Kolkata',tasks,cycles,events,now,settings:settingsState,recoveryHistory},null,2),'application/json');}
function weeklyCSV(){
  const s=reportForView(),rows=[['Metric','Value'],['Timezone','Asia/Kolkata'],['Simulation','TRUE'],['Week start',s.start],['As of',s.asOf.toISOString()],['On-time numerator',s.onTimeCount],['Due denominator',s.dueCount],['Review numerator',s.compliantReviewCount],['Review denominator',s.reviewCount],['Overdue carryover',s.carryover],['Overdue total',s.overdue],['Blocker','Open cycles','Latest actions'],...s.blockers.map(b=>[b.label,b.count,b.actions.join('; ')])];
  return rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
function exportWeekly(){const s=reportForView();exportFile('allo-week-'+s.start+'.csv',weeklyCSV(),'text/csv;charset=utf-8');}
function loadScenario(kind){
  reset();
  if(kind==='coverage'){settingsState.BackupManagerEmail='backup@demo.test';settingsState.ManagerLeaveStart='2026-10-08';settingsState.ManagerLeaveEnd='2026-10-10';advance(1);setTab('manager');}
  else if(kind==='cutoff'){advance(1);setTab('manager');}
  else if(kind==='review'){advance(5);setTab('manager');}
  else if(kind==='week'){
    for(const [day,late] of [['2026-10-05',false],['2026-10-06',true],['2026-10-07',false]]){
      const c=cycleFor(tasks[0],dateAt(day,17));c.CompletedAt=dateAt(day,late?18:16);c.CompletedBy=c.EmployeeEmail;c.Complete=true;
      if(late){c.ManagerAlertAt=dateAt(day,17);c.AcknowledgedAt=dateAt(day,18);c.AcknowledgedBy=settingsState.ManagerEmail;c.ManagerNote='Checked evidence';c.ReviewOwnerEmail=settingsState.ManagerEmail;}
      cycles.push(c);
    }
    const t={...tasks[1],TaskID:'TASK-5',Task:'Supplier statement reconciliation',IntervalDays:15,StartDate:'2026-09-30'};tasks.push(t);
    const carry=cycleFor(t,dateAt('2026-09-30',17));carry.ManagerAlertAt=dateAt('2026-09-30',17);carry.AcknowledgedAt=dateAt('2026-09-30',18);carry.ReviewOwnerEmail=settingsState.ManagerEmail;carry.ManagerNote='Supplier contacted';
    Object.assign(carry,{Blocker:'Supplier dependency',RecoveryOwner:'Employee B',RecoveryTargetAt:dateAt('2026-10-08',11),NextAction:'Request corrected statement',RecoveryRevision:1});cycles.push(carry);
    recoveryHistory.push({...carry,EntryID:carry.CycleID+':RECOVERY:1',Revision:1,UpdatedAt:dateAt('2026-10-01',10),UpdatedBy:settingsState.ManagerEmail});
    advance(2);setTab('overview');
  }
  message('Loaded a synthetic '+({week:'operating week',cutoff:'manager alert',review:'missing review',coverage:'leave coverage'}[kind]||'clean')+' scenario. These are demonstration records.');render();
}
function metric(label,value,note,alert=false){return '<div class="stat '+(alert?'alert-stat':'')+'"><div class="stat-top"><span>'+escape(label)+'</span><span class="metric-mark" aria-hidden="true">'+(alert?'◷':'↗')+'</span></div><strong>'+escape(value)+'</strong><small>'+escape(note)+'</small></div>';}
function renderWeekly(s){
  $('week-start').value=s.start;
  $('weekly-stats').innerHTML=metric('On-time completion',percent(s.onTimeRate),s.onTimeCount+' / '+s.dueCount+' generated cycles due')+metric('Review compliance',percent(s.reviewRate),s.compliantReviewCount+' / '+s.reviewCount+' mature review deadlines')+metric('Overdue carryover',s.carryover,'Unresolved work from earlier weeks',s.carryover>0)+metric('All overdue',s.overdue,'At the selected report cutoff',s.overdue>0);
  const from=dateAt(s.start,0),until=s.asOf;const person=$('person').value;
  const rows=cycles.filter(c=>(!person||c.Employee===person)&&new Date(c.DueAt)>=from&&(new Date(c.DueAt)<until||(+until<+dateAt(s.end,0)&&+new Date(c.DueAt)===+until)));
  const bars=[0,1,2,3,4,5,6].map(i=>{const day=addDays(s.start,i),due=rows.filter(c=>dayKey(c.DueAt)===day);return {day,total:due.length,on:due.filter(c=>c.CompletedAt&&new Date(c.CompletedAt)<=new Date(c.DueAt)).length};});
  const max=Math.max(1,...bars.map(b=>b.total)),height=n=>n/max*135;
  $('week-chart').innerHTML='<svg viewBox="0 0 540 210" role="img" aria-label="On-time and other due cycles by weekday"><path d="M25 165H520M25 97H520M25 30H520" stroke="#edf0ea" fill="none"/>'+bars.map((b,i)=>{const x=43+i*70;return '<g><title>'+b.day+': '+b.on+' on time out of '+b.total+' due</title><rect x="'+x+'" y="'+(165-height(b.total))+'" width="30" height="'+height(b.total)+'" rx="4" fill="#e6d9c7"/><rect x="'+x+'" y="'+(165-height(b.on))+'" width="30" height="'+height(b.on)+'" rx="4" fill="#779a83"/><text x="'+(x+15)+'" y="'+(154-height(b.total))+'" text-anchor="middle" font-size="11" fill="#6e7b7d">'+b.total+'</text><text x="'+(x+15)+'" y="191" text-anchor="middle" font-size="11" fill="#6e7b7d">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]+'</text></g>';}).join('')+'</svg>';
  if(!s.dueCount)$('week-chart').innerHTML='<div class="empty"><strong>No generated cycles due in this window.</strong><p>Choose another week or explore a populated demonstration.</p><button onclick="loadScenario(\'week\')">Explore operating week ?</button></div>';
  $('age-profile').innerHTML=s.ageBuckets.map((n,i)=>'<div class="snapshot-metric"><span>'+['Under 24 hours','24 to 72 hours','72 hours or more'][i]+'</span><strong>'+n+'</strong></div>').join('')+'<p>Age uses elapsed hours at the report cutoff, including nights and weekends.</p>';
  $('blocker-rows').innerHTML=s.blockers.length?s.blockers.map(b=>'<tr><td>'+escape(b.label)+'</td><td>'+b.count+'</td><td>'+escape(b.actions.join('; ')||'Manager action required')+'</td></tr>').join(''):'<tr><td colspan="3">No overdue blockers in this period.</td></tr>';
  $('report-definition').textContent='Window: '+s.start+' to '+s.end+'; cutoff '+fmt(s.asOf)+' IST. Current snapshots include the cutoff instant; completed weeks exclude next Monday. Due denominator includes unresolved generated cycles. Review denominator includes deadlines that matured in the window. Zero denominator is N/A. Skipped fixed-schedule dates on cycles due in this window: '+s.skippedOccurrences+'. Includes sample data; not every missed daily occurrence is a generated cycle.';
}
function renderSettings(){
  const calendar=calendarFor(settingsState);
  $('weekdays').innerHTML=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>'<label><input type="checkbox" id="day-'+i+'" '+(calendar.days.includes(i)?'checked':'')+'>'+d+'</label>').join('');
  [0,1,2,3,4,5,6].forEach(i=>$('day-'+i).checked=calendar.days.includes(i));
  $('holidays').value=settingsState.HolidayDates;$('backup-email').value=settingsState.BackupManagerEmail;$('coverage-start').value=settingsState.ManagerLeaveStart;$('coverage-end').value=settingsState.ManagerLeaveEnd;
  $('coverage-status').innerHTML='<b>Current alert owner:</b> '+escape(activeManager(settingsState,now))+'<br>Primary: '+escape(settingsState.ManagerEmail)+(settingsState.ManagerLeaveStart?'<br>Approved cover: '+escape(settingsState.ManagerLeaveStart)+' to '+escape(settingsState.ManagerLeaveEnd)+' inclusive':'<br>No leave window configured.');
  $('policy-rows').innerHTML=tasks.map((t,i)=>'<tr><td><b>'+escape(t.Task)+'</b><small>'+t.IntervalDays+'-day interval</small></td><td><select aria-label="Recurrence for '+escape(t.Task)+'" onchange="setTaskPolicy('+i+',\'RecurrenceMode\',this.value)">'+['COMPLETION','FIXED'].map(v=>'<option '+(t.RecurrenceMode===v?'selected':'')+' value="'+v+'">'+(v==='FIXED'?'Fixed schedule':'After completion')+'</option>').join('')+'</select></td><td><select aria-label="Calendar for '+escape(t.Task)+'" onchange="setTaskPolicy('+i+',\'CalendarPolicy\',this.value)">'+['CALENDAR','WORKING'].map(v=>'<option '+(t.CalendarPolicy===v?'selected':'')+' value="'+v+'">'+(v==='WORKING'?'Working days & holidays':'Calendar days')+'</option>').join('')+'</select></td></tr>').join('');
}
function eventHTML(list){return list.length?list.map(e=>'<div class="event"><time>'+fmt(e.at)+' IST</time>'+badge({MANAGER:'Review requested',LEADERSHIP:'Escalated',COMPLETED:'Completed',ACKNOWLEDGED:'Acknowledged',RECOVERY:'Recovery updated'}[e.stage]||'Recorded')+' &nbsp; '+escape(e.text)+'</div>').join(''):'<div class="empty"><strong>No activity recorded yet.</strong>Complete a task or load a scenario to explore the flow.</div>';}
function render(){
  cycles.forEach(c=>c.Status=statusFor(c,now));
  persist();$('clock').textContent=fmt(now);
  const titles={overview:'Operations overview',workboard:'Recurring workboard',manager:'Manager review',weekly:'Weekly management report',settings:'Calendar & coverage',alerts:'Escalation log'};
  const descriptions={overview:'A clear view of the work, the owners and what needs attention.',workboard:'One operating location. Evidence, completion and the next commitment.',manager:'Acknowledge the issue. Assign the recovery. Follow it through.',weekly:'Track delivery, review discipline and the blockers that need action.',settings:'Set working days, recurrence policies and approved leave coverage.',alerts:'A retained trail of decisions, actions and escalation.'};
  $('page-title').textContent=titles[activeTab];$('page-description').textContent=descriptions[activeTab];
  for(const t of Object.keys(titles)){$('nav-'+t).className=t===activeTab?'active':'';$('nav-'+t).setAttribute?.('aria-current',t===activeTab?'page':'false');}
  [['overview','overview'],['workboard','work'],['manager','manager'],['weekly','weekly'],['settings','settings'],['alerts','log']].forEach(([tab,id])=>$(id+'-panel').hidden=activeTab!==tab);
  const person=$('person').value,own=cycles.filter(c=>!person||c.Employee===person),overdue=own.filter(c=>statusFor(c,now)==='Overdue'),open=own.filter(c=>!c.CompletedAt),reviews=own.filter(c=>c.ManagerAlertAt&&!c.AcknowledgedAt);
  $('nav-open').textContent=cycles.filter(c=>!c.CompletedAt).length;$('nav-review').textContent=reviews.length;$('nav-review').hidden=!reviews.length;
  $('stats').hidden=['weekly','settings','alerts'].includes(activeTab);
  $('stats').innerHTML=metric('Open commitments',open.length,'Across the selected team')+metric('Overdue work',overdue.length,'Needs an owner and next action',overdue.length>0)+metric('Awaiting review',reviews.length,'Separate from employee completion',reviews.length>0)+metric('Completed cycles',own.filter(c=>c.CompletedAt).length,'Evidence and timestamps retained');
  $('hero-summary').textContent=overdue.length?overdue.length+' overdue commitment'+(overdue.length===1?' needs':'s need')+' attention. Keep the recovery owner and next step visible.':'Your next commitments are visible. Complete the work once; let the next cycle take care of itself.';
  const actions=[];
  if(reviews.length)actions.push({title:reviews.length+' manager review'+(reviews.length===1?'':'s')+' waiting',text:'Review within '+settingsState.AckHours+' elapsed hours.',tab:'manager'});
  const missed=own.filter(c=>!c.CompletedAt&&c.RecoveryTargetAt&&new Date(c.RecoveryTargetAt)<now);
  if(missed.length)actions.push({title:missed.length+' recovery target'+(missed.length===1?'':'s')+' missed',text:'Revisit the blocker and agree a new action.',tab:'manager'});
  if(overdue.length)actions.push({title:overdue.length+' overdue task'+(overdue.length===1?'':'s'),text:'Employee completion remains outstanding.',tab:'workboard'});
  if(!actions.length)actions.push({title:'Ready for today',text:'Open the workboard to see upcoming commitments.',tab:'workboard'});
  $('attention-count').textContent=actions.length+' priorities';$('attention-list').innerHTML=actions.slice(0,3).map(a=>'<div class="attention-item"><span class="attention-marker"></span><div><strong>'+escape(a.title)+'</strong><p>'+escape(a.text)+'</p></div><button onclick="setTab(\''+a.tab+'\')">Open →</button></div>').join('');
  $('team-cards').innerHTML=['Employee A','Employee B','Employee C','Employee D'].filter(e=>!person||e===person).map(employee=>{
    const list=cycles.filter(c=>c.Employee===employee),pending=list.filter(c=>!c.CompletedAt).sort((a,b)=>new Date(a.DueAt)-new Date(b.DueAt)),c=pending[0];
    return '<article class="person-card"><div class="person-head"><span class="avatar">'+employee.slice(-1)+'</span><div><b>'+employee+'</b><small>'+pending.length+' open commitment'+(pending.length===1?'':'s')+'</small></div></div><h3>'+escape(c?c.Task:'No open work')+'</h3><p>'+(c?(statusFor(c,now)==='Overdue'?'Overdue since ':'Next due ')+fmt(c.DueAt):'All retained work complete')+'</p>'+badge(c?statusFor(c,now):'Completed')+'<br><button onclick="showEmployee(\''+employee+'\')">Open workboard →</button></article>';
  }).join('');
  const s=reportForView();renderWeekly(s);
  $('weekly-snapshot').innerHTML='<div class="snapshot-metric"><span>On-time completion</span><strong>'+percent(s.onTimeRate)+'</strong></div><div class="progress-track"><span style="width:'+Math.round((s.onTimeRate||0)*100)+'%"></span></div><p>'+s.onTimeCount+' on time / '+s.dueCount+' generated cycles due through cutoff. '+s.carryover+' overdue carryover.</p><p>Load the synthetic Operating week scenario to explore a populated report.</p>';
  const search=String($('task-search').value||'').toLowerCase(),filter=$('status-filter').value;
  let count=0;
  $('rows').innerHTML=cycles.map((c,i)=>{
    if(person&&c.Employee!==person)return '';const status=statusFor(c,now);
    if(filter&&status!==filter)return '';if(search&&!`${c.Task} ${c.Employee} ${c.CycleID}`.toLowerCase().includes(search))return '';count++;
    const proof=c.CompletedAt?escape(c.Proof||'Daily update confirmed')+'<small>'+fmt(c.CompletedAt)+' · '+escape(c.CompletedBy)+'</small>':status==='Upcoming'?'<small>Next cycle prepared</small>':'<label class="proof-help" for="proof'+i+'">'+(c.ProofType==='TICKET'?'Ticket ID required':'Daily confirmation; evidence optional')+'</label><input id="proof'+i+'" aria-label="Proof for '+escape(c.Task)+'" maxlength="2000" value="'+escape(c.Proof||'')+'" oninput="draft('+i+',\'Proof\',this.value)" placeholder="'+(c.ProofType==='TICKET'?'e.g. PORTAL-1042':'Evidence link or note')+'"><button onclick="complete('+i+')">'+(c.ProofType==='TICKET'?'Complete cycle':'Confirm daily update')+'</button>';
    const management=c.ManagerAlertAt?badge(c.AcknowledgedAt?'Review acknowledged':'Review requested')+'<small>'+(c.AcknowledgedAt?'Acknowledged '+fmt(c.AcknowledgedAt):'Review owner '+escape(c.ReviewOwnerEmail||settingsState.ManagerEmail))+'</small><button onclick="openRecovery('+i+')">'+(c.RecoveryRevision?'Recovery v'+c.RecoveryRevision:'Plan recovery')+'</button>':'<small>No review requested</small>';
    return '<tr><td><b>'+escape(c.Task)+'</b><small>'+escape(c.CycleID)+'</small><small>'+escape(c.RecurrenceMode==='FIXED'?'Fixed schedule':'After completion')+' · '+escape(c.CalendarPolicy==='WORKING'?'Working days':'Calendar days')+'</small></td><td>'+escape(c.Employee)+'</td><td>'+fmt(c.DueAt)+'</td><td>'+badge(status)+'</td><td>'+proof+'</td><td>'+management+'</td></tr>';
  }).join('')||'<tr><td colspan="6">No tasks match this view.</td></tr>';
  $('cycle-count').textContent=count+' tracked cycles';$('review-count').textContent=reviews.length+' awaiting review';
  const queue=cycles.map((c,i)=>({c,i})).filter(({c})=>c.ManagerAlertAt&&(!person||c.Employee===person));
  $('review-cards').innerHTML=queue.length?queue.map(({c,i})=>'<article class="review-card"><div>'+badge(statusFor(c,now))+'<h3>'+escape(c.Task)+'</h3><p>'+escape(c.Employee)+' · Due '+fmt(c.DueAt)+'</p><p>Review owner '+escape(c.ReviewOwnerEmail||settingsState.ManagerEmail)+'</p><div class="review-meta"><span>Review deadline '+fmt(new Date(+new Date(c.ManagerAlertAt)+Number(settingsState.AckHours)*3600000))+'</span>'+(c.LeadershipAlertAt?'<span class="badge Overdue">Escalated to leadership</span>':'')+'</div></div><div>'+(c.AcknowledgedAt?badge('Review acknowledged')+'<p>Acknowledged '+fmt(c.AcknowledgedAt)+' · '+escape(c.AcknowledgedBy)+'</p><p>'+escape(c.ManagerNote)+'</p>':'<label for="review'+i+'">Initial action / acknowledgement note</label><input id="review'+i+'" maxlength="2000" value="'+escape(c.ManagerNote||'')+'" oninput="draft('+i+',\'ManagerNote\',this.value)" placeholder="Contacted owner; agreed next action"><button class="primary" onclick="acknowledge('+i+')">Acknowledge review</button>')+'<p>'+(c.CompletedAt?'Employee completed '+fmt(c.CompletedAt):'Task still open. Complete it from the Workboard; acknowledgement records manager review only.')+'</p><div class="review-actions"><button onclick="openRecovery('+i+')">'+(c.RecoveryRevision?'Edit recovery · v'+c.RecoveryRevision:'Create recovery plan')+'</button></div>'+(c.RecoveryOwner?'<p>Recovery: '+escape(c.RecoveryOwner)+' · Target '+fmt(c.RecoveryTargetAt)+'</p>':'')+'</div></article>').join(''):'<div class="empty"><strong>No manager reviews requested yet.</strong>The timer creates a request when work reaches its cutoff.<div class="empty-actions"><button onclick="advance(1)">Advance one hour</button><button onclick="setTab(\'workboard\')">View employee work</button></div></div>';
  $('review-context').textContent='Review within '+settingsState.AckHours+' elapsed hours; unresolved work escalates after '+settingsState.ResolveHours+' hours. New alert owner: '+activeManager(settingsState,now)+'. Saved recovery versions remain editable after acknowledgement; employee completion stays separate.';
  const eventFilter=$('event-filter').value,visible=events.filter(e=>(!eventFilter||e.stage===eventFilter)&&(!person||cycles.some(c=>c.CycleID===e.cycle&&c.Employee===person)));
  $('events').innerHTML=visible.length?eventHTML(visible):events.length?'<div class="empty"><strong>No activity matches this filter.</strong>Choose another activity type or employee.</div>':eventHTML([]);
  $('recent-events').innerHTML=eventHTML(events.filter(e=>!person||cycles.some(c=>c.CycleID===e.cycle&&c.Employee===person)).slice(0,3));renderSettings();
}
function initialize(){
  try{const state=JSON.parse(localStorage.getItem(STORAGE_KEY));if(state&&Array.isArray(state.tasks)&&Array.isArray(state.cycles)&&Array.isArray(state.events)&&Array.isArray(state.recoveryHistory)&&Number.isFinite(new Date(state.now).getTime())){
    validateSettings(state.settingsState);state.tasks.forEach(validateTask);tasks=state.tasks;cycles=state.cycles;events=state.events;recoveryHistory=state.recoveryHistory;settingsState=state.settingsState;now=new Date(state.now);activeTab=['overview','workboard','manager','weekly','settings','alerts'].includes(state.activeTab)?state.activeTab:'overview';render();return;
  }}catch{}reset();
}
document.addEventListener?.('keydown',e=>{if($('recovery-drawer').hidden)return;if(e.key==='Escape'){closeRecovery();return;}if(e.key==='Tab'){
  const nodes=$('recovery-drawer').querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled)');const first=nodes[0],last=nodes[nodes.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}});
initialize();
