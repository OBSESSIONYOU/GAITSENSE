export const DEMO_GROUPS = [
  { id: 'AG-101', name: '全区域通行', level: 'HIGH', desc: '最高权限组，适用于核心专家', zones: ['大厅入口', 'P3 核心区', '洁净区 A', '防疫科', '检验科'] },
  { id: 'AG-102', name: '基础通行区', level: 'LOW', desc: '基础区域通行权限', zones: ['大厅入口'] },
  { id: 'AG-103', name: '洁净区专线', level: 'MEDIUM', desc: '针对实验人员的洁净区专属路线', zones: ['大厅入口', '洁净区 A', '检验科'] },
  { id: 'AG-104', name: '仅限大厅', level: 'LOW', desc: '仅允许进入大厅入口', zones: ['大厅入口'] }
];

export const DEMO_IDENTITIES = [
  { id: 'GS-0102', name: '陈伟', nameEn: 'CHEN WEI', department: '检验科', status: 'ACTIVE', enrollment: 'READY', groupId: 'AG-101', createdTime: '2025-10-12', captures: 4 },
  { id: 'GS-0118', name: '刘强', nameEn: 'LIU QIANG', department: '防疫科', status: 'ACTIVE', enrollment: 'INCOMPLETE', groupId: 'AG-102', createdTime: '2025-11-05', captures: 1 },
  { id: 'GS-0240', name: '王芳', nameEn: 'WANG FANG', department: '实验室', status: 'ACTIVE', enrollment: 'READY', groupId: 'AG-103', createdTime: '2026-02-14', captures: 4 },
  { id: 'GS-0315', name: '李娜', nameEn: 'LI NA', department: '安保处', status: 'SUSPENDED', enrollment: 'READY', groupId: 'AG-104', createdTime: '2026-04-20', captures: 4 },
  { id: 'GS-0001', name: '赵院士', nameEn: 'ZHAO', department: '核心专家组', status: 'ACTIVE', enrollment: 'READY', groupId: 'AG-101', createdTime: '2022-01-01', captures: 12 }
];

export const DEMO_ZONES = ['大厅入口', 'P3 核心区', '洁净区 A', '防疫科', '检验科'];
export const DEMO_SENSORS = [
  { id: 'RD-01', zone: 'P3 核心区' }, { id: 'RD-02', zone: '洁净区 A' },
  { id: 'RD-03', zone: '大厅入口' }, { id: 'RD-04', zone: '防疫科' }, { id: 'RD-05', zone: '检验科' }
];
export const TIME_BUCKETS = Array.from({ length: 12 }, (_, i) => `${String(i * 2).padStart(2, '0')}:00`);
export const OPEN_SET_THRESHOLD = 0.61;

export const getEffectiveStatus = (identity) => {
  if (identity?.status === 'SUSPENDED') return 'SUSPENDED';
  if (identity?.enrollment !== 'READY') return 'NOT_ACTIVE';
  return 'ACTIVE';
};

export const evaluateSubject = (subject, context = {}) => {
  const sensor = DEMO_SENSORS.find(item => item.id === context.sensorId) || DEMO_SENSORS[0];
  const zone = context.zone || sensor.zone;
  const groupCatalog = context.groups || DEMO_GROUPS;
  const group = subject && groupCatalog.find(item => item.id === subject.groupId);
  const unknown = !subject || subject.identityDecision === 'UNKNOWN' || subject.id === null;
  const rawScore = context.matchScore ?? (unknown ? 0.42 : 0.86 + ((subject.id.charCodeAt(subject.id.length - 1) % 12) / 100));
  const matchScore = Math.max(0, Math.min(1, Number(rawScore)));
  let accessResult = 'AUTHORIZED';
  let denyReason = null;
  if (unknown) { accessResult = 'DENIED'; denyReason = 'UNKNOWN_IDENTITY'; }
  else if (subject.status === 'SUSPENDED') { accessResult = 'DENIED'; denyReason = 'IDENTITY_SUSPENDED'; }
  else if (subject.enrollment !== 'READY') { accessResult = 'DENIED'; denyReason = 'ENROLLMENT_INCOMPLETE'; }
  else if (!group || !group.zones.includes(zone)) { accessResult = 'DENIED'; denyReason = 'OUT_OF_SCOPE'; }
  return {
    identityId: unknown ? null : subject.id, name: unknown ? '未知人员' : subject.name,
    nameEn: unknown ? 'UNKNOWN' : (subject.nameEn || subject.name), department: unknown ? '--' : subject.department,
    identityDecision: unknown ? 'UNKNOWN' : 'KNOWN', matchScore, accessResult, denyReason,
    sensorId: sensor.id, zone, accessGroup: unknown ? null : subject.groupId, mode: 'OPEN-SET',
    status: accessResult, id: unknown ? null : subject.id, role: unknown ? '--' : subject.department,
    pinyin: unknown ? 'UNKNOWN' : (subject.nameEn || subject.name), access: group?.name || '无权限',
    confidence: Math.round(matchScore * 100)
  };
};

const eventFromEvaluation = (id, time, result) => ({
  id, time, type: 'Recognition', identityId: result.identityId,
  identity: result.identityDecision === 'UNKNOWN' ? 'Unknown' : result.name, name: result.name, nameEn: result.nameEn,
  department: result.department, identityDecision: result.identityDecision, zone: result.zone,
  sensorId: result.sensorId, sensor: result.sensorId, accessGroup: result.accessGroup,
  accessResult: result.accessResult, result: result.accessResult, denyReason: result.denyReason,
  matchScore: result.matchScore, threshold: OPEN_SET_THRESHOLD, mode: result.mode
});

const pad = value => String(value).padStart(2, '0');
const generateEvents = (count = 120) => {
  const events = [];
  for (let i = 0; i < count; i += 1) {
    const hour = (i * 7) % 24; const minute = (i * 13) % 60;
    const sensorIndex = i % 11 === 2 ? 0 : i % DEMO_SENSORS.length;
    const sensor = DEMO_SENSORS[sensorIndex]; const unknown = i % 7 === 0;
    const subject = unknown ? null : DEMO_IDENTITIES[i % DEMO_IDENTITIES.length];
    const zone = sensor.zone;
    const result = evaluateSubject(subject, { sensorId: sensor.id, zone, matchScore: unknown ? 0.35 + (i % 15) / 100 : undefined });
    events.push(eventFromEvaluation(`EV-${1000 + i}`, `${pad(hour)}:${pad(minute)}:${pad((i * 17) % 60)}`, result));
  }
  return events.sort((a, b) => b.time.localeCompare(a.time));
};
export const DEMO_EVENTS = generateEvents();

export const validateDemoData = ({ identities = DEMO_IDENTITIES, groups = DEMO_GROUPS, events = DEMO_EVENTS } = {}) => {
  const errors = []; const groupIds = new Set(groups.map(group => group.id));
  const sensors = new Map(DEMO_SENSORS.map(sensor => [sensor.id, sensor]));
  identities.forEach(identity => { if (!groupIds.has(identity.groupId)) errors.push(`Identity ${identity.id} references missing group`); });
  events.forEach(event => {
    const sensor = sensors.get(event.sensorId || event.sensor); const access = event.accessResult || event.result;
    if (!sensor) errors.push(`Event ${event.id} references missing sensor`);
    if (sensor && sensor.zone !== event.zone) errors.push(`Event ${event.id} zone does not match sensor`);
    if (!['KNOWN', 'UNKNOWN'].includes(event.identityDecision)) errors.push(`Event ${event.id} has invalid identityDecision`);
    if (!['AUTHORIZED', 'DENIED'].includes(access)) errors.push(`Event ${event.id} has invalid accessResult`);
    if (event.identityDecision === 'UNKNOWN' && access !== 'DENIED') errors.push(`Unknown event ${event.id} is not denied`);
    if (access === 'AUTHORIZED' && event.identityDecision !== 'KNOWN') errors.push(`Authorized event ${event.id} is unknown`);
    if (typeof event.matchScore !== 'number' || typeof event.threshold !== 'number') errors.push(`Event ${event.id} score fields are not numbers`);
  });
  if (errors.length) errors.forEach(error => console.error('[GAITSENSE]', error));
  else console.info('[GAITSENSE] Demo data validated.');
  return errors;
};
