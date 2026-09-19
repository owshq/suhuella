import { execFileSync } from 'node:child_process'
import os from 'node:os'

function tidyHost(value: string): string {
  return value.replace(/\.local$/i, '').replace(/-/g, ' ').trim()
}

export function getOsComputerName(): string {
  if (process.platform === 'darwin') {
    for (const key of ['ComputerName', 'LocalHostName'] as const) {
      try {
        const name = execFileSync('scutil', ['--get', key], {
          encoding: 'utf8',
          timeout: 800,
        }).trim()
        if (name) return key === 'LocalHostName' ? tidyHost(name) : name
      } catch {
        // Try the next name source.
      }
    }
  }
  if (process.platform === 'win32') {
    const name = process.env.COMPUTERNAME?.trim()
    if (name) return name
  }
  return tidyHost(os.hostname()) || (process.platform === 'darwin' ? 'Mac' : process.platform === 'win32' ? 'PC' : 'Computer')
}

export function getOsVersionLabel(platform: NodeJS.Platform = process.platform): string {
  const version =
    typeof process.getSystemVersion === 'function' ? process.getSystemVersion() : os.release()
  if (platform === 'darwin') {
    const major = Number.parseInt(version.split('.')[0] ?? '', 10)
    const names: Record<number, string> = {
      15: 'macOS Sequoia',
      14: 'macOS Sonoma',
      13: 'macOS Ventura',
      12: 'macOS Monterey',
      11: 'macOS Big Sur',
    }
    const name = names[major]
    return name ? `${name} ${version}` : `macOS ${version}`
  }
  if (platform === 'win32') return `Windows ${version}`
  return `Linux ${version}`
}
