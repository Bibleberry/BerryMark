export const SEMANTIC_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

const FIELD_SCHEMAS = {
  CB2: ['Reference', 'Translation', 'Text Status', 'Passage', 'Usage Rights Confirmed', 'Practice Status'],
  SCRIPTURE: ['Reference', 'Translation', 'Text Status', 'Passage', 'Usage Rights Confirmed', 'Practice Status'],
  CB3: ['Text', 'Label'],
  CARD: ['Title', 'Body'],
  STEP: ['Title', 'Body'],
  CHOICE: ['Label', 'Prompt'],
  CB6_PRE: ['Cycle', 'Return Caption'],
  CB6_POST: ['Conclusion'],
  CB7_PRE: ['Question'],
  CB7_POST: ['Closing']
}

export class StudioSerializationError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'StudioSerializationError'
    this.code = code
  }
}

export function allowedFields(kind, phase) {
  return FIELD_SCHEMAS[phase ? `${kind}_${phase}` : kind] ?? null
}

export function fieldPhase(kind, field) {
  if (kind === 'CB6') return field === 'Conclusion' ? 'POST' : 'PRE'
  if (kind === 'CB7') return field === 'Closing' ? 'POST' : 'PRE'
  return null
}

export function assertFieldAllowed(kind, field) {
  const phase = fieldPhase(kind, field)
  const allowed = allowedFields(kind, phase)
  if (!allowed?.includes(field)) {
    throw new StudioSerializationError('BM_STUDIO_FIELD_UNSUPPORTED', `${field} is not a supported field in ${kind}${phase ? ` ${phase.toLowerCase()}` : ''}`)
  }
}

function normalizeNewlines(value) {
  return value.replace(/\r\n?/g, '\n')
}

export function escapeLiteralMarkers(value, eol = '\n') {
  const normalized = normalizeNewlines(value)
  const escaped = normalized.replace(/^\[\[.*\]\]$/gm, '\\$&')
  return escaped.replace(/\n/g, eol)
}

export function serializeBody(value, eol = '\n') {
  if (typeof value !== 'string') {
    throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', 'Body text must be a string')
  }
  const escaped = escapeLiteralMarkers(value, eol)
  return escaped.endsWith(eol) ? escaped : `${escaped}${eol}`
}

export function serializeField(name, value, eol = '\n') {
  if (typeof value === 'boolean') value = value ? 'true' : 'false'
  if (typeof value !== 'string') {
    throw new StudioSerializationError('BM_STUDIO_VALUE_TYPE', `${name} must be a string or Boolean where the language permits one`)
  }
  value = normalizeNewlines(value)
  if (value.endsWith('\n')) {
    throw new StudioSerializationError('BM_STUDIO_VALUE_UNSUPPORTED', `${name} cannot end with a newline because the existing multiline field grammar trims trailing blank lines`)
  }
  if (value.includes('\n') || /^\s|\s$/.test(value)) {
    const continuation = value.split('\n').map(line => line ? `  ${line}` : '').join(eol)
    return `${name}: |${eol}${continuation}${eol}`
  }
  return `${name}:${value ? ` ${value}` : ''}${eol}`
}

export function serializeFields(fields = {}, kind, phase, eol = '\n') {
  let output = ''
  for (const [name, value] of Object.entries(fields)) {
    assertFieldAllowed(kind, name)
    if (phase && fieldPhase(kind, name) !== phase) continue
    if (value === null || value === undefined) continue
    output += serializeField(name, value, eol)
  }
  return output
}

function marker(kind, id, eol, closing = false) {
  if (closing) return `[[/${kind}]]${eol}`
  if (id !== null && id !== undefined && !SEMANTIC_ID.test(id)) {
    throw new StudioSerializationError('BM_STUDIO_ID_INVALID', `Invalid semantic ID "${id}"`)
  }
  return `[[${kind}${id ? ` id=${id}` : ''}]]${eol}`
}

function headerBody(spec, eol) {
  let output = ''
  if (spec.title !== null && spec.title !== undefined) output += serializeField('Title', spec.title, eol)
  output += eol
  if (spec.body !== null && spec.body !== undefined) output += serializeBody(spec.body, eol)
  return output
}

function nestedFields(spec) {
  return spec.fields ?? Object.fromEntries([
    'Reference', 'Translation', 'Text Status', 'Passage', 'Usage Rights Confirmed', 'Practice Status',
    'Title', 'Body', 'Label', 'Prompt', 'Text'
  ].filter(name => Object.hasOwn(spec, name)).map(name => [name, spec[name]]))
}

export function serializeNested(spec, eol = '\n') {
  const kind = spec.type ?? spec.kind
  const id = spec.id ?? null
  let output = marker(kind, id, eol)
  if (['LEFT', 'RIGHT'].includes(kind)) {
    output += headerBody(spec, eol)
  } else if (kind === 'FOOTER') {
    output += serializeBody(spec.text ?? spec.body ?? '', eol)
  } else if (['CARD', 'STEP', 'CHOICE', 'SCRIPTURE'].includes(kind)) {
    output += serializeFields(nestedFields(spec), kind, null, eol)
  } else {
    throw new StudioSerializationError('BM_STUDIO_NESTED_UNSUPPORTED', `Unsupported nested element "${kind}"`)
  }
  output += marker(kind, null, eol, true)
  return output
}

export function serializeBlock(spec, eol = '\n') {
  const type = spec.type
  if (!/^CB[1-9]$/.test(type ?? '')) {
    throw new StudioSerializationError('BM_STUDIO_BLOCK_UNSUPPORTED', `Unsupported Content Block "${type}"`)
  }
  const id = spec.id ?? null
  let output = marker(type, id, eol)
  if (type === 'CB1' || type === 'CB9') {
    output += serializeBody(spec.text ?? spec.body ?? '', eol)
  } else if (type === 'CB2' || type === 'CB3') {
    output += serializeFields(spec.fields ?? nestedFields(spec), type, null, eol)
  } else if (type === 'CB4') {
    if (spec.left) output += serializeNested({ ...spec.left, type: 'LEFT' }, eol)
    if (spec.right) output += serializeNested({ ...spec.right, type: 'RIGHT' }, eol)
    if (spec.footer !== null && spec.footer !== undefined) {
      output += serializeNested({ type: 'FOOTER', text: typeof spec.footer === 'string' ? spec.footer : spec.footer.text }, eol)
    }
  } else if (type === 'CB5') {
    for (const card of spec.cards ?? []) output += serializeNested({ ...card, type: 'CARD' }, eol)
  } else if (type === 'CB6') {
    output += serializeFields(spec.fields, type, 'PRE', eol)
    for (const step of spec.steps ?? []) output += serializeNested({ ...step, type: 'STEP' }, eol)
    output += serializeFields(spec.fields, type, 'POST', eol)
  } else if (type === 'CB7') {
    output += serializeFields(spec.fields, type, 'PRE', eol)
    for (const choice of spec.choices ?? []) output += serializeNested({ ...choice, type: 'CHOICE' }, eol)
    output += serializeFields(spec.fields, type, 'POST', eol)
  } else if (type === 'CB8') {
    output += headerBody(spec, eol)
    for (const scripture of spec.scriptures ?? []) output += serializeNested({ ...scripture, type: 'SCRIPTURE' }, eol)
  }
  output += marker(type, null, eol, true)
  return output
}

export function serializeScreen(spec, eol = '\n') {
  const id = spec.id ?? null
  let output = marker('SCREEN', id, eol)
  if (spec.label !== null && spec.label !== undefined) output += `Label: ${spec.label}${eol}`
  if (spec.heading !== null && spec.heading !== undefined) output += `# ${spec.heading}${eol}`
  if ((spec.label || spec.heading) && (spec.blocks?.length ?? 0) > 0) output += eol
  for (const block of spec.blocks ?? []) output += serializeBlock(block, eol)
  output += marker('SCREEN', null, eol, true)
  return output
}

export function semanticId(hint, usedIds, fallbackPrefix = 'item') {
  if (typeof hint !== 'string' || !hint.trim()) {
    throw new StudioSerializationError('BM_STUDIO_ID_HINT_REQUIRED', 'Supply an exact id or a meaningful idHint/title/text value for identifier generation')
  }
  let base = hint.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (/^\d/.test(base)) base = `${fallbackPrefix}-${base}`
  if (!base || !SEMANTIC_ID.test(base)) {
    throw new StudioSerializationError('BM_STUDIO_ID_HINT_INVALID', `The hint "${hint}" cannot form an ASCII BerryMark semantic ID; supply id explicitly`)
  }
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`
  return candidate
}

export function idHint(spec, fallbackPrefix) {
  return spec.idHint ?? spec.title ?? spec.label ?? spec.heading ??
    spec.fields?.Title ?? spec.fields?.Question ?? spec.fields?.Text ??
    spec.text ?? spec.body ?? fallbackPrefix
}
