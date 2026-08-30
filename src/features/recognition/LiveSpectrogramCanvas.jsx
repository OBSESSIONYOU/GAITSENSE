import React, { useEffect, useRef } from 'react'
import { isValidPreview, previewToNormalizedValue, spectrogramColor } from './liveSpectrogram.mjs'

const LiveSpectrogramCanvas = ({ preview, className = '' }) => {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context || !isValidPreview(preview)) {
      canvas.width = 1
      canvas.height = 1
      context?.clearRect(0, 0, 1, 1)
      return
    }
    const matrix = Array.isArray(preview) ? preview : preview.payload?.preview
    const height = matrix.length
    const width = matrix[0].length
    canvas.width = width
    canvas.height = height
    canvas.style.imageRendering = 'auto'
    canvas.style.display = 'block'
    const image = context.createImageData(width, height)
    matrix.forEach((row, y) => row.forEach((value, x) => {
      const [red, green, blue] = spectrogramColor(previewToNormalizedValue(preview, value))
      const offset = (y * width + x) * 4
      image.data[offset] = red
      image.data[offset + 1] = green
      image.data[offset + 2] = blue
      image.data[offset + 3] = 255
    }))
    context.putImageData(image, 0, 0)
  }, [preview])

  return <canvas ref={canvasRef} className={className} aria-label="微多普勒频谱" />
}

export default LiveSpectrogramCanvas
