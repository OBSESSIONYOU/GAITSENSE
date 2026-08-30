import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  getValidCaptureIds,
  getCaptureSelectionState,
  reconcileCaptureSelection,
  toggleCaptureSelection
} from '../src/utils/trainingSelection.mjs'

const records = [
  {
    subject_id: 'ID2',
    capture_id: 'ID2_trial02',
    state: 'COMPLETED',
    quality_status: 'PASS',
    evidence_complete: true,
    evidence_paths: ['raw/adc_payload.bin']
  },
  {
    subject_id: 'ID1',
    capture_id: 'ID1_trial02',
    state: 'COMPLETED',
    quality_status: 'PASS',
    evidence_complete: true,
    evidence_paths: ['raw/adc_payload.bin']
  },
  {
    subject_id: 'ID1',
    capture_id: 'ID1_trial03',
    state: 'FAILED',
    quality_status: 'PASS',
    evidence_complete: true,
    evidence_paths: ['raw/adc_payload.bin']
  },
  {
    subject_id: 'ID2',
    capture_id: 'ID2_trial03',
    state: 'COMPLETED',
    quality_status: 'PASS',
    evidence_complete: false,
    evidence_paths: []
  }
]

test('全选只返回当前人员的 PASS 且证据完整记录，并按 capture_id 排序', () => {
  assert.deepEqual(
    getValidCaptureIds(records, ['ID2', 'ID1']),
    ['ID1_trial02', 'ID2_trial02']
  )
})

test('人员变化自动补选新人员并移除旧人员，手动取消后保留明确空选择', () => {
  assert.deepEqual(
    reconcileCaptureSelection(records, ['ID1', 'ID2'], ['ID1_trial02']),
    ['ID1_trial02', 'ID2_trial02']
  )
  assert.deepEqual(
    reconcileCaptureSelection(records, ['ID2'], ['ID1_trial02']),
    ['ID2_trial02']
  )
  assert.deepEqual(toggleCaptureSelection(['ID1_trial02'], 'ID1_trial02'), [])
})

test('全选、部分选择和未选择状态可被前端直接展示', () => {
  assert.equal(getCaptureSelectionState([], ['ID1_trial02']), 'none')
  assert.equal(getCaptureSelectionState(['ID1_trial02'], ['ID1_trial02', 'ID2_trial02']), 'partial')
  assert.equal(getCaptureSelectionState(['ID2_trial02', 'ID1_trial02'], ['ID1_trial02', 'ID2_trial02']), 'all')
})

test('统计页训练模块真实位于 04 事件记录之后且不依赖 CSS order', async () => {
  const source = await readFile(new URL('../src/pages/InsightsPage.jsx', import.meta.url), 'utf8')
  const eventIndex = source.indexOf('04 / 事件记录')
  const trainingIndex = source.indexOf('<TrainingReadinessPanel')
  assert.ok(eventIndex >= 0)
  assert.ok(trainingIndex > eventIndex)
  assert.doesNotMatch(source, /order-(?:first|last|none|[1-9][0-9]*)/)
})

test('训练请求始终传递明确 captureIds，候选加载使用服务器版本接口', async () => {
  const [panel, api] = await Promise.all([
    readFile(new URL('../src/features/training/TrainingReadinessPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/runtimeApi.js', import.meta.url), 'utf8')
  ])
  assert.match(panel, /全选当前有效采集/)
  assert.match(panel, /取消全选/)
  assert.match(panel, /aria-label/)
  assert.match(panel, /已选采集/)
  assert.match(panel, /当前可用/)
  assert.match(panel, /部分选择/)
  assert.match(panel, /captureIds:\s*selectedCaptureIds/)
  assert.match(api, /model\/candidates/)
  assert.match(api, /activate/)
  assert.doesNotMatch(api, /modelPath|pythonModule|outputDir/)
})

test('批量移除与训练参数拥有独立状态，并提供常驻模型管理和阈值接口', async () => {
  const [panel, api] = await Promise.all([
    readFile(new URL('../src/features/training/TrainingReadinessPanel.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/utils/runtimeApi.js', import.meta.url), 'utf8')
  ])
  assert.match(panel, /selectedRemovalCaptureIds/)
  assert.match(panel, /全选无效数据/)
  assert.match(panel, /remaining_valid_capture_counts/)
  assert.match(panel, /maxEpochs/)
  assert.match(panel, /模型管理/)
  assert.match(panel, /待真实数据校准的初始值/)
  assert.match(api, /batch-preview/)
  assert.match(api, /batch-remove/)
  assert.match(api, /models\/versions/)
  assert.match(api, /threshold/)
})
