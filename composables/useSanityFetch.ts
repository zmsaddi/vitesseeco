export function useSanityFetch<T = any>(
  key: string | (() => string),
  query: string,
  params?: Record<string, any>
) {
  const resolveParams = () => {
    if (!params) return {}
    const resolved: Record<string, any> = {}
    for (const [k, v] of Object.entries(params)) {
      resolved[k] = isRef(v) ? v.value : typeof v === 'function' ? v() : v
    }
    return resolved
  }

  const resolveKey = () => typeof key === 'function' ? key() : key

  // Collect reactive sources for watch
  const watchSources: any[] = []
  if (params) {
    for (const v of Object.values(params)) {
      if (isRef(v)) watchSources.push(v)
    }
  }
  if (typeof key === 'function') watchSources.push(key)

  return useAsyncData<T>(
    resolveKey(),
    () => {
      const { client } = useSanity()
      return client.fetch<T>(query, resolveParams())
    },
    watchSources.length ? { watch: watchSources } : {}
  )
}
