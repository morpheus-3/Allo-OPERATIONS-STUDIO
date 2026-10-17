"""Prepare artifacts, then finalize a hash-verified release after visual review.
Usage: python scripts/package_release.py --prepare | --finalize
Use the bundled Python and ALLO_ARTIFACT_MODULES dependency path documented in README.
"""
from pathlib import Path
import argparse, hashlib, html, json, os, re, subprocess, zipfile
from datetime import date
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
VERSION=json.loads((ROOT/'package.json').read_text())['version']
RELEASE_DATE=date.fromisoformat(json.loads((ROOT/'package.json').read_text())['releaseDate']).strftime('%d %B %Y').lstrip('0')
CANDIDATE=json.loads((ROOT/'candidate.json').read_text())
assert CANDIDATE.get('confirmedByCandidate') is True, 'Confirm candidate details before building'
assert all(CANDIDATE.get(k) and '[' not in CANDIDATE[k] for k in ['name','email','portfolio'])

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def pdf_from_markdown(source,output,preface=''):
    styles=getSampleStyleSheet()
    styles.add(ParagraphStyle(name='ReportBody',fontName='Helvetica',fontSize=10,leading=13,spaceAfter=5,allowWidows=0,allowOrphans=0))
    styles.add(ParagraphStyle(name='ReportTable',fontName='Helvetica',fontSize=8.8,leading=12))
    styles['Title'].alignment=0;styles['Title'].fontSize=22;styles['Title'].leading=27
    for name in ['Heading2','Heading3']:
        styles[name].textColor=colors.black;styles[name].spaceBefore=11;styles[name].spaceAfter=7
    def rich(s):
        s=html.escape(s)
        s=re.sub(r'`([^`]+)`',r'<font name="Courier">\1</font>',s)
        return re.sub(r'\*\*([^*]+)\*\*',r'<b>\1</b>',s)
    lines=source.read_text(encoding='utf-8').splitlines();story=[];i=0
    while i<len(lines):
        line=lines[i].strip()
        if not line:i+=1;continue
        if line.startswith('|'):
            data=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                cells=[c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?',c) for c in cells):data.append([Paragraph(rich(c),styles['ReportTable']) for c in cells])
                i+=1
            widths=[110,401] if len(data[0])==2 else [511/len(data[0])]*len(data[0])
            t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
            t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e9edef')),('GRID',(0,0),(-1,-1),.5,colors.HexColor('#d9d9d9')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
            story.extend([t,Spacer(1,9)]);continue
        if line.startswith('# '):
            story.append(Paragraph(rich(line[2:]),styles['Title']))
            if preface:story.append(Paragraph(rich(preface).replace('&lt;br/&gt;','<br/>'),styles['ReportBody']))
        elif line.startswith('## '):
            if line=='## Explain the code in your own words':story.append(PageBreak())
            story.append(Paragraph(rich(line[3:]),styles['Heading2']))
        elif line.startswith('### '):story.append(Paragraph(rich(line[4:]),styles['Heading3']))
        else:
            text=line
            while i+1<len(lines) and lines[i+1].strip() and not re.match(r'^(#|\||- |\d+\. )',lines[i+1].strip()):i+=1;text+=' '+lines[i].strip()
            story.append(KeepTogether([Paragraph(rich(text),styles['ReportBody'])]))
        i+=1
    def footer(canvas,doc):
        canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#63766d'))
        canvas.drawString(42,24,'Allo operations | Release '+VERSION+' | '+RELEASE_DATE)
        canvas.drawRightString(A4[0]-42,24,str(doc.page))
    SimpleDocTemplate(str(output),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=40,bottomMargin=43,title=source.stem.replace('_',' '),author=CANDIDATE['name']).build(story,onFirstPage=footer,onLaterPages=footer)

parser=argparse.ArgumentParser();parser.add_argument('--prepare',action='store_true');parser.add_argument('--documents-only',action='store_true');parser.add_argument('--finalize',action='store_true');args=parser.parse_args()
if args.prepare or args.documents_only:
    if args.prepare:
        subprocess.run(['node','scripts/verify.cjs'],check=True)
        subprocess.run(['node','scripts/build-workbook.mjs'],check=True)
        combined='// Allo Operations Manager v'+VERSION+'\n// Paste this bundle OR the separate source files, never both.\n\n'
        combined+='\n\n'.join((ROOT/'src'/f).read_text(encoding='utf-8') for f in ['Engine.gs','Code.gs','Diagnostics.gs','Assistant.gs','Leave.gs'])
        (ROOT/'submission/Allo_Operations_AppsScript.gs').write_text(combined,encoding='utf-8',newline='\n')
    v=json.loads((ROOT/'evidence/VERIFICATION.json').read_text())
    preface=f"Release {VERSION} | {RELEASE_DATE}<br/>{CANDIDATE['name']} | {CANDIDATE['email']}<br/>Portfolio: {CANDIDATE['portfolio']}<br/>Local verification: {v['passed']}/{v['tests']} tests and eight scenarios pass."
    pdf_from_markdown(ROOT/'submission/SOLUTION_REPORT.md',ROOT/'submission/SOLUTION_REPORT.pdf',preface)
    (ROOT/'private').mkdir(exist_ok=True)
    interview=ROOT/'submission/INTERVIEW_PREPARATION.md'
    if interview.exists():pdf_from_markdown(interview,ROOT/'private/INTERVIEW_PREPARATION.pdf','Candidate preparation | Release '+VERSION)
    draft=f"To: hr.ops.allo@gmail.com\nSubject: AI Operations Manager assignment submission - {CANDIDATE['name']}\n\nDear Allo Innoware Hiring Team,\n\nPlease find my recurring operations assignment for the AI Operations Manager role.\n\nWorking Google Sheet: https://docs.google.com/spreadsheets/d/1aLoeuykOMAq-sWQ7JCzsnpEkuSQle93c6mgVHKYYsn4/edit\nSource repository: https://github.com/morpheus-3/Allo-OPERATIONS-STUDIO\nPortfolio: {CANDIDATE['portfolio']}\n\nAttached: release {VERSION}, including solution report, Apps Script, setup guide and reproducible evidence. Employees complete tasks from one Workboard; the system prepares recurring cycles and records manager review and leadership escalation.\n\n{v['passed']}/{v['tests']} local tests and eight simulated scenarios pass. Earlier live workflow and email receipts were user-confirmed with one account and accelerated escalation timing. Acceptance of this updated release, distinct-user permissions and formula calculations remains pending; the included acceptance protocol lists the exact checks. Evaluator access must be confirmed before sending.\n\nI would welcome an opportunity to demonstrate the workflow and explain the decisions.\n\nRegards,\n{CANDIDATE['name']}\n{CANDIDATE['email']}\n"
    (ROOT/'private/Submission_Email.txt').write_text(draft,encoding='utf-8')
    outputs=['submission/SOLUTION_REPORT.pdf','submission/Allo_Operations_Template.xlsx']
    (ROOT/'evidence/ARTIFACT_QA_REQUEST.json').write_text(json.dumps({ 'release':VERSION,'artifactHashes':{p:sha(ROOT/p) for p in outputs}},indent=2)+'\n')
    print('Prepared artifacts. Render and inspect PDF pages and workbook renders, then record ARTIFACT_QA.json and run --finalize.')
elif args.finalize:
    request=json.loads((ROOT/'evidence/ARTIFACT_QA_REQUEST.json').read_text())
    qa=json.loads((ROOT/'evidence/ARTIFACT_QA.json').read_text())
    assert qa['visualReviewPassed'] is True and qa['artifactHashes']==request['artifactHashes'] and qa['release']==VERSION
    for p,h in request['artifactHashes'].items():assert sha(ROOT/p)==h, 'Artifact changed since review: '+p
    v=json.loads((ROOT/'evidence/VERIFICATION.json').read_text());assert v['release']==VERSION and v['failed']==0
    for f,h in v['sourceHashes'].items():assert sha(ROOT/'src'/f)==h, 'Source changed since verification: '+f
    bundle=(ROOT/'submission/Allo_Operations_AppsScript.gs').read_text(encoding='utf-8')
    for f in ['Engine.gs','Code.gs','Diagnostics.gs','Assistant.gs','Leave.gs']:assert (ROOT/'src'/f).read_text(encoding='utf-8') in bundle
    excluded={'INTERVIEW_PREPARATION.md','INTERVIEW_WALKTHROUGH.md','SOLUTION_REPORT.docx'}
    files=[ROOT/n for n in ['README.md','CHECKPOINTS.md','REQUIREMENTS.md','DEMO.md','package.json','candidate.json','requirements-build.txt','demo.html','leave.html','Open-Preview.cmd','.gitignore','.gitattributes']]
    for folder in ['src','scripts','tests','web','evidence','submission']:
        files.extend(p for p in (ROOT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.name not in excluded and not p.name.endswith('.inspect.ndjson'))
    assert not any(('YOUR'+' NAME') in p.read_text(encoding='utf-8') for p in files if p.suffix in ['.md','.json','.py','.gs','.cjs','.mjs','.html'])
    manifest={p.relative_to(ROOT).as_posix():sha(p) for p in sorted(files)}
    release=ROOT/'release';release.mkdir(exist_ok=True)
    (release/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2)+'\n')
    archive=release/f'Allo_AI_Operations_Manager_v{VERSION}.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for p in sorted(files):z.write(p,'allo-ai-operations-manager/'+p.relative_to(ROOT).as_posix())
        z.write(release/'SHA256SUMS.json','allo-ai-operations-manager/SHA256SUMS.json')
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for name,h in manifest.items():assert hashlib.sha256(z.read('allo-ai-operations-manager/'+name)).hexdigest()==h
        assert not any('/private/' in n or '.build-deps' in n or '__pycache__' in n or n.endswith('.env') for n in z.namelist())
    print(f'Release {VERSION}: {len(manifest)} files; CRC and every SHA-256 verified. '+str(archive))
else:parser.error('Choose --prepare or --finalize')
