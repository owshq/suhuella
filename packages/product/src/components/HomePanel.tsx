import { useAppLocale } from '../lib/app-locale'
import { productCopy } from '../lib/product-copy'
import { homeKnowledgeLine } from '../host/capabilities'
import { FeaturePromoCard } from './FeaturePromoCard'
import type {
  AppInfo,
  FoldersKnowledgeSummary,
  IndexedLocationSummary,
  IndexScanProgress,
} from '../types'

type HomePanelProps = {
  appInfo: AppInfo
  scan?: IndexScanProgress
  locations?: IndexedLocationSummary[]
  foldersSummary?: FoldersKnowledgeSummary | null
  fileCount: number
  onAddSource?: () => void
  onOrganise?: () => void
}

export function HomePanel(props: HomePanelProps) {
  const { t } = useAppLocale()
  const locations = props.locations ?? []
  const scanning = props.scan?.status === 'scanning'
  const browser = props.appInfo.host === 'browser'
  const learningFrom = locations.find((location) => location.status === 'indexing')?.name ?? null
  const status = homeKnowledgeLine({
    sourceCount: locations.length,
    scanning,
    learningFrom,
    host: props.appInfo.host,
  })
  const sourceAction = browser ? 'Connect' : 'Add'

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-[var(--app-fg)]">{t.home}</h1>
        {status ? <p className="mt-2 text-[15px] font-semibold text-[var(--app-fg)]">{status}</p> : null}
      </header>

      <section>
        <p className="text-[13px] font-semibold text-[var(--app-fg)] opacity-50">{productCopy('SuHuella knows')}</p>
        <p className="mt-1 text-[17px] font-semibold text-[var(--app-fg)]">
          {props.fileCount.toLocaleString()} documents · {locations.length.toLocaleString()}{' '}
          {locations.length === 1 ? 'source' : 'sources'}
        </p>
        {props.foldersSummary?.recognised.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {props.foldersSummary.recognised.map((item) => (
              <li
                key={item}
                className="rounded-full bg-[var(--overlay-row)] px-3 py-1 text-sm font-semibold text-[var(--app-fg)]"
              >
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {locations.length === 0 && props.onAddSource ? (
        <FeaturePromoCard
          title={productCopy('SuHuella knows nothing yet.')}
          description={
            browser
              ? 'Connect a source so SuHuella can learn names and documents.'
              : 'Add a source so SuHuella can learn names and documents.'
          }
          primary={{ label: sourceAction, onClick: props.onAddSource }}
        />
      ) : null}
    </div>
  )
}
