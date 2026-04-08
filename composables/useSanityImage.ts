export function useSanityImageUrl(image: any, width?: number, height?: number): string {
  if (!image?.asset?._ref && !image?.asset?._id) return ''

  const ref = image.asset._ref || image.asset._id
  // Parse ref: image-abc123-800x600-png → abc123-800x600.png
  const [, id, dimensions, format] = ref.match(/^image-([a-zA-Z0-9]+)-(\d+x\d+)-(\w+)$/) || []

  if (!id) return ''

  let url = `https://cdn.sanity.io/images/2jvnjf0c/production/${id}-${dimensions}.${format}`

  const params: string[] = []
  if (width) params.push(`w=${width}`)
  if (height) params.push(`h=${height}`)
  params.push('fit=crop')
  params.push('auto=format')

  if (params.length) url += `?${params.join('&')}`

  return url
}
