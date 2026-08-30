import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../context/StoreContext'
import {
  activateModelCandidate,
  getTrainingReadiness,
  getModelCandidateStatus,
  getModelVersions,
  getTrainingSessionStatus,
  previewCaptureRemoval,
  setModelThreshold,
  startTrainingSession,
  stopTrainingSession
} from '../../utils/runtimeApi'
import { readinessLabel, trainingCapabilities } from '../../utils/trainingData.mjs'
import {
  getCaptureSelectionState,
  getValidCaptureIds,
  isValidTrainingCapture,
  reconcileCaptureSelection,
  toggleCaptureSelection
} from '../../utils/trainingSelection.mjs'

const BUSY_STATES = new Set(['PREPARING_DATA', 'GENERATING_SAMPLES', 'TRAINING', 'VALIDATING', 'EXPORTING_ONNX', 'MODEL_CHECK', 'STOPPING'])

const captureSubjectId = (record) => String(record?.subject_id || record?.subjectId || '').trim()
const captureId = (record) => String(record?.capture_id || record?.captureId || '').trim()
const formatModelTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value || '—') : date.toLocaleString('zh-CN')
}

const TrainingReadinessPanel = () => {
  const navigate = useNavigate()
  const { session, identities, captureCatalog, removeCapture, removeCaptures, runtime } = useStore()
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [selectedCaptureIds, setSelectedCaptureIds] = useState([])
  const [selectedRemovalCaptureIds, setSelectedRemovalCaptureIds] = useState([])
  const [maxEpochs, setMaxEpochs] = useState('20')
  const [readiness, setReadiness] = useState(null)
  const [loading, setLoading] = useState(false)
  const [trainingStatus, setTrainingStatus] = useState(null)
  const [candidateStatus, setCandidateStatus] = useState(null)
  const [activationState, setActivationState] = useState('idle')
  const [modelCatalog, setModelCatalog] = useState({ models: [], current: null })
  const [modelLoading, setModelLoading] = useState(false)
  const [modelMessage, setModelMessage] = useState('')
  const [thresholdDrafts, setThresholdDrafts] = useState({})
  const [deletingCaptureId, setDeletingCaptureId] = useState('')
  const [batchRemovalState, setBatchRemovalState] = useState('idle')
  const [error, setError] = useState('')

  const people = useMemo(
    () => (Array.isArray(identities) ? identities : []).filter((person) => person?.id),
    [identities]
  )
  const selectedCaptureRecords = useMemo(() => {
    const selected = new Set(selectedSubjectIds)
    return (Array.isArray(captureCatalog?.records) ? captureCatalog.records : [])
      .filter((record) => selected.has(captureSubjectId(record)) && captureId(record))
      .sort((left, right) => captureId(left).localeCompare(captureId(right), undefined, { numeric: true }))
  }, [captureCatalog?.records, selectedSubjectIds])
  useEffect(() => {
    setSelectedCaptureIds((current) => reconcileCaptureSelection(
      captureCatalog?.records,
      selectedSubjectIds,
      current
    ))
  }, [captureCatalog?.records, selectedSubjectIds])

  useEffect(() => {
    if (!session?.token) return undefined
    let cancelled = false
    getTrainingSessionStatus(session.token)
      .then((result) => { if (!cancelled) setTrainingStatus(result) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session?.token])

  useEffect(() => {
    let cancelled = false
    if (!session?.token || selectedSubjectIds.length === 0) {
      setReadiness(null)
      setLoading(false)
      return undefined
    }
    setLoading(true)
    setError('')
    getTrainingReadiness(session.token, {
      subjectIds: selectedSubjectIds,
      captureIds: selectedCaptureIds
    })
      .then((result) => {
        if (!cancelled) setReadiness(result)
      })
      .catch((reason) => {
        if (!cancelled) {
          setReadiness(null)
          setError(reason?.message || String(reason))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [session?.token, selectedSubjectIds, selectedCaptureIds])

  useEffect(() => {
    if (!session?.token || !BUSY_STATES.has(String(trainingStatus?.state || '').toUpperCase())) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const current = await getTrainingSessionStatus(session.token)
        if (!cancelled) setTrainingStatus(current)
      } catch (reason) {
        if (!cancelled) setError(reason?.message || String(reason))
      }
    }
    const timer = window.setInterval(poll, 1200)
    poll()
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [session?.token, trainingStatus?.state])

  const availableCaptureIds = useMemo(
    () => getValidCaptureIds(captureCatalog?.records, selectedSubjectIds),
    [captureCatalog?.records, selectedSubjectIds]
  )
  const selectionState = getCaptureSelectionState(selectedCaptureIds, availableCaptureIds)
  const allServerCaptureRecords = useMemo(
    () => (Array.isArray(captureCatalog?.records) ? captureCatalog.records : [])
      .filter((record) => captureId(record))
      .sort((left, right) => captureId(left).localeCompare(captureId(right), undefined, { numeric: true })),
    [captureCatalog?.records]
  )
  const captureSummary = useMemo(() => {
    const summary = new Map(
      people.map((person) => [
        String(person.id),
        {
          subjectId: String(person.id),
          name: person.name || '未填写',
          total: 0,
          valid: 0
        }
      ])
    )
    allServerCaptureRecords.forEach((record) => {
      const subjectId = captureSubjectId(record)
      if (!subjectId) return
      const current = summary.get(subjectId) || {
        subjectId,
        name: '未关联人员',
        total: 0,
        valid: 0
      }
      current.total += 1
      if (isValidTrainingCapture(record)) current.valid += 1
      summary.set(subjectId, current)
    })
    return [...summary.values()].sort((left, right) => (
      left.subjectId.localeCompare(right.subjectId, undefined, { numeric: true })
    ))
  }, [allServerCaptureRecords, people])
  const invalidCaptureIds = useMemo(
    () => allServerCaptureRecords
      .filter((record) => !isValidTrainingCapture(record))
      .map(captureId),
    [allServerCaptureRecords]
  )
  const allInvalidSelected = invalidCaptureIds.length > 0
    && invalidCaptureIds.every((id) => selectedRemovalCaptureIds.includes(id))
  const candidateVersion = String(
    trainingStatus?.result?.version
      || trainingStatus?.result?.promotion_gate?.model_version
      || ''
  )

  useEffect(() => {
    if (!session?.token || !candidateVersion) {
      setCandidateStatus(null)
      return undefined
    }
    let cancelled = false
    getModelCandidateStatus(session.token, candidateVersion)
      .then((result) => { if (!cancelled) setCandidateStatus(result) })
      .catch(() => { if (!cancelled) setCandidateStatus(null) })
    return () => { cancelled = true }
  }, [session?.token, candidateVersion])

  const capability = trainingCapabilities(readiness || { selected_subject_ids: selectedSubjectIds })
  const busy = BUSY_STATES.has(String(trainingStatus?.state || '').toUpperCase())
  const runtimeState = String(runtime?.events?.system_status?.payload?.state || '').toUpperCase()
  const recognitionRunning = runtimeState && !new Set(['STOPPED', 'SOURCE_ENDED', 'ERROR']).has(runtimeState)
  const validMaxEpochs = /^(?:[1-9]|[1-9][0-9]|100)$/.test(maxEpochs)
  const activationBusy = activationState === 'loading' || activationState.startsWith('loading:')

  const loadModelCatalog = useCallback(async () => {
    if (!session?.token) return
    setModelLoading(true)
    try {
      const result = await getModelVersions(session.token)
      const models = Array.isArray(result?.models) ? result.models : []
      setModelCatalog({ models, current: result?.current || null })
      setThresholdDrafts((current) => Object.fromEntries(
        models.map((model) => [
          model.model_version,
          current[model.model_version] ?? String(model.threshold ?? 0.70)
        ])
      ))
    } catch (reason) {
      setError(reason?.message || String(reason))
    } finally {
      setModelLoading(false)
    }
  }, [session?.token])

  useEffect(() => {
    if (!busy) loadModelCatalog()
  }, [busy, loadModelCatalog])

  useEffect(() => {
    setSelectedRemovalCaptureIds((current) => current.filter((id) => (
      allServerCaptureRecords.some((record) => captureId(record) === id)
    )))
  }, [allServerCaptureRecords])

  const toggleSubject = (subjectId) => {
    setSelectedSubjectIds((current) => current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId].sort())
  }

  const toggleCapture = (id) => {
    setSelectedCaptureIds((current) => toggleCaptureSelection(current, id))
  }

  const toggleAllCaptures = () => {
    setSelectedCaptureIds(selectionState === 'all' ? [] : [...availableCaptureIds])
  }

  const toggleInvalidCaptures = () => {
    setSelectedRemovalCaptureIds(allInvalidSelected ? [] : invalidCaptureIds)
  }

  const toggleRemovalCapture = (id) => {
    setSelectedRemovalCaptureIds((current) => current.includes(id)
      ? current.filter((capture) => capture !== id)
      : [...current, id])
  }

  const handleStart = async () => {
    if (!session?.token || !capability.canTrain || busy || !validMaxEpochs) return
    setError('')
    try {
      const result = await startTrainingSession(session.token, {
        subjectIds: selectedSubjectIds,
        captureIds: selectedCaptureIds,
        trainingMode: 'dynamic',
        maxEpochs: Number(maxEpochs)
      })
      setTrainingStatus(result)
    } catch (reason) {
      setError(reason?.message || String(reason))
    }
  }

  const handleStop = async () => {
    if (!session?.token || !busy) return
    try {
      setTrainingStatus(await stopTrainingSession(session.token))
    } catch (reason) {
      setError(reason?.message || String(reason))
    }
  }

  const handleDeleteCapture = async (record) => {
    const id = captureId(record)
    if (!id || deletingCaptureId) return
    if (!window.confirm(`确认移除采集记录 ${id}？服务端将安全归档记录，原始 ADC 不会被改写。`)) return
    setDeletingCaptureId(id)
    setError('')
    try {
      await removeCapture(id)
      setSelectedCaptureIds((current) => current.filter((capture) => capture !== id))
      setSelectedRemovalCaptureIds((current) => current.filter((capture) => capture !== id))
    } catch (reason) {
      setError(reason?.message || String(reason))
    } finally {
      setDeletingCaptureId('')
    }
  }

  const handleBatchDelete = async () => {
    if (!session?.token || !selectedRemovalCaptureIds.length || busy || batchRemovalState === 'loading') return
    setBatchRemovalState('loading')
    setError('')
    try {
      const preview = await previewCaptureRemoval(session.token, selectedRemovalCaptureIds)
      const remaining = Object.entries(preview?.remaining_valid_capture_counts || {})
        .map(([subjectId, count]) => `${subjectId}：${count} 组`)
        .join('；')
      const confirmed = window.confirm(
        `即将移除 ${preview?.count ?? selectedRemovalCaptureIds.length} 条采集记录。\n` +
        `移除后每个人剩余的有效采集数量：${remaining || '无'}。\n确认继续？`
      )
      if (!confirmed) {
        setBatchRemovalState('idle')
        return
      }
      await removeCaptures(selectedRemovalCaptureIds)
      setSelectedRemovalCaptureIds([])
      setSelectedCaptureIds((current) => current.filter((id) => !selectedRemovalCaptureIds.includes(id)))
      setBatchRemovalState('success')
    } catch (reason) {
      setBatchRemovalState('error')
      setError(reason?.message || String(reason))
    }
  }

  const handleActivateCandidate = async () => {
    if (!session?.token || !candidateVersion || candidateStatus?.activation_ready !== true || busy || recognitionRunning || activationBusy) return
    setActivationState('loading')
    setError('')
    try {
      await activateModelCandidate(session.token, candidateVersion)
      setActivationState('success')
      await loadModelCatalog()
      setModelMessage(`模型 ${candidateVersion} 已应用。`)
    } catch (reason) {
      setActivationState('error')
      setError(reason?.message || String(reason))
    }
  }

  const handleActivateModel = async (model) => {
    const version = String(model?.model_version || '')
    if (!session?.token || !version || model?.can_apply !== true || model?.is_current || busy || recognitionRunning) return
    if (!window.confirm(`确认应用模型 ${version}？模型、标签映射和阈值将同时切换。`)) return
    setActivationState(`loading:${version}`)
    setError('')
    try {
      await activateModelCandidate(session.token, version)
      await loadModelCatalog()
      setActivationState(`success:${version}`)
      setModelMessage(`模型 ${version} 已应用。`)
    } catch (reason) {
      setActivationState(`error:${version}`)
      setError(reason?.message || String(reason))
    }
  }

  const handleThresholdSave = async (model) => {
    const version = String(model?.model_version || '')
    const value = Number(thresholdDrafts[version])
    if (!session?.token || !version || !Number.isFinite(value) || value < 0 || value > 1 || busy || recognitionRunning) return
    setError('')
    try {
      const result = await setModelThreshold(session.token, version, value)
      setModelCatalog((current) => ({
        ...current,
        models: current.models.map((item) => item.model_version === version
          ? { ...item, threshold: result.threshold }
          : item)
      }))
      setThresholdDrafts((current) => ({ ...current, [version]: String(result.threshold) }))
      setModelMessage(`模型 ${version} 的身份判定阈值已保存。`)
    } catch (reason) {
      setError(reason?.message || String(reason))
    }
  }

  const progressPercent = Math.min(100, Math.max(0, Number(trainingStatus?.progress_percent ?? 0) || 0))
  const heartbeatAge = trainingStatus?.last_heartbeat_at
    ? Math.max(0, (Date.now() / 1000) - Number(trainingStatus.last_heartbeat_at))
    : null
  const stalled = trainingStatus?.stalled === true || (busy && heartbeatAge != null && heartbeatAge > 30)

  return (
    <section className="border-t border-b border-divider py-6" data-testid="training-readiness-panel">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
        <div>
          <div className="text-[12px] font-mono font-medium text-secondary mb-2">05 / 训练数据就绪</div>
          <div className="text-[13px] text-secondary max-w-2xl">
            依据服务端人员档案、采集质量和 recording/session 划分生成可追溯训练候选；数量与标签由当前目录决定。
          </div>
        </div>
        <div className="text-[10px] font-mono text-secondary uppercase tracking-widest">DYNAMIC CLOSED-SET CANDIDATE</div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.1fr_1fr_0.9fr] gap-5">
        <div className="border border-divider bg-surface-primary p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">人员选择</div>
            <button
              type="button"
              className="text-[11px] font-mono text-brand hover:text-brand-dark disabled:opacity-40"
              disabled={!people.length}
              onClick={() => setSelectedSubjectIds(people.map((person) => person.id).sort())}
            >
              全选当前人员
            </button>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
            {people.length === 0 ? (
              <div className="text-[12px] text-secondary">服务端暂未返回人员档案。</div>
            ) : people.map((person) => (
              <label key={person.id} className="flex items-center gap-3 text-[13px] text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSubjectIds.includes(person.id)}
                  onChange={() => toggleSubject(person.id)}
                  className="accent-[#2F806E]"
                />
                <span className="font-medium">{person.name}</span>
                <span className="font-mono text-[11px] text-secondary">{person.id}</span>
                <span className="ml-auto font-mono text-[11px] text-secondary">{person.trainingEligibleCaptureCount ?? 0} 组可用</span>
              </label>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-divider text-[11px] font-mono text-secondary">
            已选人员：{selectedSubjectIds.length} · 已选采集 {selectedCaptureIds.length} 组 · 当前可用 {availableCaptureIds.length} 组
          </div>
        </div>

        <div className="border border-divider bg-surface-primary p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">采集记录筛选（可选）</div>
            <button
              type="button"
              aria-label={selectionState === 'all' ? '取消全选' : '全选当前有效采集'}
              onClick={toggleAllCaptures}
              disabled={!availableCaptureIds.length}
              className="min-h-8 px-2 border border-divider text-[11px] font-mono text-brand hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selectionState === 'all' ? '取消全选' : '全选当前有效采集'}
            </button>
          </div>
          <div className="text-[11px] font-mono text-secondary mb-3">
            已选采集 {selectedCaptureIds.length} 组 · 当前可用 {availableCaptureIds.length} 组 · {
              selectionState === 'all' ? '全选' : selectionState === 'partial' ? '部分选择' : '未选择'
            }
          </div>
          {selectedSubjectIds.length === 0 ? (
            <div className="text-[12px] text-secondary">先选择人员，再按采集编号缩小训练快照。</div>
          ) : selectedCaptureRecords.length === 0 ? (
            <div className="text-[12px] text-secondary">当前选择暂无采集记录。</div>
          ) : (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {selectedCaptureRecords.map((record) => {
                const id = captureId(record)
                const valid = isValidTrainingCapture(record)
                return (
                  <div key={id} className="flex items-center gap-2 text-[12px] text-primary">
                    <label className={`flex min-w-0 flex-1 items-center gap-3 ${valid ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                      <input type="checkbox" checked={selectedCaptureIds.includes(id)} onChange={() => toggleCapture(id)} disabled={!valid} className="accent-[#2F806E]" />
                      <span className="font-mono truncate">{id}</span>
                      <span className={`ml-auto text-[10px] ${valid ? 'text-[#2F806E]' : 'text-secondary'}`}>{valid ? '可用于训练' : '暂不可用'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteCapture(record)}
                      disabled={busy || deletingCaptureId === id}
                      className="shrink-0 border border-divider px-2 py-1 text-[10px] text-secondary hover:border-[#B65B5B] hover:text-[#B65B5B] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`移除采集记录 ${id}`}
                    >
                      {deletingCaptureId === id ? '移除中…' : '移除'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="border border-divider bg-surface-secondary p-4">
          <div className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-3">就绪层级</div>
          <div className="text-[22px] font-medium text-primary mb-1">{readiness ? readinessLabel(capability.level) : '等待选择'}</div>
          <div className="text-[11px] font-mono text-secondary mb-4">
            {loading ? '正在读取服务端目录...' : readiness ? `${readiness.selected_captures?.length || 0} 组进入当前快照` : '选择人员后检查'}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <span className={capability.canCheck ? 'text-[#2F806E]' : 'text-secondary'}>数据检查 / {capability.canCheck ? '可用' : '不可用'}</span>
            <span className={capability.canTrain ? 'text-[#2F806E]' : 'text-secondary'}>分类训练 / {capability.canTrain ? '可用' : '受阻'}</span>
            <span className={readiness?.export_allowed ? 'text-[#2F806E]' : 'text-secondary'}>快照导出 / {readiness?.export_allowed ? '可用' : '不可用'}</span>
            <span className={capability.canPromote ? 'text-[#2F806E]' : 'text-secondary'}>模型晋级 / {capability.canPromote ? '可用' : '受阻'}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="border border-divider bg-surface-primary p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">采集记录管理</div>
                <div className="text-[11px] text-secondary mt-1">全部服务端记录均可查看，可按需勾选或删除。</div>
              </div>
            <button
              type="button"
              onClick={toggleInvalidCaptures}
              disabled={!invalidCaptureIds.length || busy}
              className="min-h-8 px-2 border border-divider text-[11px] font-mono text-brand hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {allInvalidSelected ? '取消全选无效数据' : '全选无效数据'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-4" data-testid="capture-record-summary">
            {captureSummary.map((item) => (
              <div key={item.subjectId} className="border border-divider/70 bg-surface-secondary px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-primary">{item.subjectId}</span>
                  <span className="truncate text-[11px] text-secondary">{item.name}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-secondary">
                  <span>共 {item.total} 组</span>
                  <span className="text-[#2F806E]">有效 {item.valid}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[11px] font-mono text-secondary mb-3">
            已选移除 {selectedRemovalCaptureIds.length} 条 · 服务端记录 {allServerCaptureRecords.length} 条 · 均可按需管理
          </div>
          {allServerCaptureRecords.length === 0 ? (
            <div className="text-[12px] text-secondary">暂无可管理的服务端采集记录。</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
              {allServerCaptureRecords.map((record) => {
                const id = captureId(record)
                const subjectId = captureSubjectId(record)
                const person = people.find((item) => String(item.id) === subjectId)
                const valid = isValidTrainingCapture(record)
                const qualityStatus = String(record.quality_status || record.qualityStatus || '').toUpperCase()
                const state = String(record.state || '').toUpperCase()
                return (
                  <div key={id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 border-b border-divider/60 py-2 text-[12px] text-primary">
                    <input
                      type="checkbox"
                      checked={selectedRemovalCaptureIds.includes(id)}
                      onChange={() => toggleRemovalCapture(id)}
                      disabled={busy}
                      className="accent-[#2F806E]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono font-medium text-primary">{subjectId || '—'}</span>
                        <span className="truncate text-primary">{person?.name || '未关联人员'}</span>
                        <span className="font-mono text-secondary">{id}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-secondary">
                        <span>第 {record.sequence_number ?? record.sequenceNumber ?? '—'} 组</span>
                        <span>{formatModelTime(record.updated_at || record.updatedAt)}</span>
                        <span>{state || 'UNKNOWN'} / {record.source_mode || record.sourceMode || '—'}</span>
                      </div>
                    </div>
                    <span className={`whitespace-nowrap text-[10px] ${valid ? 'text-[#2F806E]' : 'text-[#B65B5B]'}`}>
                      {valid ? '质量通过' : qualityStatus === 'PASS' ? '证据不完整' : '质量不通过'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCapture(record)}
                      disabled={busy || deletingCaptureId === id}
                      className="whitespace-nowrap border border-divider px-2 py-1 text-[10px] text-secondary hover:border-[#B65B5B] hover:text-[#B65B5B] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`移除采集记录 ${id}`}
                    >
                      {deletingCaptureId === id ? '移除中…' : '移除'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={!selectedRemovalCaptureIds.length || busy || batchRemovalState === 'loading'}
              className="h-9 px-4 rounded-sm border border-[#B65B5B] text-[#B65B5B] text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {batchRemovalState === 'loading' ? '正在读取移除预览...' : '移除选中记录'}
            </button>
            {batchRemovalState === 'success' && <span className="text-[11px] font-mono text-[#2F806E]">采集目录、人员数量和训练就绪状态已刷新。</span>}
          </div>
        </div>

        <div className="border border-divider bg-surface-secondary p-4">
          <div className="text-[11px] font-mono text-secondary uppercase tracking-widest mb-3">训练参数</div>
          <label htmlFor="max-training-epochs" className="block text-[12px] text-primary mb-2">最大训练轮数</label>
          <input
            id="max-training-epochs"
            type="number"
            inputMode="numeric"
            min="1"
            max="100"
            step="1"
            value={maxEpochs}
            onChange={(event) => setMaxEpochs(event.target.value)}
            disabled={busy}
            className="w-full h-9 border border-divider bg-surface-primary px-3 text-[13px] font-mono text-primary focus:outline-none focus:border-brand disabled:opacity-50"
            aria-describedby="max-training-epochs-help"
          />
          <div id="max-training-epochs-help" className={`mt-2 text-[11px] font-mono ${validMaxEpochs ? 'text-secondary' : 'text-[#B65B5B]'}`}>
            {validMaxEpochs ? '请输入 1–100 的整数，默认 20；验证结果连续 5 轮未改善时提前停止。' : '最大训练轮数必须是 1–100 的整数。'}
          </div>
        </div>
      </div>

      {(readiness?.blocking_reasons?.length || readiness?.warnings?.length || error) ? (
        <div className="mt-4 border-l-2 border-[#AA843B] pl-3 space-y-1 text-[12px] text-secondary">
          {error && <div className="text-[#B65B5B]">{error}</div>}
          {(readiness?.blocking_reasons || []).map((reason) => <div key={`block-${reason}`}>· {reason}</div>)}
          {(readiness?.warnings || []).map((warning) => <div key={`warn-${warning}`}>· {warning}</div>)}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={!capability.canTrain || busy || loading || !validMaxEpochs}
          className="h-9 px-4 rounded-sm bg-brand text-white text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? '训练任务运行中...' : '开始训练候选'}
        </button>
        <button
          type="button"
          onClick={handleStop}
          disabled={!busy}
          className="h-9 px-4 rounded-sm border border-primary text-primary text-[12px] disabled:opacity-30 disabled:cursor-not-allowed"
        >
          安全停止训练
        </button>
        {trainingStatus && (
          <div className="basis-full border border-divider bg-surface-secondary p-3 text-[11px] font-mono text-secondary space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>任务状态：{trainingStatus.state || '—'}</span>
              <span>模式：{String(trainingStatus.training_mode || 'dynamic').toUpperCase()}</span>
              <span>阶段：{trainingStatus.stage || trainingStatus.message || '—'}</span>
              <span>进度：{progressPercent.toFixed(1)}%</span>
              <span>当前采集：{trainingStatus.current_capture_id || '—'}</span>
              <span>采集进度：{trainingStatus.processed_capture_count ?? 0}/{trainingStatus.total_capture_count ?? 0}</span>
              <span>样本：{trainingStatus.generated_sample_count ?? 0}</span>
              <span>Epoch：{trainingStatus.epoch ?? '—'}/{trainingStatus.total_epochs ?? '—'}</span>
            </div>
            <div className="h-1 bg-divider overflow-hidden" aria-label="训练真实进度">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${progressPercent}%` }} />
            </div>
            {stalled && <div className="text-[#B65B5B]">任务疑似停滞：当前阶段「{trainingStatus.stage || '未知'}」，后端心跳已超过合理等待时间。</div>}
            {trainingStatus.last_error && <div className="text-[#B65B5B]">最后错误：{trainingStatus.last_error}</div>}
            {trainingStatus.last_heartbeat_at && <div>最后心跳：{new Date(Number(trainingStatus.last_heartbeat_at) * 1000).toLocaleString('zh-CN')}</div>}
          </div>
        )}
      </div>

      {candidateVersion && (
        <div className="mt-4 border border-divider bg-surface-primary p-4 space-y-2">
          <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">候选模型检查</div>
          <div className="text-[12px] text-primary">服务器版本：<span className="font-mono">{candidateVersion}</span></div>
          <div className="text-[11px] font-mono text-secondary">
            {candidateStatus?.activation_ready === true
              ? 'ONNX、SHA256、metadata、label_map、输入输出合同和 parity 检查通过。'
              : candidateStatus?.errors?.join('；') || '候选文件检查尚未通过或尚未完成。'}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleActivateCandidate}
              disabled={candidateStatus?.activation_ready !== true || activationBusy || busy || recognitionRunning}
              className="h-9 px-4 rounded-sm bg-brand text-white text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {activationState === 'loading' ? '正在加载候选模型...' : '应用候选模型'}
            </button>
            <span className="text-[11px] font-mono text-[#AA843B]">候选模型，门禁保持锁定</span>
          </div>
        </div>
      )}

      <div className="mt-5 border border-divider bg-surface-primary p-4" data-testid="model-management">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] font-mono text-secondary uppercase tracking-widest">模型管理</div>
            <div className="text-[12px] text-secondary mt-1">仅显示服务端管理的版本；模型、标签映射和阈值按版本保存。</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/live')}
            disabled={!modelCatalog.current?.model_version}
            className="h-8 px-3 border border-primary text-primary text-[11px] font-mono disabled:opacity-40 disabled:cursor-not-allowed"
          >
            前往实时识别
          </button>
        </div>
        {modelMessage && <div role="status" className="mb-3 text-[12px] text-[#2F806E]">{modelMessage}</div>}
        <div className="mb-4 border-b border-divider pb-3 text-[11px] font-mono text-secondary">
          当前模型：<span className="text-primary">{modelCatalog.current?.model_version || '未加载'}</span>
          {modelCatalog.current?.threshold != null && <span> · 当前阈值 {Number(modelCatalog.current.threshold).toFixed(2)}</span>}
        </div>
        {modelLoading ? (
          <div className="text-[12px] text-secondary">正在读取服务端模型版本...</div>
        ) : modelCatalog.models.length === 0 ? (
          <div className="text-[12px] text-secondary">暂无服务端模型版本。</div>
        ) : (
          <div className="space-y-3">
            {modelCatalog.models.map((model) => {
              const version = String(model?.model_version || '')
              const applying = activationState === `loading:${version}`
              const thresholdValue = thresholdDrafts[version] ?? String(model.threshold ?? 0.70)
              return (
                <div key={version} className="border-t border-divider pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-primary">
                    <span className="font-mono font-medium">{version || '—'}</span>
                    <span className={`font-mono text-[10px] ${model.is_current ? 'text-[#2F806E]' : model.can_apply ? 'text-brand' : 'text-secondary'}`}>
                      {model.is_current ? '当前' : model.can_apply ? '可应用' : '不可用'}
                    </span>
                    <span className="text-secondary">创建：{formatModelTime(model.created_at)}</span>
                    <span className="text-secondary">训练人员：{model.trained_by || '—'}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-secondary">
                    <span className="break-all">数据集：{model.dataset_fingerprint || '—'}</span>
                    <span>最大轮数：{model.max_epochs ?? '—'} · 最佳 epoch：{model.best_epoch ?? '—'}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleActivateModel(model)}
                      disabled={!model.can_apply || model.is_current || busy || recognitionRunning || activationBusy || !version}
                      className="h-8 px-3 border border-primary text-primary text-[11px] font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {applying ? '应用中...' : '应用此模型'}
                    </button>
                    <label className="flex items-center gap-2 text-[11px] font-mono text-secondary">
                      <span>高级设置 / 身份判定阈值</span>
                      <input
                        aria-label={`${version} 身份判定阈值`}
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={thresholdValue}
                        onChange={(event) => setThresholdDrafts((current) => ({ ...current, [version]: event.target.value }))}
                        disabled={busy || recognitionRunning || !version}
                        className="w-20 h-8 border border-divider bg-surface-secondary px-2 text-primary focus:outline-none focus:border-brand disabled:opacity-50"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleThresholdSave(model)}
                      disabled={busy || recognitionRunning || !version || !Number.isFinite(Number(thresholdValue)) || Number(thresholdValue) < 0 || Number(thresholdValue) > 1}
                      className="h-8 px-3 border border-divider text-[11px] font-mono text-brand hover:border-brand disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      保存阈值
                    </button>
                    <span className="text-[10px] text-secondary">默认 0.70，待真实数据校准的初始值</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default TrainingReadinessPanel
