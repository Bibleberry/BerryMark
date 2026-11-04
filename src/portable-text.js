import { lexer } from 'marked'
import { DeterministicKeyer } from './keys.js'

const SUPPORTED_BLOCKS = new Set(['paragraph', 'text', 'heading', 'blockquote', 'list', 'space'])
const SUPPORTED_INLINE = new Set(['text', 'escape', 'strong', 'em', 'link', 'br'])

class MarkdownLocation {
  constructor(source, baseLine) {
    this.source = source
    this.baseLine = baseLine
    this.cursor = 0
  }

  locate(raw = '', advance = false) {
    let offset = this.source.indexOf(raw, this.cursor)
    if (offset < 0) offset = Math.min(this.cursor, this.source.length)
    const before = this.source.slice(0, offset)
    const lines = before.split('\n')
    const location = { line: this.baseLine + lines.length - 1, column: lines.at(-1).length + 1 }
    if (advance) this.cursor = offset + raw.length
    return location
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}

/**
 * Convert the approved BerryMark Markdown subset through marked's AST.
 * Unsupported constructs are reported, never stripped or approximated.
 */
export function markdownToPortableText(markdown, context, diagnostics) {
  const keyer = new DeterministicKeyer()
  const location = new MarkdownLocation(markdown, context.line)
  const report = (code, message, token, advance = false) => {
    diagnostics.push({
      severity: 'error',
      code,
      message,
      filename: context.filename,
      ...location.locate(token?.raw, advance),
      path: context.path,
      target: context.target
    })
  }
  const unsupported = (token, construct = token.type) => {
    report('BM_MARKDOWN_UNSUPPORTED', `Unsupported Markdown construct "${construct}" in ${context.target}`, token)
  }

  const inline = (tokens, inheritedMarks, markDefs) => {
    const spans = []
    const appendSpan = (text, marks, token) => {
      if (!text) return
      const uniqueMarks = [...new Set(marks)]
      const span = {
        _type: 'span',
        _key: keyer.next(context.target, 'span', { text, marks: uniqueMarks }),
        marks: uniqueMarks,
        text
      }
      spans.push(span)
      location.locate(token?.raw, true)
    }

    for (const token of tokens ?? []) {
      if (!SUPPORTED_INLINE.has(token.type)) {
        unsupported(token)
        continue
      }
      if (token.type === 'text') {
        if (token.tokens) spans.push(...inline(token.tokens, inheritedMarks, markDefs))
        else appendSpan(token.text, inheritedMarks, token)
      } else if (token.type === 'escape') {
        appendSpan(token.text, inheritedMarks, token)
      } else if (token.type === 'strong' || token.type === 'em') {
        location.locate(token.raw)
        spans.push(...inline(token.tokens, [...inheritedMarks, token.type === 'strong' ? 'strong' : 'em'], markDefs))
      } else if (token.type === 'link') {
        location.locate(token.raw)
        if (!isHttpUrl(token.href)) {
          report('BM_MARKDOWN_LINK', `Markdown link must use an absolute HTTP(S) URL; received "${token.href}"`, token)
          continue
        }
        if (token.title) {
          unsupported(token, 'link title')
          continue
        }
        const annotationKey = keyer.next(context.target, 'link', { href: token.href })
        markDefs.push({ _type: 'link', _key: annotationKey, href: token.href })
        spans.push(...inline(token.tokens, [...inheritedMarks, annotationKey], markDefs))
      } else if (token.type === 'br') {
        appendSpan('\n', inheritedMarks, token)
      }
    }
    return spans
  }

  const makeBlock = (token, options = {}) => {
    const markDefs = []
    const children = inline(token.tokens, [], markDefs)
    const content = {
      _type: 'block',
      children,
      markDefs,
      style: options.style ?? 'normal',
      ...(options.listItem ? { listItem: options.listItem, level: options.level ?? 1 } : {})
    }
    return { ...content, _key: keyer.next(context.target, 'block', content) }
  }

  const convertList = token => {
    if (token.ordered && token.start !== '' && Number(token.start) !== 1) {
      unsupported(token, 'ordered list with a non-1 start')
      return []
    }
    const blocks = []
    for (const item of token.items) {
      if (item.task) {
        unsupported(item, 'task list item')
        continue
      }
      if (item.tokens.length !== 1 || !['text', 'paragraph'].includes(item.tokens[0].type)) {
        unsupported(item, 'nested or multi-block list item')
        continue
      }
      location.locate(item.raw)
      blocks.push(makeBlock(item.tokens[0], {
        listItem: token.ordered ? 'number' : 'bullet',
        level: 1
      }))
    }
    return blocks
  }

  const blocks = []
  let tokens
  try {
    tokens = lexer(markdown, { gfm: true, breaks: false })
  } catch (error) {
    report('BM_MARKDOWN_PARSE', `Markdown parsing failed: ${error.message}`)
    return blocks
  }

  for (const token of tokens) {
    if (!SUPPORTED_BLOCKS.has(token.type)) {
      unsupported(token)
      continue
    }
    if (token.type === 'space') continue
    if (token.type === 'paragraph' || token.type === 'text') {
      location.locate(token.raw)
      blocks.push(makeBlock(token))
    } else if (token.type === 'heading') {
      location.locate(token.raw)
      if (![2, 3].includes(token.depth)) {
        unsupported(token, `heading level ${token.depth}`)
        continue
      }
      blocks.push(makeBlock(token, { style: `h${token.depth}` }))
    } else if (token.type === 'blockquote') {
      location.locate(token.raw)
      for (const child of token.tokens) {
        if (!['paragraph', 'text'].includes(child.type)) {
          unsupported(child, `blockquote ${child.type}`)
          continue
        }
        blocks.push(makeBlock(child, { style: 'blockquote' }))
      }
    } else if (token.type === 'list') {
      location.locate(token.raw)
      blocks.push(...convertList(token))
    }
  }

  if (!blocks.length && !diagnostics.some(item => item.severity === 'error' && item.target === context.target)) {
    report('BM_MARKDOWN_EMPTY', `Rich-text body ${context.target} produced no Portable Text blocks`)
  }
  return blocks
}
