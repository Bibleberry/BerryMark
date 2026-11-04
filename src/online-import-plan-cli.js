#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { compileBerryMark } from './compiler.js'
import { planBerryMarkImport } from './import-planner.js'
import { resolveBerryMarkOnlineImport } from './online-import-planner.js'
import { lookupSanityImportState } from './sanity-readonly-transport.js'
import { SANITY_READ_TOKEN_ENV } from './sanity-target.js'

const args = process.argv.slice(2)
if (args.length !== 1) {
  console.error('Usage: node src/online-import-plan-cli.js <source.berry.md>')
  process.exitCode = 2
} else {
  const sourcePath = args[0]
  try {
    const source = await readFile(sourcePath, 'utf8')
    const schemaSnapshot = JSON.parse(await readFile(new URL('../test/bibleberry-schema-v0.1.snapshot.json', import.meta.url), 'utf8'))
    const compilation = compileBerryMark(source, { filename: sourcePath })
    const offlineReport = planBerryMarkImport({ compilation, source, schemaSnapshot })
    if (offlineReport.proposedAction === 'reject' || !offlineReport.sourceVerification.verified || !offlineReport.importEligible) {
      offlineReport.lookup = { ...offlineReport.lookup, status: 'not-run' }
      offlineReport.onlineResolution = { state: 'offline-prerequisite-failed' }
      console.log(JSON.stringify(offlineReport, null, 2))
      process.exitCode = 1
    } else {
      const lookupResults = await lookupSanityImportState({
        ...offlineReport.proposedIdentity,
        seriesSlug: compilation.reviewReport.pendingLookups.find(item => item.type === 'challengeSeriesSlug')?.slug ?? null,
        sequence: compilation.sanityCandidate.sequence ?? null,
        token: process.env[SANITY_READ_TOKEN_ENV]
      })
      const report = resolveBerryMarkOnlineImport({ offlineReport, lookupResults })
      console.log(JSON.stringify(report, null, 2))
      if (report.proposedAction === 'reject') process.exitCode = 1
      else if (report.lookup.status === 'failed') process.exitCode = 3
    }
  } catch {
    console.error('Cannot read or verify the online planner input')
    process.exitCode = 2
  }
}
