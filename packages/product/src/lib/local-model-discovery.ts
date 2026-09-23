/**
 * Local model engines SuHuella can probe over HTTP on this device.
 * Extend LOCAL_MODEL_ENGINES to add more ports or runtimes later.
 */

export type LocalModelEngineId = 'ollama' | 'lmstudio'

export type LocalModelEngineDefinition = {
  id: LocalModelEngineId
  label: string
  host: string
  port: number
  listPath: string
  listKind: 'ollama_tags' | 'openai_models'
  apiBasePath: string
  installUrl: string
  installLabel: string
}

/** Single registry — add engines here. */
export const LOCAL_MODEL_ENGINES: LocalModelEngineDefinition[] = [
  {
    id: 'ollama',
    label: 'Ollama',
    host: '127.0.0.1',
    port: 11434,
    listPath: '/api/tags',
    listKind: 'ollama_tags',
    apiBasePath: '/v1',
    installUrl: 'https://ollama.com/download',
    installLabel: 'Install Ollama',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    host: '127.0.0.1',
    port: 1234,
    listPath: '/v1/models',
    listKind: 'openai_models',
    apiBasePath: '/v1',
    installUrl: 'https://lmstudio.ai',
    installLabel: 'Install LM Studio',
  },
]

export type DetectedLocalModel = {
  engineId: LocalModelEngineId
  engineLabel: string
  model: string
  baseUrl: string
}

export type LocalModelProbeResult = {
  models: DetectedLocalModel[]
  /** Browser could not reach localhost (mixed content, CORS, PNA). */
  browserBlocked?: boolean
}

function engineListUrl(engine: LocalModelEngineDefinition): string {
  return `http://${engine.host}:${engine.port}${engine.listPath}`
}

function engineApiBaseUrl(engine: LocalModelEngineDefinition): string {
  return `http://${engine.host}:${engine.port}${engine.apiBasePath}`
}

export function parseEngineModels(
  engine: LocalModelEngineDefinition,
  payload: unknown,
): DetectedLocalModel[] {
  const baseUrl = engineApiBaseUrl(engine)
  if (engine.listKind === 'ollama_tags') {
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { models?: unknown }).models)) {
      return []
    }
    return (payload as { models: Array<{ name?: string }> })
      .models.map((entry) => entry.name?.trim())
      .filter((name): name is string => Boolean(name))
      .map((model) => ({
        engineId: engine.id,
        engineLabel: engine.label,
        model,
        baseUrl,
      }))
  }
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { data?: unknown }).data)) {
    return []
  }
  return (payload as { data: Array<{ id?: string }> })
    .data.map((entry) => entry.id?.trim())
    .filter((id): id is string => Boolean(id))
    .map((model) => ({
      engineId: engine.id,
      engineLabel: engine.label,
      model,
      baseUrl,
    }))
}

export function detectedLocalModelKey(model: Pick<DetectedLocalModel, 'engineId' | 'model'>): string {
  return `${model.engineId}:${model.model}`
}

export function localModelConnectRequest(model: DetectedLocalModel): {
  assistant: 'local_server'
  apiKey: string
  model: string
  baseUrl: string
} {
  return {
    assistant: 'local_server',
    apiKey: 'ollama',
    model: model.model,
    baseUrl: model.baseUrl,
  }
}

export const BROWSER_LOCAL_MODEL_CORS_NOTE =
  'Connecting a local model from the browser requires your server to allow this site (for Ollama, set OLLAMA_ORIGINS). Without that, use built-in rules or connect a cloud assistant in the desktop app.'

export const DESKTOP_NO_LOCAL_MODEL_NOTE =
  'No local AI server was found on this computer. Install Ollama or LM Studio, start a model, then return here.'

export async function probeLocalModelsBrowser(): Promise<LocalModelProbeResult> {
  let browserBlocked = false
  const models: DetectedLocalModel[] = []
  const seen = new Set<string>()

  for (const engine of LOCAL_MODEL_ENGINES) {
    try {
      const response = await fetch(engineListUrl(engine), {
        signal: AbortSignal.timeout(900),
      })
      if (!response.ok) continue
      const payload = await response.json()
      for (const model of parseEngineModels(engine, payload)) {
        const key = detectedLocalModelKey(model)
        if (seen.has(key)) continue
        seen.add(key)
        models.push(model)
      }
    } catch {
      browserBlocked = true
    }
  }

  return {
    models,
    browserBlocked: browserBlocked && models.length === 0,
  }
}

export function runLocalModelDiscoveryChecks(): void {
  if (LOCAL_MODEL_ENGINES.length < 2) {
    throw new Error('local model registry must include Ollama and LM Studio')
  }
  const ollama = LOCAL_MODEL_ENGINES.find((engine) => engine.id === 'ollama')
  if (!ollama || ollama.port !== 11434) {
    throw new Error('Ollama must probe port 11434')
  }
  const parsed = parseEngineModels(ollama, { models: [{ name: 'llama3' }] })
  if (parsed[0]?.model !== 'llama3' || !parsed[0].baseUrl.includes('11434')) {
    throw new Error('Ollama model parse failed')
  }
  const lm = LOCAL_MODEL_ENGINES.find((engine) => engine.id === 'lmstudio')
  const lmParsed = parseEngineModels(lm!, { data: [{ id: 'local-model' }] })
  if (lmParsed[0]?.model !== 'local-model') {
    throw new Error('LM Studio model parse failed')
  }
}
