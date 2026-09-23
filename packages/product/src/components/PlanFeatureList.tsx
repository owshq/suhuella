export function PlanFeatureList({ features }: { features: string[] }) {
  if (features.length === 0) return null
  return (
    <ul className="mt-2.5 space-y-1.5 text-sm leading-snug text-slate-500">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2">
          <span aria-hidden="true" className="text-slate-400">
            ·
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  )
}
