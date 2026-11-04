import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { stringify } from 'yaml'
import { parseBerryMark } from '../src/parser.js'

const body=`[[SCREEN id=opening]]
Label: Test
# Metadata fixture
[[CB1 id=teaching]]
BM-TEST prose.
[[/CB1]]
[[/SCREEN]]`
const validMetadata=()=>({
  berrymark:'0.1',
  challenge:{
    title:'Test Challenge',
    slug:'test-challenge',
    type:'teaching',
    summary:null
  },
  publishing:{
    series:'test-series',
    sequence:1,
    releaseAt:'2026-11-03T12:00:00-06:00'
  },
  scripture:{
    reference:'John 11:35',
    translation:'NIV',
    textStatus:'referenceOnly',
    usageRightsConfirmed:false,
    practiceStatus:'notConfigured'
  },
  editorial:{
    sourceTitle:'Test Challenge',
    sourceAuthor:'Test Author',
    sourceRevision:null,
    approvalStatus:'pending',
    approvedBy:null,
    approvedAt:null
  },
  companionLinks:[]
})
const wrap=yaml=>`---\n${yaml.replace(/\n$/,'')}\n---\n${body}`
const checkYaml=yaml=>parseBerryMark(wrap(yaml),{filename:'metadata-test.berry.md'})
const checkValue=value=>checkYaml(stringify(value))
const checkMutation=mutate=>{
  const value=validMetadata()
  mutate(value)
  return checkValue(value)
}
const codes=result=>result.diagnostics.map(d=>d.code)
const has=(result,code)=>codes(result).includes(code)
const find=(result,code)=>result.diagnostics.find(d=>d.code===code)

test('real YAML produces a separate typed metadata AST and preserves raw front matter',()=>{
  const yaml=stringify(validMetadata())
  const result=checkYaml(yaml)
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics))
  assert.equal(result.document.frontmatter.raw,yaml.replace(/\n$/,''))
  assert.equal(result.document.frontmatter.yamlValidated,true)
  assert.equal(result.document.frontmatter.startLine,1)
  assert.equal(result.document.metadata.challenge.sequence,undefined)
  assert.equal(result.document.metadata.publishing.sequence,1)
  assert.equal(result.document.metadata.publishing.releaseAt,'2026-11-03T12:00:00-06:00')
  assert.equal(result.document.metadata.challenge.summary,null)
  assert.equal(result.document.metadata.scripture.usageRightsConfirmed,false)
  assert.deepEqual(result.document.metadata.companionLinks,[])
})

test('Rejoice Always retains seven screens, sixteen CBs, null metadata, and editorial work',async()=>{
  const source=await readFile(new URL('../examples/rejoice-always/rejoice-always.berry.md',import.meta.url),'utf8')
  const result=parseBerryMark(source,{filename:'rejoice-always.berry.md'})
  const blocks=result.document.screens.flatMap(screen=>screen.blocks)
  const studies=blocks.filter(block=>block.type==='CB8')
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics))
  assert.equal(result.document.screens.length,7)
  assert.equal(blocks.length,16)
  assert.equal(studies.length,3)
  assert.equal(studies.flatMap(study=>study.scriptures).length,4)
  assert.equal(result.document.annotations.length,17)
  assert.equal(result.diagnostics.filter(d=>d.code==='BM_EDITORIAL_REVIEW').length,11)
  assert.equal(result.document.metadata.publishing.series,null)
  assert.equal(result.document.metadata.publishing.sequence,null)
  assert.equal(result.document.metadata.publishing.releaseAt,null)
  assert.equal(result.document.metadata.editorial.approvalStatus,'pending')
  assert.equal(result.document.metadata.editorial.approvedBy,null)
  assert.equal(result.document.metadata.editorial.approvedAt,null)
  assert.equal(result.document.metadata.scripture.textStatus,'referenceOnly')
  assert.equal(result.document.metadata.scripture.usageRightsConfirmed,false)
  assert.deepEqual(result.document.metadata.companionLinks.map(link=>link.url),[null,null])
  assert.equal(result.summary.errors,0)
  assert.equal(result.summary.editorial,17)
  assert.ok(result.summary.info>=6)
})

test('duplicate YAML keys fail at the duplicate source line',()=>{
  const result=checkYaml('berrymark: "0.1"\nberrymark: "0.1"')
  const diagnostic=find(result,'BM_YAML_DUPLICATE_KEY')
  assert.equal(result.ok,false)
  assert.equal(result.document.metadata,null)
  assert.equal(diagnostic.line,3)
  assert.equal(diagnostic.filename,'metadata-test.berry.md')
})

test('non-mapping YAML roots are rejected',()=>{
  for(const yaml of ['- one\n- two','"scalar"','null']){
    const result=checkYaml(yaml)
    assert.equal(has(result,'BM_YAML_ROOT'),true,yaml)
    assert.equal(result.document.metadata,null)
  }
})

test('custom tags, anchors, and aliases are rejected without cyclic output',()=>{
  const tagged=checkYaml('berrymark: !custom "0.1"')
  assert.equal(has(tagged,'BM_YAML_TAG_UNSUPPORTED'),true)
  const aliased=checkYaml('berrymark: "0.1"\nchallenge: &shared\n  title: Test\nother: *shared')
  assert.equal(has(aliased,'BM_YAML_ANCHOR_UNSUPPORTED'),true)
  assert.equal(has(aliased,'BM_YAML_ALIAS_UNSUPPORTED'),true)
  assert.equal(aliased.document.metadata,null)
  assert.doesNotThrow(()=>JSON.stringify(aliased))
})

test('missing, unsupported, and mistyped BerryMark versions fail',()=>{
  const missing=validMetadata()
  delete missing.berrymark
  assert.equal(has(checkValue(missing),'BM_VERSION_REQUIRED'),true)
  assert.equal(has(checkMutation(value=>{value.berrymark='0.2'}),'BM_VERSION_UNSUPPORTED'),true)
  assert.equal(has(checkMutation(value=>{value.berrymark=0.1}),'BM_VERSION_UNSUPPORTED'),true)
})

test('missing required sections and Challenge fields are located errors',()=>{
  const missing=checkValue({berrymark:'0.1'})
  assert.equal(missing.ok,false)
  for(const path of ['challenge','publishing','scripture','editorial']){
    assert.ok(missing.diagnostics.some(d=>d.code==='BM_METADATA_REQUIRED'&&d.path===path))
  }
  const fields=checkMutation(value=>{value.challenge={title:'Only a title'}})
  for(const path of ['challenge.slug','challenge.type']){
    assert.ok(fields.diagnostics.some(d=>d.code==='BM_METADATA_REQUIRED'&&d.path===path))
  }
})

test('unsupported enums and mistyped booleans, arrays, and numbers are not coerced',()=>{
  const result=checkMutation(value=>{
    value.challenge.type='devotional'
    value.publishing.sequence='1'
    value.scripture.usageRightsConfirmed='false'
    value.companionLinks={}
  })
  assert.equal(result.ok,false)
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_ENUM'&&d.path==='challenge.type'))
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_TYPE'&&d.path==='publishing.sequence'))
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_TYPE'&&d.path==='scripture.usageRightsConfirmed'))
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_TYPE'&&d.path==='companionLinks'))
  assert.equal(result.document.metadata.publishing.sequence,'1')
  assert.equal(result.document.metadata.scripture.usageRightsConfirmed,'false')
})

test('YAML strings preserve colons, apostrophes, Unicode, and multiline text',()=>{
  const result=checkMutation(value=>{
    value.challenge.title='Rejoice: God’s goodness 🌿'
    value.challenge.summary='First: a colon and an apostrophe \' remain.\nSecond line: Ω and 中文.'
  })
  assert.equal(result.ok,true,JSON.stringify(result.diagnostics))
  assert.equal(result.document.metadata.challenge.title,'Rejoice: God’s goodness 🌿')
  assert.equal(result.document.metadata.challenge.summary,"First: a colon and an apostrophe ' remain.\nSecond line: Ω and 中文.")
})

test('explicit null and absent optional values remain distinct and unresolved',()=>{
  const explicit=checkMutation(value=>{
    value.publishing={series:null,sequence:null,releaseAt:null}
    value.companionLinks=[{provider:'other',label:'Editorial only',url:null}]
  })
  assert.equal(explicit.ok,true,JSON.stringify(explicit.diagnostics))
  assert.equal(explicit.document.metadata.publishing.releaseAt,null)
  assert.equal(explicit.document.metadata.companionLinks[0].url,null)
  assert.equal(explicit.document.metadata.editorial.approvedBy,null)
  assert.equal(explicit.document.metadata.editorial.approvedAt,null)
  assert.equal(explicit.diagnostics.filter(d=>d.code==='BM_PUBLISHING_UNRESOLVED').length,3)

  const absent=checkMutation(value=>{
    delete value.publishing.releaseAt
    delete value.editorial.approvedBy
    delete value.editorial.approvedAt
    value.companionLinks=[{provider:'other',label:'Editorial only'}]
  })
  assert.equal(absent.ok,true,JSON.stringify(absent.diagnostics))
  assert.equal(Object.hasOwn(absent.document.metadata.publishing,'releaseAt'),false)
  assert.equal(Object.hasOwn(absent.document.metadata.editorial,'approvedBy'),false)
  assert.equal(Object.hasOwn(absent.document.metadata.editorial,'approvedAt'),false)
  assert.equal(Object.hasOwn(absent.document.metadata.companionLinks[0],'url'),false)
})

test('sequence accepts only positive safe integers or null',()=>{
  for(const sequence of [0,-1,1.5,'2',true,Number.MAX_SAFE_INTEGER+1]){
    const result=checkMutation(value=>{value.publishing.sequence=sequence})
    assert.equal(result.ok,false,String(sequence))
    assert.ok(result.diagnostics.some(d=>['BM_METADATA_TYPE','BM_METADATA_SEQUENCE'].includes(d.code)&&d.path==='publishing.sequence'))
  }
  assert.equal(checkMutation(value=>{value.publishing.sequence=2}).ok,true)
})

test('releaseAt requires a real timezone-aware datetime and accepts explicit offsets',()=>{
  for(const releaseAt of ['2026-11-03','2026-11-03T12:00:00','2026-02-30T12:00:00Z','not-a-date']){
    const result=checkMutation(value=>{value.publishing.releaseAt=releaseAt})
    assert.equal(has(result,'BM_METADATA_DATETIME'),true,releaseAt)
  }
  const valid=checkMutation(value=>{value.publishing.releaseAt='2026-11-03T18:30:45.123+05:30'})
  assert.equal(valid.ok,true,JSON.stringify(valid.diagnostics))
  assert.equal(valid.document.metadata.publishing.releaseAt,'2026-11-03T18:30:45.123+05:30')
})

test('semantic metadata diagnostics include original source line and metadata path',()=>{
  const result=checkMutation(value=>{value.publishing.sequence=0})
  const diagnostic=result.diagnostics.find(d=>d.code==='BM_METADATA_SEQUENCE')
  const yaml=stringify({...validMetadata(),publishing:{...validMetadata().publishing,sequence:0}})
  const expectedLine=yaml.split('\n').findIndex(line=>line.includes('sequence:'))+2
  assert.equal(diagnostic.line,expectedLine)
  assert.equal(diagnostic.column,3)
  assert.equal(diagnostic.path,'publishing.sequence')
})

test('front matter and blocks share Scripture status, passage, rights, and practice rules',()=>{
  const prohibited=checkMutation(value=>{
    value.scripture.textStatus='referenceOnly'
    value.scripture.passage='Jesus wept.'
  })
  assert.equal(has(prohibited,'BM_SCRIPTURE_RIGHTS'),true)

  const missingPassage=checkMutation(value=>{
    value.scripture.textStatus='provided'
    value.scripture.usageRightsConfirmed=true
  })
  assert.equal(has(missingPassage,'BM_SCRIPTURE_PASSAGE'),true)

  const missingRights=checkMutation(value=>{
    value.scripture.textStatus='provided'
    value.scripture.passage='Rights-safe synthetic text'
    value.scripture.usageRightsConfirmed=false
  })
  assert.equal(has(missingRights,'BM_SCRIPTURE_RIGHTS'),true)

  const unsafePractice=checkMutation(value=>{
    value.scripture.practiceStatus='configured'
  })
  assert.equal(has(unsafePractice,'BM_SCRIPTURE_PRACTICE'),true)

  const configured=checkMutation(value=>{
    value.scripture.textStatus='provided'
    value.scripture.passage='Rights-safe synthetic text'
    value.scripture.usageRightsConfirmed=true
    value.scripture.practiceStatus='configured'
  })
  assert.equal(configured.ok,true,JSON.stringify(configured.diagnostics))
  assert.equal(has(configured,'BM_SCRIPTURE_RIGHTS_ASSERTION'),true)
})

test('editorial pending stays pending and contradictory approvals fail',()=>{
  const pending=checkValue(validMetadata())
  assert.equal(pending.ok,true)
  assert.equal(pending.document.metadata.editorial.approvalStatus,'pending')
  assert.equal(has(pending,'BM_EDITORIAL_PENDING'),true)

  const contradictory=checkMutation(value=>{
    value.editorial.approvedBy='Synthetic Reviewer'
    value.editorial.approvedAt='2026-11-03T12:00:00Z'
  })
  assert.equal(contradictory.diagnostics.filter(d=>d.code==='BM_EDITORIAL_CONTRADICTION').length,2)

  const incomplete=checkMutation(value=>{value.editorial.approvalStatus='approved'})
  assert.equal(incomplete.diagnostics.filter(d=>d.code==='BM_EDITORIAL_CONTRADICTION').length,2)

  const approved=checkMutation(value=>{
    value.editorial.approvalStatus='approved'
    value.editorial.approvedBy='Synthetic Reviewer'
    value.editorial.approvedAt='2026-11-03T12:00:00Z'
  })
  assert.equal(approved.ok,true,JSON.stringify(approved.diagnostics))
})

test('companion links allow absent or null URLs but reject non-HTTP schemes',()=>{
  for(const link of [
    {provider:'other',label:'No URL'},
    {provider:'social',label:'Null URL',url:null}
  ]){
    const result=checkMutation(value=>{value.companionLinks=[link]})
    assert.equal(result.ok,true,JSON.stringify(result.diagnostics))
  }
  for(const url of ['javascript:alert(1)','file:///tmp/private','ftp://example.com/file','/relative']){
    const result=checkMutation(value=>{value.companionLinks=[{provider:'other',label:'Bad URL',url}]})
    assert.equal(has(result,'BM_METADATA_URL'),true,url)
  }
  const https=checkMutation(value=>{value.companionLinks=[{provider:'youtube',label:'Video',url:'https://example.com/watch'}]})
  assert.equal(https.ok,true,JSON.stringify(https.diagnostics))
})

test('unknown and misspelled recognized metadata paths are not silently dropped',()=>{
  const result=checkMutation(value=>{
    value.challenge.ttle='Misspelled'
    value.publishing.releasedAt='2026-11-03T12:00:00Z'
  })
  assert.equal(result.ok,false)
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_UNKNOWN_FIELD'&&d.path==='challenge.ttle'))
  assert.ok(result.diagnostics.some(d=>d.code==='BM_METADATA_UNKNOWN_FIELD'&&d.path==='publishing.releasedAt'))
  assert.equal(result.document.metadata.challenge.ttle,'Misspelled')
})

test('CLI returns nonzero for YAML errors and machine-readable JSON diagnostics',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'berrymark-cli-'))
  const filename=join(directory,'invalid.berry.md')
  await writeFile(filename,wrap('berrymark: "0.1"\nchallenge: [unterminated'),'utf8')
  const cli=new URL('../src/cli.js',import.meta.url).pathname
  const checked=spawnSync(process.execPath,[cli,'check',filename],{encoding:'utf8'})
  assert.equal(checked.status,1)
  assert.match(checked.stdout,/ERROR BM_YAML_SYNTAX/)
  assert.match(checked.stdout,/invalid\.berry\.md:3:25/)

  const json=spawnSync(process.execPath,[cli,'json',filename],{encoding:'utf8'})
  assert.equal(json.status,1)
  const result=JSON.parse(json.stdout)
  assert.equal(result.ok,false)
  assert.equal(result.document.metadata,null)
  assert.ok(result.summary.errors>0)
  assert.ok(result.diagnostics.every(d=>d.filename===filename&&Number.isInteger(d.line)&&Number.isInteger(d.column)))
})

test('CLI JSON retains editorial TODOs without turning them into blocking errors',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'berrymark-editorial-'))
  const filename=join(directory,'todo.berry.md')
  await writeFile(filename,wrap(stringify(validMetadata())).replace('BM-TEST prose.','<!-- TODO: Confirm synthetic copy. -->\nBM-TEST prose.'),'utf8')
  const cli=new URL('../src/cli.js',import.meta.url).pathname
  const run=spawnSync(process.execPath,[cli,'json',filename],{encoding:'utf8'})
  assert.equal(run.status,0,run.stderr)
  const result=JSON.parse(run.stdout)
  assert.equal(result.ok,true)
  assert.equal(result.summary.editorial,1)
  assert.equal(result.diagnostics.find(d=>d.code==='BM_EDITORIAL_TODO').severity,'editorial')
  assert.match(result.document.annotations[0].text,/TODO: Confirm synthetic copy/)
})

test('validation performs no network or Sanity calls',async()=>{
  const source=await readFile(new URL('../examples/rejoice-always/rejoice-always.berry.md',import.meta.url),'utf8')
  const originalFetch=globalThis.fetch
  globalThis.fetch=()=>{throw new Error('Network access is forbidden during validation')}
  try{
    const result=parseBerryMark(source,{filename:'offline.berry.md'})
    assert.equal(result.ok,true,JSON.stringify(result.diagnostics))
    assert.equal(result.document.screens.length,7)
  }finally{
    globalThis.fetch=originalFetch
  }
})
