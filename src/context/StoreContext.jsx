import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  createCompetitionSession,
  createDepartment,
  createPersonnel,
  deleteCaptureRecord,
  removeCaptureBatch,
  deletePersonnel,
  getCaptureCatalog,
  getPersonnel,
  getDepartments,
  getRuntimeAuditLogs,
  getRuntimeEvents,
  updatePersonnel
} from '../utils/runtimeApi'
import { useLiveRuntimeEvents } from '../features/recognition/useLiveRuntimeEvents'
import { mergeRuntimeEvents, normalizePersonnel } from '../utils/runtimeData'

const StoreContext = createContext(null)
const ANALYTICS_EVENT_TYPES = ['identity_resolved', 'decision_status', 'access_event', 'alarm_event']

const toPersonnelPayload = (record = {}) => ({
  name: record.name || '',
  gender: record.gender || '未填写',
  age: record.age === '' ? '' : (record.age ?? ''),
  department: record.department || '未填写',
  role: record.role || '实验室人员',
  phone: record.phone || '',
  email: record.email || '',
  accessPolicy: record.accessPolicy || 'review',
  ...(record.groupId ? { groupId: record.groupId } : {}),
  status: record.status || 'ACTIVE'
})

export const StoreProvider = ({ children }) => {
  const [session, setSession] = useState(null)
  const [sessionState, setSessionState] = useState({ status: 'loading', error: '' })
  const [serverPersonnel, setServerPersonnel] = useState([])
  const [captureCatalog, setCaptureCatalog] = useState({ people: [], records: [], dynamic: true })
  const [groups, setGroups] = useState([])
  const [departments, setDepartments] = useState([])
  const [restEvents, setRestEvents] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [dataState, setDataState] = useState({ loading: true, refreshing: false, error: '' })

  const runtime = useLiveRuntimeEvents(session?.token || '')

  const loadSession = useCallback(async () => {
    setSessionState((current) => ({ ...current, status: 'loading', error: '' }))
    try {
      const result = await createCompetitionSession()
      if (!result?.session?.token) throw new Error('竞赛会话未返回 token')
      setSession(result.session)
      setSessionState({ status: 'ready', error: '' })
    } catch (error) {
      setSession(null)
      setSessionState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }, [])

  useEffect(() => {
    loadSession()
    const handleInvalidAuth = () => loadSession()
    window.addEventListener('radar-auth-invalid', handleInvalidAuth)
    return () => window.removeEventListener('radar-auth-invalid', handleInvalidAuth)
  }, [loadSession])

  const refresh = useCallback(async () => {
    const token = session?.token
    if (!token) return
    setDataState((current) => ({ ...current, refreshing: true, error: '' }))
    const [personnelResult, catalogResult, departmentsResult, eventsResult, auditResult] = await Promise.allSettled([
      getPersonnel(token),
      getCaptureCatalog(token),
      getDepartments(token),
      Promise.all(ANALYTICS_EVENT_TYPES.map((type) => getRuntimeEvents(type, token, 500))),
      getRuntimeAuditLogs(token, { page: 1, pageSize: 100 })
    ])
    const errors = []
    if (personnelResult.status === 'fulfilled') {
      const payload = personnelResult.value || {}
      setServerPersonnel(Array.isArray(payload.personnel) ? payload.personnel : [])
      setGroups(Array.isArray(payload.groups) ? payload.groups : [])
      if (Array.isArray(payload.departments)) setDepartments(payload.departments)
    } else {
      errors.push(personnelResult.reason)
    }
    if (catalogResult.status === 'fulfilled') {
      const payload = catalogResult.value || {}
      setCaptureCatalog({
        ...payload,
        people: Array.isArray(payload.people) ? payload.people : [],
        records: Array.isArray(payload.records) ? payload.records : [],
        dynamic: payload.dynamic !== false
      })
    } else {
      errors.push(catalogResult.reason)
    }
    if (departmentsResult.status === 'fulfilled') {
      const payload = departmentsResult.value || {}
      setDepartments(Array.isArray(payload.departments) ? payload.departments : [])
    } else {
      errors.push(departmentsResult.reason)
    }
    if (eventsResult.status === 'fulfilled') {
      setRestEvents(eventsResult.value.flatMap((result) => Array.isArray(result?.events) ? result.events : []))
    } else {
      errors.push(eventsResult.reason)
    }
    if (auditResult.status === 'fulfilled') {
      setAuditLogs(Array.isArray(auditResult.value?.data) ? auditResult.value.data : [])
    } else {
      errors.push(auditResult.reason)
    }
    setDataState({
      loading: false,
      refreshing: false,
      error: errors.length ? errors.map((error) => error?.message || String(error)).join('; ') : ''
    })
  }, [session?.token])

  useEffect(() => {
    refresh()
  }, [refresh])

  const identities = useMemo(
    () => serverPersonnel.map((record) => normalizePersonnel(record, groups)),
    [serverPersonnel, groups]
  )
  const events = useMemo(
    () => mergeRuntimeEvents(restEvents, runtime.eventHistory, identities, groups, { maxEvents: null }),
    [restEvents, runtime.eventHistory, identities, groups]
  )

  const saveIdentity = useCallback(async (record) => {
    if (!session?.token) throw new Error('竞赛会话不可用')
    const payload = toPersonnelPayload(record)
    const result = record?.id
      ? await updatePersonnel(session.token, record.id, payload)
      : await createPersonnel(session.token, payload)
    const saved = result?.personnel
    if (!saved?.id) throw new Error('人员接口未返回人员记录')
    setServerPersonnel((current) => {
      const exists = current.some((item) => item.id === saved.id)
      return exists ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]
    })
    return normalizePersonnel(saved, groups)
  }, [groups, session?.token])

  const removeIdentity = useCallback(async (personnelId) => {
    if (!session?.token) throw new Error('竞赛会话不可用')
    await deletePersonnel(session.token, personnelId)
    setServerPersonnel((current) => current.filter((item) => item.id !== personnelId))
  }, [session?.token])

  const removeCapture = useCallback(async (captureId) => {
    if (!session?.token) throw new Error('竞赛会话不可用')
    const result = await deleteCaptureRecord(session.token, captureId)
    setCaptureCatalog((current) => ({
      ...current,
      records: current.records.filter((record) => String(record?.capture_id || record?.captureId || '') !== String(captureId))
    }))
    await refresh()
    return result
  }, [refresh, session?.token])

  const removeCaptures = useCallback(async (captureIds) => {
    if (!session?.token) throw new Error('竞赛会话不可用')
    const result = await removeCaptureBatch(session.token, captureIds)
    await refresh()
    return result
  }, [refresh, session?.token])

  const addDepartment = useCallback(async (name) => {
    if (!session?.token) throw new Error('竞赛会话不可用')
    const result = await createDepartment(session.token, name)
    const created = result?.department
    if (!created) throw new Error('部门接口未返回部门记录')
    if (Array.isArray(result.departments)) setDepartments(result.departments)
    else setDepartments((current) => [...current, created])
    return created
  }, [session?.token])

  const updateIdentity = useCallback((id, data) => saveIdentity({ ...identities.find((item) => item.id === id), ...data, id }), [identities, saveIdentity])
  const addIdentity = useCallback((record) => saveIdentity(record), [saveIdentity])

  const value = useMemo(() => ({
    session,
    sessionState,
    sessionUser: session?.user || null,
    identities,
    groups,
    captureCatalog,
    departments,
    events,
    runtime,
    runtimeEvents: runtime.eventHistory,
    auditLogs,
    loading: dataState.loading,
    refreshing: dataState.refreshing,
    dataError: dataState.error,
    refresh,
    saveIdentity,
    removeIdentity,
    removeCapture,
    removeCaptures,
    updateIdentity,
    addIdentity,
    addDepartment
  }), [
    session,
    sessionState,
    identities,
    groups,
    captureCatalog,
    departments,
    events,
    runtime,
    auditLogs,
    dataState,
    refresh,
    saveIdentity,
    removeIdentity,
    removeCapture,
    removeCaptures,
    updateIdentity,
    addIdentity,
    addDepartment
  ])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
