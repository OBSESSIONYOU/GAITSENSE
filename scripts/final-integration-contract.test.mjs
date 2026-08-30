import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('capture API and drawer use the fixed ten-second attended capture contract', async () => {
  const api = await source('src/utils/runtimeApi.js')
  const page = await source('src/pages/IdentitiesPage.jsx')
  assert.match(api, /durationS\s*=\s*10/)
  assert.match(api, /consentConfirmed/)
  assert.doesNotMatch(page, /durationS:\s*5/)
  assert.match(page, /durationS:\s*10/)
})

test('formal browser identity data has a canonical and legacy adapter', async () => {
  const data = await source('src/utils/runtimeData.js')
  const store = await source('src/context/StoreContext.jsx')
  assert.match(data, /canonicalPersonnelId/)
  assert.match(data, /legacyPersonnelId/)
  assert.match(store, /departments/)
  assert.doesNotMatch(store, /LOCAL_ID[1-9]/)
})

test('department options come from the persisted server collection', async () => {
  const page = await source('src/pages/IdentitiesPage.jsx')
  const api = await source('src/utils/runtimeApi.js')
  assert.match(api, /getDepartments/)
  assert.match(api, /createDepartment/)
  assert.match(page, /departments\.map/)
  assert.doesNotMatch(page, /外包维护/)
})

test('新增人员先完成基础信息，再在权限步骤选择权限组', async () => {
  const page = await source('src/pages/IdentitiesPage.jsx')
  assert.match(page, /if \(!newName\.trim\(\) \|\| !newDept\.trim\(\)\)/)
  assert.doesNotMatch(page, /if \(!newName\.trim\(\) \|\| !newDept\.trim\(\) \|\| !newScope\)/)
  assert.match(page, /const selectedGroupId = newScope \|\| \(wizardMode === 'reenroll' \? target\.groupId : ''\)/)
  assert.match(page, /if \(!selectedGroupId\)/)
  assert.match(page, /captureState !== 'done'[\s\S]*权限分配/)
  assert.match(page, /value=\{newScope\}[\s\S]*请选择权限组/)
})

test('live preview is rendered as direct pixels without a second interpolation path', async () => {
  const page = await source('src/pages/LivePage.jsx')
  const canvas = await source('src/features/recognition/LiveSpectrogramCanvas.jsx')
  assert.match(page, /LiveSpectrogramCanvas/)
  assert.match(canvas, /putImageData/)
  assert.doesNotMatch(page, /backgroundImage/)
  assert.doesNotMatch(canvas, /drawImage|imageSmoothingEnabled/)
})

test('模型激活后移动端实时页仍显示服务器确认的 model_id 和版本', async () => {
  const page = await source('src/pages/LivePage.jsx')
  assert.match(page, /md:hidden[\s\S]*MODEL \/ /)
})
