import {
  AppWindow,
  ArrowDownToLine,
  Clapperboard,
  Cloud,
  Code,
  FileText,
  Folder,
  HardDrive,
  Image,
  Music,
  Usb,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CORPORATE_COLORS,
  CUSTOMIZABLE_ICONS,
  SOURCE_TONE_CLASSES,
  sourceAppearanceDotColor,
  sourceAppearanceSwatchSelected,
  type ResolvedSourceAppearance,
} from '../lib/source-appearance'
import type { SourceIconId } from '../types'
import { isOfficialSourceMark, OfficialSourceMark } from './SourceBrandMarks'

const ICONS: Record<SourceIconId, LucideIcon> = {
  folder: Folder,
  documents: FileText,
  downloads: ArrowDownToLine,
  desktop: Folder,
  pictures: Image,
  movies: Clapperboard,
  music: Music,
  shared: Users,
  applications: AppWindow,
  developer: Code,
  icloud: Cloud,
  dropbox: Cloud,
  onedrive: Cloud,
  google_drive: Cloud,
  volume: HardDrive,
  usb: Usb,
}

function scrollParents(element: HTMLElement): Array<HTMLElement | Window> {
  const parents: Array<HTMLElement | Window> = [window]
  let node = element.parentElement
  while (node) {
    const style = getComputedStyle(node)
    const overflow = `${style.overflow}${style.overflowY}${style.overflowX}`
    if (/(auto|scroll|overlay)/.test(overflow)) parents.push(node)
    node = node.parentElement
  }
  return parents
}

function useAnchorRect(anchorEl: HTMLElement | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!anchorEl) {
      setRect(null)
      return
    }
    const update = () => setRect(anchorEl.getBoundingClientRect())
    update()
    const parents = scrollParents(anchorEl)
    for (const parent of parents) {
      parent.addEventListener('scroll', update, { passive: true })
    }
    window.addEventListener('resize', update)
    return () => {
      for (const parent of parents) {
        parent.removeEventListener('scroll', update)
      }
      window.removeEventListener('resize', update)
    }
  }, [anchorEl])

  return rect
}

export function SourceIconGlyph({
  iconId,
  className,
}: {
  iconId: SourceIconId
  className?: string
}) {
  if (isOfficialSourceMark(iconId)) {
    return <OfficialSourceMark iconId={iconId} className={className} />
  }
  const Icon = ICONS[iconId]
  return <Icon className={className} strokeWidth={1.75} />
}

function SourceAppearancePickerBody({
  appearance,
  hasOverride,
  compact,
  onPickColor,
  onPickIcon,
}: {
  appearance: ResolvedSourceAppearance
  hasOverride: boolean
  compact?: boolean
  onPickColor: (color: string | null) => void
  onPickIcon: (iconId: SourceIconId | null) => void
}) {
  const labelClass = 'px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--app-fg)] opacity-50'
  const colorButtonClass = compact ? 'h-7 w-7' : 'h-6 w-6'
  const iconButtonClass = compact ? 'h-8 w-8' : 'h-7 w-7'
  const iconGlyphClass = compact ? 'h-4 w-4' : 'h-3.5 w-3.5'
  const colorGrid = (
    <div className={`grid grid-cols-4 place-items-center ${compact ? 'w-full gap-2.5' : 'gap-1.5'}`}>
      {CORPORATE_COLORS.map((color) => {
        const selected = sourceAppearanceSwatchSelected(appearance, color)
        return (
          <button
            key={color}
            type="button"
            role="menuitem"
            aria-label={`Color ${color}`}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation()
              onPickColor(color)
            }}
            className={`${colorButtonClass} rounded-full transition duration-150 ${
              selected
                ? 'scale-110 shadow-[0_0_0_2px_var(--overlay-bg),0_0_0_3.5px_var(--app-fg)]'
                : 'opacity-90 hover:scale-105 hover:opacity-100'
            }`}
            style={{ backgroundColor: color }}
          />
        )
      })}
    </div>
  )
  const iconGrid = (
    <div className={`grid grid-cols-5 place-items-center ${compact ? 'w-full gap-1.5' : 'gap-1'}`}>
      {CUSTOMIZABLE_ICONS.map((iconId) => {
        const selected = appearance.iconId === iconId
        return (
          <button
            key={iconId}
            type="button"
            role="menuitem"
            aria-label={`Icon ${iconId}`}
            aria-pressed={selected}
            onClick={(event) => {
              event.stopPropagation()
              onPickIcon(iconId)
            }}
            className={`flex ${iconButtonClass} items-center justify-center rounded-xl transition ${
              selected
                ? 'bg-[var(--app-fg)] text-[var(--app-bg)] shadow-sm'
                : 'text-[var(--app-fg)] opacity-55 hover:bg-[var(--overlay-row)] hover:opacity-100'
            }`}
          >
            <SourceIconGlyph iconId={iconId} className={iconGlyphClass} />
          </button>
        )
      })}
    </div>
  )
  const resetButton = hasOverride ? (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation()
        onPickColor(null)
        onPickIcon(null)
      }}
      className={`w-full rounded-lg font-medium text-[var(--app-fg)] opacity-60 hover:bg-[var(--overlay-row)] hover:opacity-100 ${
        compact ? 'py-0.5 text-[10px]' : 'mt-2 px-2 py-1 text-[11px]'
      }`}
    >
      Reset
    </button>
  ) : null

  if (compact) {
    return (
      <div className="flex h-full w-full min-h-0 flex-col justify-between">
        <div className="grid grid-cols-4 gap-2">
          {CORPORATE_COLORS.map((color) => {
            const selected = sourceAppearanceSwatchSelected(appearance, color)
            return (
              <button
                key={color}
                type="button"
                role="menuitem"
                aria-label={`Color ${color}`}
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation()
                  onPickColor(color)
                }}
                className={`aspect-square w-full rounded-full transition duration-150 ${
                  selected
                    ? 'scale-[1.04] shadow-[0_0_0_2px_var(--overlay-bg),0_0_0_4px_var(--app-fg)]'
                    : 'opacity-90 hover:scale-105 hover:opacity-100'
                }`}
                style={{ backgroundColor: color }}
              />
            )
          })}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {CUSTOMIZABLE_ICONS.map((iconId) => {
            const selected = appearance.iconId === iconId
            return (
              <button
                key={iconId}
                type="button"
                role="menuitem"
                aria-label={`Icon ${iconId}`}
                aria-pressed={selected}
                onClick={(event) => {
                  event.stopPropagation()
                  onPickIcon(iconId)
                }}
                className={`flex aspect-square w-full items-center justify-center rounded-2xl transition ${
                  selected
                    ? 'bg-[var(--app-fg)] text-[var(--app-bg)] shadow-sm'
                    : 'text-[var(--app-fg)] opacity-55 hover:bg-[var(--overlay-row)] hover:opacity-100'
                }`}
              >
                <SourceIconGlyph iconId={iconId} className="h-5 w-5" />
              </button>
            )
          })}
        </div>
        {resetButton}
      </div>
    )
  }

  return (
    <>
      <p className={labelClass}>Color</p>
      {colorGrid}
      <p className="mt-3 px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--app-fg)] opacity-50">
        Icon
      </p>
      {iconGrid}
      {resetButton}
    </>
  )
}

export function SourceAppearanceMenu({
  anchorEl,
  appearance,
  hasOverride,
  onPickColor,
  onPickIcon,
  onClose,
}: {
  anchorEl: HTMLElement
  appearance: ResolvedSourceAppearance
  hasOverride: boolean
  onPickColor: (color: string | null) => void
  onPickIcon: (iconId: SourceIconId | null) => void
  onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const anchorRect = useAnchorRect(anchorEl)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) return
      if (anchorEl.contains(event.target as Node)) return
      onClose()
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorEl, onClose])

  if (!anchorRect) return null

  const menuWidth = 168
  const left = Math.min(
    Math.max(8, anchorRect.left + anchorRect.width / 2 - menuWidth / 2),
    window.innerWidth - menuWidth - 8,
  )
  const top = anchorRect.bottom + 8

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 w-[168px] rounded-xl border border-[var(--sidebar-line)] bg-[var(--overlay-bg)] p-2.5 shadow-lg backdrop-blur-xl"
      style={{ top, left }}
    >
      <SourceAppearancePickerBody
        appearance={appearance}
        hasOverride={hasOverride}
        onPickColor={onPickColor}
        onPickIcon={onPickIcon}
      />
    </div>,
    document.body,
  )
}

const SOURCE_TONE_TEXT: Record<ResolvedSourceAppearance['tone'], string> = {
  slate: 'text-[var(--app-fg)] opacity-70',
  blue: 'text-blue-500',
  indigo: 'text-indigo-500',
  rose: 'text-rose-500',
  orange: 'text-orange-500',
  violet: 'text-violet-500',
  sky: 'text-sky-500',
  teal: 'text-teal-500',
}

export function SourceIconBadge({
  appearance,
  size = 'md',
  variant = 'badge',
  className = '',
  editing = false,
  hasOverride = false,
  onPickColor,
  onPickIcon,
  onPress,
}: {
  appearance: ResolvedSourceAppearance
  size?: 'sm' | 'md' | 'lg' | 'grid' | 'recent'
  variant?: 'badge' | 'source'
  className?: string
  editing?: boolean
  hasOverride?: boolean
  onPickColor?: (color: string | null) => void
  onPickIcon?: (iconId: SourceIconId | null) => void
  onPress?: () => void
}) {
  const shell =
    size === 'recent'
      ? 'h-10 w-10 rounded-[14px]'
      : size === 'sm'
        ? 'h-7 w-7 rounded-lg'
        : size === 'grid'
          ? 'aspect-square w-full rounded-[2rem]'
          : size === 'lg'
            ? 'h-12 w-12 rounded-[14px]'
            : 'h-9 w-9 rounded-xl'
  const iconClass =
    size === 'recent'
      ? 'h-5 w-5'
      : size === 'sm'
        ? 'h-3.5 w-3.5'
        : size === 'grid'
          ? 'h-12 w-12'
          : size === 'lg'
            ? 'h-7 w-7'
            : 'h-4 w-4'
  const officialMark = isOfficialSourceMark(appearance.iconId)
  const sourceAvatar = variant === 'source' || size === 'recent' || size === 'grid' || size === 'lg'
  const shellClass = appearance.color
    ? 'border border-[var(--sidebar-line)]'
    : officialMark
      ? 'bg-[var(--overlay-row)] border border-[var(--sidebar-line)]'
      : `bg-gradient-to-br ${SOURCE_TONE_CLASSES[appearance.tone]} border border-[var(--sidebar-line)]`
  const shellStyle = appearance.color
    ? {
        backgroundColor: `${appearance.color}26`,
        color: officialMark ? undefined : appearance.color,
      }
    : undefined

  const showInlinePicker = editing && size === 'grid' && onPickColor && onPickIcon

  const icon = <SourceIconGlyph iconId={appearance.iconId} className={iconClass} />

  return (
    <div
      role={showInlinePicker ? 'menu' : undefined}
      aria-hidden={sourceAvatar && !showInlinePicker ? undefined : true}
      aria-label={showInlinePicker ? 'Customize source appearance' : undefined}
      className={`relative flex shrink-0 items-center justify-center transition duration-200 ${shell} ${
        showInlinePicker
          ? 'overflow-hidden border border-[var(--sidebar-line)] bg-[var(--overlay-bg)] p-3.5 shadow-[0_4px_16px_rgba(0,0,0,0.08)]'
          : sourceAvatar
            ? `shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${shellClass} ${
                size === 'grid' ? 'group-hover:-translate-y-0.5 group-hover:shadow-md' : ''
              }`
            : `${SOURCE_TONE_TEXT[appearance.tone]} bg-transparent shadow-none border-0`
      } ${showInlinePicker ? 'cursor-default' : onPress ? 'cursor-pointer' : ''} ${className}`}
      style={
        showInlinePicker
          ? { backgroundColor: `${sourceAppearanceDotColor(appearance)}18` }
          : sourceAvatar
            ? shellStyle
            : appearance.color
              ? { color: appearance.color }
              : undefined
      }
      onClick={
        showInlinePicker || onPress
          ? (event) => {
              event.stopPropagation()
              if (!showInlinePicker) onPress?.()
            }
          : undefined
      }
    >
      {showInlinePicker ? (
        <div className="flex h-full w-full min-h-0 flex-col">
          <SourceAppearancePickerBody
            appearance={appearance}
            hasOverride={hasOverride}
            compact
            onPickColor={onPickColor}
            onPickIcon={onPickIcon}
          />
        </div>
      ) : (
        icon
      )}
    </div>
  )
}

export function useSourceAppearanceMenu() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = useCallback((element: HTMLElement) => setAnchorEl(element), [])
  const close = useCallback(() => setAnchorEl(null), [])
  return { anchorEl, open, close, isOpen: anchorEl !== null }
}

export function useGridAppearanceEditor() {
  const [open, setOpen] = useState(false)
  const badgeRef = useRef<HTMLDivElement>(null)
  const toggle = useCallback(() => setOpen((value) => !value), [])
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (badgeRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, badgeRef, toggle, close }
}
