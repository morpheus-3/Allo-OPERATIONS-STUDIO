/* Owner-run deployment diagnostics. These checks do not send test emails. */
function runHealthCheck() {
  requireOwner();
  const rows=[],cfg=settings(),tasks=records('Tasks');
  const check=(name,fn)=>{try {rows.push([name,'PASS',String(fn()||'OK')]);}catch(err){rows.push([name,'FAIL',String(err.message||err)]);}};
  check('Settings',()=>validateSettings(cfg));
  check('Task configuration',()=>{
    const ids=new Set();
    tasks.forEach(t=>{validateTask(t);if(ids.has(t.TaskID))throw new Error('Duplicate ID '+t.TaskID);ids.add(t.TaskID);});
    return tasks.length+' task definitions validated';
  });
  check('Timezone',()=>{if(book().getSpreadsheetTimeZone()!=='Asia/Kolkata')throw new Error('Expected Asia/Kolkata');});
  check('Five-minute automation trigger',()=>{
    const count=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='runAutomation').length;
    if(count!==1)throw new Error('Expected one timer trigger; use Install automation triggers');
    return 'One timer trigger visible to current owner; schedule configured by installer';
  });
  check('Edit trigger',()=>{
    const count=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='handleEdit').length;
    if(count!==1)throw new Error('Expected one edit trigger; use Install automation triggers');
  });
  check('Real employee accounts',()=>{if(tasks.filter(t=>t.Active===true).some(t=>isSampleEmail(t.EmployeeEmail)))throw new Error('Replace sample employee emails, share the Sheet, then rerun setup');});
  check('Email delivery reservations',()=>{
    const review=records('EmailLog').filter(r=>['SENDING','REVIEW_REQUIRED'].includes(r.DeliveryStatus));
    if(review.length)throw new Error(review.length+' ambiguous/failed delivery entries need manual review');
  });
  check('Automation heartbeat',()=>{
    const last=PropertiesService.getScriptProperties().getProperty('LAST_SUCCESSFUL_RUN');
    if(!last || new Date()-new Date(last)>15*60000)throw new Error('No successful automation run within 15 minutes; inspect trigger executions');
    return last;
  });
  check('No duplicate cycles or email keys',()=>{
    for(const [name,key] of [['Workboard','CycleID'],['EmailLog','Key']]) {
      const values=records(name).map(r=>r[key]);if(new Set(values).size!==values.length)throw new Error('Duplicate '+key+' in '+name);
    }
  });
  check('Workboard protections',()=>{
    const s=book().getSheetByName('Workboard');
    if(!s.getProtections(SpreadsheetApp.ProtectionType.SHEET).some(p=>p.getDescription()==='ALLO:system'))throw new Error('Run setup to apply system protection');
    const descriptions=s.getProtections(SpreadsheetApp.ProtectionType.RANGE).map(p=>p.getDescription());
    records('Workboard').forEach(c=>['H'+c._row+':I'+c._row,'N'+c._row,'Q'+c._row].forEach(a=>{
      if(!descriptions.includes('ALLO:'+c.CycleID+':'+a))throw new Error('Missing protection for '+c.CycleID+' '+a);
    }));
    return 'Protection objects present; verify actual users manually';
  });
  check('Remaining mail quota',()=>{const n=MailApp.getRemainingDailyQuota();if(n<2)throw new Error('Insufficient daily quota');return n+' recipients remaining';});
  rows.push(['Delivery mode',String(cfg.DryRun).toLowerCase()==='true'?'DRY_RUN':'LIVE','Dry-run entries do not prove receipt. Use a fresh copy for live operation.']);
  rows.push(['Real-user identity and receipt','MANUAL','Verify employee/manager edits and actual email receipts; this check cannot authenticate other users.']);
  let s=book().getSheetByName('Health');if(!s)s=book().insertSheet('Health');
  s.clearContents();s.getRange(1,1,1,3).setValues([['CHECK','RESULT','DETAIL']]);
  s.getRange(2,1,rows.length,3).setValues(rows);
  s.getRange(1,1,1,3).setBackground('#173e36').setFontColor('white').setFontWeight('bold');
  s.setFrozenRows(1);s.setColumnWidth(1,260);s.setColumnWidth(2,100);s.setColumnWidth(3,700);
  s.getRange(rows.length+3,1).setValue('Checked at '+Utilities.formatDate(new Date(),'Asia/Kolkata','yyyy-MM-dd HH:mm:ss')+' IST');
  let pr=s.getProtections(SpreadsheetApp.ProtectionType.SHEET).find(p=>p.getDescription()==='ALLO:system');
  if(!pr)pr=s.protect().setDescription('ALLO:system');restrict(pr,[]);
  return rows;
}
