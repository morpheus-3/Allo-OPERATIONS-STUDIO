/* Optional owner-run DATA TEST. Paste separately ONLY in a disposable copy.
   Never install this as part of the production source bundle. */
function acceptanceGuard_() {
  requireOwner();
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss.getName().startsWith('ALLO ACCEPTANCE '))throw Error('Use a disposable copy named ALLO ACCEPTANCE ...');
  if(ss.getId()!==book().getId())throw Error('Run setup in this copy first; project is bound to another Sheet');
  if(String(settings().DryRun).toLowerCase()!=='true')throw Error('DryRun must be TRUE');
  if(ScriptApp.getProjectTriggers().some(t=>['runAutomation','handleEdit'].includes(t.getHandlerFunction())))throw Error('Remove this copy\'s automation/edit triggers before loading fixture data');
  if(ss.getSpreadsheetTimeZone()!=='Asia/Kolkata'||ss.getSpreadsheetLocale()!=='en_IN')throw Error('Expected Asia/Kolkata and en_IN');
  return ss;
}
function clearAcceptanceData_(ss) {
  ['Workboard','EmailLog'].forEach(name=>{
    const s=ss.getSheetByName(name);
    if(s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,HEADERS[name].length).clearContent();
  });
}
function recordFormulaAcceptance_(ss,clock,expected) {
  let s=ss.getSheetByName('Acceptance');if(!s)s=ss.insertSheet('Acceptance');
  s.clearContents();s.getRange('A1').setValue('Fixed test clock IST');s.getRange('B1').setValue(clock).setNumberFormat('dd mmm yyyy hh:mm:ss');
  s.getRange('A3:D3').setValues([['Metric','Actual Google result','Expected','Result']]);
  const manager=ss.getSheetByName('Manager');
  for(let i=0;i<6;i++) {
    const formula=manager.getRange(i+3,16).getFormula();
    if(!formula.startsWith('='))throw Error('Missing original Manager formula');
    s.getRange(i+4,1).setValue(manager.getRange(i+3,15).getValue());
    s.getRange(i+4,2).setFormula(formula.replace(/NOW\(\)/g,"'Acceptance'!$B$1").replace(/TODAY\(\)/g,"INT('Acceptance'!$B$1)"));
    s.getRange(i+4,3).setValue(expected[i]);
    s.getRange(i+4,4).setFormula('=IF(B'+(i+4)+'=C'+(i+4)+',"PASS","FAIL")');
  }
  SpreadsheetApp.flush();
  const actual=s.getRange('B4:B9').getValues().map(r=>r[0]);
  const result={observedAt:new Date().toISOString(),clock:clock.toISOString(),timezone:ss.getSpreadsheetTimeZone(),locale:ss.getSpreadsheetLocale(),expected,actual,pass:actual.every((v,i)=>typeof v==='number'&&v===expected[i])};
  s.getRange('A11').setValue('Data-only test: copy of actual formulas with fixed clock. Live NOW refresh and timer checks are separate.');
  s.setColumnWidth(1,350);s.setColumnWidth(2,180);s.setColumnWidth(3,100);s.setColumnWidth(4,100);
  console.log(JSON.stringify(result));
  if(!result.pass)throw Error('Formula acceptance failed; inspect Acceptance and retain actual results');
  return result;
}
function runFormulaAcceptance() {
  const ss=acceptanceGuard_();
  // setup installs original formulas before replacing any data. DryRun required.
  setup();clearAcceptanceData_(ss);
  const clock=dateAt(dayKey(new Date()),17),at=h=>new Date(+clock+h*3600000);
  const defs=[
    ['A',-1,null,-1,null],['B',1,null,null,null],
    ['C',-5,-4,-4,null],['D',-25,null,-24,-23],
    ['E',-5,null,-4,null],['F',-25,null,-24+1/3600000,-23],
    ['G',-25,null,-24,-23],['H',-2,-1,-1,-.5]
  ];
  defs.forEach(([id,due,complete,alert,ack])=>{
    const c=cycleFor({TaskID:'ACCEPT-'+id,Task:'Formula fixture '+id,Employee:'Fixture '+id,EmployeeEmail:'fixture@example.com',ProofType:'TICKET'},at(due));
    if(complete!==null){c.CompletedAt=at(complete);c.CompletedBy=c.EmployeeEmail;c.Complete=true;c.Proof='TEST-'+id;}
    if(alert!==null)c.ManagerAlertAt=at(alert);
    if(ack!==null){c.AcknowledgedAt=at(ack);c.Acknowledge=true;c.AcknowledgedBy='manager@example.com';c.ManagerNote='Fixture review';}
    c.Status=statusFor(c,clock);save('Workboard',c);
  });
  ['SENDING','REVIEW_REQUIRED'].forEach((status,i)=>save('EmailLog',{Key:'ACCEPT-DELIVERY-'+i,CycleID:'ACCEPT-A',Stage:'MANAGER',Recipient:'fixture@example.com',CreatedAt:clock,DeliveryStatus:status,Error:'Simulated reservation for formula test only'}));
  return recordFormulaAcceptance_(ss,clock,[5,1,2,2,2,2]);
}
function runEmptyFormulaAcceptance() {
  const ss=acceptanceGuard_();clearAcceptanceData_(ss);
  return recordFormulaAcceptance_(ss,dateAt(dayKey(new Date()),17),[0,0,0,0,0,0]);
}
