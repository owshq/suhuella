import {
  LOCAL_MODEL_ENGINES,
  parseEngineModels,
  type DetectedLocalModel,
  type LocalModelEngineDefinition,
} from '@suhuella/product/lib/local-model-discovery.ts'

const PROBE_TIMEOUT_MS = 900

function listUrl(engine: LocalModelEngineDefinition): string {
  return `http://${engine.host}:${engine.port}${engine.listPath}`
}

async function probeEngine(engine: LocalModelEngineDefinition): Promise<DetectedLocalModel[]> {
  try {
    const response = await fetch(listUrl(engine), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    if (!response.ok) return []
    const payload = await response.json()
    return parseEngineModels(engine, payload)
  } catch {
    return []
  }
}

export async function probeLocalModelsDesktop(): Promise<DetectedLocalModel[]> {
  const batches = await Promise.all(LOCAL_MODEL_ENGINES.map((engine) => probeEngine(engine)))
  const seen = new Set<string>()
  const models: DetectedLocalModel[] = []
  for (const batch of batches) {
    for (const model of batch) {
      const key = `${model.engineId}:${model.model}`
      if (seen.has(key)) continue
      seen.add(key)
      models.push(model)
    }
  }
  return models
}
