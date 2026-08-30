const LEVELS = Object.freeze({
  NO_DATA: '暂无数据',
  TRAIN_ONLY_UNVALIDATED: '仅训练，未验证',
  VALIDATION_AVAILABLE: '可验证，证据待补充',
  SESSION_SPLIT_COMPLETE: '会话分层完成'
})

export const readinessLabel = (level) => LEVELS[String(level || 'NO_DATA')] || LEVELS.NO_DATA

export function trainingCapabilities(readiness = {}) {
  const selectedCount = Array.isArray(readiness.selected_subject_ids)
    ? readiness.selected_subject_ids.length
    : Number(readiness.selectedSubjectCount || 0)
  const canTrain = readiness.training_allowed === true || readiness.trainingAllowed === true
  const canCheck = readiness.data_check_allowed === true || readiness.dataCheckAllowed === true
  const promotionFlag = readiness.promotion_allowed === true || readiness.promotionAllowed === true
  const test = readiness.test && typeof readiness.test === 'object' ? readiness.test : null
  const checks = readiness.checks && typeof readiness.checks === 'object' ? readiness.checks : {}
  const hasIndependentTestMetric = test !== null && Number.isFinite(Number(test.accuracy))
  const hasOpenSetEvidence = readiness.open_set_validated === true || checks.open_set_validated === true
  const canPromote = promotionFlag && hasIndependentTestMetric && hasOpenSetEvidence
  return {
    selectedCount,
    canTrain,
    canCheck,
    canPromote,
    testAccuracy: test && Number.isFinite(Number(test.accuracy)) ? Number(test.accuracy) : null,
    level: String(readiness.evidence_level || readiness.evidenceLevel || 'NO_DATA'),
    warnings: Array.isArray(readiness.warnings) ? readiness.warnings : []
  }
}

export { LEVELS }
