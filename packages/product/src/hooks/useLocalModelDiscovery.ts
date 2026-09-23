import { useCallback, useEffect, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import type { DetectedLocalModel, LocalModelProbeResult } from '../lib/local-model-discovery'

export function useLocalModelDiscovery(enabled = true) {
  const [result, setResult] = useState<LocalModelProbeResult>({ models: [] })
  const [probing, setProbing] = useState(false)

  const refresh = useCallback(async () => {
    setProbing(true)
    try {
      const next = await getSuhuellaApi().probeLocalModels()
      setResult(next)
      return next
    } catch {
      const empty = { models: [] as DetectedLocalModel[] }
      setResult(empty)
      return empty
    } finally {
      setProbing(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
  }, [enabled, refresh])

  return { ...result, probing, refresh }
}
