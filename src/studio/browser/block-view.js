const BLOCK_NAMES = {
  CB1: 'Teaching Text',
  CB2: 'Scripture',
  CB3: 'Key Statement',
  CB4: 'Comparison',
  CB5: 'Visual Cards',
  CB6: 'Connected Sequence',
  CB7: 'Reflection',
  CB8: 'Deeper Study',
  CB9: 'Prayer'
}

function element(tag, { className, text, dataset } = {}) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined && text !== null) node.textContent = String(text)
  for (const [key, value] of Object.entries(dataset ?? {})) node.dataset[key] = value
  return node
}

function textBlock(text, className = 'preserved-text') {
  return element('p', { className, text: text || 'Not supplied' })
}

function fieldList(fields = {}) {
  const list = element('dl', { className: 'field-list' })
  const entries = Object.entries(fields)
  if (!entries.length) {
    list.append(element('dt', { text: 'Fields' }), element('dd', { text: 'None supplied' }))
    return list
  }
  for (const [name, value] of entries) {
    list.append(element('dt', { text: name }))
    list.append(element('dd', { text: value === null || value === undefined || value === '' ? 'Not supplied' : value }))
  }
  return list
}

function section(label, title, body) {
  const wrapper = element('section', { className: 'block-section' })
  wrapper.append(element('span', { className: 'nested-label', text: label }))
  if (title !== undefined) wrapper.append(element('h3', { text: title || 'Untitled' }))
  if (body !== undefined) wrapper.append(textBlock(body))
  return wrapper
}

function nestedCollection(label, items, fields = true) {
  const wrapper = element('div', { className: 'block-section' })
  wrapper.append(element('span', { className: 'nested-label', text: `${label} · ${items.length}` }))
  if (!items.length) wrapper.append(element('p', { text: `No ${label.toLowerCase()} supplied.` }))
  items.forEach((item, index) => {
    const nested = element('section', { className: 'nested-item' })
    nested.append(element('h3', { text: `${index + 1}. ${item.fields?.Title || item.fields?.Label || item.fields?.Reference || item.id || label}` }))
    if (fields) nested.append(fieldList(item.fields))
    wrapper.append(nested)
  })
  return wrapper
}

function renderBody(block) {
  const body = element('div', { className: 'block-body' })
  switch (block.type) {
    case 'CB1':
      body.append(textBlock(block.text))
      break
    case 'CB2':
      body.append(fieldList(block.fields))
      break
    case 'CB3':
      body.append(fieldList(block.fields))
      break
    case 'CB4':
      body.append(
        section('Left', block.left?.title ?? 'Missing left side', block.left?.body ?? 'Not supplied'),
        section('Right', block.right?.title ?? 'Missing right side', block.right?.body ?? 'Not supplied'),
        section('Footer', undefined, block.footer ?? 'Not supplied')
      )
      break
    case 'CB5':
      body.append(nestedCollection('Visual cards', block.cards ?? []))
      break
    case 'CB6':
      body.append(fieldList(block.fields), nestedCollection('Ordered steps', block.steps ?? []))
      break
    case 'CB7':
      body.append(fieldList(block.fields), nestedCollection('Reflection choices', block.choices ?? []))
      break
    case 'CB8':
      body.append(section('Study', block.title, block.body), nestedCollection('Scripture references', block.scriptures ?? []))
      break
    case 'CB9':
      for (const paragraph of block.paragraphs ?? [block.text]) body.append(textBlock(paragraph))
      break
    default:
      body.append(textBlock('This block has no specialized summary. Its complete interpreted structure is shown below.'))
  }
  return body
}

export function renderBlocks(container, screen) {
  container.replaceChildren()
  for (const block of screen?.blocks ?? []) {
    const article = element('article', {
      className: 'content-block',
      dataset: { blockType: block.type, blockId: block.id ?? '' }
    })
    const heading = element('div', { className: 'block-heading' })
    heading.append(
      element('h2', { text: BLOCK_NAMES[block.type] ?? 'Unsupported Content Block' }),
      element('span', { className: 'block-code', text: block.type ?? 'Unknown' })
    )
    article.append(heading, element('p', { className: 'block-id', text: `Semantic ID · ${block.id ?? 'missing'}` }), renderBody(block))

    const details = element('details', { className: 'technical-details' })
    details.append(element('summary', { text: 'Complete interpreted structure' }))
    const technical = Object.fromEntries(Object.entries(block).filter(([key]) => !['line', 'endLine'].includes(key)))
    details.append(element('pre', { text: JSON.stringify(technical, null, 2) }))
    article.append(details)
    container.append(article)
  }
}

export function blockDisplayName(type) {
  return BLOCK_NAMES[type] ?? type
}
