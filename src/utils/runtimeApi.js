const DEFAULT_API_BASE = 'http://127.0.0.1:18788'

export const runtimeApiBase = (import.meta.env.VITE_RADAR_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, '')

export function runtimeEventsWebSocketUrl(token = '') {
  const url = new URL(runtimeApiBase)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/events'
  url.search = token ? `?token=${encodeURIComponent(token)}` : ''
  return url.toString()
}

async function request(path, { method = 'GET', token = '', body, timeoutMs = 3500 } = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${runtimeApiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (token && (response.status === 401 || response.status === 403)) {
        window.dispatchEvent(new CustomEvent('radar-auth-invalid', { detail: { status: response.status } }))
      }
      const error = new Error(payload?.error?.message || payload?.error?.code || `HTTP ${response.status}`)
      error.status = response.status
      error.code = payload?.error?.code || ''
      error.payload = payload
      throw error
    }
    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error('后端响应超时，请确认本机后端服务仍在运行。')
      timeoutError.code = 'REQUEST_TIMEOUT'
      throw timeoutError
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function createCompetitionSession() {
  return request('/api/auth/competition-session', { method: 'POST', body: {}, timeoutMs: 5000 })
}

export function getLiveSessionStatus(token) {
  return request('/api/live/session/status?compact=1', { token, timeoutMs: 5000 })
}

export function getSystemStatus(token) {
  return request('/api/system/status', { token, timeoutMs: 5000 })
}

export function startLiveSession(token, { confirmHardwareStart = false, durationS = 120 } = {}) {
  return request('/api/live/session/start', {
    method: 'POST',
    token,
    body: { confirmHardwareStart, durationS },
    timeoutMs: 10000
  })
}

export function stopLiveSession(token) {
  return request('/api/live/session/stop', { method: 'POST', token, body: {}, timeoutMs: 15000 })
}

export function resetLiveSessionTarget(token) {
  return request('/api/live/session/reset-target', { method: 'POST', token, body: {}, timeoutMs: 5000 })
}

export function getPersonnel(token) {
  return request('/api/personnel', { token, timeoutMs: 3500 })
}

export function getDepartments(token) {
  return request('/api/departments', { token, timeoutMs: 3500 })
}

export function createDepartment(token, name) {
  return request('/api/departments', { method: 'POST', token, body: { name }, timeoutMs: 5000 })
}

export function createPersonnel(token, record) {
  return request('/api/personnel', { method: 'POST', token, body: record, timeoutMs: 5000 })
}

export function updatePersonnel(token, personnelId, record) {
  return request(`/api/personnel/${encodeURIComponent(personnelId)}`, {
    method: 'PATCH', token, body: record, timeoutMs: 5000
  })
}

export function deletePersonnel(token, personnelId) {
  return request(`/api/personnel/${encodeURIComponent(personnelId)}`, {
    method: 'DELETE', token, timeoutMs: 5000
  })
}

export function getRuntimeEvents(type, token = '', limit = 200) {
  const query = type
    ? `?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`
    : `?limit=${encodeURIComponent(limit)}`
  return request(`/api/events${query}`, { token, timeoutMs: 3500 })
}

export function getRuntimeAuditLogs(token, { page = 1, pageSize = 100 } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return request(`/api/audit/logs?${query}`, { token, timeoutMs: 3500 })
}

export function startCaptureSession(token, {
  personnelId,
  durationS = 10,
  audibleCountdownS = 3,
  confirmHardwareStart = false,
  consentConfirmed = false
} = {}) {
  return request('/api/capture/session/start', {
    method: 'POST',
    token,
    body: { personnelId, durationS, audibleCountdownS, confirmHardwareStart, consentConfirmed },
    timeoutMs: 5000
  })
}

export function getCaptureSessionStatus(token) {
  return request('/api/capture/session/status', { token, timeoutMs: 3500 })
}

export function stopCaptureSession(token) {
  return request('/api/capture/session/stop', { method: 'POST', token, body: {}, timeoutMs: 15000 })
}

export function getCaptureCatalog(token, subjectIds = []) {
  const query = new URLSearchParams()
  for (const subjectId of Array.isArray(subjectIds) ? subjectIds : []) query.append('subjectIds', subjectId)
  return request(`/api/capture/catalog${query.toString() ? `?${query}` : ''}`, { token, timeoutMs: 5000 })
}

export function deleteCaptureRecord(token, captureId) {
  return request(`/api/capture/catalog/${encodeURIComponent(captureId)}`, {
    method: 'DELETE',
    token,
    timeoutMs: 8000
  })
}

export function previewCaptureRemoval(token, captureIds) {
  return request('/api/capture/catalog/batch-preview', {
    method: 'POST',
    token,
    body: { captureIds },
    timeoutMs: 5000
  })
}

export function removeCaptureBatch(token, captureIds) {
  return request('/api/capture/catalog/batch-remove', {
    method: 'POST',
    token,
    body: { captureIds, confirmed: true },
    timeoutMs: 15000
  })
}

export function getTrainingReadiness(token, { subjectIds = [], captureIds = [] } = {}) {
  const query = new URLSearchParams()
  for (const subjectId of Array.isArray(subjectIds) ? subjectIds : []) query.append('subjectIds', subjectId)
  for (const captureId of Array.isArray(captureIds) ? captureIds : []) query.append('captureIds', captureId)
  return request(`/api/training/readiness${query.toString() ? `?${query}` : ''}`, { token, timeoutMs: 6000 })
}

export function startTrainingSession(token, {
  subjectIds = [],
  captureIds = [],
  trainingMode = 'dynamic',
  maxEpochs = 20
} = {}) {
  return request('/api/training/session/start', {
    method: 'POST',
    token,
    body: { subjectIds, captureIds, trainingMode, maxEpochs },
    timeoutMs: 8000
  })
}

export function getTrainingSessionStatus(token) {
  return request('/api/training/session/status', { token, timeoutMs: 4000 })
}

export function getModelCandidateStatus(token, version) {
  return request(`/api/model/candidates/${encodeURIComponent(version)}`, { token, timeoutMs: 5000 })
}

export function activateModelCandidate(token, version) {
  return request(`/api/model/candidates/${encodeURIComponent(version)}/activate`, {
    method: 'POST',
    token,
    body: {},
    timeoutMs: 15000
  })
}

export function getModelVersions(token) {
  return request('/api/models/versions', { token, timeoutMs: 6000 })
}

export function setModelThreshold(token, version, threshold) {
  return request(`/api/models/versions/${encodeURIComponent(version)}/threshold`, {
    method: 'POST',
    token,
    body: { threshold },
    timeoutMs: 6000
  })
}

export function stopTrainingSession(token) {
  return request('/api/training/session/stop', { method: 'POST', token, body: {}, timeoutMs: 12000 })
}
