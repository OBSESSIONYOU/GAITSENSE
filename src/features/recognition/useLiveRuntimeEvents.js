import { useEffect, useRef, useState } from 'react'
import { runtimeEventsWebSocketUrl } from '../../utils/runtimeApi'
import { isLiveEvent, runtimeEventKey } from '../../utils/runtimeData'

const STALE_AFTER_MS = 1800
const RECONNECT_MIN_MS = 250
const RECONNECT_MAX_MS = 5000
const MAX_EVENT_HISTORY = 512
const MAX_PREVIEW_HISTORY = 256
const MAX_SEEN_KEYS = 1024

const emptyState = () => ({
  connected: false,
  stale: true,
  lastEventAt: 0,
  events: {},
  eventHistory: [],
  previewHistory: [],
  streamPreviewHistory: []
})

export function useLiveRuntimeEvents(token = '') {
  const [state, setState] = useState(emptyState)
  const seenKeysRef = useRef(new Set())

  useEffect(() => {
    let closed = false
    let socket = null
    let reconnectTimer = null
    let connectTimer = null
    let staleTimer = null
    let reconnectDelay = RECONNECT_MIN_MS
    seenKeysRef.current = new Set()
    setState(emptyState())

    if (!token) return undefined

    const markStale = () => {
      setState((current) => ({
        ...current,
        stale: current.lastEventAt === 0 || Date.now() - current.lastEventAt > STALE_AFTER_MS
      }))
    }

    const scheduleReconnect = () => {
      if (closed || reconnectTimer !== null) return
      const delay = reconnectDelay
      reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS)
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        connect()
      }, delay)
    }

    const connect = () => {
      if (closed) return
      try {
        socket = new WebSocket(runtimeEventsWebSocketUrl(token))
      } catch {
        setState((current) => ({ ...current, connected: false }))
        scheduleReconnect()
        return
      }
      socket.onopen = () => {
        if (closed) {
          socket?.close()
          return
        }
        reconnectDelay = RECONNECT_MIN_MS
        setState((current) => ({ ...current, connected: true }))
      }
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data)
          if (!isLiveEvent(event) || !event?.event_type || !event?.payload) return
          const key = runtimeEventKey(event)
          if (!key || seenKeysRef.current.has(key)) return
          seenKeysRef.current.add(key)
          if (seenKeysRef.current.size > MAX_SEEN_KEYS) {
            const oldest = seenKeysRef.current.values().next().value
            if (oldest) seenKeysRef.current.delete(oldest)
          }
          setState((current) => {
            const eventHistory = [...current.eventHistory, event].slice(-MAX_EVENT_HISTORY)
            const previewHistory = event.event_type === 'micro_doppler_preview'
              ? [...current.previewHistory, event].slice(-MAX_PREVIEW_HISTORY)
              : current.previewHistory
            const streamPreviewHistory = event.event_type === 'micro_doppler_stream_preview'
              ? [...current.streamPreviewHistory, event].slice(-MAX_PREVIEW_HISTORY)
              : current.streamPreviewHistory
            return {
              ...current,
              connected: true,
              stale: false,
              lastEventAt: Date.now(),
              events: { ...current.events, [event.event_type]: event },
              eventHistory,
              previewHistory,
              streamPreviewHistory
            }
          })
        } catch {
          // Invalid frames are ignored; the transport remains available.
        }
      }
      socket.onerror = () => {
        if (!closed) setState((current) => ({ ...current, connected: false }))
      }
      socket.onclose = () => {
        socket = null
        setState((current) => ({ ...current, connected: false }))
        scheduleReconnect()
      }
    }

    // React StrictMode mounts effects twice in development. Defer the first
    // transport open so the probe mount is cleaned up before a socket exists.
    connectTimer = window.setTimeout(() => {
      connectTimer = null
      connect()
    }, 0)
    staleTimer = window.setInterval(markStale, 300)
    return () => {
      closed = true
      if (connectTimer !== null) window.clearTimeout(connectTimer)
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      if (staleTimer !== null) window.clearInterval(staleTimer)
      if (socket) {
        const activeSocket = socket
        activeSocket.onclose = null
        if (activeSocket.readyState === WebSocket.OPEN) {
          activeSocket.close()
        } else if (activeSocket.readyState === WebSocket.CONNECTING) {
          // Closing a CONNECTING browser socket emits a console warning. Let
          // the handshake settle, then close it without dispatching handlers.
          activeSocket.onerror = null
          activeSocket.onopen = () => activeSocket.close()
        }
      }
      socket = null
    }
  }, [token])

  return state
}
