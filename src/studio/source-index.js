const MARKER = /^\[\[(\/)?(SCREEN|CB[1-9]|LEFT|RIGHT|FOOTER|CARD|STEP|CHOICE|SCRIPTURE)(?: id=([a-z][a-z0-9]*(?:-[a-z0-9]+)*))?\]\]$/
const MARKER_LIKE = /^\[\[.*\]\]$/
const LITERAL_MARKER = /^\\\[\[.*\]\]$/
const NEED_ID = new Set(['SCREEN', 'CARD', 'STEP', 'CHOICE', 'SCRIPTURE'])
const NEWLINE = /\r\n|\n|\r/g

function childAllowed(parent, child) {
  if (!parent) return child === 'SCREEN'
  if (parent === 'SCREEN') return /^CB[1-9]$/.test(child)
  const kinds = {
    CB4: ['LEFT', 'RIGHT', 'FOOTER'],
    CB5: ['CARD'],
    CB6: ['STEP'],
    CB7: ['CHOICE'],
    CB8: ['SCRIPTURE']
  }
  return (kinds[parent] ?? []).includes(child)
}

function sourceLines(source) {
  const lines = []
  let offset = 0
  NEWLINE.lastIndex = 0
  while (offset < source.length) {
    NEWLINE.lastIndex = offset
    const match = NEWLINE.exec(source)
    const contentEnd = match ? match.index : source.length
    const end = match ? contentEnd + match[0].length : source.length
    lines.push({
      index: lines.length,
      start: offset,
      contentEnd,
      end,
      text: source.slice(offset, contentEnd),
      eol: match?.[0] ?? ''
    })
    offset = end
    if (!match) break
  }
  return lines
}

/**
 * Index only the concrete structure needed for safe source edits. Semantic
 * parsing and validation remain the responsibility of src/parser.js.
 */
export function indexBerryMarkSource(source, filename = '<memory>') {
  const lines = sourceLines(source)
  const diagnostics = []
  const report = (code, message, line = 1) => {
    diagnostics.push({ severity: 'error', code, message, filename, line, column: 1 })
  }
  const root = { kind: 'ROOT', id: null, parent: null, parts: [], children: [] }
  let frontmatter = null
  let bodyStart = 0

  const firstText = lines[0]?.text.replace(/^\uFEFF/, '')
  if (firstText !== '---') {
    report('BM_STUDIO_FRONTMATTER', 'Document must start with a YAML --- delimiter')
  } else {
    const close = lines.findIndex((line, index) => index > 0 && line.text === '---')
    if (close < 0) {
      report('BM_STUDIO_FRONTMATTER', 'Missing closing YAML --- delimiter')
      bodyStart = lines.length
    } else {
      frontmatter = {
        openLine: 0,
        closeLine: close,
        rawStart: lines[0].end,
        rawEnd: lines[close].start,
        raw: source.slice(lines[0].end, lines[close].start)
      }
      bodyStart = close + 1
    }
  }

  const stack = []
  const nodesById = new Map()
  let comment = null

  for (let index = bodyStart; index < lines.length; index++) {
    const line = lines[index]
    const text = index === 0 ? line.text.replace(/^\uFEFF/, '') : line.text
    const parent = stack.at(-1) ?? root
    const addLine = (extra = {}) => parent.parts.push({ kind: 'line', line: index, ...extra })

    if (comment) {
      addLine({ comment: true })
      if (text.includes('-->')) comment = null
      continue
    }
    if (text.startsWith('<!--')) {
      addLine({ comment: true })
      if (!text.includes('-->')) comment = { line: index + 1 }
      continue
    }
    if (LITERAL_MARKER.test(text)) {
      addLine({ literalMarker: true })
      continue
    }

    const match = text.match(MARKER)
    if (match) {
      const closing = Boolean(match[1])
      const kind = match[2]
      const id = match[3] ?? null
      if (closing) {
        const active = stack.pop()
        if (!active || active.kind !== kind) {
          report('BM_STUDIO_MARKER', `Unexpected closing ${kind}; expected ${active?.kind ?? 'none'}`, index + 1)
        } else {
          active.closeLine = index
          active.end = line.end
        }
      } else {
        if (!childAllowed(parent.kind === 'ROOT' ? null : parent.kind, kind)) {
          report('BM_STUDIO_MARKER', `${kind} is not valid inside ${parent.kind}`, index + 1)
        }
        if ((NEED_ID.has(kind) || /^CB[1-9]$/.test(kind)) && !id) {
          report('BM_STUDIO_ID', `${kind} requires an id for safe editing`, index + 1)
        }
        if (['LEFT', 'RIGHT', 'FOOTER'].includes(kind) && id) {
          report('BM_STUDIO_ID', `${kind} does not accept an ID`, index + 1)
        }
        if (id) {
          if (nodesById.has(id)) report('BM_STUDIO_ID', `Duplicate semantic ID "${id}"`, index + 1)
          else nodesById.set(id, null)
        }
        const node = {
          kind,
          id,
          parent,
          openLine: index,
          closeLine: null,
          start: line.start,
          end: null,
          parts: [],
          children: []
        }
        if (id && nodesById.get(id) === null) nodesById.set(id, node)
        parent.parts.push({ kind: 'node', node, line: index })
        parent.children.push(node)
        stack.push(node)
      }
      continue
    }

    if (MARKER_LIKE.test(text)) {
      report('BM_STUDIO_MARKER', `Unknown or malformed marker: ${text}`, index + 1)
      addLine({ unsupported: true })
      continue
    }
    if (!stack.length && text.trim()) {
      report('BM_STUDIO_TEXT', 'Non-comment text must be inside SCREEN / CB', index + 1)
    }
    addLine()
  }

  if (comment) report('BM_STUDIO_COMMENT', 'Unclosed HTML editorial comment', comment.line)
  for (const node of stack) report('BM_STUDIO_MARKER', `Unclosed ${node.kind} marker`, node.openLine + 1)

  return {
    source,
    filename,
    lines,
    root,
    screens: root.children.filter(node => node.kind === 'SCREEN'),
    nodesById,
    frontmatter,
    diagnostics,
    eol: lines.find(line => line.eol)?.eol ?? '\n',
    editableStructure: diagnostics.length === 0
  }
}

export function nodeSource(index, node) {
  if (!node || node.end === null) return null
  return index.source.slice(node.start, node.end)
}

export function lineForNode(index, node) {
  return node.openLine + 1
}
