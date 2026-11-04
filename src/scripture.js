/**
 * Shared, pure Scripture consistency rules for Challenge metadata, CB2,
 * and nested CB8 SCRIPTURE sections. A rights flag remains an assertion;
 * this module does not verify licenses or contact external services.
 */
export function validateScriptureConsistency(value, report) {
  const {
    textStatus,
    passage,
    passagePresent = typeof passage === 'string' && passage.trim().length > 0,
    usageRightsConfirmed,
    practiceStatus
  } = value

  if (textStatus === 'referenceOnly' && passagePresent) {
    report('BM_SCRIPTURE_RIGHTS', 'referenceOnly Scripture cannot contain Passage text', 'passage')
  }

  if (textStatus === 'provided') {
    if (typeof passage !== 'string' || passage.trim().length === 0) {
      report('BM_SCRIPTURE_PASSAGE', 'provided Scripture requires Passage', 'passage')
    }
    if (usageRightsConfirmed !== true) {
      report('BM_SCRIPTURE_RIGHTS', 'provided Scripture requires confirmed quotation rights', 'usageRightsConfirmed')
    }
  }

  if (practiceStatus === 'configured' && (
    textStatus !== 'provided' ||
    typeof passage !== 'string' || passage.trim().length === 0 ||
    usageRightsConfirmed !== true
  )) {
    report('BM_SCRIPTURE_PRACTICE', 'configured practice requires rights-confirmed provided passage', 'practiceStatus')
  }
}

export function blockScriptureValue(fields) {
  const rights = fields['Usage Rights Confirmed']
  return {
    textStatus: fields['Text Status'],
    passage: fields.Passage,
    passagePresent: Object.hasOwn(fields, 'Passage'),
    usageRightsConfirmed: rights === 'true' ? true : rights === 'false' ? false : rights,
    practiceStatus: fields['Practice Status']
  }
}
