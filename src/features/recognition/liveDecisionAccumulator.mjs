const MAX_CONTEXTS = 256

export function createDecisionAccumulatorState() {
  return { contexts: new Map(), processed: new Set() }
}

export function advanceDecisionAccumulator(state, events = []) {
  const next = state || createDecisionAccumulatorState()
  for (const event of Array.isArray(events) ? events : []) {
    if (String(event?.source_mode || '').toLowerCase() !== 'live') continue
    const payload = event?.payload || {}
    const key = event.event_id || [
      event.event_type,
      payload.session_id || '',
      payload.record_id || '',
      payload.window_id || payload.source_window_id || '',
      payload.sequence ?? ''
    ].join('|')
    if (!key || next.processed.has(key)) continue
    next.processed.add(key)
    const contextKey = [
      payload.session_id || '',
      payload.record_id || '',
      payload.window_id || payload.source_window_id || '',
      payload.sequence ?? ''
    ].join('|')
    if (contextKey !== '|||') next.contexts.set(contextKey, event)
  }
  while (next.processed.size > MAX_CONTEXTS * 4) next.processed.delete(next.processed.values().next().value)
  while (next.contexts.size > MAX_CONTEXTS) next.contexts.delete(next.contexts.keys().next().value)
  return next
}
