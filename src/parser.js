import { parseMetadata } from './metadata.js'
import { blockScriptureValue, validateScriptureConsistency } from './scripture.js'
import { sha256 } from './keys.js'

/**
 * EXPERIMENTAL read-only BerryMark syntax and metadata parser.
 * Does not convert Markdown to Portable Text, authorize drafts, contact
 * Sanity, verify licenses, or determine editorial/publication readiness.
 */
const MARKER=/^\[\[(\/)?(SCREEN|CB[1-9]|LEFT|RIGHT|FOOTER|CARD|STEP|CHOICE|SCRIPTURE)(?: id=([a-z][a-z0-9]*(?:-[a-z0-9]+)*))?\]\]$/
const MARKER_LIKE=/^\[\[.*\]\]$/
const LITERAL_MARKER=/^\\(\[\[.*\]\])$/
const NEED_ID=new Set(['SCREEN','CARD','STEP','CHOICE','SCRIPTURE'])
const FREE=new Set(['CB1','CB9','FOOTER'])
const SCHEMAS={
  CB2:{req:['Reference','Translation','Text Status','Practice Status'],opt:['Passage','Usage Rights Confirmed']},
  SCRIPTURE:{req:['Reference','Translation','Text Status','Practice Status'],opt:['Passage','Usage Rights Confirmed']},
  CB3:{req:['Text'],opt:['Label']},
  CARD:{req:['Title'],opt:['Body']},
  STEP:{req:['Title','Body'],opt:[]},
  CHOICE:{req:['Label','Prompt'],opt:[]},
  CB6_PRE:{req:[],opt:['Cycle','Return Caption']},
  CB6_POST:{req:[],opt:['Conclusion']},
  CB7_PRE:{req:['Question'],opt:['Closing']},
  CB7_POST:{req:[],opt:['Closing']}
}
function error(ds,code,message,line,column=1,target){
  ds.push({severity:'error',code,message,line,column,...(target?{target}:{})})
}
function hasText(s){return typeof s==='string'&&s.trim().length>0}
function textOf(entries){
  const a=entries.map(e=>e.text)
  while(a.length&&a[0]==='')a.shift()
  while(a.length&&a.at(-1)==='')a.pop()
  return a.join('\n')
}
function named(entries,kind,ds){
  const schema=SCHEMAS[kind],allowed=new Set([...schema.req,...schema.opt]),fields={}
  for(let i=0;i<entries.length;i++){
    const {text,line}=entries[i]
    if(!text.trim())continue
    const m=text.match(/^([A-Za-z][A-Za-z ]*):(?: ?)(.*)$/)
    if(!m){error(ds,'BM_FIELD_SYNTAX','Expected a named field in '+kind,line);continue}
    const name=m[1]
    if(text.slice(name.length+1).startsWith('  ')){
      error(ds,'BM_FIELD_SPACING','Use at most one space after '+name+':',line);continue
    }
    if(!allowed.has(name)){error(ds,'BM_FIELD_UNKNOWN','Unknown field "'+name+'" in '+kind,line);continue}
    if(Object.hasOwn(fields,name)){error(ds,'BM_FIELD_DUPLICATE','Duplicate field "'+name+'" in '+kind,line);continue}
    let value=m[2]
    if(value==='|'){
      const multi=[];let j=i+1
      while(j<entries.length){
        const next=entries[j].text
        if(next===''||/^ {2}/.test(next)){multi.push(next===''?'':next.slice(2));j++}
        else break
      }
      while(multi.length&&multi.at(-1)==='')multi.pop()
      if(!multi.length)error(ds,'BM_MULTILINE_EMPTY','Multiline field "'+name+'" needs indented content',line)
      value=multi.join('\n');i=j-1
    }
    if(!hasText(value))error(ds,'BM_FIELD_EMPTY','Field "'+name+'" cannot be empty',line)
    fields[name]=value
    if((name==='Cycle'||name==='Usage Rights Confirmed')&&!['true','false'].includes(value))
      error(ds,'BM_BOOLEAN_INVALID',name+' must be true or false',line)
    if(name==='Text Status'&&!['referenceOnly','provided'].includes(value))
      error(ds,'BM_ENUM_INVALID','Text Status must be referenceOnly or provided',line)
    if(name==='Practice Status'&&!['notConfigured','configured'].includes(value))
      error(ds,'BM_ENUM_INVALID','Practice Status must be notConfigured or configured',line)
  }
  for(const key of schema.req)if(!hasText(fields[key]))
    error(ds,'BM_FIELD_REQUIRED','Missing required '+kind+' field "'+key+'"',entries[0]?.line??1)
  return fields
}
function scripture(fields,ds,line,target){
  validateScriptureConsistency(blockScriptureValue(fields),(code,message)=>
    error(ds,code,message,line,1,target))
}
function childAllowed(parent,child){
  if(!parent)return child==='SCREEN'
  if(parent==='SCREEN')return /^CB[1-9]$/.test(child)
  const kinds={CB4:['LEFT','RIGHT','FOOTER'],CB5:['CARD'],CB6:['STEP'],CB7:['CHOICE'],CB8:['SCRIPTURE']}
  return (kinds[parent]??[]).includes(child)
}
function headerBody(n,ds){
  const childIndex=n.parts.findIndex(p=>p.kind==='child')
  const before=childIndex<0?n.parts:n.parts.slice(0,childIndex)
  const after=childIndex<0?[]:n.parts.slice(childIndex).filter(p=>p.kind==='line')
  for(const p of after)if(p.text.trim())
    error(ds,'BM_BODY_AFTER_NESTED',n.kind+' body must precede nested sections',p.line)
  const entries=before.filter(p=>p.kind==='line')
  const first=entries.findIndex(p=>p.text.trim())
  if(first<0||!/^Title: [^\s]/.test(entries[first].text)){
    error(ds,'BM_HEADER_TITLE',n.kind+' requires a Title: header',n.startLine)
    return{title:null,body:textOf(entries)}
  }
  const title=entries[first].text.slice(7)
  const hasSeparator=entries[first+1]?.text===''
  if(!hasSeparator)error(ds,'BM_HEADER_SEPARATOR',n.kind+' needs a blank line after Title:',entries[first].line)
  const body=textOf(entries.slice(first+(hasSeparator?2:1)))
  if(!hasText(body))error(ds,'BM_BODY_REQUIRED',n.kind+' needs a nonempty rich-text body',n.startLine)
  return{title,body}
}
function nodeToAst(n,ds){
  const lines=n.parts.filter(p=>p.kind==='line')
  const children=n.parts.filter(p=>p.kind==='child').map(p=>nodeToAst(p.node,ds))
  const of=kind=>children.filter(c=>c.type===kind)
  const out={type:n.kind,id:n.id??null,line:n.startLine,endLine:n.endLine??null}
  const requireShape=(test,code,msg)=>{if(!test)error(ds,code,msg,n.startLine)}
  if(n.kind==='SCREEN'){
    const index=n.parts.findIndex(p=>p.kind==='child')
    const pre=(index<0?n.parts:n.parts.slice(0,index)).filter(p=>p.kind==='line')
    const post=(index<0?[]:n.parts.slice(index)).filter(p=>p.kind==='line')
    let heading=null,label=null
    for(const p of pre){
      if(!p.text.trim())continue
      if(p.text.startsWith('Label: ')){
        if(label!==null)error(ds,'BM_SCREEN_DUPLICATE','Duplicate screen Label',p.line)
        label=p.text.slice(7)
      }else if(/^# [^\s]/.test(p.text)){
        if(heading!==null)error(ds,'BM_SCREEN_DUPLICATE','Duplicate screen heading',p.line)
        heading=p.text.slice(2)
      }else error(ds,'BM_SCREEN_HEADER','Unexpected text in SCREEN header; use a CB for prose',p.line)
    }
    for(const p of post)if(p.text.trim())error(ds,'BM_SCREEN_PROSE','SCREEN prose must be inside a CB',p.line)
    requireShape(children.length>0,'BM_SCREEN_EMPTY','SCREEN must contain at least one CB')
    out.label=label;out.heading=heading;out.blocks=children
  }else if(FREE.has(n.kind)){
    requireShape(children.length===0,'BM_PLAIN_NESTED',n.kind+' cannot contain nested sections')
    out.text=textOf(lines)
    if(!hasText(out.text)&&n.kind!=='FOOTER')error(ds,'BM_BODY_REQUIRED',n.kind+' needs text',n.startLine)
    if(n.kind==='CB9')out.paragraphs=out.text.split(/\n\s*\n/).filter(hasText)
  }else if(SCHEMAS[n.kind]){
    requireShape(children.length===0,'BM_FIELD_NESTED',n.kind+' cannot contain nested sections')
    out.fields=named(lines,n.kind,ds)
    if(n.kind==='CB2'||n.kind==='SCRIPTURE')scripture(out.fields,ds,n.startLine,n.id)
  }else if(n.kind==='LEFT'||n.kind==='RIGHT'||n.kind==='CB8'){
    const {title,body}=headerBody(n,ds)
    out.title=title;out.body=body
    if(n.kind==='CB8')out.scriptures=of('SCRIPTURE')
  }else if(n.kind==='CB4'){
    for(const p of lines)if(p.text.trim())error(ds,'BM_CB4_STRAY','CB4 prose must be in LEFT, RIGHT or FOOTER',p.line)
    requireShape(of('LEFT').length===1,'BM_CB4_LEFT','CB4 requires exactly one LEFT')
    requireShape(of('RIGHT').length===1,'BM_CB4_RIGHT','CB4 requires exactly one RIGHT')
    requireShape(of('FOOTER').length<=1,'BM_CB4_FOOTER','CB4 allows at most one FOOTER')
    out.left=of('LEFT')[0]??null;out.right=of('RIGHT')[0]??null;out.footer=of('FOOTER')[0]?.text??null
  }else if(n.kind==='CB5'){
    for(const p of lines)if(p.text.trim())error(ds,'BM_CB5_STRAY','CB5 text must be inside CARD',p.line)
    requireShape(of('CARD').length>=1,'BM_CARD_REQUIRED','CB5 requires at least one CARD')
    out.cards=of('CARD')
  }else if(n.kind==='CB6'||n.kind==='CB7'){
    const childKind=n.kind==='CB6'?'STEP':'CHOICE'
    const first=n.parts.findIndex(p=>p.kind==='child')
    const last=n.parts.findLastIndex(p=>p.kind==='child')
    const pre=(first<0?n.parts:n.parts.slice(0,first)).filter(p=>p.kind==='line')
    const post=(last<0?[]:n.parts.slice(last+1)).filter(p=>p.kind==='line')
    const middle=first<0?[]:n.parts.slice(first,last+1).filter(p=>p.kind==='line')
    for(const p of middle)if(p.text.trim())error(ds,'BM_MIXED_STRAY','Unexpected prose between '+childKind+' sections',p.line)
    const preFields=named(pre,n.kind+'_PRE',ds),postFields=named(post,n.kind+'_POST',ds)
    out.fields={...preFields,...postFields}
    if(n.kind==='CB6'){
      requireShape(of('STEP').length>=2,'BM_STEP_COUNT','CB6 requires at least two STEP sections')
      if(preFields.Cycle==='true'&&!hasText(preFields['Return Caption']))
        error(ds,'BM_RETURN_CAPTION','Cycle: true requires Return Caption',n.startLine)
      out.steps=of('STEP')
    }else{
      const count=of('CHOICE').length
      requireShape(count===0||count>=2,'BM_CHOICE_COUNT','CB7 must have zero or at least two choices')
      if(count>0&&Object.hasOwn(preFields,'Closing'))
        error(ds,'BM_CHOICE_CLOSING','Closing with choices must follow last CHOICE',n.startLine)
      out.choices=of('CHOICE')
    }
  }
  return out
}
export function parseBerryMark(input,{filename='<memory>'}={}){
  if(typeof input!=='string')throw new TypeError('BerryMark input must be a string')
  const ds=[],lines=input.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n')
  let start=0,frontmatter=null
  if(lines[0]!=='---')error(ds,'BM_FRONTMATTER_OPEN','Document must start with YAML --- delimiter',1)
  else{
    const end=lines.indexOf('---',1)
    if(end<0){error(ds,'BM_FRONTMATTER_CLOSE','Missing closing YAML --- delimiter',1);start=lines.length}
    else{frontmatter={raw:lines.slice(1,end).join('\n'),startLine:1,endLine:end+1,yamlValidated:false};start=end+1}
  }
  const metadataLocations=new Map()
  const metadata=parseMetadata(frontmatter,ds,metadataLocations)
  if(frontmatter)frontmatter.yamlValidated=metadata!==null
  const roots=[],stack=[],comments=[],seen=new Map()
  let comment=null
  for(let i=start;i<lines.length;i++){
    const text=lines[i],line=i+1
    if(comment){comment.content.push(text);if(text.includes('-->')){comments.push(comment);comment=null}continue}
    if(text.startsWith('<!--')){
      comment={line,content:[text]}
      if(text.includes('-->')){comments.push(comment);comment=null}
      continue
    }
    const literal=text.match(LITERAL_MARKER)
    if(literal){
      if(stack.length)stack.at(-1).parts.push({kind:'line',line,text:literal[1]})
      else error(ds,'BM_OUTSIDE_SCREEN','Literal marker text outside SCREEN',line)
      continue
    }
    const m=text.match(MARKER)
    if(m){
      const closing=Boolean(m[1]),kind=m[2],id=m[3]??null
      if(closing){
        const active=stack.pop()
        if(!active||active.kind!==kind)
          error(ds,'BM_MARKER_MISMATCH','Unexpected closing '+kind+', expected '+(active?.kind??'none'),line)
        else active.endLine=line
      }else{
        const parent=stack.at(-1)
        if(!childAllowed(parent?.kind,kind))
          error(ds,'BM_NESTING',kind+' is not valid inside '+(parent?.kind??'document'),line)
        if((NEED_ID.has(kind)||/^CB[1-9]$/.test(kind))&&!id)
          error(ds,'BM_ID_REQUIRED',kind+' requires id=...',line)
        if(['LEFT','RIGHT','FOOTER'].includes(kind)&&id)
          error(ds,'BM_ID_UNEXPECTED',kind+' does not accept an ID',line)
        if(id){
          if(seen.has(id))error(ds,'BM_ID_DUPLICATE','ID "'+id+'" was used on line '+seen.get(id),line)
          else seen.set(id,line)
        }
        const n={kind,id,startLine:line,endLine:null,parts:[]}
        if(parent)parent.parts.push({kind:'child',node:n,line})
        else roots.push(n)
        stack.push(n)
      }
      continue
    }
    if(MARKER_LIKE.test(text)){error(ds,'BM_MARKER_UNKNOWN','Unknown or malformed marker: '+text,line);continue}
    if(!stack.length){if(text.trim())error(ds,'BM_OUTSIDE_SCREEN','Text must be inside SCREEN / CB',line)}
    else stack.at(-1).parts.push({kind:'line',line,text})
  }
  if(comment)error(ds,'BM_COMMENT_UNCLOSED','Unclosed HTML editorial comment',comment.line)
  for(const n of stack)error(ds,'BM_MARKER_UNCLOSED','Unclosed '+n.kind+' marker',n.startLine)
  if(!roots.length)error(ds,'BM_SCREEN_REQUIRED','Document requires at least one SCREEN',start+1)
  const screens=roots.map(n=>nodeToAst(n,ds))
  const annotations=comments.map(c=>({line:c.line,text:c.content.join('\n')}))
  for(const annotation of annotations){
    const match=annotation.text.match(/^<!--\s*(EDITORIAL NOTE|TODO|REVIEW REQUIRED)\s*:/)
    if(!match)continue
    const codes={'EDITORIAL NOTE':'BM_EDITORIAL_NOTE',TODO:'BM_EDITORIAL_TODO','REVIEW REQUIRED':'BM_EDITORIAL_REVIEW'}
    ds.push({severity:'editorial',code:codes[match[1]],message:annotation.text,line:annotation.line,column:1})
  }
  const diagnostics=ds.map(d=>({filename,...d}))
  const summary={
    errors:diagnostics.filter(d=>d.severity==='error').length,
    warnings:diagnostics.filter(d=>d.severity==='warning').length,
    editorial:diagnostics.filter(d=>d.severity==='editorial').length,
    info:diagnostics.filter(d=>d.severity==='info').length
  }
  const result={
    ok:summary.errors===0,filename,mode:'experimental-read-only-validation',
    capabilities:{
      checked:['safe YAML 1.2 syntax and core types','supported metadata','marker nesting','field declarations','structural IDs','block shapes','shared Scripture status combinations','editorial annotations'],
      notChecked:['Markdown/Portable Text mapping','Sanity import','external Scripture license evidence','editorial approval','publication readiness']
    },
    document:{frontmatter,metadata,screens,annotations},
    summary,
    diagnostics
  }
  // Non-enumerable compiler bindings preserve the existing validator JSON shape.
  Object.defineProperties(result,{
    sourceSha256:{value:sha256(input)},
    metadataLocations:{value:metadataLocations}
  })
  return result
}
export function formatStructuralPreview(result){
  const lines=['BerryMark experimental structural preview — '+result.filename,
    'Status: '+(result.ok?'valid working document (not import-ready)':'validation errors')]
  for(const [index,screen] of result.document.screens.entries()){
    lines.push('SCREEN '+(index+1)+'/'+result.document.screens.length+' id='+screen.id+' · '+(screen.label??'')+' · '+(screen.heading??''))
    for(const block of screen.blocks){
      lines.push('  '+block.type+' id='+block.id)
      for(const kind of ['cards','steps','choices','scriptures'])
        if(Array.isArray(block[kind]))for(const child of block[kind])
          lines.push('    '+child.type+' id='+child.id)
    }
  }
  for(const d of result.diagnostics)
    lines.push(d.severity.toUpperCase()+' '+d.code+' '+result.filename+':'+d.line+':'+d.column+(d.path?' '+d.path:'')+' '+d.message)
  lines.push('Not validated: Markdown conversion, Sanity import, external rights evidence, editorial/publishing readiness')
  return lines.join('\n')
}
