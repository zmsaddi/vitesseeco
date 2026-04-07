import groq from 'groq'

export { groq }

export function useSanityFetch<T = any>(query: string, params?: Record<string, any>) {
  const sanity = useSanity()
  const data = ref<T | null>(null)
  const pending = ref(true)

  const fetchData = async () => {
    pending.value = true
    try {
      // Resolve computed/ref params
      const resolvedParams: Record<string, any> = {}
      if (params) {
        for (const [key, val] of Object.entries(params)) {
          resolvedParams[key] = unref(val)
        }
      }
      data.value = await sanity.fetch<T>(query, resolvedParams)
    } catch (e) {
      console.error('Sanity fetch error:', e)
      data.value = null
    } finally {
      pending.value = false
    }
  }

  // Watch reactive params and refetch
  if (params) {
    const watchSources = Object.values(params).filter(v => isRef(v) || typeof v === 'function')
    if (watchSources.length) {
      watch(watchSources, fetchData, { immediate: true })
    } else {
      fetchData()
    }
  } else {
    fetchData()
  }

  return { data: data as Ref<T | null>, pending, refresh: fetchData }
}
