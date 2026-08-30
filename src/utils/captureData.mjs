const finite = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const ACTIVE_CAPTURE_STATES = new Set(['PREFLIGHT', 'COUNTDOWN', 'CAPTURING', 'QUALITY_CHECK', 'STOPPING'])

const captureIdOf = (status = {}) => String(status.capture_id || status.result?.capture_id || '')

export function captureStatusDisposition(status = {}, expectedCaptureId = '') {
  if (!expectedCaptureId || captureIdOf(status) !== String(expectedCaptureId)) return 'ignore'
  const state = String(status.state || status.phase || '').toUpperCase()
  if (ACTIVE_CAPTURE_STATES.has(state)) return 'active'
  if (state === 'COMPLETED' && String(status.result?.quality_status || status.quality_status || '').toUpperCase() === 'PASS') return 'done'
  if (state === 'FAILED' || state === 'STOPPED' || state === 'COMPLETED') return 'rejected'
  return 'ignore'
}

export function canAdoptCaptureSession(status = {}, subjectId = '') {
  const state = String(status.state || status.phase || '').toUpperCase()
  return Boolean(
    subjectId
      && captureIdOf(status)
      && String(status.subject_id || '') === String(subjectId)
      && ACTIVE_CAPTURE_STATES.has(state)
  )
}

export function captureProgress(status = {}) {
  const elapsed = Math.max(0, finite(status.elapsed_s ?? status.elapsedSeconds))
  const target = Math.max(0, finite(status.duration_s ?? status.target_duration_s, 10))
  return {
    elapsed,
    target,
    percent: target > 0 ? Math.min(100, Math.round((elapsed / target) * 1000) / 10) : 0
  }
}

export function capturePhaseLabel(phase = '') {
  return {
    PREFLIGHT: '预检',
    COUNTDOWN: '倒计时',
    CAPTURING: '采集中',
    STOPPING: '安全停止',
    QUALITY_CHECK: '质量检查',
    COMPLETED: '已完成',
    FAILED: '已拒绝',
    STOPPED: '已停止'
  }[String(phase).toUpperCase()] || '待机'
}

export function normalizeCaptureError(status = {}) {
  const result = status?.result && typeof status.result === 'object' ? status.result : {}
  const failureEvidence = result.failure_evidence && typeof result.failure_evidence === 'object'
    ? result.failure_evidence
    : status.failure_evidence && typeof status.failure_evidence === 'object' ? status.failure_evidence : {}
  const telemetry = result.telemetry && typeof result.telemetry === 'object'
    ? result.telemetry
    : failureEvidence.telemetry && typeof failureEvidence.telemetry === 'object' ? failureEvidence.telemetry : {}
  const code = String(result.error_code || status.error_code || 'CAPTURE_RUNTIME_ERROR')
  const message = String(
    result.operator_message
      || result.failure_reason
      || status.error
      || '采集未完成，系统已安全停止；本次未计入有效采集，请重试。'
  )
  return {
    code,
    message,
    countsAsValid: result.counts_as_valid_capture === true && String(result.quality_status || '').toUpperCase() === 'PASS',
    captureId: result.capture_id || status.capture_id || '',
    phase: capturePhaseLabel(status.phase || status.state),
    telemetry,
    failureEvidence,
    preflight: telemetry.preflight || result.preflight || status.preflight || null
  }
}

export function captureStartFailureMessage(error = {}) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').trim()
  if (message.includes('already running')) return '当前已有采集正在进行，请等待它结束后再开始下一组。'
  if (/live recognition/i.test(message)) return '实时识别正在占用雷达链路，请先停止实时识别后再采集。'
  if (/training session/i.test(message)) return '模型训练正在占用本机资源，请等待训练结束后再采集。'
  if (/hardware config is missing/i.test(message)) return '硬件配置文件缺失，采集会话未建立。'
  if (message === 'Failed to fetch') return '后端不可达，请确认本机后端服务正在运行。'
  if (code === 'REQUEST_TIMEOUT') return '后端响应超时，请确认本机后端服务和采集进程状态。'
  return message || '采集会话未能建立；后端未返回具体原因。'
}

export function captureStatusTone(status = {}) {
  const phase = String(status.phase || status.state || '').toUpperCase()
  if (phase === 'COMPLETED' && String(status.result?.quality_status || '').toUpperCase() === 'PASS') return 'success'
  if (phase === 'FAILED' || phase === 'STOPPED') return 'danger'
  if (phase === 'CAPTURING' || phase === 'COUNTDOWN' || phase === 'QUALITY_CHECK') return 'active'
  return 'neutral'
}
