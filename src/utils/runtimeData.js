const LIVE_SOURCE_MODES = new Set(['live'])
const DECISION_EVENT_TYPES = new Set(['identity_candidate', 'identity_resolved', 'decision_status', 'access_event', 'alarm_event'])
const ALLOW_STATES = new Set(['ALLOW', 'ALLOWED', 'AUTHORIZED', 'KNOWN_CONFIRMED', 'PASS'])
const DENY_STATES = new Set([
  'ALARM',
  'DENIED',
  'DENY',
  'UNKNOWN',
  'REJECTED',
  'REVIEW',
  'REVIEW_REQUIRED',
  'MANUAL_REVIEW'
])
const MAX_EVENTS = 200
const LIVE_SESSION_TERMINAL_STATES = new Set(['FAILED', 'STOPPED'])
const CANONICAL_PERSONNEL_ID_PATTERN = /^ID([1-9][0-9]{0,4})$/
const LEGACY_PERSONNEL_ID_PATTERN = /^LOCAL_ID([1-9][0-9]{0,4})$/

const asText = (value, fallback = '') => {
  const text = String(value ?? '').trim()
  return text || fallback
}

const asFiniteNumber = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const canonicalPersonnelId = (value) => {
  const text = asText(value)
  const match = CANONICAL_PERSONNEL_ID_PATTERN.exec(text) || LEGACY_PERSONNEL_ID_PATTERN.exec(text)
  return match ? `ID${match[1]}` : null
}

export const legacyPersonnelId = (value) => {
  const canonical = canonicalPersonnelId(value)
  return canonical ? `LOCAL_${canonical}` : null
}

const asProbability = (value, scoreType) => {
  if (String(scoreType || '').toUpperCase() !== 'PROBABILITY') return null
  const score = asFiniteNumber(value)
  return score !== null && score >= 0 && score <= 1 ? score : null
}

const dateOnly = (value) => {
  const text = asText(value)
  if (!text) return '--'
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : text
}

export const isLiveEvent = (event) => LIVE_SOURCE_MODES.has(String(event?.source_mode || '').toLowerCase())

export const eventPayload = (event) => (event?.payload && typeof event.payload === 'object' ? event.payload : {})

export async function waitForLiveSessionReady(initialStatus, getStatus, {
  maxAttempts = 240,
  intervalMs = 250,
  delay = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
} = {}) {
  let status = initialStatus
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const state = String(status?.state || '').toUpperCase()
    const runtime = status?.runtime && typeof status.runtime === 'object' ? status.runtime : {}
    if (
      state === 'RUNNING'
      && String(runtime.source_mode || '').toLowerCase() === 'live'
      && runtime.live_listener_ready === true
    ) return status
    if (LIVE_SESSION_TERMINAL_STATES.has(state)) {
      throw new Error(String(status?.error || `live session ${state.toLowerCase()}`))
    }
    if (attempt === maxAttempts) throw new Error('live session did not reach RUNNING')
    await delay(intervalMs)
    status = await getStatus()
  }
  throw new Error('live session did not reach RUNNING')
}

export const runtimeEventKey = (event) => {
  if (!event || typeof event !== 'object') return ''
  if (event.event_type === 'system_status') return event.event_id ? `event:${event.event_id}` : ''
  const payload = eventPayload(event)
  const context = [
    event.event_type,
    payload.session_id || '',
    payload.record_id || '',
    payload.window_id || payload.source_window_id || '',
    payload.sequence ?? ''
  ].join('|')
  if (context !== `${event.event_type}||||`) return `context:${context}`
  return event.event_id ? `event:${event.event_id}` : ''
}

export function normalizePersonnel(record, groups = []) {
  const source = record && typeof record === 'object' ? record : {}
  const groupId = asText(source.groupId || source.accessGroupId, groups[0]?.id || '')
  const status = String(source.status || '').toUpperCase()
  const enrollmentStatus = String(source.gaitEnrollmentStatus || '').toLowerCase()
  const enrollment = enrollmentStatus === 'enrolled' || source.gaitEnrollmentStatus === 'READY'
    ? 'READY'
    : 'INCOMPLETE'
  const mappedStatus = status === 'SUSPENDED' || status === 'SUSPENDED'.toLowerCase()
    ? 'SUSPENDED'
    : 'ACTIVE'
  const name = asText(source.name, source.id || '未命名人员')
  const canonicalId = canonicalPersonnelId(source.id)
  const displayId = canonicalId || (asText(source.id).startsWith('LOCAL_') ? '' : asText(source.id))
  return {
    ...source,
    id: displayId,
    legacyId: legacyPersonnelId(canonicalId),
    name,
    nameEn: asText(source.nameEn, name),
    department: asText(source.department, '未填写'),
    role: asText(source.role, source.department || '实验室人员'),
    status: mappedStatus,
    enrollment,
    groupId,
    createdTime: dateOnly(source.createdAt || source.created_at),
    captures: Number.isFinite(Number(source.captureCount)) ? Number(source.captureCount) : 0,
    validCaptureCount: Number.isFinite(Number(source.validCaptureCount)) ? Number(source.validCaptureCount) : 0,
    totalAttemptCount: Number.isFinite(Number(source.totalAttemptCount)) ? Number(source.totalAttemptCount) : 0,
    latestCaptureStatus: asText(source.latestCaptureStatus),
    nextCaptureId: asText(source.nextCaptureId),
    captureIds: Array.isArray(source.captureIds) ? source.captureIds.map(String) : [],
    optionalTargetCaptureCount: source.optionalTargetCaptureCount == null ? null : Number(source.optionalTargetCaptureCount),
    trainingEligibleCaptureCount: Number.isFinite(Number(source.trainingEligibleCaptureCount))
      ? Number(source.trainingEligibleCaptureCount)
      : 0
  }
}

function personnelIndex(personnel = []) {
  const byId = new Map()
  const byName = new Map()
  for (const person of Array.isArray(personnel) ? personnel : []) {
    if (!person) continue
    if (person.id) byId.set(String(person.id), person)
    const legacyId = legacyPersonnelId(person.id)
    if (legacyId) byId.set(legacyId, person)
    if (person.name) byName.set(String(person.name), person)
    if (person.nameEn) byName.set(String(person.nameEn).toLowerCase(), person)
  }
  return { byId, byName }
}

function candidateIdentity(payload, personnel) {
  const { byId, byName } = personnelIndex(personnel)
  const rawIdentityId = asText(
    payload.identity_id || payload.personnel_id || payload.personnelId || payload.candidate_id
  )
  const identityId = canonicalPersonnelId(rawIdentityId) || rawIdentityId
  const label = asText(
    payload.candidate_label || payload.candidateLabel || payload.label || payload.identity
  )
  return byId.get(identityId)
    || byName.get(label)
    || byName.get(label.toLowerCase())
    || null
}

function contextKey(event) {
  const payload = eventPayload(event)
  const session = asText(payload.session_id)
  const cycle = asText(payload.recognition_cycle_id)
  const record = asText(payload.record_id)
  const window = asText(payload.window_id || payload.source_window_id)
  const sequence = payload.sequence === undefined ? '' : String(payload.sequence)
  if (event?.event_type === 'identity_resolved' && (session || cycle)) {
    return ['identity_resolved', session, cycle].join('|')
  }
  return [session, record, window, sequence].join('|')
}

function eventTimestamp(event) {
  const payload = eventPayload(event)
  const value = asFiniteNumber(event?.timestamp_s ?? payload.timestamp_s ?? payload.end_timestamp_s)
  if (value !== null) return value * (value > 100000000000 ? 0.001 : 1)
  const parsed = Date.parse(String(event?.timestamp || ''))
  return Number.isFinite(parsed) ? parsed / 1000 : 0
}

export const isEventFromLiveRun = (event, startedAt = 0) => {
  const rawEvent = event?.rawEvent && typeof event.rawEvent === 'object' ? event.rawEvent : event
  if (!isLiveEvent(rawEvent)) return false
  const lowerBound = asFiniteNumber(startedAt)
  return lowerBound === null || eventTimestamp(rawEvent) + 0.001 >= lowerBound
}

export const formatRuntimeTime = (eventOrTime) => {
  const value = typeof eventOrTime === 'object' ? eventTimestamp(eventOrTime) : eventOrTime
  const date = new Date(Number(value) * 1000)
  if (!Number.isFinite(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

export function adaptRuntimeEvent(event, personnel = [], groups = []) {
  if (!isLiveEvent(event) || !DECISION_EVENT_TYPES.has(event?.event_type) || !isDisplayEvent(event)) return null
  const payload = eventPayload(event)
  const isIdentityCandidate = event.event_type === 'identity_candidate'
  const isIdentityResolved = event.event_type === 'identity_resolved'
  const rawStatus = asText(
    payload.status || payload.decision || payload.access_result || payload.result
  ).toUpperCase()
  const person = candidateIdentity(payload, personnel)
  const explicitPassed = payload.passed === true || payload.recognition_passed === true
  const explicitRejected = payload.passed === false || payload.recognition_passed === false
  const explicitAllow = isIdentityResolved
    ? !explicitRejected && Boolean(person) && (explicitPassed || String(payload.identity_decision || '').toUpperCase() === 'KNOWN' || rawStatus === 'KNOWN_CONFIRMED')
    : ALLOW_STATES.has(rawStatus) && payload.access_eligible !== false
  const recognitionPassed = !explicitRejected && explicitAllow
  const displayPerson = explicitRejected ? null : person
  const identityDecision = displayPerson && explicitAllow ? 'KNOWN' : 'UNKNOWN'
  const accessResult = explicitAllow ? 'AUTHORIZED' : 'DENIED'
  const score = asProbability(payload.score ?? payload.match_score, payload.score_type)
  const group = displayPerson && groups.find((item) => item.id === displayPerson.groupId)
  const sensorId = asText(payload.sensor_id || payload.sensorId, 'RD-01')
  const zone = asText(payload.zone, 'P3 核心区')
  return {
    id: displayPerson?.id || (explicitRejected ? '' : canonicalPersonnelId(payload.identity_id || payload.personnel_id || payload.candidate_id)) || asText(event.event_id, runtimeEventKey(event)),
    eventId: asText(event.event_id),
    time: formatRuntimeTime(event),
    type: 'Recognition',
    identityId: displayPerson?.id || null,
    identity: displayPerson?.name || 'Unknown',
    name: displayPerson?.name || '未知人员',
    nameEn: displayPerson?.nameEn || displayPerson?.name || 'UNKNOWN',
    department: displayPerson?.department || '--',
    role: displayPerson?.department || '--',
    pinyin: displayPerson?.nameEn || displayPerson?.name || 'UNKNOWN',
    identityDecision,
    recognitionPassed,
    zone,
    sensorId,
    sensor: sensorId,
    accessGroup: displayPerson?.groupId || null,
    accessGroupName: group?.name || '',
    access: group?.name || '—',
    accessResult,
    result: accessResult,
    status: accessResult,
    denyReason: explicitAllow ? null : asText(payload.reason || payload.deny_reason, rawStatus || 'REVIEW_REQUIRED'),
    matchScore: score,
    confidence: score === null ? null : Math.round(score * 100),
    threshold: asProbability(payload.threshold, 'PROBABILITY'),
    mode: asText(payload.mode, isIdentityCandidate || isIdentityResolved ? 'CLOSED-SET' : 'OPEN-SET'),
    sourceMode: 'live',
    sessionId: asText(payload.session_id),
    recordId: asText(payload.record_id),
    windowId: asText(payload.window_id || payload.source_window_id),
    sequence: payload.sequence ?? null,
    rawEvent: event
  }
}

const eventPriority = (event) => {
  if (event?.event_type === 'identity_resolved') return 5
  if (event?.event_type === 'identity_candidate') return 0
  if (event?.event_type === 'access_event' || event?.event_type === 'alarm_event') return 3
  if (event?.event_type === 'decision_status') return 2
  return 1
}

export function mergeRuntimeEvents(restEvents = [], websocketEvents = [], personnel = [], groups = [], { maxEvents = MAX_EVENTS } = {}) {
  const candidates = [...(Array.isArray(restEvents) ? restEvents : []), ...(Array.isArray(websocketEvents) ? websocketEvents : [])]
    .filter(isLiveEvent)
    .filter((event) => DECISION_EVENT_TYPES.has(event?.event_type))
    .filter(isDisplayEvent)
  const byContext = new Map()
  for (const event of candidates) {
    const key = contextKey(event) || runtimeEventKey(event)
    if (!key) continue
    const previous = byContext.get(key)
    const priority = eventPriority(event)
    const previousPriority = previous ? eventPriority(previous) : -1
    if (
      !previous
      || priority > previousPriority
      || (priority === previousPriority && eventTimestamp(event) >= eventTimestamp(previous))
    ) {
      byContext.set(key, event)
    }
  }
  const mergedEvents = [...byContext.values()]
    .sort((left, right) => eventTimestamp(right) - eventTimestamp(left))
    .map((event) => adaptRuntimeEvent(event, personnel, groups))
    .filter(Boolean)
  return maxEvents === null ? mergedEvents : mergedEvents.slice(0, maxEvents)
}

export function findLatestLiveEvent(events = []) {
  return Array.isArray(events) && events.length ? events[0] : null
}

function findLatestPreviewForRun(previews = [], startedAt = 0, eventType, {
  sessionId = '',
  recognitionCycleId = '',
  windowId = ''
} = {}) {
  if (!Array.isArray(previews)) return null
  for (let index = previews.length - 1; index >= 0; index -= 1) {
    const preview = previews[index]
    const payload = eventPayload(preview)
    const matchesSession = !sessionId || asText(payload.session_id) === asText(sessionId)
    const matchesCycle = !recognitionCycleId || asText(payload.recognition_cycle_id) === asText(recognitionCycleId)
    const matchesWindow = !windowId || asText(payload.window_id || payload.source_window_id) === asText(windowId)
    if (
      preview?.event_type === eventType
      && isEventFromLiveRun(preview, startedAt)
      && matchesSession
      && matchesCycle
      && matchesWindow
    ) {
      return preview
    }
  }
  return null
}

export function findLatestLivePreviewForRun(previews = [], startedAt = 0, options = {}) {
  return findLatestPreviewForRun(previews, startedAt, 'micro_doppler_preview', options)
}

export function findLatestLiveStreamPreviewForRun(previews = [], startedAt = 0, options = {}) {
  return findLatestPreviewForRun(previews, startedAt, 'micro_doppler_stream_preview', options)
}

function isDisplayEvent(event) {
  if (!event || event.event_type === 'identity_candidate') return false
  if (event.event_type === 'identity_resolved') return true
  if (event.event_type === 'access_event' || event.event_type === 'alarm_event') return true
  if (event.event_type !== 'decision_status') return false
  const payload = eventPayload(event)
  const status = asText(payload.status || payload.decision || payload.access_result || payload.result).toUpperCase()
  return ALLOW_STATES.has(status) && payload.access_eligible !== false
}

export const isFiniteProbability = (value) => asProbability(value, 'PROBABILITY') !== null

export const eventStatusSets = Object.freeze({
  allow: ALLOW_STATES,
  deny: DENY_STATES
})
