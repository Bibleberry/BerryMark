import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { parseBerryMark, formatStructuralPreview } from '../src/parser.js'

const validYaml=`berrymark: "0.1"
challenge:
  title: "Test Challenge"
  slug: test-challenge
  type: teaching
publishing:
  series: null
  sequence: null
  releaseAt: null
scripture:
  reference: "John 11:35"
  translation: NIV
  textStatus: referenceOnly
  usageRightsConfirmed: false
  practiceStatus: notConfigured
editorial:
  sourceTitle: "Test Challenge"
  sourceAuthor: "Test Author"
  approvalStatus: pending
  approvedBy: null
  approvedAt: null
companionLinks: []`
const wrap=(body,yaml=validYaml)=>'---\n'+yaml+'\n---\n'+body
const screen=(content,id='opening')=>'[[SCREEN id='+id+']]\nLabel: Encounter\n# Heading\n'+content+'\n[[/SCREEN]]'
const cb1=(prose='Hello world.')=>'[[CB1 id=teaching]]\n'+prose+'\n[[/CB1]]'
const check=source=>parseBerryMark(source,{filename:'test.berry.md'})
const has=(result,code)=>result.diagnostics.some(d=>d.code===code)
const success=body=>check(wrap(screen(body)))
const script=(id='reference')=>'[[SCRIPTURE id='+id+']]\nReference: John 11:35\nTranslation: NIV\nText Status: referenceOnly\nUsage Rights Confirmed: false\nPractice Status: notConfigured\n[[/SCRIPTURE]]'

test('hello-world fixture has ordered CB1 and CB3',async()=>{
  const src=await readFile(new URL('../examples/hello-world.berry.md',import.meta.url),'utf8')
  const r=check(src)
  assert.equal(r.ok,true)
  assert.equal(r.document.screens.length,1)
  assert.deepEqual(r.document.screens[0].blocks.map(b=>b.type),['CB1','CB3'])
  assert.equal(r.document.screens[0].blocks[1].fields.Text,'BM-TEST-CB3-HELLO')
  assert.equal(r.document.frontmatter.yamlValidated,true)
  assert.equal(r.document.metadata.challenge.slug,'berry-hello-world')
  assert.match(formatStructuralPreview(r),/CB3 id=hello-callout/)
})
test('CB1 Title: and Text: lines are literal prose',()=>{
  const r=success(cb1('Title: This is not metadata.\n\nText: Still prose.'))
  assert.equal(r.ok,true)
  assert.equal(r.document.screens[0].blocks[0].text,'Title: This is not metadata.\n\nText: Still prose.')
})
test('CB4 LEFT/RIGHT title headers and FOOTER preserve literal text',()=>{
  const b='[[CB4 id=contrast]]\n[[LEFT]]\nTitle: Joy\n\nTitle: This later line is prose.\n[[/LEFT]]\n[[RIGHT]]\nTitle: Rejoicing\n\nGod is good.\n[[/RIGHT]]\n[[FOOTER]]\nTitle: This is literal footer prose.\n[[/FOOTER]]\n[[/CB4]]'
  const r=success(b)
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics))
  assert.match(r.document.screens[0].blocks[0].left.body,/^Title: This later line/)
  assert.match(r.document.screens[0].blocks[0].footer,/^Title:/)
})
test('missing CB4 blank line errors without dropping the first body line',()=>{
  const b='[[CB4 id=contrast]]\n[[LEFT]]\nTitle: Joy\nActual body first line.\n[[/LEFT]]\n[[RIGHT]]\nTitle: Rejoicing\n\nGod is good.\n[[/RIGHT]]\n[[/CB4]]'
  const r=success(b)
  assert.equal(has(r,'BM_HEADER_SEPARATOR'),true)
  assert.match(r.document.screens[0].blocks[0].left.body,/Actual body first line/)
})
test('CB8 nested Scripture is structured, not prose',()=>{
  const b='[[CB8 id=study]]\nTitle: Hope\n\nThis teaching contains Title: as plain words.\n'+script()+'\n[[/CB8]]'
  const r=success(b)
  assert.equal(r.ok,true,JSON.stringify(r.diagnostics))
  const study=r.document.screens[0].blocks[0]
  assert.equal(study.scriptures.length,1)
  assert.equal(study.scriptures[0].fields.Reference,'John 11:35')
  assert.equal(study.body,'This teaching contains Title: as plain words.')
})
test('SCRIPTURE cannot be nested in CB1',()=>{
  const r=success('[[CB1 id=teaching]]\nText.\n'+script()+'\n[[/CB1]]')
  assert.equal(has(r,'BM_NESTING'),true)
})
test('field names are exact and case-sensitive',()=>{
  const r=success('[[CB3 id=statement]]\ntext: wrong casing\nUnexpected: x\n[[/CB3]]')
  assert.equal(has(r,'BM_FIELD_UNKNOWN'),true)
  assert.equal(has(r,'BM_FIELD_REQUIRED'),true)
})
test('duplicate field declarations are rejected',()=>{
  const r=success('[[CB3 id=statement]]\nText: First\nText: Second\n[[/CB3]]')
  assert.equal(has(r,'BM_FIELD_DUPLICATE'),true)
  assert.equal(r.document.screens[0].blocks[0].fields.Text,'First')
})
test('multiline plain-text scalar preserves indented literal field-like lines',()=>{
  const r=success('[[CB3 id=statement]]\nLabel: Note\nText: |\n  Text: literally written text.\n  More text.\n\n  Final line.\n[[/CB3]]')
  assert.equal(r.ok,true)
  assert.equal(r.document.screens[0].blocks[0].fields.Text,'Text: literally written text.\nMore text.\n\nFinal line.')
})
test('empty multiline text is an error',()=>{
  assert.equal(has(success('[[CB3 id=statement]]\nText: |\n[[/CB3]]'),'BM_MULTILINE_EMPTY'),true)
})
test('duplicate semantic IDs across blocks are rejected',()=>{
  const r=check(wrap(screen(cb1())+'\n'+screen('[[CB3 id=teaching]]\nText: Duplicate ID\n[[/CB3]]','another')))
  assert.equal(has(r,'BM_ID_DUPLICATE'),true)
})
test('unknown markers fail loudly',()=>{
  assert.equal(has(success('[[CB10 id=unknown]]\n[[/CB10]]'),'BM_MARKER_UNKNOWN'),true)
})
test('mismatched closing marker is detected',()=>{
  assert.equal(has(success('[[CB1 id=teaching]]\nText\n[[/CB2]]'),'BM_MARKER_MISMATCH'),true)
})
test('editorial comments containing markers are not parsed as blocks',()=>{
  const r=success('<!-- REVIEW REQUIRED: [[CB8 id=not-real]] -->\n'+cb1())
  assert.equal(r.ok,true)
  assert.equal(r.document.annotations.length,1)
  assert.equal(r.document.screens[0].blocks.length,1)
})
test('backslash-escaped marker line stays in freeform prose',()=>{
  const r=success(cb1('\\[[SCREEN id=literal]]'))
  assert.equal(r.ok,true)
  assert.equal(r.document.screens[0].blocks[0].text,'[[SCREEN id=literal]]')
})
test('reference-only Scripture cannot contain supplied passage',()=>{
  const r=success('[[CB2 id=scripture]]\nReference: John 11:35\nTranslation: NIV\nText Status: referenceOnly\nPassage: Jesus wept.\nPractice Status: configured\n[[/CB2]]')
  assert.equal(has(r,'BM_SCRIPTURE_RIGHTS'),true)
  assert.equal(has(r,'BM_SCRIPTURE_PRACTICE'),true)
})
test('provided Scripture requires passage and confirmed rights',()=>{
  const r=success('[[CB2 id=scripture]]\nReference: John 11:35\nTranslation: NIV\nText Status: provided\nPractice Status: configured\n[[/CB2]]')
  assert.equal(has(r,'BM_SCRIPTURE_RIGHTS'),true)
  assert.equal(has(r,'BM_SCRIPTURE_PASSAGE'),true)
})
test('CB6 requires two steps and return caption for cycle',()=>{
  const b='[[CB6 id=sequence]]\nCycle: true\n[[STEP id=first]]\nTitle: One\nBody: One.\n[[/STEP]]\n[[/CB6]]'
  const r=success(b)
  assert.equal(has(r,'BM_STEP_COUNT'),true)
  assert.equal(has(r,'BM_RETURN_CAPTION'),true)
})
test('CB7 forbids exactly one choice',()=>{
  const b='[[CB7 id=reflection]]\nQuestion: What now?\n[[CHOICE id=first]]\nLabel: First\nPrompt: Think.\n[[/CHOICE]]\n[[/CB7]]'
  assert.equal(has(success(b),'BM_CHOICE_COUNT'),true)
})
test('CB7 closing must follow choices when present',()=>{
  const b='[[CB7 id=reflection]]\nQuestion: What now?\nClosing: Too early.\n[[CHOICE id=first]]\nLabel: First\nPrompt: Think.\n[[/CHOICE]]\n[[CHOICE id=second]]\nLabel: Second\nPrompt: Reflect.\n[[/CHOICE]]\n[[/CB7]]'
  assert.equal(has(success(b),'BM_CHOICE_CLOSING'),true)
})
test('missing YAML frontmatter opening delimiter is rejected',()=>{
  assert.equal(has(check(screen(cb1())),'BM_FRONTMATTER_OPEN'),true)
})
test('malformed frontmatter YAML is rejected with a located diagnostic',()=>{
  const r=check(wrap(screen(cb1()),'this is not legal: : YAML'))
  const diagnostic=r.diagnostics.find(d=>d.code==='BM_YAML_SYNTAX')
  assert.equal(r.ok,false)
  assert.equal(r.mode,'experimental-read-only-validation')
  assert.equal(r.document.frontmatter.yamlValidated,false)
  assert.equal(r.document.metadata,null)
  assert.equal(diagnostic.filename,'test.berry.md')
  assert.equal(diagnostic.line,2)
  assert.ok(diagnostic.column>1)
  assert.ok(r.capabilities.checked.includes('safe YAML 1.2 syntax and core types'))
})
test('CLI uses nonzero exit code on a duplicate-ID fixture',()=>{
  const src=new URL('../examples/invalid-duplicate-ids.berry.md',import.meta.url).pathname
  const cli=new URL('../src/cli.js',import.meta.url).pathname
  const r=spawnSync(process.execPath,[cli,'check',src],{encoding:'utf8'})
  assert.equal(r.status,1)
  assert.match(r.stdout,/BM_ID_DUPLICATE/)
})
