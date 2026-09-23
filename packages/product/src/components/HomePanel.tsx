import { useState } from 'react'
import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { homeKnowledgeLine } from '../host/capabilities'
import { homeOrganiseOpportunity, homeOrganiseScope } from '../lib/home-organise'
import { hostAccessFor } from '../lib/platform-capabilities'
import { defaultSourceAppearance } from '../lib/source-appearance'
import { homeQuickConnectSources, sourcePickActionLabel, type HomeQuickConnectSource } from '../lib/sources-ui'
import { FeaturePromoCard } from './FeaturePromoCard'
import { SourceIconGlyph } from './SourceIconBadge'
import { SuhuellaWordmark } from './SuhuellaWordmark'
import type {
  AppInfo,
  IndexedLocationSummary,
  IndexScanProgress,
} from '../types'

type HomePanelProps = {
  appInfo: AppInfo
  scan?: IndexScanProgress
  locations?: IndexedLocationSummary[]
  fileCount: number
  onAddSource?: () => void
  onConnectSourceHint?: (hint: string) => void
  onOrganise?: () => void
  firstHomeHint?: boolean
  onDismissFirstHomeHint?: () => void
}

export function HomePanel(props: HomePanelProps) {
  const { locale } = useAppLocale()
  const [showMoreSources, setShowMoreSources] = useState(false)
  const locations = props.locations ?? []
  const scanning = props.scan?.status === 'scanning'
  const access = hostAccessFor(props.appInfo.host)
  const indexingFrom = locations.find((location) => location.status === 'indexing')?.name ?? null
  const workspaceStatus = homeKnowledgeLine({
    sourceCount: locations.length,
    scanning,
    indexingFrom,
    host: props.appInfo.host,
    access,
  })
  const sourceAction = access.connectGrant ? 'Connect a source' : 'Add a source'
  const connectLabel = sourcePickActionLabel(access)
  const organiseScope = homeOrganiseScope(locations)
  const organise = homeOrganiseOpportunity(props.fileCount, organiseScope?.name ?? null)
  const waitingForDocuments = locations.length > 0 && props.fileCount <= 0
  const quickSources =
    locations.length === 0 ? homeQuickConnectSources(access, props.appInfo.platform ?? 'darwin') : null
  const visibleSources = quickSources
    ? [...quickSources.visible, ...(showMoreSources ? quickSources.more : [])]
    : []
  const seeMoreLabel = locale === 'es' ? 'Ver más' : 'See more'

  function connectExample(path: string) {
    if (path.startsWith('suhuella:')) {
      props.onConnectSourceHint?.(path)
      return
    }
    props.onAddSource?.()
  }

  function quickConnectAppearance(source: HomeQuickConnectSource) {
    const cloudIds = new Set(['icloud', 'google_drive', 'onedrive', 'dropbox'])
    const path = source.path || `suhuella:${source.id}`
    const kind = cloudIds.has(source.id) ? ('cloud_folder' as const) : ('user_folder' as const)
    return defaultSourceAppearance(source.label, path, kind, props.appInfo.platform ?? 'darwin')
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      {props.firstHomeHint ? (
        <div className="rounded-[1.4rem] border border-[var(--sidebar-line)] bg-[var(--overlay-row)] px-5 py-4">
          <p className="text-sm font-semibold text-[var(--app-fg)]">{productCopy('This is Home')}</p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--app-fg)] opacity-70">
            {productCopy('SuHuella shows the documents it can see from your sources. Open Plan Mode when you want a Plan.')}
          </p>
          {props.onDismissFirstHomeHint ? (
            <button
              type="button"
              onClick={props.onDismissFirstHomeHint}
              className="mt-3 rounded-full bg-[var(--brand-accent)] px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {productCopy('Got it')}
            </button>
          ) : null}
        </div>
      ) : null}

      <header className="space-y-2">
        <SuhuellaWordmark
          glyphSize={28}
          textClassName="text-[22px] font-bold tracking-[-0.03em] text-[var(--app-fg)]"
        />
        {scanning && workspaceStatus ? (
          <p className="pt-1 text-[14px] font-medium text-[var(--app-fg)] opacity-70">{workspaceStatus}</p>
        ) : locations.length === 0 ? (
          <p className="text-[15px] font-medium text-[var(--app-fg)] opacity-55">
            {access.connectGrant
              ? productCopy('Connect a source. Create a Plan.')
              : productCopy('Add a source. Create a Plan.')}
          </p>
        ) : null}
      </header>

      {locations.length > 0 ? (
        <section className="space-y-4">
          <p className="text-[17px] font-medium text-[var(--app-fg)]">
            {props.fileCount.toLocaleString()} {props.fileCount === 1 ? 'document' : 'documents'} in{' '}
            {locations.length.toLocaleString()} {locations.length === 1 ? 'source' : 'sources'}
          </p>
          {waitingForDocuments && !scanning ? (
            <p className="text-[15px] text-[var(--app-fg)] opacity-65">
              Documents will appear here when SuHuella has checked this source.
            </p>
          ) : null}
          {organise && props.onOrganise ? (
            <div className="space-y-3">
              <p className="text-[15px] text-[var(--app-fg)] opacity-65">{organise.line}</p>
              <button
                type="button"
                onClick={props.onOrganise}
                className="rounded-full bg-[var(--app-fg)] px-4 py-2 text-[13px] font-semibold text-[var(--app-bg)] transition hover:opacity-90"
              >
                {organise.actionLabel}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {locations.length === 0 && props.onAddSource ? (
        <FeaturePromoCard
          title={productCopy('No sources yet.')}
          description={
            access.connectGrant
              ? 'Connect a folder. Then create a Plan.'
              : 'Add a folder. Then create a Plan.'
          }
          primary={{ label: sourceAction, onClick: props.onAddSource }}
        >
          {visibleSources.length > 0 ? (
            <div className="feature-promo-source-examples">
              {visibleSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className="feature-promo-source-chip"
                  disabled={!source.connectable}
                  title={source.statusNote}
                  onClick={() => {
                    if (!source.connectable) return
                    connectExample(source.path)
                  }}
                >
                  <span className="feature-promo-source-chip-icon" aria-hidden>
                    <SourceIconGlyph
                      iconId={quickConnectAppearance(source).iconId}
                      className="h-3.5 w-3.5"
                    />
                  </span>
                  <span className="feature-promo-source-chip-label">{productCopy(source.label)}</span>
                  {source.connectable ? (
                    <span className="feature-promo-source-chip-action">{connectLabel}</span>
                  ) : source.statusNote ? (
                    <span className="feature-promo-source-chip-note">{productCopy(source.statusNote)}</span>
                  ) : null}
                </button>
              ))}
              {!showMoreSources && quickSources && quickSources.more.length > 0 ? (
                <button
                  type="button"
                  className="feature-promo-source-more"
                  onClick={() => setShowMoreSources(true)}
                >
                  {seeMoreLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </FeaturePromoCard>
      ) : null}
    </div>
  )
}
