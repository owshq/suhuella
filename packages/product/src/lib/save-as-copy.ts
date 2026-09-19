import { productCopy } from './product-copy.ts'
import type {
  SaveAsAssistantState,
  SaveAsDestination,
  SaveAsDocumentView,
  SaveAsMatchLabel,
} from '../types.ts'

export function fileTypeLabel(extension: string | null | undefined, fileFamily?: string): string {
  const ext = (extension ?? '').replace(/^\./, '').toLowerCase()
  if (!ext) {
    if (fileFamily === 'image') return 'Image'
    if (fileFamily === 'video') return 'Video'
    if (fileFamily === 'audio') return 'Audio'
    return 'Document'
  }

  switch (ext) {
    case 'pdf':
      return 'PDF'
    case 'doc':
    case 'docx':
    case 'rtf':
    case 'odt':
    case 'pages':
      return 'Word'
    case 'xls':
    case 'xlsx':
    case 'csv':
    case 'ods':
    case 'numbers':
      return 'Spreadsheet'
    case 'ppt':
    case 'pptx':
    case 'key':
      return 'Presentation'
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'heic':
    case 'webp':
    case 'tiff':
    case 'tif':
    case 'bmp':
      return 'Image'
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
      return 'Video'
    case 'mp3':
    case 'wav':
    case 'm4a':
      return 'Audio'
    case 'zip':
    case 'rar':
    case '7z':
      return 'Archive'
    case 'eml':
    case 'msg':
      return 'Email'
    default:
      return ext.toUpperCase()
  }
}

export function prettyToken(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (trimmed === trimmed.toUpperCase() && trimmed.length <= 8) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function matchLabelClass(label: SaveAsMatchLabel): string {
  if (label === 'Strong match') return 'text-[var(--overlay-strong)]'
  if (label === 'Good match') return 'text-[var(--overlay-fg)]'
  if (label === 'Possible match') return 'text-[var(--overlay-muted)]'
  return 'text-[var(--overlay-muted)]'
}

export function saveAsHeadline(_state: SaveAsAssistantState | undefined, isSaveDialog: boolean): string {
  if (isSaveDialog) return 'Save this document'
  return 'Preview Save As'
}

export function saveAsBanner(state: SaveAsAssistantState | undefined): { title: string; body: string } | null {
  if (state === 'first_use') {
    return {
      title: productCopy('SuHuella has not learned your folders yet.'),
      body: 'You can still choose a place to save this document. Add sources later to improve recommendations.',
    }
  }
  if (state === 'no_filename') {
    return {
      title: productCopy('SuHuella needs a document name.'),
      body: 'Choose an available place for now. A file name helps make stronger recommendations.',
    }
  }
  if (state === 'no_match') {
    return {
      title: 'No confident match yet.',
      body: 'Choose an available place or add sources to improve future recommendations.',
    }
  }
  if (state === 'preview') {
    return {
      title: productCopy('Preview how SuHuella decides'),
      body: 'Type a document name, or choose a file. Nothing is saved or moved.',
    }
  }
  return null
}

export function documentMetaLine(document: SaveAsDocumentView | undefined): string {
  if (!document) return ''
  const parts = [
    document.typeLabel,
    document.looksLike[0] ? prettyToken(document.looksLike[0]) : '',
    ...document.detected.slice(0, 3),
  ].filter(Boolean)
  return parts.join(' · ')
}

export function primaryDestinationAction(
  isSaveDialog: boolean,
  destination: SaveAsDestination,
): string {
  if (!destination.exists) return 'Unavailable'
  return isSaveDialog ? 'Save here' : 'Use this folder'
}

export function destinationUnavailableCopy(destination: SaveAsDestination): string | null {
  if (!destination.exists) return 'This source is not available right now.'
  return null
}
