export const TIME_BUCKETS = Array.from(
  { length: 12 },
  (_, index) => `${String(index * 2).padStart(2, '0')}:00`
)

export const FACILITY_ZONES = ['大厅入口', 'P3 核心区', '洁净区 A', '防疫科', '检验科']

export const getEffectiveStatus = (identity) => {
  const status = String(identity?.status || '').toUpperCase()
  if (status === 'SUSPENDED') return 'SUSPENDED'
  if (identity?.enrollment !== 'READY') return 'NOT_ACTIVE'
  return 'ACTIVE'
}
