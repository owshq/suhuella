import { useEffect, useState } from 'react'
import { getSuhuellaApi } from '../lib/api'
import {
  licenseDayLabel,
  organisationMoneyLabel,
  organisationSeatLabel,
} from '../lib/license-status'
import type {
  BusinessOrganisationOverview,
  BusinessOrganisationRow,
} from '../types'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-white/60 bg-white/55 p-5 shadow-xl shadow-blue-900/5 backdrop-blur-xl">
      {children}
    </div>
  )
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function organisationErrorMessage(error: string): string {
  if (error === 'seat_limit') return 'No available seats. Change seats to add more.'
  if (error === 'seat_in_use') return 'Unassign seats before reducing your subscription.'
  if (error === 'min_seats') return 'Business needs at least 20 seats.'
  if (error === 'subscription_missing') return 'Billing is not ready for this organisation yet.'
  if (error === 'stripe_unavailable' || error === 'stripe_timeout') {
    return 'Billing is temporarily unavailable. Seat count is unchanged. Try again.'
  }
  if (error === 'duplicate_email') return 'That person already has a seat.'
  if (error === 'forbidden') return 'You cannot manage this organisation.'
  if (error === 'offline' || error === 'service_unavailable') {
    return 'Organisation details are unavailable while offline.'
  }
  return 'We could not update the organisation. Try again later.'
}

function displayLastActive(value: string): string {
  if (!value) return '—'
  if (!Number.isFinite(Date.parse(value))) return value
  return licenseDayLabel(value)
}

function displayUser(row: BusinessOrganisationRow): string {
  return row.email || '—'
}

function displayDevice(row: BusinessOrganisationRow): string {
  if (!row.deviceName) return '—'
  return row.platform ? `${row.deviceName} · ${row.platform}` : row.deviceName
}

export function BusinessOrganisationSection({
  currentEmail,
  busy,
  onBusy,
  onFeedback,
}: {
  currentEmail: string
  busy: boolean
  onBusy: (value: boolean) => void
  onFeedback: (text: string, tone: 'ok' | 'error') => void
}) {
  const [organisation, setOrganisation] = useState<BusinessOrganisationOverview | null>(null)
  const [assignEmail, setAssignEmail] = useState('')
  const [assigning, setAssigning] = useState(false)

  async function loadOrganisation() {
    const api = getSuhuellaApi()
    if (typeof api.getBusinessOrganisation !== 'function') return
    const result = await api.getBusinessOrganisation()
    if (result.ok) {
      setOrganisation(result.organisation)
      return
    }
    setOrganisation(null)
    onFeedback(organisationErrorMessage(result.error), 'error')
  }

  useEffect(() => {
    void loadOrganisation().catch(() => undefined)
  }, [])

  async function runAction(
    action: () => Promise<{ ok: true; organisation: BusinessOrganisationOverview } | { ok: false; error: string }>,
    successText: string,
  ) {
    onBusy(true)
    try {
      const result = await action()
      if (!result.ok) {
        onFeedback(organisationErrorMessage(result.error), 'error')
        return
      }
      setOrganisation(result.organisation)
      onFeedback(successText, 'ok')
    } catch {
      onFeedback(organisationErrorMessage('server_error'), 'error')
    } finally {
      onBusy(false)
    }
  }

  if (!organisation) return null

  const nextBilling = organisation.nextBilling
    ? Number.isFinite(Date.parse(organisation.nextBilling))
      ? new Date(organisation.nextBilling).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : organisation.nextBilling
    : null

  return (
    <Card>
      <h3 className="text-base font-semibold text-slate-900">{organisation.organisationName}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {organisation.seats} seats · {organisationMoneyLabel(organisation.monthlyAmountCents, organisation.currency)}
        /month
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {organisation.assigned} assigned · {organisation.available} available
        {nextBilling ? ` · Next billing: ${nextBilling}` : ''}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <SecondaryButton
          disabled={busy}
          onClick={() => {
            const raw = window.prompt(
              `New seat count (currently ${organisation.seats})`,
              String(organisation.seats),
            )
            if (!raw) return
            const seatCount = Number(raw)
            if (!Number.isInteger(seatCount)) return
            void runAction(
              () => getSuhuellaApi().manageBusinessOrganisation('change_seats', { seatCount }),
              'Seats updated',
            )
          }}
        >
          Change seats
        </SecondaryButton>
        <SecondaryButton
          disabled={busy}
          onClick={() => void getSuhuellaApi().openCheckout('business', currentEmail)}
        >
          Billing
        </SecondaryButton>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
              <th className="pb-2 font-medium">User</th>
              <th className="pb-2 font-medium">Seat</th>
              <th className="pb-2 font-medium">Device</th>
              <th className="pb-2 font-medium">Last active</th>
              <th className="pb-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {organisation.rows.map((row, index) => {
              const firstAvailable = organisation.rows.findIndex((item) => item.seatStatus === 'available')
              const showAssignForm = assigning && row.seatStatus === 'available' && index === firstAvailable
              return (
              <tr key={`${row.seatId ?? 'open'}-${row.email || index}`} className="border-t border-white/70">
                <td className="py-2.5 font-medium text-slate-900">{displayUser(row)}</td>
                <td className="py-2.5 text-slate-600">{organisationSeatLabel(row.seatStatus)}</td>
                <td className="py-2.5 text-slate-600">{displayDevice(row)}</td>
                <td className="py-2.5 text-slate-600">{displayLastActive(row.lastActive)}</td>
                <td className="py-2.5">
                  {row.seatStatus === 'available' ? (
                    showAssignForm ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault()
                          if (!assignEmail.trim()) return
                          void runAction(
                            () => getSuhuellaApi().manageBusinessOrganisation('invite', { email: assignEmail.trim() }),
                            'Seat assigned',
                          ).then(() => {
                            setAssignEmail('')
                            setAssigning(false)
                          })
                        }}
                      >
                        <input
                          type="email"
                          value={assignEmail}
                          onChange={(event) => setAssignEmail(event.target.value)}
                          className="w-44 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-[var(--brand-accent)]"
                          placeholder="name@company.com"
                        />
                        <button
                          type="submit"
                          disabled={busy || !assignEmail.trim()}
                          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Assign
                        </button>
                      </form>
                    ) : index === firstAvailable ? (
                      <SecondaryButton disabled={busy} onClick={() => setAssigning(true)}>
                        Assign
                      </SecondaryButton>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )
                  ) : row.seatId && row.email !== currentEmail ? (
                    <div className="flex flex-wrap gap-1.5">
                      <SecondaryButton
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () =>
                              getSuhuellaApi().manageBusinessOrganisation('reset_devices', { seatId: row.seatId! }),
                            'Computer released',
                          )
                        }
                      >
                        Replace computer
                      </SecondaryButton>
                      <SecondaryButton
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () => getSuhuellaApi().manageBusinessOrganisation('remove', { seatId: row.seatId! }),
                            'Seat available',
                          )
                        }
                      >
                        Unassign
                      </SecondaryButton>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
