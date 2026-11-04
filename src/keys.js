import { createHash } from 'node:crypto'

export function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  return `{${Object.keys(value).sort().map(key => (
    `${JSON.stringify(key)}:${stableStringify(value[key])}`
  )).join(',')}}`
}

export function generatedKey(parentIdentity, kind, content, occurrence = 1) {
  const identity = `${parentIdentity}\0${kind}\0${stableStringify(content)}\0${occurrence}`
  return `bm${sha256(identity).slice(0, 24)}`
}

/**
 * Deterministically disambiguates repeated identical nodes without using
 * array position. Only the Nth identical canonical node receives a suffix
 * input; distinct sibling nodes retain their keys when reordered.
 */
export class DeterministicKeyer {
  #occurrences = new Map()
  #used = new Set()

  next(parentIdentity, kind, content) {
    const base = `${parentIdentity}\0${kind}\0${stableStringify(content)}`
    let occurrence = (this.#occurrences.get(base) ?? 0) + 1
    let key = generatedKey(parentIdentity, kind, content, occurrence)
    while (this.#used.has(key)) {
      occurrence += 1
      key = generatedKey(parentIdentity, kind, content, occurrence)
    }
    this.#occurrences.set(base, occurrence)
    this.#used.add(key)
    return key
  }
}
