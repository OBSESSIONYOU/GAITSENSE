import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as captureData from '../src/utils/captureData.mjs'
import { readinessLabel, trainingCapabilities } from '../src/utils/trainingData.mjs'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')
const { captureProgress, captureStartFailureMessage, normalizeCaptureError } = captureData

test('采集目录使用真实动态计数并把进度绑定到后端遥测', () => {
  assert.deepEqual(captureProgress({ elapsed_s: 2.5, duration_s: 10 }), { elapsed: 2.5, target: 10, percent: 25 })
  assert.deepEqual(captureProgress({ elapsed_s: 14, duration_s: 10 }), { elapsed: 14, target: 10, percent: 100 })
})

test('拒绝采集显示结构化中文错误且明确不计有效次数', () => {
  const error = normalizeCaptureError({
    state: 'FAILED',
    result: {
      error_code: 'CAPTURE_QUEUE_FULL',
      operator_message: '采集缓存已满，系统已安全停止；本次未计入有效采集，请重试。',
      counts_as_valid_capture: false,
      telemetry: { queue_rejections: 2 }
    }
  })
  assert.equal(error.code, 'CAPTURE_QUEUE_FULL')
  assert.equal(error.countsAsValid, false)
  assert.equal(error.telemetry.queue_rejections, 2)
  assert.match(error.message, /未计入有效采集/)
})

test('采集启动失败保留后端原因而不是只提示连接失败', () => {
  assert.equal(
    captureStartFailureMessage({ message: 'live recognition is using DCA1000/UDP 4098', code: 'STATE_CONFLICT' }),
    '实时识别正在占用雷达链路，请先停止实时识别后再采集。'
  )
  assert.equal(
    captureStartFailureMessage({ message: '硬件预检未通过：DCA1000: no packet' }),
    '硬件预检未通过：DCA1000: no packet'
  )
  assert.match(captureStartFailureMessage({ message: 'Failed to fetch' }), /后端不可达/)
})

test('采集状态只接受本次 capture_id，旧完成结果不得提前结束新采集', () => {
  assert.equal(typeof captureData.captureStatusDisposition, 'function')
  assert.equal(
    captureData.captureStatusDisposition(
      { state: 'COMPLETED', capture_id: 'ID3_trial15', result: { quality_status: 'PASS' } },
      'ID3_trial16'
    ),
    'ignore'
  )
  assert.equal(
    captureData.captureStatusDisposition(
      { state: 'CAPTURING', capture_id: 'ID3_trial16' },
      'ID3_trial16'
    ),
    'active'
  )
  assert.equal(
    captureData.captureStatusDisposition(
      { state: 'COMPLETED', capture_id: 'ID3_trial16', result: { quality_status: 'PASS' } },
      'ID3_trial16'
    ),
    'done'
  )
})

test('冲突恢复只接管同一人员的活动采集会话', () => {
  assert.equal(typeof captureData.canAdoptCaptureSession, 'function')
  assert.equal(captureData.canAdoptCaptureSession({ state: 'PREFLIGHT', subject_id: 'ID3', capture_id: 'ID3_trial16' }, 'ID3'), true)
  assert.equal(captureData.canAdoptCaptureSession({ state: 'CAPTURING', subject_id: 'ID2', capture_id: 'ID2_trial16' }, 'ID3'), false)
  assert.equal(captureData.canAdoptCaptureSession({ state: 'COMPLETED', subject_id: 'ID3', capture_id: 'ID3_trial15' }, 'ID3'), false)
})

test('采集轮询清理只停止轮询，不得误停后端采集会话', async () => {
  const page = await read('src/pages/IdentitiesPage.jsx')
  const pollingCleanup = page.slice(
    page.indexOf('const pollTimer = window.setInterval'),
    page.indexOf('}, [captureExpectedId, captureState, refresh, session?.token]')
  )
  assert.match(pollingCleanup, /clearInterval\(pollTimer\)/)
  assert.doesNotMatch(pollingCleanup, /stopCaptureSession/)

  const explicitCancel = page.slice(
    page.indexOf('const cancelCapture = async'),
    page.indexOf('const closeEnrollment')
  )
  assert.match(explicitCancel, /stopCaptureSession/)
})

test('人员采集一次点击后锁定到本次编号，完成或中断后才开放下一步', async () => {
  const page = await read('src/pages/IdentitiesPage.jsx')
  assert.match(page, /captureExpectedId/)
  assert.match(page, /setCaptureState\('starting'\)/)
  assert.match(page, /captureStatusDisposition\(status, captureExpectedId\)/)
  assert.match(page, /canAdoptCaptureSession\(current, target\.id\)/)
  assert.match(page, /captureState === 'stopping'/)
  assert.match(page, /setCaptureState\(captureStatusDisposition\(status, captureExpectedId\) === 'done' \? 'done' : 'rejected'\)/)
  assert.match(page, /captureStopSentRef\.current = false;[\s\S]*setCaptureState\('in_progress'\)/)
  assert.match(page, /中断本组采集/)
  assert.match(page, /正在建立采集会话/)
  assert.match(page, /正在安全停止采集/)
  assert.doesNotMatch(page, /alert\(error\?\.message \|\| '雷达采集未启动。'\)/)
})

test('训练能力按最弱人员分层，不制造测试准确率', () => {
  const capability = trainingCapabilities({
    selected_subject_ids: ['ID1', 'ID2'],
    evidence_level: 'TRAIN_ONLY_UNVALIDATED',
    training_allowed: true,
    classification_allowed: true,
    data_check_allowed: true,
    promotion_allowed: false,
    warnings: ['暂无独立测试集']
  })
  assert.equal(readinessLabel('TRAIN_ONLY_UNVALIDATED'), '仅训练，未验证')
  assert.equal(capability.canTrain, true)
  assert.equal(capability.canPromote, false)
  assert.equal(capability.testAccuracy, null)
})

test('模型晋级必须同时有独立测试和开放集证据', () => {
  const capability = trainingCapabilities({
    selected_subject_ids: ['ID1', 'ID2'],
    evidence_level: 'SESSION_SPLIT_COMPLETE',
    training_allowed: true,
    promotion_allowed: true,
    checks: {
      independent_test_available: true,
      open_set_validated: false,
      access_control_validated: false
    }
  })
  assert.equal(capability.canPromote, false)
})

test('正式采集和训练页面不再出现固定目标计数或宽度进度条', async () => {
  const page = await read('src/pages/IdentitiesPage.jsx')
  assert.doesNotMatch(page, /已通过[^\n]*\/\s*15|\b15\s*组|w-\[60%\]/)
})

test('统计页提供服务端驱动的动态训练就绪与启动入口', async () => {
  const [page, panel, api] = await Promise.all([
    read('src/pages/InsightsPage.jsx'),
    read('src/features/training/TrainingReadinessPanel.jsx'),
    read('src/utils/runtimeApi.js')
  ])
  assert.match(page, /TrainingReadinessPanel/)
  assert.match(panel, /getTrainingReadiness/)
  assert.match(panel, /startTrainingSession/)
  assert.match(panel, /captureCatalog/)
  assert.match(panel, /canCheck|export_allowed/)
  assert.match(api, /training\/readiness/)
  assert.match(api, /training\/session\/start/)
  assert.doesNotMatch(panel, /15组|\/15|Math\.random|accuracy\s*:/)
})

test('统计页读取判定类型事件并显示持久采集目录摘要', async () => {
  const [store, page] = await Promise.all([
    read('src/context/StoreContext.jsx'),
    read('src/pages/InsightsPage.jsx')
  ])
  assert.match(store, /ANALYTICS_EVENT_TYPES/)
  assert.doesNotMatch(store, /getRuntimeEvents\('', token, 200\)/)
  assert.match(page, /captureCatalog/)
  assert.match(page, /PASS 有效采集/)
  assert.match(page, /FAIL 失败采集/)
})

test('采集记录全部由操作员决定是否勾选和移除', async () => {
  const panel = await read('src/features/training/TrainingReadinessPanel.jsx')
  assert.match(panel, /allServerCaptureRecords[\s\S]*captureCatalog\?\.records/)
  assert.doesNotMatch(panel, /record\.deletable|受保护/)
  assert.doesNotMatch(panel, /disabled=\{!deletable/)
  assert.match(panel, /onChange=\{\(\) => toggleRemovalCapture\(id\)\}/)
  assert.match(panel, /checked=\{selectedRemovalCaptureIds\.includes\(id\)\}[\s\S]{0,160}disabled=\{busy\}/)
  const removalHandlers = panel.slice(
    panel.indexOf('const handleDeleteCapture'),
    panel.indexOf('const handleActivateCandidate')
  )
  assert.doesNotMatch(removalHandlers, /recognitionRunning/)
  assert.match(panel, /onClick=\{\(\) => handleDeleteCapture\(record\)\}/)
  assert.match(panel, /grid-cols-\[auto_minmax\(0,1fr\)_auto_auto\]/)
  assert.match(panel, /captureSubjectId/)
  assert.match(panel, /updated_at|updatedAt/)
  assert.match(panel, /captureSummary/)
  assert.match(panel, /全部服务端记录均可查看，可按需勾选或删除/)
})

test('实时页消费独立流式预览并使用 Jet 色谱直接像素映射', async () => {
  const [page, hook, canvas, palette] = await Promise.all([
    read('src/pages/LivePage.jsx'),
    read('src/features/recognition/useLiveRuntimeEvents.js'),
    read('src/features/recognition/LiveSpectrogramCanvas.jsx'),
    read('src/features/recognition/liveSpectrogram.mjs')
  ])
  assert.match(hook, /streamPreviewHistory/)
  assert.match(page, /findLatestLiveStreamPreviewForRun|streamPreviewHistory/)
  assert.match(page, /display_axis_unit|preview_doppler_axis/)
  assert.match(palette, /SPECTROGRAM_STOPS/)
  assert.match(canvas, /spectrogramColor/)
})

test('统计页在窄屏不强制固定宽度', async () => {
  const page = await read('src/pages/InsightsPage.jsx')
  assert.doesNotMatch(page, /min-w-\[950px\]/)
})

test('身份列表窄屏使用可读卡片而不是压缩七列布局', async () => {
  const page = await read('src/pages/IdentitiesPage.jsx')
  assert.match(page, /data-mobile-identity-list/)
  assert.match(page, /data-mobile-identity-card/)
  assert.match(page, /hidden sm:flex/)
})

test('统计页摘要卡片在窄屏允许收缩', async () => {
  const page = await read('src/pages/InsightsPage.jsx')
  assert.match(page, /grid-cols-2/)
  assert.match(page, /min-w-0/)
})

test('窄屏保留可展开的正式路由导航', async () => {
  const nav = await read('src/components/Navbar.jsx')
  assert.match(nav, /data-mobile-nav-toggle/)
  assert.match(nav, /id="mobile-navigation"/)
  assert.match(nav, /md:hidden/)
  assert.match(nav, /z-\[60\]/)
})
