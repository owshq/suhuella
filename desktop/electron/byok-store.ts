import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import { clearByokConversation } from './byok-conversation.ts'
import {
  assistantLabel,
  isByokAssistantId,
  isByokProviderId,
  validateByokConnectInput,
} from './byok.ts'
import type { ByokAssistantId, ByokConnectResult, ByokProviderId, ByokStatus } from '../src/types.ts'

const BYOK_FILE = 'byok.json'

type StoredByokRecord = {
  assistant: ByokAssistantId | null
  provider: ByokProviderId | null
  model: string | null
  baseUrl: string | null
  encryptedKey: string | null
  encryption: 'safeStorage' | null
}

const EMPTY_RECORD: StoredByokRecord = {
  assistant: null,
  provider: null,
  model: null,
  baseUrl: null,
  encryptedKey: null,
  encryption: null,
}

export function getByokFilePath(userDataDir: string): string {
  return path.join(userDataDir, BYOK_FILE)
}

function emptyStatus(): ByokStatus {
  return {
    connected: false,
    assistant: null,
    assistantLabel: null,
    model: null,
    hasKey: false,
  }
}

function toStatus(record: StoredByokRecord): ByokStatus {
  const connected = Boolean(record.assistant && record.encryptedKey && record.model)
  return {
    connected,
    assistant: record.assistant,
    assistantLabel: assistantLabel(record.assistant),
    model: record.model,
    hasKey: Boolean(record.encryptedKey),
  }
}

function readRecord(userDataDir: string): StoredByokRecord {
  const filePath = getByokFilePath(userDataDir)
  if (!existsSync(filePath)) return { ...EMPTY_RECORD }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredByokRecord> & {
      provider?: ByokProviderId
    }
    let assistant: ByokAssistantId | null = isByokAssistantId(parsed.assistant)
      ? parsed.assistant
      : null
    if (!assistant && isByokProviderId(parsed.provider)) {
      assistant =
        parsed.provider === 'openai'
          ? 'openai'
          : parsed.provider === 'anthropic'
            ? 'anthropic'
            : 'compatible_api'
    }
    return {
      assistant,
      provider: isByokProviderId(parsed.provider) ? parsed.provider : null,
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : null,
      baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl.trim() : null,
      encryptedKey:
        typeof parsed.encryptedKey === 'string' && parsed.encryptedKey.trim()
          ? parsed.encryptedKey
          : null,
      encryption: parsed.encryption === 'safeStorage' ? 'safeStorage' : null,
    }
  } catch {
    return { ...EMPTY_RECORD }
  }
}

function writeRecord(userDataDir: string, record: StoredByokRecord): StoredByokRecord {
  mkdirSync(userDataDir, { recursive: true })
  writeFileSync(getByokFilePath(userDataDir), `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return record
}

function encryptKey(apiKey: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  return safeStorage.encryptString(apiKey).toString('base64')
}

function decryptKey(encryptedKey: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encryptedKey, 'base64'))
  } catch {
    return null
  }
}

export function getByokStatus(userDataDir: string): ByokStatus {
  return toStatus(readRecord(userDataDir))
}

export function connectByok(userDataDir: string, input: unknown): ByokConnectResult {
  const parsed = validateByokConnectInput(input)
  if (!parsed.ok) return parsed

  const encryptedKey = encryptKey(parsed.apiKey)
  if (!encryptedKey) {
    return {
      ok: false,
      error: 'This computer cannot store your key right now. Try again or contact support.',
    }
  }

  const status = toStatus(
    writeRecord(userDataDir, {
      assistant: parsed.assistant,
      provider: parsed.provider,
      model: parsed.model,
      baseUrl: parsed.baseUrl,
      encryptedKey,
      encryption: 'safeStorage',
    }),
  )
  clearByokConversation()
  return { ok: true, status }
}

export function disconnectByok(userDataDir: string): ByokStatus {
  const filePath = getByokFilePath(userDataDir)
  if (existsSync(filePath)) {
    unlinkSync(filePath)
  }
  clearByokConversation()
  return emptyStatus()
}

export function loadByokCredentials(userDataDir: string):
  | { ok: true; provider: ByokProviderId; model: string; apiKey: string; baseUrl: string | null }
  | { ok: false; error: string } {
  const record = readRecord(userDataDir)
  if (!record.assistant || !record.model || !record.encryptedKey) {
    return { ok: false, error: 'Connect an AI assistant in Preferences first.' }
  }

  const apiKey = decryptKey(record.encryptedKey)
  if (!apiKey) {
    return {
      ok: false,
      error: 'The saved key could not be read. Connect your assistant again.',
    }
  }

  return {
    ok: true,
    provider: record.provider ?? 'openai',
    model: record.model,
    apiKey,
    baseUrl: record.baseUrl,
  }
}
