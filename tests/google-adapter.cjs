const fs=require('node:fs'),vm=require('node:vm');
function googleAdapter() {
  let clock=new Date('2026-10-08T16:00:00+05:30'),flushes=0;
  const owner='owner@allo.test',sent=[],properties={},triggers=[];
  class ClockDate extends Date {constructor(...args){super(...(args.length?args:[+clock]));}}
  const user=email=>({getEmail:()=>email});
  class Protection {
    constructor(sheet,range,type){this.sheet=sheet;this.range=range;this.type=type;this.editors=[owner];this.exempt=[];this.description='';}
    setDescription(v){this.description=v;return this;}getDescription(){return this.description;}
    setWarningOnly(){return this;}addEditor(u){const email=typeof u==='string'?u:u.getEmail();if(!this.editors.includes(email))this.editors.push(email);return this;}
    getEditors(){return this.editors.map(user);}removeEditors(users){this.editors=this.editors.filter(e=>!users.some(u=>u.getEmail()===e));return this;}
    canDomainEdit(){return false;}setDomainEdit(){return this;}setUnprotectedRanges(r){this.exempt=r;return this;}
    remove(){this.sheet.protections=this.sheet.protections.filter(p=>p!==this);}
  }
  const col=v=>[...v].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0);
  class Range {
    constructor(sheet,a,b,rows=1,cols=1){this.sheet=sheet;
      if(typeof a==='string'){
        const m=a.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+)?)?$/);if(!m)throw Error('Unsupported A1 '+a);
        this.row=+m[2];this.column=col(m[1]);this.rows=m[3]?(m[4]?+m[4]:sheet.maxRows)-this.row+1:1;this.cols=m[3]?col(m[3])-this.column+1:1;
      }else{this.row=a;this.column=b;this.rows=rows;this.cols=cols;}
      if(this.row<1||this.column<1||this.rows<1||this.cols<1)throw Error('Invalid range');
    }
    getSheet(){return this.sheet;}getRow(){return this.row;}getColumn(){return this.column;}getLastRow(){return this.row+this.rows-1;}getLastColumn(){return this.column+this.cols-1;}
    getValues(){return Array.from({length:this.rows},(_,r)=>Array.from({length:this.cols},(_,c)=>this.sheet.cells[this.row+r-1]?.[this.column+c-1]??''));}
    setValues(values){if(values.length!==this.rows||values.some(r=>r.length!==this.cols))throw Error('Shape mismatch');values.forEach((row,r)=>row.forEach((v,c)=>{this.sheet.cells[this.row+r-1]??=[];this.sheet.cells[this.row+r-1][this.column+c-1]=v;}));return this;}
    setValue(v){if(this.rows===1&&this.cols===1)return this.setValues([[v]]);throw Error('Use setValues for larger range');}
    setFormula(v){return this.setValue(v);}setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setDataValidation(){return this;}setNumberFormat(){return this;}setNote(){return this;}
    createFilter(){this.sheet.filter={remove:()=>{this.sheet.filter=null;}};return this;}protect(){const p=new Protection(this.sheet,this,'RANGE');this.sheet.protections.push(p);return p;}
    clearContent(){return this.setValues(Array.from({length:this.rows},()=>Array(this.cols).fill('')));}
    contains(row,column){return row>=this.row&&row<=this.getLastRow()&&column>=this.column&&column<=this.getLastColumn();}
  }
  class Sheet {
    constructor(name){this.name=name;this.cells=[];this.maxRows=1000;this.protections=[];}
    getName(){return this.name;}getLastRow(){for(let i=this.cells.length-1;i>=0;i--)if(this.cells[i]?.some(v=>v!==''&&v!==undefined))return i+1;return 0;}
    getMaxRows(){return this.maxRows;}getRange(...args){return new Range(this,...args);}appendRow(row){this.cells[this.getLastRow()]=[...row];return this;}
    insertRowsAfter(row,count){this.maxRows+=count;return this;}
    setFrozenRows(){return this;}autoResizeColumns(){return this;}setColumnWidth(){return this;}setConditionalFormatRules(){return this;}getFilter(){return this.filter;}clearContents(){this.cells=[];return this;}
    getProtections(type){return this.protections.filter(p=>p.type===type);}protect(){const p=new Protection(this,null,'SHEET');this.protections.push(p);return p;}
  }
  const sheets=[];
  const ss={getId:()=> 'test-sheet',getUrl:()=> 'https://example.test/sheet',getSheets:()=>sheets,getSheetByName:n=>sheets.find(s=>s.name===n),insertSheet(n){const s=new Sheet(n);sheets.push(s);return s;},setSpreadsheetTimeZone(z){this.zone=z;},getSpreadsheetTimeZone(){return this.zone;},setSpreadsheetLocale(l){this.locale=l;}};
  function builder(){const b={build:()=>({}),requireCheckbox:()=>b,requireValueInList:()=>b,requireNumberBetween:()=>b,setAllowInvalid:()=>b,whenTextEqualTo:()=>b,setBackground:()=>b,setRanges:()=>b};return b;}
  const ctx=vm.createContext({Date:ClockDate,console,
    Utilities:{formatDate(d,z,pattern){const value=new Intl.DateTimeFormat('en-CA',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);return pattern==='yyyy-MM-dd'?value:value+' 16:00:00';}},
    Session:{getEffectiveUser:()=>user(owner)},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties[k],setProperty(k,v){properties[k]=v;}})},
    LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
    MailApp:{sendEmail(...args){sent.push(args);},getRemainingDailyQuota:()=>100},
    SpreadsheetApp:{ProtectionType:{SHEET:'SHEET',RANGE:'RANGE'},getActiveSpreadsheet:()=>ss,openById(id){if(id!=='test-sheet')throw Error('Unknown Sheet');return ss;},flush(){flushes++;},newDataValidation:builder,newConditionalFormatRule:builder},
    ScriptApp:{getProjectTriggers:()=>triggers,deleteTrigger(t){triggers.splice(triggers.indexOf(t),1);},newTrigger(handler){const t={handler,getHandlerFunction:()=>handler};const b={timeBased:()=>b,everyMinutes(m){t.minutes=m;return b;},forSpreadsheet:()=>b,onEdit:()=>b,create(){triggers.push(t);return t;}};return b;}}
  });
  for(const file of ['Engine.gs','Code.gs','Diagnostics.gs'])vm.runInContext(fs.readFileSync('src/'+file,'utf8'),ctx,{filename:file});
  function userEdit(row,column,value,email){
    const s=ss.getSheetByName('Workboard');
    if(email!==owner){
      for(const p of s.protections){
        if(p.type==='SHEET'&&!p.exempt.some(r=>r.contains(row,column))&&!p.editors.includes(email))throw Error('Sheet protection denied');
        if(p.type==='RANGE'&&p.range.contains(row,column)&&!p.editors.includes(email))throw Error('Range protection denied');
      }
    }
    s.getRange(row,column).setValue(value);
    ctx.handleEdit({range:s.getRange(row,column),user:email?user(email):undefined});
  }
  function configure(){
    const master=ss.getSheetByName('Tasks');
    for(let i=0;i<4;i++)master.getRange(i+2,4).setValue('employee'+String.fromCharCode(97+i)+'@allo.test');
    const settings=ss.getSheetByName('Settings');settings.getRange(2,2).setValue('manager@allo.test');settings.getRange(3,2).setValue('leader@allo.test');
    // Initial sample cycles intentionally snapshot the sample assignees; replace
    // those snapshots only for this test-fixture initialization, before sharing.
    const board=ss.getSheetByName('Workboard');
    for(let i=0;i<4;i++)board.getRange(i+2,5).setValue('employee'+String.fromCharCode(97+i)+'@allo.test');
    ctx.setup();
  }
  return {ctx,ss,sent,triggers,owner,userEdit,configure,properties,setTime:v=>clock=new Date(v),getFlushes:()=>flushes};
}
module.exports={googleAdapter};
