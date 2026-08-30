import React, { useState, useEffect, useRef } from 'react';
import { getLiveSessionStatus, getSystemStatus, resetLiveSessionTarget, startLiveSession, stopLiveSession } from '../utils/runtimeApi';
import LiveSpectrogramCanvas from '../features/recognition/LiveSpectrogramCanvas';
import {
  findLatestLiveEvent,
  findLatestLivePreviewForRun,
  findLatestLiveStreamPreviewForRun,
  isEventFromLiveRun,
  waitForLiveSessionReady
} from '../utils/runtimeData';
import { useStore } from '../context/StoreContext';

const matchesLiveContext = (event, sessionId, recognitionCycleId) => {
  const rawEvent = event?.rawEvent && typeof event.rawEvent === 'object' ? event.rawEvent : event;
  const payload = rawEvent?.payload && typeof rawEvent.payload === 'object' ? rawEvent.payload : {};
  const eventSessionId = String(payload.session_id ?? event?.sessionId ?? '').trim();
  const eventCycleId = String(payload.recognition_cycle_id ?? '').trim();
  return (
    (!sessionId || eventSessionId === String(sessionId))
    && (!recognitionCycleId || eventCycleId === String(recognitionCycleId))
  );
};
const STABLE_IDENTITY_EVENT_TYPE = 'identity_resolved';
const PHASE_LABELS = Object.freeze({
  STANDBY: '待机',
  WAITING: '等待目标',
  STREAMING: '流式谱图',
  RESOLVING: '解析身份',
  RESOLVED: '识别完成',
  LOW_QUALITY: '质量不足',
  STALE: '数据陈旧',
  FAILED: '启动失败'
});

const LivePage = () => {
  const CURRENT_ZONE = 'P3 核心区';
  const { events, runtime, session } = useStore();

  const [isScanning, setIsScanning] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState('');
  const [liveRecognitionCycleId, setLiveRecognitionCycleId] = useState('');
  const [liveStartedAt, setLiveStartedAt] = useState(0);
  const [phase, setPhase] = useState('STANDBY'); // STANDBY, WAITING, STREAMING, RESOLVING, RESOLVED, LOW_QUALITY, STALE, FAILED
  const [currentSubject, setCurrentSubject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [resetPending, setResetPending] = useState(false);
  const [frozenPreviewWindowId, setFrozenPreviewWindowId] = useState('');
  const [systemStatus, setSystemStatus] = useState(null);
  const [startError, setStartError] = useState('');

  const logEndRef = useRef(null);
  const startPendingRef = useRef(false);
  const resetPendingRef = useRef(false);
  const preservedLogsRef = useRef([]);
  const lockedSubjectRef = useRef(null);

  useEffect(() => {
    if (!session?.token) {
      setSystemStatus(null);
      return undefined;
    }
    let stopped = false;
    const pollSystem = async () => {
      try {
        const status = await getSystemStatus(session.token);
        if (!stopped) setSystemStatus(status);
      } catch {
        // Keep the last confirmed model status visible during a transient poll failure.
      }
    };
    pollSystem();
    const timer = window.setInterval(pollSystem, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [session?.token]);

  useEffect(() => {
    if (!isScanning) {
      setPhase('STANDBY');
      setCurrentSubject(null);
      setLogs([]);
      setLiveSessionId('');
      setLiveRecognitionCycleId('');
      setLiveStartedAt(0);
      setFrozenPreviewWindowId('');
      setResetPending(false);
      resetPendingRef.current = false;
      preservedLogsRef.current = [];
      lockedSubjectRef.current = null;
      return;
    }

    let stopped = false;
    const pollSession = async () => {
      if (stopped || !session?.token) return;
      try {
        const status = await getLiveSessionStatus(session.token);
        const state = String(status?.state || '').toUpperCase();
        if (!stopped && state === 'FAILED') {
          setStartError(status?.error || '实时识别启动失败');
          setIsScanning(false);
        } else if (!stopped && state === 'STOPPED') {
          setIsScanning(false);
        }
      } catch {
        // The original standby/stream states remain the only visible fallback.
      }
    };
    pollSession();
    const pollTimer = window.setInterval(pollSession, 1000);
    return () => {
      stopped = true;
      window.clearInterval(pollTimer);
    };
  }, [isScanning, session?.token]);

  useEffect(() => {
    if (!isScanning) return;
    const liveEvents = events.filter((event) => (
      event.sourceMode === 'live'
      && isEventFromLiveRun(event, liveStartedAt)
      && matchesLiveContext(event, liveSessionId, liveRecognitionCycleId)
    ));
    const livePreviews = runtime.previewHistory.filter((event) => (
      isEventFromLiveRun(event, liveStartedAt)
      && matchesLiveContext(event, liveSessionId, liveRecognitionCycleId)
    ));
    const liveStreamPreviews = runtime.streamPreviewHistory.filter((event) => (
      isEventFromLiveRun(event, liveStartedAt)
      && matchesLiveContext(event, liveSessionId, liveRecognitionCycleId)
    ));
    const qualityEvent = runtime.events?.window_quality;
    const qualityValid = qualityEvent?.payload?.quality_valid;
    setLogs([...preservedLogsRef.current, ...liveEvents.slice(0, 20)].slice(0, 20));
    const latest = findLatestLiveEvent(liveEvents);
    const latestIsStable = latest?.rawEvent?.event_type === STABLE_IDENTITY_EVENT_TYPE || latest?.event_type === STABLE_IDENTITY_EVENT_TYPE;
    if (latest && latestIsStable) {
      const resolvedSubject = {
        ...latest,
        id: latest.identityId,
        role: latest.department,
        pinyin: latest.nameEn,
        access: latest.accessGroupName || '—',
        status: latest.accessResult
      };
      lockedSubjectRef.current = resolvedSubject;
      setCurrentSubject((current) => current || resolvedSubject);
      setFrozenPreviewWindowId((current) => current || latest.windowId || '');
      setPhase('RESOLVED');
    } else if (lockedSubjectRef.current) {
      // A resolved identity is locked until the operator explicitly resets the target.
    } else if (runtime.stale && liveStreamPreviews.length > 0) {
      setCurrentSubject(null);
      setPhase('STALE');
    } else if (qualityValid === false) {
      setCurrentSubject(null);
      setPhase('LOW_QUALITY');
    } else if (liveStreamPreviews.length > 0) {
      setCurrentSubject(null);
      setPhase('STREAMING');
    } else if (livePreviews.length > 0) {
      setCurrentSubject(null);
      setPhase('RESOLVING');
    } else {
      setCurrentSubject(null);
      setPhase('WAITING');
    }
  }, [events, isScanning, liveStartedAt, liveSessionId, liveRecognitionCycleId, runtime.events, runtime.previewHistory, runtime.stale, runtime.streamPreviewHistory]);

  const finalPreview = findLatestLivePreviewForRun(runtime.previewHistory, liveStartedAt, {
    sessionId: liveSessionId,
    recognitionCycleId: liveRecognitionCycleId,
    windowId: phase === 'RESOLVED' ? frozenPreviewWindowId : ''
  });
  const streamPreview = findLatestLiveStreamPreviewForRun(runtime.streamPreviewHistory, liveStartedAt, {
    sessionId: liveSessionId,
    recognitionCycleId: liveRecognitionCycleId
  });
  const currentPreview = phase === 'RESOLVED' ? finalPreview : (streamPreview || finalPreview);
  const previewPayload = currentPreview?.payload || {};
  const previewAxis = Array.isArray(previewPayload.preview_doppler_axis) ? previewPayload.preview_doppler_axis : [];
  const previewAxisUnit = previewPayload.preview_axis_unit || '—';
  const previewAxisMin = previewAxis.length ? Math.min(...previewAxis).toFixed(1) : '—';
  const previewAxisMax = previewAxis.length ? Math.max(...previewAxis).toFixed(1) : '—';
  const previewShape = Array.isArray(previewPayload.preview_shape) ? previewPayload.preview_shape : [];
  const previewAspectRatio = '1 / 1';
  const peakPositions = Array.isArray(previewPayload.display_peak_positions)
    ? previewPayload.display_peak_positions
      .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      .slice(0, 5)
    : [];
  const completeCycleCount = Math.min(
    4,
    Math.max(0, Math.trunc(Number(previewPayload.display_complete_cycle_count) || 0))
  );
  const previewZeroIndex = Number.isInteger(previewPayload.preview_zero_doppler_index)
    ? previewPayload.preview_zero_doppler_index
    : '—';
  const previewStartTimestamp = previewPayload.preview_start_timestamp_s ?? previewPayload.start_timestamp_s ?? '—';
  const previewEndTimestamp = previewPayload.preview_end_timestamp_s ?? previewPayload.end_timestamp_s ?? '—';
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const loadedModel = systemStatus?.model || runtime.events?.model_status?.payload || {};
  const loadedModelLabel = loadedModel.id === 'test-fixture' ? 'DEFAULT MODEL' : (loadedModel.id || '—');

  const toggleScanning = async () => {
    if (!session?.token || startPendingRef.current || resetPendingRef.current) return;
    if (isScanning) {
      setStartError('');
      try {
        await stopLiveSession(session.token);
      } catch {
        // Stopping is idempotent on the backend; retain the original standby fallback.
      }
      setIsScanning(false);
      return;
    }
    startPendingRef.current = true;
    setStartError('');
    preservedLogsRef.current = [];
    lockedSubjectRef.current = null;
    try {
      const started = await startLiveSession(session.token, { confirmHardwareStart: true, durationS: 120 });
      const ready = await waitForLiveSessionReady(
        started,
        () => getLiveSessionStatus(session.token)
      );
      const runtimeSessionId = ready?.runtime?.session_id || ready?.session_id;
      if (ready?.session_id && runtimeSessionId) {
        setLiveSessionId(runtimeSessionId);
        setLiveRecognitionCycleId(ready?.runtime?.recognition_cycle_id || '');
        setLiveStartedAt(Number(ready.started_at) || Date.now() / 1000);
        setFrozenPreviewWindowId('');
        setIsScanning(true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStartError(message || '实时识别启动失败');
      setIsScanning(false);
      setLiveSessionId('');
      setLiveRecognitionCycleId('');
      setLiveStartedAt(0);
    } finally {
      startPendingRef.current = false;
    }
  };

  const handleNextSubject = async () => {
    if (!isScanning || !session?.token || resetPendingRef.current) return;
    resetPendingRef.current = true;
    preservedLogsRef.current = logs.slice(0, 20);
    setResetPending(true);
    try {
      const reset = await resetLiveSessionTarget(session.token);
      if (String(reset?.state || '').toUpperCase() !== 'RUNNING') return;
      setLiveRecognitionCycleId(reset?.runtime?.recognition_cycle_id || '');
      lockedSubjectRef.current = null;
      setCurrentSubject(null);
      setFrozenPreviewWindowId('');
      setPhase('WAITING');
    } catch {
      // The original live state remains visible when the reset request is unavailable.
    } finally {
      resetPendingRef.current = false;
      setResetPending(false);
    }
  };

  const StatusIcon = ({ status, className }) => {
    if (status === 'DENIED') {
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
      );
    }
    if (status === 'WARNING') {
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      );
    }
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
    );
  };

  return (
    <div className="absolute inset-0 w-full h-full bg-[#F5F5F4] flex flex-col font-sans overflow-y-auto md:overflow-hidden">

      {/* ================= 页面 Header ================= */}
      <header className="min-h-[70px] md:h-[80px] border-b border-divider flex items-start md:items-center justify-between px-6 md:px-8 py-3 md:py-0 bg-white shrink-0">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-[20px] md:text-[24px] font-semibold tracking-tight text-primary">实时感知</h1>
            <span className="text-[13px] md:text-[14px] font-mono tracking-[0.08em] text-primary">LIVE GAIT RECOGNITION</span>
          </div>
          <div className="text-[12px] md:text-[13px] text-secondary">毫米波实时采集、微多普勒表征与开放集身份判定</div>
          <div className="md:hidden mt-2 text-[10px] font-mono tracking-[0.06em] text-secondary break-all">
            MODEL / {loadedModelLabel} {loadedModel.model_version ? `· ${loadedModel.model_version}` : ''}
            {loadedModel.candidate_only || loadedModel.status === 'CANDIDATE_ONLY_MODEL' ? ' · 候选模型，门禁保持锁定' : ''}
          </div>
        </div>
        <div className="hidden md:flex flex-col items-end text-right">
          <div className="text-[11px] font-mono tracking-[0.1em] text-secondary mb-2">MODEL / {loadedModelLabel} {loadedModel.model_version ? `· ${loadedModel.model_version}` : ''}</div>
          <div className="text-[12px] font-mono tracking-[0.08em] text-primary flex items-center gap-2">
            <span>RADAR-01</span>
            <span className="text-divider">|</span>
            <span>P3 BIOSECURITY LAB</span>
            <span className="text-divider">|</span>
            <span className={isScanning ? 'text-[#2F806E] font-bold' : 'text-secondary'}>
              {isScanning ? 'LIVE' : 'STANDBY'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-secondary mt-1">
            {loadedModel.candidate_only || loadedModel.status === 'CANDIDATE_ONLY_MODEL' ? '候选模型，门禁保持锁定' : '识别结果由服务器确认'}
          </div>
        </div>
      </header>

      {/* ================= Main Layout (2/3 + 1/3) ================= */}
      <div className="flex flex-none md:flex-1 flex-col md:flex-row overflow-visible md:overflow-hidden min-h-0">

        {/* === 左侧：MD Stream === */}
        <div className="flex-none md:flex-[2] min-h-[520px] md:min-h-0 border-r border-divider flex flex-col relative bg-[#F5F5F4] overflow-hidden">

          {!isScanning ? (
            <div className="m-auto flex flex-col items-center text-center">
              {startError ? (
                <div role="alert" className="max-w-[560px] px-6 text-center">
                  <div className="text-[13px] font-mono tracking-[0.1em] text-[#B65B5B] mb-3">START FAILED</div>
                  <div className="text-[18px] font-medium text-primary mb-2">实时识别启动失败</div>
                  <div className="text-[13px] text-[#B65B5B] break-words">{startError}</div>
                </div>
              ) : (
                <>
                  <div className="text-[13px] font-mono tracking-[0.1em] text-primary mb-3">SYSTEM STANDBY</div>
                  <div className="text-[18px] font-medium text-primary mb-2">实时识别尚未启动</div>
                  <div className="text-[13px] text-secondary">启动后，实时微多普勒数据将在此显示。</div>
                </>
              )}
            </div>
          ) : (
            <div className="w-full h-full bg-[#050505] relative flex items-center justify-center">

              {/* Header inside Stream */}
              <div className="absolute top-0 left-0 w-full flex items-center justify-between p-6 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#2F806E] animate-pulse"></div>
                  <span className="text-[13px] font-mono text-[#2F806E] tracking-widest font-bold">LIVE</span>
                </div>
                <div className="text-[12px] font-mono text-white/50 tracking-widest uppercase">
                  {phaseLabel}
                </div>
              </div>

              {/* Minimal Axes */}
              <div className="absolute bottom-6 left-6 text-[11px] font-mono text-white/40 tracking-widest">
                时间轴 {previewStartTimestamp}–{previewEndTimestamp} s →
              </div>
              <div className="absolute top-1/2 left-6 -translate-y-1/2 -rotate-90 text-[11px] font-mono text-white/40 tracking-widest whitespace-nowrap origin-bottom-left">
                频率轴 {previewAxisMin}–{previewAxisMax} {previewAxisUnit}
              </div>

               {/* Grid / Stream canvas */}
               {phase !== 'WAITING' && (
                    <div
                      className="relative max-w-[1040px] border border-white/15 bg-[#090A0D] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_60px_rgba(0,0,0,0.28)] overflow-hidden"
                      style={{ aspectRatio: previewAspectRatio, width: 'min(88%, calc(100vh - 176px))' }}
                    >
                    <LiveSpectrogramCanvas preview={currentPreview} className="absolute inset-0 w-full h-full" />
                   <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,transparent_24.8%,rgba(255,255,255,0.12)_25%,transparent_25.2%,transparent_49.8%,rgba(255,255,255,0.16)_50%,transparent_50.2%,transparent_74.8%,rgba(255,255,255,0.12)_75%,transparent_75.2%)]"></div>
                   {peakPositions.length === 5 && peakPositions.map((position, index) => (
                     <div
                       key={`${position}-${index}`}
                       aria-hidden="true"
                       className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-[#FFEFB8]/65 shadow-[0_0_10px_rgba(255,239,184,0.18)]"
                       style={{ left: `${position * 100}%` }}
                     />
                   ))}
                   <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/45 to-transparent"></div>
                  </div>
              )}
              {currentPreview && (
                <div className="absolute bottom-6 right-6 flex items-end gap-3 text-[10px] font-mono text-white/55">
                  <div className="flex flex-col items-end gap-1">
                    <span>{previewPayload.preview_db_ceiling ?? '—'} dB</span>
                    <div className="w-2 h-16 border border-white/20" style={{ background: 'linear-gradient(to top, #000080, #0000FF, #00FFFF, #FFFF00, #FF0000, #800000)' }} />
                    <span>{previewPayload.preview_db_floor ?? '—'} dB</span>
                  </div>
                  <div className="flex flex-col gap-1 leading-tight text-right">
                    <span>ZERO / {previewZeroIndex}</span>
                    <span>{previewPayload.stream_status || 'FINAL'}</span>
                    <span>{previewPayload.source_mode || 'live'} / {previewPayload.recognition_cycle_id || '—'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* === 右侧：当前身份与事件流 === */}
        <div className="flex-none md:flex-[1] flex flex-col bg-white min-w-0 md:min-w-[340px] xl:min-w-[420px] overflow-visible md:overflow-hidden">

          {/* --- Current Identity & Details --- */}
          <div className="flex flex-col p-6 shrink-0">
            <div className="text-[11px] md:text-[12px] font-mono tracking-[0.1em] text-secondary mb-6 uppercase">Current Identity</div>

            {phase === 'STANDBY' ? (
              <div className="flex flex-col justify-center min-h-[160px]">
                <div className="text-[48px] md:text-[56px] font-medium text-primary leading-[1] mb-4 opacity-20">—</div>
                <div className="text-[14px] md:text-[16px] font-mono text-secondary tracking-widest uppercase">Awaiting Subject</div>
              </div>
            ) : phase === 'WAITING' ? (
              <div className="flex flex-col justify-center min-h-[160px]">
                <div className="text-[48px] md:text-[56px] font-medium text-primary leading-[1] mb-4 opacity-20">—</div>
                <div className="text-[14px] md:text-[16px] font-mono text-secondary tracking-widest uppercase animate-pulse">Capturing Signal...</div>
              </div>
            ) : ['RESOLVING', 'STREAMING', 'LOW_QUALITY', 'STALE'].includes(phase) ? (
              <div className="flex flex-col justify-center min-h-[160px]">
                <div className={`text-[28px] md:text-[32px] font-mono font-medium leading-[1] mb-4 tracking-widest ${phase === 'LOW_QUALITY' || phase === 'STALE' ? 'text-[#AA843B]' : 'text-primary'} ${phase === 'STREAMING' || phase === 'RESOLVING' ? 'animate-pulse' : ''}`}>{phaseLabel}</div>
                <div className="text-[14px] md:text-[16px] font-mono text-secondary tracking-widest uppercase">
                  {phase === 'STREAMING'
                    ? `完整周期 ${completeCycleCount} / 4 · Receiving micro-Doppler stream...`
                    : phase === 'LOW_QUALITY'
                      ? 'Waiting for a valid window...'
                      : phase === 'STALE'
                        ? 'No fresh live telemetry...'
                        : `完整周期 ${completeCycleCount} / 4 · Extracting features...`}
                </div>
              </div>
            ) : currentSubject ? (
              <div className="flex flex-col animate-[fadeIn_0.3s_ease-out]">

                 {/* 顶级信息与最终结果 */}
                 <div className="flex flex-col items-start mb-6 md:mb-8">
                   <div className="flex flex-col">
                    <div className="text-[48px] md:text-[56px] font-medium leading-[1] text-primary">
                      {currentSubject.identityDecision === 'UNKNOWN' ? '未匹配' : currentSubject.name}
                    </div>
                    <div className="text-[15px] md:text-[18px] font-mono tracking-[0.2em] text-secondary mt-3 uppercase">
                      {currentSubject.identityDecision === 'UNKNOWN' ? 'UNKNOWN IDENTITY' : currentSubject.pinyin}
                    </div>
                  </div>
                 </div>

                {/* 大气的状态横幅 (大字号+大Icon支撑) */}
                <div className={`flex items-center gap-4 mb-8 ${
                    currentSubject.recognitionPassed === true ? 'text-[#2F806E]' : 'text-[#B65B5B]'
                }`}>
                  <StatusIcon status={currentSubject.status} className="w-10 h-10 md:w-12 md:h-12 shrink-0" />
                  <div className="text-[20px] md:text-[24px] font-mono font-bold tracking-[0.15em] uppercase">
                     {currentSubject.recognitionPassed === true ? '识别通过' : '识别未通过'}
                  </div>
                </div>

                {/* Metadata Grid (由2x2改为大屏4x1横排，消灭水平空白，压缩垂直空间) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-4 border-t border-divider pt-6">
                  <div>
                    <div className="text-[10px] md:text-[11px] font-mono text-secondary mb-2 uppercase tracking-[0.1em]">Identity ID</div>
                    <div className="text-[13px] md:text-[14px] font-medium text-primary">{currentSubject.id}</div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-[11px] font-mono text-secondary mb-2 uppercase tracking-[0.1em]">Department</div>
                    <div className="text-[13px] md:text-[14px] font-medium text-primary">{currentSubject.role}</div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-[11px] font-mono text-secondary mb-2 uppercase tracking-[0.1em]">Access</div>
                    <div className="text-[13px] md:text-[14px] font-medium text-primary">{currentSubject.access}</div>
                  </div>
                  <div>
                    <div className="text-[10px] md:text-[11px] font-mono text-secondary mb-2 uppercase tracking-[0.1em]">Decision Mode</div>
                    <div className="text-[13px] md:text-[14px] font-medium text-primary">{currentSubject.mode}</div>
                  </div>
                </div>

              </div>
            ) : null}
          </div>

          <div className="w-full h-[1px] bg-divider shrink-0"></div>

          {/* --- Recent Events --- */}
          <div className="flex-1 p-6 flex flex-col shrink-1 min-h-[120px] overflow-hidden">
            <div className="text-[11px] md:text-[12px] font-mono tracking-[0.1em] text-secondary mb-4 uppercase shrink-0">Recent Events</div>

            <div className="flex-1 overflow-y-auto flex flex-col pr-2">
              {logs.length === 0 ? (
                <div className="text-[13px] font-mono text-secondary py-2">No activity</div>
              ) : (
                logs.map((log, i) => {
                  const passed = log.recognitionPassed === true;
                  const statusColor = passed ? 'text-[#2F806E]' : 'text-[#B65B5B]';
                  const timeColor = passed ? 'text-secondary' : 'text-[#B65B5B]';

                  return (
                    <div key={i} className="flex items-center justify-between border-b border-divider py-3 animate-[fadeIn_0.3s_ease-out] shrink-0">
                      <div className="flex items-center gap-4 md:gap-6">
                        <span className={`text-[12px] md:text-[13px] font-mono ${timeColor}`}>{log.time}</span>
                        <span className="text-[13px] md:text-[14px] text-primary font-medium w-[80px] truncate">{log.name}</span>
                      </div>
                      <span className={`text-[11px] md:text-[12px] font-mono font-bold tracking-[0.08em] ${statusColor}`}>
                        {passed ? '识别通过' : '识别未通过'}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} className="h-2 shrink-0" />
            </div>
          </div>

          {/* --- Footer Control --- */}
          <div className="p-6 border-t border-divider bg-[#FAFAF8] flex items-center justify-between shrink-0">
            <div className="text-[11px] font-mono text-secondary tracking-widest hidden lg:block">
              SYSTEM CONTROL
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={handleNextSubject}
                disabled={!isScanning || resetPending}
                className="h-[44px] md:h-[48px] px-4 flex items-center justify-center transition-colors rounded-[2px] bg-white border border-primary text-primary hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-[13px] md:text-[14px] font-semibold whitespace-nowrap">下一位人员</span>
              </button>
              <button
                onClick={toggleScanning}
                className={`h-[44px] md:h-[48px] px-8 flex items-center justify-center transition-colors rounded-[2px] ${
                  !isScanning
                    ? 'bg-[#2F806E] text-white hover:bg-[#1F6758] w-full lg:w-auto'
                    : 'bg-white border border-primary text-primary hover:bg-gray-50 w-auto'
                }`}
              >
                <span className="text-[14px] md:text-[15px] font-semibold">
                  {!isScanning ? '启动实时识别 →' : '停止识别'}
                </span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LivePage;
