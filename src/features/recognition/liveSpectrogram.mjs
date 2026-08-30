const MAX_PREVIEW_ROWS = 256
const MAX_PREVIEW_COLUMNS = 320
const DEFAULT_DB_FLOOR = -60
const DEFAULT_DB_CEILING = 0
const UINT8_MAX = 255
const SPECTROGRAM_STOPS = Object.freeze([
  [0.000, 0, 0, 128],
  [0.125, 0, 0, 255],
  [0.375, 0, 255, 255],
  [0.625, 255, 255, 0],
  [0.875, 255, 0, 0],
  [1.000, 128, 0, 0]
])

const previewPayload = (eventOrMatrix) => (
  Array.isArray(eventOrMatrix) ? null : eventOrMatrix?.payload || eventOrMatrix || null
)

const previewMatrix = (eventOrMatrix) => (
  Array.isArray(eventOrMatrix) ? eventOrMatrix : eventOrMatrix?.payload?.preview
)

export function isValidPreview(eventOrMatrix) {
  const matrix = previewMatrix(eventOrMatrix)
  if (!Array.isArray(matrix) || matrix.length === 0 || matrix.length > MAX_PREVIEW_ROWS) return false
  const width = Array.isArray(matrix[0]) ? matrix[0].length : 0
  if (width === 0 || width > MAX_PREVIEW_COLUMNS) return false
  const payload = previewPayload(eventOrMatrix)
  if (Array.isArray(payload?.preview_shape)) {
    if (payload.preview_shape[0] !== matrix.length || payload.preview_shape[1] !== width) return false
  }
  const encoding = payload?.preview_encoding
  return matrix.every((row) => Array.isArray(row) && row.length === width && row.every((value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return false
    return encoding !== 'uint8_db' || (Number.isInteger(numeric) && numeric >= 0 && numeric <= UINT8_MAX)
  }))
}

export function previewToNormalizedValue(eventOrMatrix, value) {
  const payload = previewPayload(eventOrMatrix)
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  if (payload?.preview_encoding === 'uint8_db') {
    return Math.max(0, Math.min(1, numeric / UINT8_MAX))
  }
  const floor = Number(payload?.preview_db_floor ?? DEFAULT_DB_FLOOR)
  const ceiling = Number(payload?.preview_db_ceiling ?? DEFAULT_DB_CEILING)
  if (Number.isFinite(floor) && Number.isFinite(ceiling) && ceiling > floor && payload?.preview_encoding === 'normalized_db') {
    return Math.max(0, Math.min(1, (numeric - floor) / (ceiling - floor)))
  }
  return Math.max(0, Math.min(1, numeric))
}

export function previewToDataUrl(eventOrMatrix) {
  if (!isValidPreview(eventOrMatrix) || typeof document === 'undefined') return ''
  const matrix = previewMatrix(eventOrMatrix)
  const height = matrix.length
  const width = matrix[0].length
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  const sourceContext = sourceCanvas.getContext('2d')
  if (!sourceContext) return ''

  const image = sourceContext.createImageData(width, height)
  matrix.forEach((row, y) => row.forEach((value, x) => {
    const [red, green, blue] = spectrogramColor(previewToNormalizedValue(eventOrMatrix, value))
    const offset = (y * width + x) * 4
    image.data[offset] = red
    image.data[offset + 1] = green
    image.data[offset + 2] = blue
    image.data[offset + 3] = 255
  }))
  sourceContext.putImageData(image, 0, 0)
  // The backend already supplies the bounded display grid. Keep the browser
  // path as a direct pixel upload; CSS handles smooth visual scaling.
  return sourceCanvas.toDataURL('image/png')
}

export function spectrogramColor(value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0))
  for (let index = 1; index < SPECTROGRAM_STOPS.length; index += 1) {
    const [stop, red, green, blue] = SPECTROGRAM_STOPS[index]
    if (normalized <= stop) {
      const [previousStop, previousRed, previousGreen, previousBlue] = SPECTROGRAM_STOPS[index - 1]
      const ratio = (normalized - previousStop) / (stop - previousStop)
      return [
        Math.round(previousRed + (red - previousRed) * ratio),
        Math.round(previousGreen + (green - previousGreen) * ratio),
        Math.round(previousBlue + (blue - previousBlue) * ratio)
      ]
    }
  }
  const [, red, green, blue] = SPECTROGRAM_STOPS[SPECTROGRAM_STOPS.length - 1]
  return [red, green, blue]
}
