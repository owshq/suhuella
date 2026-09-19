import { productCopy } from '../lib/product-copy'
import type { ReactNode } from 'react'
import { formatLearnedAgo } from '../lib/folders-ui'
import { formatDuration, formatMeasuredSize, formatStorageSize } from '../lib/storage-format'
import type { DeviceMetrics } from '../types'

function Card({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <h2 className="text-[13px] font-bold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-1 text-[13px] leading-relaxed text-slate-600">{children}</div>
    </section>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
      <div className="skeleton h-3 w-20" />
      <div className="skeleton mt-3 h-4 w-40" />
      <div className="skeleton mt-2 h-4 w-28" />
    </div>
  )
}

export function HomeHealthCards({
  metrics,
  loading,
  lastLearned,
  deviceFallback,
  fallbackDocuments,
  fallbackSources,
}: {
  metrics: DeviceMetrics | null
  loading?: boolean
  lastLearned: string | null
  deviceFallback: string
  fallbackDocuments: number
  fallbackSources: number
}) {
  if (loading && !metrics) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const knowledge = metrics?.knowledgeStorage
  const disk = metrics?.deviceStorage
  const perf = metrics?.performance
  const learned = formatLearnedAgo(lastLearned)
  const cpu = perf?.cpuPercent
  const idle = cpu != null && cpu <= 0.2

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card id="knowledge" title="Knowledge">
        <p className="text-[15px] font-semibold text-slate-900">
          {(knowledge?.documentCount ?? fallbackDocuments).toLocaleString()} documents
        </p>
        <p>{knowledge?.sourceCount ?? fallbackSources} sources</p>
        <p>{learned ? `Last updated ${learned}` : 'No sources yet'}</p>
      </Card>

      <Card id="device" title="Device">
        <p className="text-[15px] font-semibold text-slate-900">
          {metrics?.deviceName || deviceFallback}
        </p>
        <p>
          {disk?.status === 'measured' && disk.freeBytes != null
            ? `${formatStorageSize(disk.freeBytes)} available`
            : disk?.status === 'unsupported'
              ? 'Full disk not available here'
              : 'Device storage unavailable'}
        </p>
        <p>
          {metrics
            ? productCopy(`SuHuella is using ${formatStorageSize(metrics.appStorage.totalBytes)}`)
            : productCopy('SuHuella storage not measured')}
        </p>
      </Card>

      <Card id="performance" title="Performance">
        <p className="text-[15px] font-semibold text-slate-900">
          {perf?.status === 'not_measured'
            ? 'Not measured yet'
            : idle
              ? 'Idle'
              : cpu != null
                ? 'Active'
                : 'Ready'}
        </p>
        <p>Recommendation: {formatDuration(perf?.lastRecommendationMs)}</p>
        <p>
          {perf?.lastPlanExecutionMs != null
            ? `Last plan: ${perf.lastPlanActions ?? 0} actions in ${formatDuration(perf.lastPlanExecutionMs)}`
            : 'Last plan: Not measured yet'}
        </p>
      </Card>
    </div>
  )
}

export function DeviceMetricsPanel({
  metrics,
  loading,
  onRefresh,
}: {
  metrics: DeviceMetrics | null
  loading?: boolean
  onRefresh: () => void
}) {
  const disk = metrics?.deviceStorage
  const knowledge = metrics?.knowledgeStorage
  const app = metrics?.appStorage
  const perf = metrics?.performance
  const fullDisk = disk?.status === 'measured'

  return (
    <section id="app-storage" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">Storage and performance</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            {productCopy('Device disk, knowledge SuHuella manages, and app data — kept separate.')}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={onRefresh}
          className="shrink-0 text-[12px] font-semibold text-[var(--brand-accent)] hover:underline disabled:opacity-50"
        >
          Refresh metrics
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <MetricGroup title="Device storage">
          {!fullDisk ? (
            <Row label="Storage" value="Full disk not available here" />
          ) : (
            <>
              <Row label="Total disk" value={formatMeasuredSize(disk?.totalBytes)} />
              <Row label="Available" value={formatMeasuredSize(disk?.freeBytes)} />
              <Row label="Used" value={formatMeasuredSize(disk?.usedBytes)} />
            </>
          )}
        </MetricGroup>

        <MetricGroup title="Knowledge managed">
          <Row
            label="Indexed sources"
            value={
              knowledge?.totalBytes == null ? 'Size unavailable' : formatStorageSize(knowledge.totalBytes)
            }
          />
          <Row label="Documents" value={(knowledge?.documentCount ?? 0).toLocaleString()} />
          <Row label="Sources" value={(knowledge?.sourceCount ?? 0).toLocaleString()} />
        </MetricGroup>

        <MetricGroup title={productCopy('SuHuella storage')}>
          <Row label="Knowledge index" value={app ? formatStorageSize(app.indexBytes) : 'Not measured'} />
          <Row label="Activity" value={app ? formatStorageSize(app.activityBytes) : 'Not measured'} />
          <Row label="Cache" value={app ? formatStorageSize(app.cacheBytes) : 'Not measured'} />
          <Row label="Logs" value={app ? formatStorageSize(app.logsBytes) : 'Not measured'} />
          <Row label="Workflows" value={app ? formatStorageSize(app.workflowsBytes) : 'Not measured'} />
          <Row label="Total" value={app ? formatStorageSize(app.totalBytes) : 'Not measured'} />
        </MetricGroup>

        <MetricGroup title="Performance">
          <Row
            label="App memory"
            value={perf?.memoryBytes == null ? 'Not measured yet' : formatStorageSize(perf.memoryBytes)}
          />
          <Row
            label="Idle CPU"
            value={perf?.cpuPercent == null ? 'Not measured yet' : `${perf.cpuPercent}%`}
          />
          <Row label="Last recommendation" value={formatDuration(perf?.lastRecommendationMs)} />
          <Row label="Last index run" value={formatDuration(perf?.lastIndexingMs)} />
          <Row label="Startup" value={formatDuration(perf?.startupMs)} />
        </MetricGroup>

        <MetricGroup title="Beta targets">
          <Row
            label="Idle RAM"
            value={
              perf?.memoryBytes == null
                ? 'Not measured yet'
                : `${formatStorageSize(perf.memoryBytes)} · target < 50 MB`
            }
          />
          <Row
            label="Idle CPU"
            value={perf?.cpuPercent == null ? 'Not measured yet' : `${perf.cpuPercent}% · target 0–0.2%`}
          />
          <Row
            label="Startup"
            value={
              perf?.startupMs == null ? 'Not measured yet' : `${formatDuration(perf.startupMs)} · target < 2 s`
            }
          />
        </MetricGroup>
      </div>

      {metrics?.warnings[0] ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600">
          {metrics.warnings[0].message}
        </p>
      ) : null}
    </section>
  )
}

function MetricGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
      <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
