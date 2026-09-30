<script setup lang="ts">
/**
 * A finger signature, for a tablet or phone passed across the counter.
 *
 * Pointer events rather than touch or mouse ones, so a finger, a stylus and a
 * mouse all draw the same line. `touch-none` stops the page scrolling under
 * the stroke — without it the first downward stroke on a phone scrolls the
 * form instead of signing it.
 *
 * The ink is the element's own text colour, read at draw time, so the pad
 * follows the theme without a colour written into this file.
 */
const model = defineModel<string>({ default: '' })
defineProps<{ label: string; hint: string; clearLabel: string }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let drawing = false
let fittedWidth = 0

function context(): CanvasRenderingContext2D | null {
  return canvas.value?.getContext('2d') ?? null
}

function fit(): void {
  const element = canvas.value
  // Only a WIDTH change refits. A phone keyboard opening changes the viewport
  // height and fires resize — refitting then would wipe a signature the moment
  // the next field is tapped.
  if (!element || element.clientWidth === fittedWidth) return
  fittedWidth = element.clientWidth
  // Resizing a canvas wipes its bitmap. A tablet turned sideways after the
  // customer signed must not silently lose the signature, so the old bitmap
  // is copied out first and painted back, stretched to the new size.
  const previous = model.value ? document.createElement('canvas') : null
  if (previous) {
    previous.width = element.width
    previous.height = element.height
    previous.getContext('2d')?.drawImage(element, 0, 0)
  }
  const ratio = window.devicePixelRatio || 1
  element.width = Math.round(element.clientWidth * ratio)
  element.height = Math.round(element.clientHeight * ratio)
  const ctx = context()
  if (!ctx) return
  if (previous) ctx.drawImage(previous, 0, 0, element.width, element.height)
  ctx.scale(ratio, ratio)
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (previous) model.value = inked(element)
}

function point(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.value!.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function start(event: PointerEvent): void {
  const ctx = context()
  if (!ctx) return
  drawing = true
  canvas.value!.setPointerCapture(event.pointerId)
  ctx.strokeStyle = getComputedStyle(canvas.value!).color
  const { x, y } = point(event)
  ctx.beginPath()
  ctx.moveTo(x, y)
  // A dot for a tap, so an initial is not lost.
  ctx.lineTo(x + 0.1, y + 0.1)
  ctx.stroke()
}

function move(event: PointerEvent): void {
  if (!drawing) return
  const ctx = context()
  if (!ctx) return
  const { x, y } = point(event)
  ctx.lineTo(x, y)
  ctx.stroke()
}

function end(): void {
  if (!drawing) return
  drawing = false
  model.value = inked(canvas.value!)
}

/**
 * The exported signature is always black on transparent. On screen the ink is
 * the theme's text colour — near-white in dark mode — and a near-white stroke
 * printed on a white receipt is no signature at all.
 */
function inked(source: HTMLCanvasElement): string {
  const copy = document.createElement('canvas')
  copy.width = source.width
  copy.height = source.height
  const ctx = copy.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, copy.width, copy.height)
  return copy.toDataURL('image/png')
}

function clear(): void {
  const element = canvas.value
  const ctx = context()
  if (!element || !ctx) return
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, element.width, element.height)
  ctx.restore()
  model.value = ''
}

onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
})
onBeforeUnmount(() => window.removeEventListener('resize', fit))
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-3 text-sm">
      <span class="text-content-muted">{{ label }}</span>
      <button type="button" class="btn-secondary h-9 px-3 text-xs" @click="clear">{{ clearLabel }}</button>
    </div>
    <canvas
      ref="canvas"
      class="mt-1 block h-44 w-full touch-none rounded-lg border border-surface-border bg-surface-raised text-content-strong"
      :aria-label="label"
      role="img"
      @pointerdown.prevent="start"
      @pointermove.prevent="move"
      @pointerup="end"
      @pointercancel="end"
      @pointerleave="end"
    />
    <p class="mt-1 text-xs text-content-muted">{{ hint }}</p>
  </div>
</template>
