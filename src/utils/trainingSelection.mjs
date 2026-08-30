const idOf = (record) => String(record?.capture_id || record?.captureId || '').trim()
const subjectOf = (record) => String(record?.subject_id || record?.subjectId || '').trim()

const ordered = (values) => [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))]
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

export function isValidTrainingCapture(record) {
  const evidenceComplete = record?.evidence_complete === true
    || record?.evidenceComplete === true
  return String(record?.state || '').toUpperCase() === 'COMPLETED'
    && String(record?.quality_status || record?.qualityStatus || '').toUpperCase() === 'PASS'
    && evidenceComplete
    && Boolean(idOf(record))
}

export function getValidCaptureIds(records, subjectIds = []) {
  const subjects = new Set(ordered(subjectIds))
  return ordered((Array.isArray(records) ? records : [])
    .filter((record) => subjects.has(subjectOf(record)) && isValidTrainingCapture(record))
    .map(idOf))
}

export function getCaptureSelectionState(selectedIds = [], availableIds = []) {
  const available = new Set(ordered(availableIds))
  const selected = new Set(ordered(selectedIds.filter((id) => available.has(String(id)))))
  if (selected.size === 0) return 'none'
  if (available.size > 0 && selected.size === available.size) return 'all'
  return 'partial'
}

export function reconcileCaptureSelection(records, subjectIds = [], selectedIds = []) {
  // A subject change starts a new explicit selection: all currently valid
  // records are checked, while failed/incomplete records never enter it.
  return getValidCaptureIds(records, subjectIds)
}

export function toggleCaptureSelection(selectedIds = [], captureId) {
  const id = String(captureId || '').trim()
  if (!id) return ordered(selectedIds)
  const current = new Set(ordered(selectedIds))
  if (current.has(id)) current.delete(id)
  else current.add(id)
  return ordered([...current])
}
