import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  runtimeEventKey,
  isLiveEvent,
  isEventFromLiveRun,
  findLatestLivePreviewForRun,
  mergeRuntimeEvents,
  normalizePersonnel,
  waitForLiveSessionReady
} from '../src/utils/runtimeData.js'
import { isValidPreview, previewToNormalizedValue, spectrogramColor } from '../src/features/recognition/liveSpectrogram.mjs'

const event = (type, payload, id, sourceMode = 'live') => ({
  event_id: id,
  event_type: type,
  source_mode: sourceMode,
  timestamp_s: 1_735_000_000,
  payload
})

test('人员适配保留服务端 ID、状态、分组和真实采集计数', () => {
  const person = normalizePersonnel({
    id: 'LOCAL_ID1',
    name: '陈伟',
    department: '检验科',
    status: 'in_facility',
    gaitEnrollmentStatus: 'enrolled',
    groupId: 'AG-101',
    createdAt: '2026-08-27T00:00:00Z',
    captureCount: 6
  }, [{ id: 'AG-101', name: '全区域通行' }])
  assert.deepEqual({ id: person.id, name: person.name, status: person.status, enrollment: person.enrollment, groupId: person.groupId, captures: person.captures }, {
    id: 'ID1', name: '陈伟', status: 'ACTIVE', enrollment: 'READY', groupId: 'AG-101', captures: 6
  })
})

test('实时事件按 live source、会话、窗口和序列去重', () => {
  const first = event('micro_doppler_preview', { session_id: 's1', record_id: 'r1', window_id: 'w1', sequence: 1, preview: [[1]] }, 'event-a')
  const duplicateWithNewEnvelopeId = event('micro_doppler_preview', { session_id: 's1', record_id: 'r1', window_id: 'w1', sequence: 1, preview: [[1]] }, 'event-b')
  const replay = event('micro_doppler_preview', { session_id: 's1', record_id: 'r1', window_id: 'w2', sequence: 2, preview: [[2]] }, 'event-c', 'replay')
  assert.equal(isLiveEvent(first), true)
  assert.equal(runtimeEventKey(first), runtimeEventKey(duplicateWithNewEnvelopeId))
  assert.equal(isLiveEvent(replay), false)
})

test('同一识别会话的系统状态切换不得被当作重复事件丢弃', () => {
  const running = event('system_status', { session_id: 's1', state: 'COLLECTING' }, 'status-running')
  const stopped = event('system_status', { session_id: 's1', state: 'STOPPED' }, 'status-stopped')
  assert.notEqual(runtimeEventKey(running), runtimeEventKey(stopped))
})

test('识别适配只把后端 probability 当作可显示分数，logit 不转概率', () => {
  const personnel = [normalizePersonnel({ id: 'LOCAL_ID1', name: '陈伟', nameEn: 'CHEN WEI', department: '检验科', groupId: 'AG-101', gaitEnrollmentStatus: 'enrolled' })]
  const groups = [{ id: 'AG-101', name: '全区域通行' }]
  const probability = event('decision_status', {
    session_id: 's1', record_id: 'r1', source_window_id: 'w1', sequence: 1,
    status: 'ALLOW', access_eligible: true, candidate_id: 'LOCAL_ID1', score: 0.94, score_type: 'PROBABILITY'
  }, 'decision-a')
  const logit = event('decision_status', {
    session_id: 's1', record_id: 'r1', source_window_id: 'w2', sequence: 2,
    status: 'ALLOW', access_eligible: true, candidate_id: 'LOCAL_ID1', score: 9.4, score_type: 'LOGIT'
  }, 'decision-b')
  const merged = mergeRuntimeEvents([probability, logit], [], personnel, groups)
  assert.equal(merged.length, 2)
  assert.equal(merged.find((item) => item.windowId === 'w1').confidence, 94)
  assert.equal(merged.find((item) => item.windowId === 'w2').confidence, null)
})

test('比赛实时页只显示后端稳定解析结果，不把单窗口候选显示为姓名', () => {
  const personnel = [normalizePersonnel({
    id: 'LOCAL_ID2', name: '刘强', department: '实验室人员', groupId: 'AG-103', gaitEnrollmentStatus: 'enrolled'
  })]
  const groups = [{ id: 'AG-103', name: '全区域通行' }]
  const candidate = event('identity_candidate', {
    session_id: 'udp-source-1', source_window_id: 'window-1', sequence: 1,
    candidate_id: 'LOCAL_ID2', candidate_label: 'LOCAL_ID2', score: 0.91,
    score_type: 'PROBABILITY', status: 'CLOSED_SET_CANDIDATE', access_eligible: false
  }, 'candidate-1')
  const review = event('decision_status', {
    session_id: 'udp-source-1', source_window_id: 'window-1', sequence: 1,
    status: 'REVIEW_REQUIRED', access_eligible: false
  }, 'decision-1')
  const resolved = event('identity_resolved', {
    session_id: 'udp-source-1', recognition_cycle_id: 'cycle-1', source_window_id: 'window-5', sequence: 5,
    candidate_id: 'LOCAL_ID2', candidate_label: 'LOCAL_ID2', score: 0.93,
    score_type: 'PROBABILITY', status: 'KNOWN_CONFIRMED', access_eligible: false, locked: true
  }, 'resolved-1')

  const beforeResolved = mergeRuntimeEvents([candidate, review], [], personnel, groups)
  assert.equal(beforeResolved.length, 0)

  const merged = mergeRuntimeEvents([candidate, review, resolved], [], personnel, groups)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].name, '刘强')
  assert.equal(merged[0].identityDecision, 'KNOWN')
  assert.equal(merged[0].confidence, 93)
  assert.equal(merged[0].accessResult, 'AUTHORIZED')
})

test('置信度未通过时不泄露候选身份，只显示未通过', () => {
  const personnel = [normalizePersonnel({ id: 'LOCAL_ID1', name: '陈伟', gaitEnrollmentStatus: 'enrolled' })]
  const rejected = event('identity_resolved', {
    session_id: 's1', recognition_cycle_id: 'cycle-1', source_window_id: 'w5',
    candidate_id: 'LOCAL_ID1', candidate_label: 'LOCAL_ID1', status: 'CONFIDENCE_REJECTED',
    passed: false, score: 0.4, score_type: 'PROBABILITY', locked: true
  }, 'resolved-rejected')

  const [result] = mergeRuntimeEvents([rejected], [], personnel, [])
  assert.equal(result.recognitionPassed, false)
  assert.equal(result.identityId, null)
  assert.equal(result.name, '未知人员')
  assert.equal(result.accessResult, 'DENIED')
})

test('未知身份即使后端带有 passed 也不能显示识别通过', () => {
  const unknown = event('identity_resolved', {
    session_id: 's1', recognition_cycle_id: 'cycle-1', source_window_id: 'w5',
    candidate_id: 'ID_NOT_IN_PERSONNEL', candidate_label: 'ID_NOT_IN_PERSONNEL',
    status: 'KNOWN_CONFIRMED', identity_decision: 'KNOWN',
    passed: true, score: 0.9, score_type: 'PROBABILITY', locked: true
  }, 'resolved-unknown')

  const [result] = mergeRuntimeEvents([unknown], [], [], [])
  assert.equal(result.identityDecision, 'UNKNOWN')
  assert.equal(result.recognitionPassed, false)
  assert.equal(result.accessResult, 'DENIED')
})

test('稳定识别结果按会话和识别周期合并，每轮只保留一条', () => {
  const personnel = [normalizePersonnel({ id: 'LOCAL_ID1', name: '陈伟', gaitEnrollmentStatus: 'enrolled' })]
  const first = event('identity_resolved', {
    session_id: 'source-1', recognition_cycle_id: 'cycle-1', source_window_id: 'window-5',
    candidate_id: 'LOCAL_ID1', candidate_label: 'LOCAL_ID1', status: 'KNOWN_CONFIRMED', locked: true
  }, 'resolved-a')
  const duplicate = { ...first, event_id: 'resolved-b' }
  const nextCycle = event('identity_resolved', {
    session_id: 'source-1', recognition_cycle_id: 'cycle-2', source_window_id: 'window-10',
    candidate_id: 'LOCAL_ID1', candidate_label: 'LOCAL_ID1', status: 'KNOWN_CONFIRMED', locked: true
  }, 'resolved-c')

  const merged = mergeRuntimeEvents([first], [duplicate, nextCycle], personnel, [])

  assert.equal(merged.length, 2)
  assert.deepEqual(new Set(merged.map((item) => item.rawEvent.payload.recognition_cycle_id)), new Set(['cycle-1', 'cycle-2']))
})

test('统计合并不受实时列表上限影响，保留完整历史事件', () => {
  const personnel = [normalizePersonnel({ id: 'LOCAL_ID1', name: '陈伟', gaitEnrollmentStatus: 'enrolled' })]
  const history = Array.from({ length: 201 }, (_, index) => {
    const item = event('identity_resolved', {
      session_id: 'source-1',
      recognition_cycle_id: `cycle-${index}`,
      source_window_id: `window-${index}`,
      candidate_id: 'LOCAL_ID1',
      candidate_label: 'LOCAL_ID1',
      status: 'KNOWN_CONFIRMED',
      passed: true,
      locked: true
    }, `resolved-${index}`)
    item.timestamp_s = 1_735_000_000 + index
    return item
  })

  const merged = mergeRuntimeEvents(history, [], personnel, [], { maxEvents: null })

  assert.equal(merged.length, 201)
  assert.equal(merged.at(-1).rawEvent.payload.recognition_cycle_id, 'cycle-0')
})

test('统计数据源使用完整历史合并模式', async () => {
  const source = await readFile(new URL('../src/context/StoreContext.jsx', import.meta.url), 'utf8')
  assert.match(source, /mergeRuntimeEvents\(restEvents, runtime\.eventHistory, identities, groups, \{ maxEvents: null \}\)/)
})

test('微多普勒预览要求有限、非空二维矩阵', () => {
  assert.equal(isValidPreview({ payload: { preview: [[0, 1], [2, 3]] } }), true)
  assert.equal(isValidPreview({ payload: { preview: [[0], ['not-a-number']] } }), false)
  assert.equal(isValidPreview({ payload: { preview: [] } }), false)
})

test('前端按固定 uint8 dB 范围映射颜色，不扫描每个窗口的动态范围', () => {
  const payload = { preview_encoding: 'uint8_db', preview_db_floor: -60, preview_db_ceiling: 0 }
  assert.equal(previewToNormalizedValue({ payload }, 0), 0)
  assert.equal(previewToNormalizedValue({ payload }, 255), 1)
  assert.equal(previewToNormalizedValue({ payload }, 128), 128 / 255)
  assert.equal(isValidPreview({ payload: { ...payload, preview: [[256]] } }), false)
})

test('实时页按启动时间关联当前采集，不把 UDP 内部会话 ID 当作页面会话 ID', () => {
  const oldPreview = event('micro_doppler_preview', {
    session_id: 'udp-source-old', window_id: 'old-window', sequence: 1, preview: [[1]]
  }, 'preview-old')
  oldPreview.timestamp_s = 99
  const currentPreview = event('micro_doppler_preview', {
    session_id: 'udp-source-current', window_id: 'current-window', sequence: 1, preview: [[2]]
  }, 'preview-current')
  currentPreview.timestamp_s = 101

  assert.equal(isEventFromLiveRun(oldPreview, 100), false)
  assert.equal(isEventFromLiveRun(currentPreview, 100), true)
  assert.equal(findLatestLivePreviewForRun([oldPreview, currentPreview], 100), currentPreview)
})

test('频谱画布挂载后会重新应用真实预览图且不平铺', async () => {
  const source = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  const canvas = await readFile(new URL('../src/features/recognition/LiveSpectrogramCanvas.jsx', import.meta.url), 'utf8')
  assert.match(source, /liveRecognitionCycleId/)
  assert.match(source, /frozenPreviewWindowId/)
  assert.match(source, /LiveSpectrogramCanvas/)
  assert.match(source, /preview_start_timestamp_s/)
  assert.match(source, /preview_end_timestamp_s/)
  assert.doesNotMatch(source, /backgroundSize|backgroundRepeat|drawImage\(/)
  assert.match(canvas, /putImageData/)
  assert.doesNotMatch(canvas, /imageRendering\s*=\s*['"]pixelated['"]/)
  assert.match(canvas, /imageRendering\s*=\s*['"]auto['"]/)
})

test('实时频谱使用蓝底 Jet 色谱', async () => {
  const page = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  const canvas = await readFile(new URL('../src/features/recognition/LiveSpectrogramCanvas.jsx', import.meta.url), 'utf8')
  const palette = await readFile(new URL('../src/features/recognition/liveSpectrogram.mjs', import.meta.url), 'utf8')
  assert.match(canvas, /spectrogramColor/)
  assert.match(palette, /SPECTROGRAM_STOPS/)
  assert.deepEqual(spectrogramColor(0), [0, 0, 128])
  assert.deepEqual(spectrogramColor(0.375), [0, 255, 255])
  assert.deepEqual(spectrogramColor(0.625), [255, 255, 0])
  assert.deepEqual(spectrogramColor(0.875), [255, 0, 0])
  assert.match(page, /#000080[\s\S]*#800000/)
  assert.doesNotMatch(canvas, /jetColor/)
})

test('最终频谱只按后端五峰位置标出四个完整周期', async () => {
  const page = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  assert.match(page, /display_peak_positions/)
  assert.match(page, /display_complete_cycle_count/)
  assert.match(page, /peakPositions\.map/)
  assert.doesNotMatch(page, /峰位 \{index \+ 1\}/)
  assert.match(page, /完整周期/)
  assert.doesNotMatch(page, /findPeaks|detectPeaks|Math\.random/)
})

test('实时频谱容器保持接近方形，避免短窗口被拉成竖条', async () => {
  const source = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  assert.match(source, /preview_shape/)
  assert.match(source, /const previewAspectRatio = ['"]1 \/ 1['"]/)
  assert.match(source, /aspectRatio:\s*previewAspectRatio/)
  assert.match(source, /width:\s*['"]min\(88%, calc\(100vh - 176px\)\)['"]/)
  assert.doesNotMatch(source, /aspect-square/)
})

test('实时频谱允许 320 列有界历史并按实际宽度校验', async () => {
  const source = await readFile(new URL('../src/features/recognition/liveSpectrogram.mjs', import.meta.url), 'utf8')
  assert.match(source, /MAX_PREVIEW_COLUMNS\s*=\s*320/)
  assert.match(source, /width\s*>\s*MAX_PREVIEW_COLUMNS/)
})

test('前端直接渲染后端有界结果，不进行第二次 Canvas 重采样', async () => {
  const source = await readFile(new URL('../src/features/recognition/liveSpectrogram.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /imageSmoothingEnabled/)
  assert.doesNotMatch(source, /drawImage\(/)
  assert.match(source, /putImageData/)
})

test('实时页只在稳定结果后展示姓名，并提供不重启硬件的下一位人员操作', async () => {
  const source = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  assert.match(source, /identity_resolved/)
  assert.match(source, /resetLiveSessionTarget/)
  assert.match(source, /下一位人员/)
  assert.match(source, /resetPending/)
  assert.match(source, /disabled=\{!isScanning \|\| resetPending\}/)
  assert.match(source, /保持.*RUNNING|state.*RUNNING/)
})

test('前端频谱渲染使用后端固定 dB 量化，不按窗口最小最大值拉伸', async () => {
  const source = await readFile(new URL('../src/features/recognition/liveSpectrogram.mjs', import.meta.url), 'utf8')
  assert.match(source, /uint8_db/)
  assert.match(source, /preview_db_floor/)
  assert.match(source, /preview_db_ceiling/)
  assert.doesNotMatch(source, /let minimum|let maximum|maximum - minimum/)
})

test('前端只在 live listener 已就绪且会话 RUNNING 后进入采集中', async () => {
  const statuses = [
    { state: 'LISTENER_READY', session_id: 'live-1', runtime: { source_mode: 'live', live_listener_ready: true } },
    { state: 'COUNTDOWN', session_id: 'live-1', runtime: { source_mode: 'live', live_listener_ready: true } },
    { state: 'RUNNING', session_id: 'live-1', runtime: { source_mode: 'live', live_listener_ready: true } }
  ]
  let index = 0
  const ready = await waitForLiveSessionReady(
    { state: 'PREFLIGHT', session_id: 'live-1', runtime: { source_mode: 'synthetic', live_listener_ready: false } },
    async () => statuses[index++],
    { maxAttempts: 4, delay: async () => {} }
  )
  assert.equal(ready.state, 'RUNNING')
  assert.equal(index, 3)
})

test('dev proxy exposes backend health on the frontend port', async () => {
  const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8')
  assert.match(vite, /['"]\/_backend\/health['"]/)
  assert.match(vite, /target:\s*process\.env\.VITE_RADAR_API_BASE/)
  assert.match(vite, /rewrite:\s*\(\)\s*=>\s*['"]\/api\/health['"]/)
})

test('GitHub Pages 构建使用仓库路径并让路由复用 Vite 基础路径', async () => {
  const [vite, app] = await Promise.all([
    readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')
  ])
  assert.match(vite, /base:\s*process\.env\.GITHUB_ACTIONS\s*\?\s*['\"]\/GAITSENSE\/['\"]\s*:\s*['\"]\/['\"]/)
  assert.match(app, /<Router\s+basename=\{import\.meta\.env\.BASE_URL\}>/)
})

test('backend health view uses the same-origin health proxy', async () => {
  const page = await readFile(new URL('../public/backend-health.html', import.meta.url), 'utf8')
  assert.match(page, /fetch\(['"]\/_backend\/health['"]/)
  assert.match(page, /id=['"]status['"]/)
  assert.match(page, /id=['"]source['"]/)
})

test('后端启动失败时不把 session_id 当作采集成功', async () => {
  await assert.rejects(
    waitForLiveSessionReady(
      { state: 'PREFLIGHT', session_id: 'live-failed' },
      async () => ({ state: 'FAILED', session_id: 'live-failed', error: 'direct UDP evidence gate failed' }),
      { maxAttempts: 2, delay: async () => {} }
    ),
    /direct UDP evidence gate failed/
  )
})

test('实时启动失败后保留后端错误并在待机区域展示', async () => {
  const source = await readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8')
  assert.match(source, /const \[startError, setStartError\] = useState\(''\)/)
  assert.match(source, /status\?\.error/)
  assert.match(source, /error instanceof Error \? error\.message : String\(error\)/)
  assert.match(source, /startError\s*\?/)
})

test('正式页面保留原版路由与可见文案，识别页没有 mock cycle', async () => {
  const [app, live, identities, insights, store] = await Promise.all([
    readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/LivePage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/IdentitiesPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/pages/InsightsPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/context/StoreContext.jsx', import.meta.url), 'utf8')
  ])
  for (const route of ['path="/"', 'path="/live"', 'path="/identities"', 'path="/insights"']) assert.match(app, new RegExp(route.replace(/[\\/]/g, '\\$&')))
  assert.match(live, /micro_doppler_preview|previewHistory/)
  assert.match(live, /startLiveSession/)
  assert.match(live, /stopLiveSession/)
  assert.doesNotMatch(live, /evaluateSubject|mockDatabase|Math\.random/)
  assert.doesNotMatch(identities, /Math\.random|setTimeout\(/)
  assert.doesNotMatch(insights, /DEMO_EVENTS|DEMO_ZONES|Math\.random/)
  assert.match(store, /createCompetitionSession/)
  assert.match(store, /getPersonnel/)
  assert.match(store, /getRuntimeEvents/)
  assert.match(store, /getRuntimeAuditLogs/)
})
