"use client";

import { brand } from "@suhuella/brand";
import {
  ADMIN_CREATE_ORIGINS,
  EDITION_LABELS,
  GIFT_SECTION_ORIGINS,
  ORIGIN_LABELS,
  PLAN_LABELS,
} from "@/lib/operations/catalog";
import {
  LICENSE_EDITIONS,
  ORGANISATION_PLANS,
  type Activation,
  type Customer,
  type License,
  type OperationsAction,
  type OperationsSnapshot,
  type OpsPartnerRow,
  type Organisation,
  type Seat,
} from "@/lib/operations/types";
import { operationsRoleLabel } from "@/lib/operations/roles";
import type { OperationsConsoleSection } from "@/lib/operations/routes";
import { searchOperationsSnapshot } from "@/lib/operations/search";
import type { OperationsSession } from "@/lib/operations/session";
import type { ReleaseManifest } from "@/lib/release-manifest";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  DataTable,
  Empty,
  Field,
  formatWhen,
  Panel,
  ReasonDialog,
  Select,
  Stat,
  statusTone,
  TextArea,
  TextInput,
  type PendingAction,
} from "./operations-ui";

const SECTIONS = [
  ["dashboard", "Dashboard"],
  ["customers", "Customers"],
  ["business", "Business"],
  ["partners", "Partners"],
  ["licenses", "Licenses"],
  ["billing", "Billing"],
  ["activity", "Activity"],
] as const;

type Section = (typeof SECTIONS)[number][0];

type ConsoleState = {
  snapshot: OperationsSnapshot;
  release: ReleaseManifest | null;
};

function customerEmail(
  snapshot: OperationsSnapshot,
  customerId: string | null,
): string {
  if (!customerId) return "—";
  return snapshot.customers.find((row) => row.id === customerId)?.email ?? "—";
}

function licensesForCustomer(
  snapshot: OperationsSnapshot,
  customerId: string,
): License[] {
  return snapshot.licenses.filter((row) => row.customerId === customerId);
}

function editionLabel(edition: License["edition"]): string {
  return EDITION_LABELS[edition];
}

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDay(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function entitlementLabel(license: License): string {
  if (license.isPaid) return "Paid";
  if (license.isGifted) return "Gifted";
  return "Admin";
}

function OperationsIdentityPanel({ session }: { session: OperationsSession }) {
  return (
    <div className="mt-5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
      <div className="text-sm font-medium text-slate-100">{session.displayName}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">
        {session.authMethodLabel}
      </div>
      <dl className="mt-3 grid gap-1.5 text-xs text-slate-400">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Environment</dt>
          <dd className="font-medium text-slate-200">
            {session.environment === "production" ? "Production" : "Local"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Worker</dt>
          <dd className="font-mono text-[11px] text-slate-300">
            {session.workerLabel}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Version</dt>
          <dd className="font-medium text-slate-200">{session.appVersion}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Role</dt>
          <dd className="font-medium text-slate-200">
            {operationsRoleLabel(session.actor.role)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500">Brand</dt>
          <dd className="font-medium text-slate-200">{session.brandName}</dd>
        </div>
      </dl>
    </div>
  );
}

export function OperationsConsole({
  initialSnapshot,
  initialRelease,
  initialSession,
  initialSection = "dashboard",
}: {
  initialSnapshot: OperationsSnapshot;
  initialRelease: ReleaseManifest | null;
  initialSession: OperationsSession;
  initialSection?: OperationsConsoleSection;
}) {
  const [state, setState] = useState<ConsoleState>({
    snapshot: initialSnapshot,
    release: initialRelease,
  });
  const [section, setSection] = useState<Section>(initialSection);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const snapshot = state.snapshot;

  async function runAction(action: OperationsAction) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/operations/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = (await response.json()) as
        | ConsoleState & { ok: true; notice?: string }
        | { ok: false; message?: string };

      if (!response.ok || !body.ok) {
        throw new Error(
          "message" in body && body.message
            ? body.message
            : "The action was rejected.",
        );
      }

      setState({ snapshot: body.snapshot, release: body.release });
      setPending(null);
      setNotice(
        body.notice?.trim()
          ? body.notice
          : "Change saved and written to the audit log.",
      );    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  }

  function ask(action: Omit<PendingAction, "onConfirm">, build: (reason: string) => OperationsAction) {
    setError(null);
    setPending({
      ...action,
      onConfirm: (reason) => runAction(build(reason)),
    });
  }

  const selectedCustomer = snapshot.customers.find(
    (row) => row.id === selectedCustomerId,
  );

  const filteredCustomers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snapshot.customers.filter((customer) => {
      if (!needle) return true;
      return (
        customer.email.includes(needle) ||
        customer.id.toLowerCase().includes(needle)
      );
    });
  }, [query, snapshot.customers]);

  const searchHits = useMemo(
    () => searchOperationsSnapshot(snapshot, query),
    [query, snapshot],
  );

  return (
    <div className="flex min-h-screen bg-[#0b0f14] text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/8 bg-[#0e141c] px-4 py-5">
        <div className="px-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            Operations
          </div>
          <div className="mt-1 text-sm text-slate-400">{brand.displayName} control center</div>
        </div>
        <OperationsIdentityPanel session={initialSession} />
        <nav className="mt-6 grid gap-1">
          {SECTIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSection(id);
                setNotice(null);
              }}
              className={`rounded-lg px-3 py-2 text-left text-sm ${
                section === id
                  ? "bg-sky-500/15 text-sky-100"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2 pt-6 text-xs leading-5 text-slate-500">
          Ops administers through the same license, seat, and billing operations
          as the product. It does not edit storage directly.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-white/8 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold">
                {SECTIONS.find(([id]) => id === section)?.[1]}
              </h1>
              <p className="text-sm text-slate-500">{snapshot.actor.email}</p>
            </div>
            <Badge
              tone={
                snapshot.persistence === "memory"
                  ? "warn"
                  : snapshot.persistence === "d1"
                    ? "good"
                    : "info"
              }
            >
              {snapshot.persistence}
            </Badge>
          </div>
          <div className="relative mt-3">
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search email, company, license key, device, support ref, Stripe ID…"
              aria-label="Global operations search"
            />
            {searchHits.length > 0 ? (
              <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-[#101821] shadow-2xl">
                {searchHits.map((hit) => (
                  <li key={`${hit.kind}:${hit.id}`}>
                    <button
                      type="button"
                      className="flex w-full flex-col px-3 py-2 text-left hover:bg-white/5"
                      onClick={() => {
                        setSection(hit.section);
                        if (hit.customerId) setSelectedCustomerId(hit.customerId);
                        setNotice(null);
                      }}
                    >
                      <span className="text-sm text-slate-100">{hit.title}</span>
                      <span className="text-xs text-slate-500">
                        {hit.kind} · {hit.subtitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </header>

        <main className="grid gap-5 px-6 py-6">
          {notice ? (
            <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {notice}
            </p>
          ) : null}

          {section === "dashboard" ? (
            <Dashboard snapshot={snapshot} release={state.release} ask={ask} />
          ) : null}
          {section === "customers" ? (
            <CustomersSection
              snapshot={snapshot}
              query={query}
              setQuery={setQuery}
              customers={filteredCustomers}
              selected={selectedCustomer}
              onOpen={(customer) => {
                setSelectedCustomerId(customer.id);
              }}
              onChangeEmail={(customer) => {
                const email = window.prompt("New email", customer.email);
                if (!email) return;
                ask(
                  {
                    title: "Change customer email",
                    description: `Replace ${customer.email} with ${email}. Email is display and activate input only.`,
                  },
                  (reason) => ({
                    action: "update_customer_email",
                    reason,
                    customerId: customer.id,
                    email,
                  }),
                );
              }}
              onResetDevices={(license) =>
                ask(
                  {
                    title: "Reset all devices",
                    description: `Deactivate every device on ${license.id}.`,
                  },
                  (reason) => ({
                    action: "reset_license_devices",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRefreshLicense={(license) =>
                ask(
                  {
                    title: "Refresh license",
                    description: `Re-read ${license.id} without changing billing state.`,
                  },
                  (reason) => ({
                    action: "refresh_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRevokeLicense={(license) =>
                ask(
                  {
                    title: "Revoke complimentary license",
                    description: `${license.id} is a gifted or manual license. This does not change a paid entitlement.`,
                  },
                  (reason) => ({
                    action: "revoke_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRestoreLicense={(license) =>
                ask(
                  {
                    title: "Restore complimentary license",
                    description: `Restore ${license.id} if policy allows.`,
                  },
                  (reason) => ({
                    action: "restore_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
            />
          ) : null}
          {section === "licenses" ? (
            <LicensesSection
              snapshot={snapshot}
              onCreate={(email, edition, origin) =>
                ask(
                  {
                    title: "Create license",
                    description: `Issue ${EDITION_LABELS[edition]} (${ORIGIN_LABELS[origin]}) to ${email}.`,
                  },
                  (reason) => ({
                    action: "create_license",
                    reason,
                    email,
                    edition,
                    origin,
                  }),
                )
              }
              onRefresh={(license) =>
                ask(
                  {
                    title: license.isPaid ? "Refresh billing status" : "Refresh license",
                    description: `Re-read ${license.id} without replacing billing state.`,
                  },
                  (reason) => ({
                    action: "refresh_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRevoke={(license) =>
                ask(
                  {
                    title: "Revoke complimentary license",
                    description: `${license.id} is gifted or manual. Paid licenses cannot be revoked here.`,
                  },
                  (reason) => ({
                    action: "revoke_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRestore={(license) =>
                ask(
                  {
                    title: "Restore complimentary license",
                    description: `Restore ${license.id}.`,
                  },
                  (reason) => ({
                    action: "restore_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onExpire={(license) =>
                ask(
                  {
                    title: "Expire complimentary license",
                    description: `Expire ${license.id} now.`,
                  },
                  (reason) => ({
                    action: "expire_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onExtend={(license) => {
                const validUntil = window.prompt(
                  "New expiry (ISO date)",
                  license.validUntil ?? new Date(Date.now() + 30 * 86400000).toISOString(),
                );
                if (!validUntil) return;
                ask(
                  {
                    title: "Extend complimentary license",
                    description: `Set expiry of ${license.id} to ${validUntil}.`,
                  },
                  (reason) => ({
                    action: "extend_license",
                    reason,
                    licenseId: license.id,
                    validUntil,
                  }),
                );
              }}
              onReset={(license) =>
                ask(
                  {
                    title: "Deactivate devices",
                    description: `Deactivate every device on ${license.id}. The license stays in place.`,
                  },
                  (reason) => ({
                    action: "reset_license_devices",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
            />
          ) : null}
          {section === "business" ? (
            <>
            <BusinessSection
              snapshot={snapshot}
              onCreate={(name, billingEmail, seatCount, plan) =>
                ask(
                  {
                    title: "Create organisation",
                    description: `${name} · ${plan} · ${seatCount} seats · ${billingEmail}`,
                  },
                  (reason) => ({
                    action: "create_organisation",
                    reason,
                    name,
                    billingEmail,
                    seatCount,
                    plan,
                  }),
                )
              }
              onAddSeats={(organisation, count) =>
                ask(
                  {
                    title: "Add seats",
                    description: `Add ${count} seats to ${organisation.name}.`,
                  },
                  (reason) => ({
                    action: "add_seats",
                    reason,
                    organisationId: organisation.id,
                    count,
                  }),
                )
              }
              onRemoveSeats={(organisation, count) =>
                ask(
                  {
                    title: "Remove seats",
                    description: `Remove ${count} unused seats from ${organisation.name}.`,
                  },
                  (reason) => ({
                    action: "remove_seats",
                    reason,
                    organisationId: organisation.id,
                    count,
                  }),
                )
              }
              onInvite={(organisation, email) =>
                ask(
                  {
                    title: "Invite user",
                    description: `Invite ${email} to ${organisation.name}.`,
                  },
                  (reason) => ({
                    action: "invite_user",
                    reason,
                    organisationId: organisation.id,
                    email,
                  }),
                )
              }
              onChangeAdmin={(organisation, customerId) =>
                ask(
                  {
                    title: "Change organisation admin",
                    description: `Move admin of ${organisation.name} to ${customerEmail(snapshot, customerId)}.`,
                  },
                  (reason) => ({
                    action: "change_admin",
                    reason,
                    organisationId: organisation.id,
                    customerId,
                  }),
                )
              }
              onReactivate={(organisation) =>
                ask(
                  {
                    title: "Reactivate organisation",
                    description: `${organisation.name} is currently ${organisation.status}.`,
                  },
                  (reason) => ({
                    action: "reactivate_organisation",
                    reason,
                    organisationId: organisation.id,
                  }),
                )
              }
              onSetDeviceLimit={(organisation, deviceLimitPerSeat) =>
                ask(
                  {
                    title: "Set devices per seat",
                    description: `${organisation.name}: ${deviceLimitPerSeat} active device(s) per assigned seat.`,
                  },
                  (reason) => ({
                    action: "set_organisation_device_limit",
                    reason,
                    organisationId: organisation.id,
                    deviceLimitPerSeat,
                  }),
                )
              }
            />
            <SeatsSection
              snapshot={snapshot}
              onToggle={(seat) =>
                ask(
                  {
                    title:
                      seat.status === "suspended"
                        ? "Reactivate seat"
                        : "Suspend seat",
                    description: `${seat.email} is currently ${seat.status}. This is not license revocation.`,
                  },
                  (reason) => ({
                    action:
                      seat.status === "suspended"
                        ? "reactivate_seat"
                        : "suspend_seat",
                    reason,
                    seatId: seat.id,
                  }),
                )
              }
              onRemove={(seat) =>
                ask(
                  {
                    title: "Remove seat",
                    description: `Remove ${seat.email} from the organisation. The paid organisation license stays in place.`,
                  },
                  (reason) => ({
                    action: "remove_seat",
                    reason,
                    seatId: seat.id,
                  }),
                )
              }
              onReset={(seat) =>
                ask(
                  {
                    title: "Deactivate seat devices",
                    description: `Deactivate every device for ${seat.email}. The seat stays assigned.`,
                  },
                  (reason) => ({
                    action: "reset_seat_devices",
                    reason,
                    seatId: seat.id,
                  }),
                )
              }
            />
            </>
          ) : null}
          {section === "partners" ? (
            <PartnersSection
              snapshot={snapshot}
              onCreate={(slug, displayName, ownerEmail, origin, validUntil) =>
                ask(
                  {
                    title: "Create partner",
                    description: `${displayName} (${slug}) · ${origin} · ${ownerEmail}${validUntil ? ` · until ${validUntil}` : " · no expiry"}`,
                  },
                  (reason) => ({
                    action: "create_partner",
                    reason,
                    slug,
                    displayName,
                    ownerEmail,
                    origin,
                    validUntil: validUntil || undefined,
                  }),
                )
              }
              onInvite={(partner, email, role) =>
                ask(
                  {
                    title: "Create onboarding invite",
                    description: `${email} → ${partner.displayName} as ${role}`,
                  },
                  (reason) => ({
                    action: "create_partner_invite",
                    reason,
                    partnerId: partner.partnerId,
                    email,
                    role,
                  }),
                )
              }
              onSuspend={(partner) =>
                ask(
                  {
                    title: "Suspend partner",
                    description: `${partner.displayName} (${partner.slug})`,
                  },
                  (reason) => ({
                    action: "suspend_partner",
                    reason,
                    partnerId: partner.partnerId,
                  }),
                )
              }
              onRevoke={(partner) =>
                ask(
                  {
                    title: "Revoke partner",
                    description: `${partner.displayName} (${partner.slug})`,
                  },
                  (reason) => ({
                    action: "revoke_partner",
                    reason,
                    partnerId: partner.partnerId,
                  }),
                )
              }
              onReactivate={(partner) =>
                ask(
                  {
                    title: "Reactivate partner",
                    description: `${partner.displayName} (${partner.slug})`,
                  },
                  (reason) => ({
                    action: "reactivate_partner",
                    reason,
                    partnerId: partner.partnerId,
                  }),
                )
              }
              onReviewApplication={(applicationId, email) =>
                ask(
                  {
                    title: "Mark application in review",
                    description: email,
                  },
                  (reason) => ({
                    action: "set_partner_application_status",
                    reason,
                    applicationId,
                    status: "in_review" as const,
                  }),
                )
              }
              onRejectApplication={(applicationId, email) =>
                ask(
                  {
                    title: "Reject partner application",
                    description: email,
                  },
                  (reason) => ({
                    action: "reject_partner_application",
                    reason,
                    applicationId,
                    rejectionReason: reason,
                  }),
                )
              }
              onApproveApplication={(applicationId, email, displayName) => {
                const slug = window.prompt(
                  "Partner slug (lowercase, unique)",
                  displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                );
                if (!slug?.trim()) return;
                const origin = window.prompt(
                  "Entitlement origin (gift, manual, internal, test — not stripe)",
                  "manual",
                );
                if (!origin || !["gift", "manual", "internal", "test"].includes(origin)) return;
                ask(
                  {
                    title: "Approve partner application",
                    description: `${email} → ${slug} (${origin}). Reuses createPartner onboarding invite. Copy invite URL from the notice — email is manual.`,
                  },
                  (reason) => ({
                    action: "approve_partner_application",
                    reason,
                    applicationId,
                    slug: slug.trim(),
                    origin: origin as "gift" | "manual" | "internal" | "test",
                    displayName,
                  }),
                );
              }}
              onRevokeDomain={(partner, domainId, hostname) =>
                ask(
                  {
                    title: "Revoke domain",
                    description: hostname,
                  },
                  (reason) => ({
                    action: "revoke_partner_domain",
                    reason,
                    partnerId: partner.partnerId,
                    domainId,
                  }),
                )
              }
            />
          ) : null}
          {section === "licenses" ? (
            <>
            <ActivationsSection
              snapshot={snapshot}
              onDeactivate={(activation) =>
                ask(
                  {
                    title: "Deactivate device",
                    description: `${activation.deviceName} on ${activation.platform}.`,
                  },
                  (reason) => ({
                    action: "deactivate_device",
                    reason,
                    activationId: activation.id,
                  }),
                )
              }
              onRename={(activation) => {
                const deviceName = window.prompt(
                  "Device name",
                  activation.deviceName,
                );
                if (!deviceName) return;
                ask(
                  {
                    title: "Rename device",
                    description: `Rename ${activation.deviceName} to ${deviceName}.`,
                  },
                  (reason) => ({
                    action: "rename_device",
                    reason,
                    activationId: activation.id,
                    deviceName,
                  }),
                );
              }}
            />
            <GiftsSection
              snapshot={snapshot}
              onCreate={(email, edition, origin) =>
                ask(
                  {
                    title: "Create gift or manual license",
                    description: `${EDITION_LABELS[edition]} via ${ORIGIN_LABELS[origin]} for ${email}.`,
                  },
                  (reason) => ({
                    action: "create_license",
                    reason,
                    email,
                    edition,
                    origin,
                  }),
                )
              }
              onRevoke={(license) =>
                ask(
                  {
                    title: "Revoke complimentary license",
                    description: `${license.id} will stop after the next check or offline grace.`,
                  },
                  (reason) => ({
                    action: "revoke_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onRestore={(license) =>
                ask(
                  {
                    title: "Restore complimentary license",
                    description: `Restore ${license.id}.`,
                  },
                  (reason) => ({
                    action: "restore_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onExpire={(license) =>
                ask(
                  {
                    title: "Expire complimentary license",
                    description: `Expire ${license.id} now.`,
                  },
                  (reason) => ({
                    action: "expire_license",
                    reason,
                    licenseId: license.id,
                  }),
                )
              }
              onExtend={(license) => {
                const validUntil = window.prompt(
                  "New expiry (ISO date)",
                  license.validUntil ?? new Date(Date.now() + 30 * 86400000).toISOString(),
                );
                if (!validUntil) return;
                ask(
                  {
                    title: "Extend complimentary license",
                    description: `Set expiry of ${license.id} to ${validUntil}.`,
                  },
                  (reason) => ({
                    action: "extend_license",
                    reason,
                    licenseId: license.id,
                    validUntil,
                  }),
                );
              }}
            />
            </>
          ) : null}
          {section === "billing" ? <BillingSection snapshot={snapshot} /> : null}
          {section === "activity" ? (
            <>
            <AuditSection snapshot={snapshot} />
            <DiagnosticsSection snapshot={snapshot} />
            <SupportSection
              snapshot={snapshot}
              onLookup={(email) => {
                const customer = snapshot.customers.find(
                  (row) => row.email === email.trim().toLowerCase(),
                );
                setSelectedCustomerId(customer?.id ?? null);
                setQuery(email);
                setSection("customers");
              }}
              onRecordActivation={(licenseId, deviceName, platform, appVersion) =>
                ask(
                  {
                    title: "Record reported device",
                    description:
                      "Support-only record. The desktop does not send activations to Operations.",
                  },
                  (reason) => ({
                    action: "record_activation",
                    reason,
                    licenseId,
                    deviceName,
                    platform,
                    appVersion,
                  }),
                )
              }
              onReceiveDiagnostic={(source, customerEmail, payload) =>
                ask(
                  {
                    title: "Store diagnostic export",
                    description:
                      "Manual paste only. Operations does not collect telemetry automatically.",
                  },
                  (reason) => ({
                    action: "receive_diagnostic",
                    reason,
                    source,
                    customerEmail,
                    payload,
                  }),
                )
              }
            />
            </>
          ) : null}
        </main>
      </div>

      <ReasonDialog
        pending={pending}
        busy={busy}
        error={error}
        onClose={() => {
          if (!busy) {
            setPending(null);
            setError(null);
          }
        }}
      />
    </div>
  );
}

function Dashboard({
  snapshot,
  release,
  ask,
}: {
  snapshot: OperationsSnapshot;
  release: ReleaseManifest | null;
  ask: (
    action: Omit<PendingAction, "onConfirm">,
    build: (reason: string) => OperationsAction,
  ) => void;
}) {
  const activeLicenses = snapshot.licenses.filter((row) => row.status === "active");
  const health = snapshot.serviceHealth ?? {
    serviceState: "NORMAL" as const,
    affectedCapabilities: [],
    retryAfter: null,
    updatedAt: null,
    updatedBy: null,
    persistence: snapshot.persistence,
  };

  return (
    <>
      <Panel title="Service health">
        <div className="grid gap-3 text-sm text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-slate-100">{health.serviceState}</div>
              <div className="text-slate-500">
                {health.affectedCapabilities.length > 0
                  ? health.affectedCapabilities.join(", ")
                  : "No remote capabilities limited"}
              </div>
            </div>
            <Badge
              tone={
                health.serviceState === "NORMAL"
                  ? "good"
                  : health.serviceState === "DEGRADED"
                    ? "warn"
                    : "warn"
              }
            >
              {health.persistence}
            </Badge>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            High traffic does not disable the browser. This state may temporarily
            limit remote capabilities. It does not create a different product edition.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                ask(
                  {
                    title: "Set service health to NORMAL",
                    description: "Restore full remote capability. Local work was never blocked.",
                  },
                  (reason) => ({ action: "set_service_health", reason, serviceState: "NORMAL" }),
                )
              }
            >
              NORMAL
            </Button>
            <Button
              onClick={() =>
                ask(
                  {
                    title: "Set service health to DEGRADED",
                    description: "Browser stays up. Only the listed remote capabilities pause.",
                  },
                  (reason) => ({
                    action: "set_service_health",
                    reason,
                    serviceState: "DEGRADED",
                    affectedCapabilities: ["license-recovery", "remote-analysis"],
                    retryAfter: 300,
                  }),
                )
              }
            >
              DEGRADED
            </Button>
            <Button
              onClick={() =>
                ask(
                  {
                    title: "Set service health to WEB_CAPACITY_LIMITED",
                    description:
                      "Last-resort: new browser backend operations pause. Local Home, Search, and Plan Mode stay available.",
                  },
                  (reason) => ({
                    action: "set_service_health",
                    reason,
                    serviceState: "WEB_CAPACITY_LIMITED",
                    retryAfter: 300,
                  }),
                )
              }
            >
              WEB_CAPACITY_LIMITED
            </Button>
          </div>
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Customers" value={snapshot.customers.length} />
        <Stat label="Active licenses" value={activeLicenses.length} />
        <Stat label="Business accounts" value={snapshot.organisations.length} />
        <Stat
          label="Seats"
          value={`${snapshot.organisations.reduce((sum, row) => sum + row.assignedSeatCount, 0)} / ${snapshot.organisations.reduce((sum, row) => sum + row.seatCount, 0)}`}
        />
        <Stat
          label="Expected monthly"
          value={formatMoney(
            snapshot.organisations.reduce((sum, row) => sum + row.monthlyAmountCents, 0),
            snapshot.organisations[0]?.currency ?? "eur",
          )}
        />
        <Stat
          label="License / payment issues"
          value={
            snapshot.licenses.filter((row) => row.status !== "active").length +
            snapshot.organisations.filter((row) => row.status !== "active").length
          }
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Licenses by edition">
          <div className="grid gap-2 text-sm">
            {LICENSE_EDITIONS.map((edition) => {
              const count = snapshot.licenses.filter(
                (row) => row.edition === edition,
              ).length;
              return (
                <div key={edition} className="flex justify-between text-slate-300">
                  <span>{EDITION_LABELS[edition]}</span>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Current stable release">
          {release ? (
            <div className="grid gap-2 text-sm text-slate-300">
              <div>Version {release.version}</div>
              <div>Minimum {release.minimumVersion}</div>
              <div>Mandatory {release.mandatory ? "yes" : "no"}</div>
              <div className="break-all text-slate-500">
                Windows {release.windows || "not published"}
              </div>
              <div className="break-all text-slate-500">
                macOS {release.mac || "not published"}
              </div>
            </div>
          ) : (
            <Empty>No release manifest is available.</Empty>
          )}
        </Panel>
      </div>
      <Panel title="Recent audit">
        <DataTable
          headers={["When", "Who", "What", "Target", "Reason"]}
          empty="No operations have been recorded yet."
          rows={snapshot.audit.slice(0, 8).map((entry) => [
            formatWhen(entry.timestamp),
            entry.actor,
            entry.action,
            `${entry.targetType} ${entry.targetId}`,
            entry.reason,
          ])}
        />
      </Panel>
      {snapshot.persistence === "memory" ? (
        <p className="text-sm text-amber-200">
          Persistence is in-memory. Create the Operations D1 database before using
          this console in production.
        </p>
      ) : null}
    </>
  );
}

function CustomersSection({
  snapshot,
  query,
  setQuery,
  customers,
  selected,
  onOpen,
  onChangeEmail,
  onResetDevices,
  onRefreshLicense,
  onRevokeLicense,
  onRestoreLicense,
}: {
  snapshot: OperationsSnapshot;
  query: string;
  setQuery: (value: string) => void;
  customers: Customer[];
  selected?: Customer;
  onOpen: (customer: Customer) => void;
  onChangeEmail: (customer: Customer) => void;
  onResetDevices: (license: License) => void;
  onRefreshLicense: (license: License) => void;
  onRevokeLicense: (license: License) => void;
  onRestoreLicense: (license: License) => void;
}) {
  return (
    <>
      <DataTable
        headers={[
          "Email",
          "Customer",
          "Licenses",
          "Edition",
          "Status",
          "Created",
          "Last seen",
          "",
        ]}
        empty="No customers yet."
        rows={customers.map((customer) => {
          const licenses = licensesForCustomer(snapshot, customer.id);
          return [
            customer.email,
            customer.id,
            String(licenses.length),
            licenses.map((row) => editionLabel(row.edition)).join(", ") || "—",
            licenses.map((row) => row.status).join(", ") || "—",
            formatWhen(customer.createdAt),
            formatWhen(customer.lastSeenAt),
            <Button key={customer.id} tone="ghost" onClick={() => onOpen(customer)}>
              Open
            </Button>,
          ];
        })}
      />
      {selected ? (
        <Panel
          title={selected.email}
          action={
            <Button tone="ghost" onClick={() => onChangeEmail(selected)}>
              Change email
            </Button>
          }
        >
          <p className="mb-4 text-sm text-slate-400">{selected.id}</p>
          <DataTable
            headers={["License", "Edition", "Origin", "Paid / Gifted", "Status", ""]}
            empty="This customer has no licenses."
            rows={licensesForCustomer(snapshot, selected.id).map((license) => [
              license.id,
              editionLabel(license.edition),
              ORIGIN_LABELS[license.origin],
              entitlementLabel(license),
              <Badge key={license.id} tone={statusTone(license.status)}>
                {license.status}
              </Badge>,
              <div key={`${license.id}-actions`} className="flex flex-wrap gap-2">
                <Button tone="ghost" onClick={() => onRefreshLicense(license)}>
                  Refresh
                </Button>
                <Button tone="ghost" onClick={() => onResetDevices(license)}>
                  Deactivate devices
                </Button>
                {license.isRevocableByAdmin ? (
                  license.status === "active" ? (
                    <Button tone="danger" onClick={() => onRevokeLicense(license)}>
                      Revoke
                    </Button>
                  ) : (
                    <Button tone="ghost" onClick={() => onRestoreLicense(license)}>
                      Restore
                    </Button>
                  )
                ) : null}
              </div>,
            ])}
          />
          <div className="mt-5">
            <h3 className="mb-2 text-xs uppercase tracking-wider text-slate-500">
              Activations
            </h3>
            <DataTable
              headers={["Device", "Platform", "Version", "Last seen", "Status"]}
              empty="No activations recorded for this customer."
              rows={snapshot.activations
                .filter((row) => row.customerId === selected.id)
                .map((activation) => [
                  activation.deviceName,
                  activation.platform,
                  activation.appVersion,
                  formatWhen(activation.lastSeenAt),
                  <Badge key={activation.id} tone={statusTone(activation.status)}>
                    {activation.status}
                  </Badge>,
                ])}
            />
          </div>
        </Panel>
      ) : null}
    </>
  );
}

function LicenseForm({
  origins,
  editions,
  submitLabel,
  onCreate,
}: {
  origins: License["origin"][];
  editions: License["edition"][];
  submitLabel: string;
  onCreate: (
    email: string,
    edition: License["edition"],
    origin: License["origin"],
  ) => void;
}) {
  const [email, setEmail] = useState("");
  const [edition, setEdition] = useState(editions[0]);
  const [origin, setOrigin] = useState(origins[0]);

  return (
    <form
      className="grid gap-3 md:grid-cols-4 md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(email, edition, origin);
      }}
    >
      <Field label="Email">
        <TextInput
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>
      <Field label="Edition">
        <Select
          value={edition}
          onChange={(event) =>
            setEdition(event.target.value as License["edition"])
          }
        >
          {editions.map((value) => (
            <option key={value} value={value}>
              {EDITION_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Origin">
        <Select
          value={origin}
          onChange={(event) =>
            setOrigin(event.target.value as License["origin"])
          }
        >
          {origins.map((value) => (
            <option key={value} value={value}>
              {ORIGIN_LABELS[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}

function LicensesSection({
  snapshot,
  onCreate,
  onRefresh,
  onRevoke,
  onRestore,
  onExpire,
  onExtend,
  onReset,
}: {
  snapshot: OperationsSnapshot;
  onCreate: (
    email: string,
    edition: License["edition"],
    origin: License["origin"],
  ) => void;
  onRefresh: (license: License) => void;
  onRevoke: (license: License) => void;
  onRestore: (license: License) => void;
  onExpire: (license: License) => void;
  onExtend: (license: License) => void;
  onReset: (license: License) => void;
}) {
  return (
    <>
      <Panel title="Create complimentary license">
        <LicenseForm
          editions={[...LICENSE_EDITIONS]}
          origins={[...ADMIN_CREATE_ORIGINS]}
          submitLabel="Create"
          onCreate={onCreate}
        />
        <p className="mt-3 text-xs text-slate-500">
          Admin can create gift, promo, manual, internal, or test licenses. Paid
          licenses come from billing and cannot be revoked here.
        </p>
      </Panel>
      <DataTable
        headers={[
          "License",
          "Customer",
          "Edition",
          "Origin",
          "Paid / Gifted",
          "Status",
          "Expiry",
          "Devices",
          "",
        ]}
        empty="No licenses yet."
        rows={snapshot.licenses.map((license) => [
          license.id,
          license.email || customerEmail(snapshot, license.customerId),
          editionLabel(license.edition),
          ORIGIN_LABELS[license.origin],
          entitlementLabel(license),
          <Badge key={license.id} tone={statusTone(license.status)}>
            {license.entitlementStatus}
          </Badge>,
          formatWhen(license.validUntil ?? license.currentPeriodEnd),
          `${license.deviceCount}/${license.deviceLimit}`,
          <div key={`${license.id}-actions`} className="flex flex-wrap gap-2">
            <Button tone="ghost" onClick={() => onRefresh(license)}>
              {license.isPaid ? "Refresh billing" : "Refresh"}
            </Button>
            <Button tone="ghost" onClick={() => onReset(license)}>
              Deactivate devices
            </Button>
            {license.isRevocableByAdmin ? (
              <>
                {license.status === "active" ? (
                  <>
                    <Button tone="ghost" onClick={() => onExtend(license)}>
                      Extend
                    </Button>
                    <Button tone="ghost" onClick={() => onExpire(license)}>
                      Expire
                    </Button>
                    <Button tone="danger" onClick={() => onRevoke(license)}>
                      Revoke
                    </Button>
                  </>
                ) : (
                  <Button tone="ghost" onClick={() => onRestore(license)}>
                    Restore
                  </Button>
                )}
              </>
            ) : null}
          </div>,
        ])}
      />
    </>
  );
}

function BusinessSection({
  snapshot,
  onCreate,
  onAddSeats,
  onRemoveSeats,
  onInvite,
  onChangeAdmin,
  onReactivate,
  onSetDeviceLimit,
}: {
  snapshot: OperationsSnapshot;
  onCreate: (
    name: string,
    billingEmail: string,
    seatCount: number,
    plan: Organisation["plan"],
  ) => void;
  onAddSeats: (organisation: Organisation, count: number) => void;
  onRemoveSeats: (organisation: Organisation, count: number) => void;
  onInvite: (organisation: Organisation, email: string) => void;
  onChangeAdmin: (organisation: Organisation, customerId: string) => void;
  onReactivate: (organisation: Organisation) => void;
  onSetDeviceLimit: (organisation: Organisation, deviceLimitPerSeat: number) => void;
}) {
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [seatCount, setSeatCount] = useState(20);
  const [plan, setPlan] = useState<Organisation["plan"]>("business");

  return (
    <>
      <Panel title="Create organisation">
        <form
          className="grid gap-3 md:grid-cols-5 md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(name, billingEmail, seatCount, plan);
          }}
        >
          <Field label="Name">
            <TextInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field label="Billing email">
            <TextInput
              type="email"
              value={billingEmail}
              onChange={(event) => setBillingEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Seat count">
            <TextInput
              type="number"
              min={plan === "business" ? 20 : 1}
              value={seatCount}
              onChange={(event) => setSeatCount(Number(event.target.value))}
              required
            />
          </Field>
          <Field label="Plan">
            <Select
              value={plan}
              onChange={(event) =>
                setPlan(event.target.value as Organisation["plan"])
              }
            >
              {ORGANISATION_PLANS.map((value) => (
                <option key={value} value={value}>
                  {PLAN_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Create</Button>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          Business requires at least 20 seats. The billing email becomes the first
          admin seat.
        </p>
      </Panel>
      {snapshot.organisations.length === 0 ? (
        <Empty>No business accounts yet.</Empty>
      ) : (
        snapshot.organisations.map((organisation) => {
          const seats = snapshot.seats.filter(
            (seat) => seat.organisationId === organisation.id,
          );
          return (
            <Panel
              key={organisation.id}
              title={organisation.name}
              action={
                <Badge tone={statusTone(organisation.status)}>
                  {organisation.status}
                </Badge>
              }
            >
              <div className="mb-4 grid gap-1 text-sm text-slate-300">
                <p className="font-medium text-slate-100">
                  {PLAN_LABELS[organisation.plan]} · {organisation.status === "active" ? "Active" : "Suspended"}
                </p>
                <p>{organisation.seatCount} seats</p>
                <p className="text-slate-400">
                  {organisation.deviceLimitPerSeat} active device(s) per assigned seat
                </p>
                <p className="text-slate-400">
                  {organisation.assignedSeatCount} assigned · {organisation.availableSeatCount} available
                </p>
                <p>{formatMoney(organisation.monthlyAmountCents, organisation.currency)}/month</p>
                <p className="text-slate-400">
                  Stripe subscription: {organisation.stripeSubscriptionStatus ?? "—"}
                </p>
                <p className="text-slate-400">
                  Renewal: {formatDay(organisation.currentPeriodEnd)}
                </p>
                <p className="text-xs text-slate-500">
                  {organisation.id} · billing {organisation.billingEmail} · admin{" "}
                  {customerEmail(snapshot, organisation.adminCustomerId)}
                </p>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  tone="ghost"
                  onClick={() => {
                    const count = Number(window.prompt("Seats to add", "1"));
                    if (!Number.isInteger(count) || count < 1) return;
                    onAddSeats(organisation, count);
                  }}
                >
                  Add seats
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const count = Number(window.prompt("Seats to remove", "1"));
                    if (!Number.isInteger(count) || count < 1) return;
                    onRemoveSeats(organisation, count);
                  }}
                >
                  Remove seats
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const email = window.prompt("Invite email");
                    if (!email) return;
                    onInvite(organisation, email);
                  }}
                >
                  Invite user
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const customerId = window.prompt(
                      "New admin customerId",
                      organisation.adminCustomerId ?? "",
                    );
                    if (!customerId) return;
                    onChangeAdmin(organisation, customerId);
                  }}
                >
                  Change admin
                </Button>
                <Button
                  tone="ghost"
                  onClick={() => {
                    const limit = Number(
                      window.prompt(
                        "Active devices per assigned seat",
                        String(organisation.deviceLimitPerSeat),
                      ),
                    );
                    if (!Number.isInteger(limit) || limit < 1 || limit > 10) return;
                    onSetDeviceLimit(organisation, limit);
                  }}
                >
                  Set devices per seat
                </Button>
                {organisation.isPaid ? null : organisation.status === "suspended" ? (
                  <Button tone="ghost" onClick={() => onReactivate(organisation)}>
                    Reactivate trial
                  </Button>
                ) : null}
              </div>
              <DataTable
                headers={["Email", "Status", "License", "Created"]}
                empty="No seats assigned."
                rows={seats.map((seat) => [
                  seat.email,
                  <Badge key={seat.id} tone={statusTone(seat.status)}>
                    {seat.status}
                  </Badge>,
                  seat.licenseId ?? "—",
                  formatWhen(seat.createdAt),
                ])}
              />
            </Panel>
          );
        })
      )}
    </>
  );
}

function SeatsSection({
  snapshot,
  onToggle,
  onRemove,
  onReset,
}: {
  snapshot: OperationsSnapshot;
  onToggle: (seat: Seat) => void;
  onRemove: (seat: Seat) => void;
  onReset: (seat: Seat) => void;
}) {
  return (
    <DataTable
      headers={["Email", "Organisation", "Status", "License", ""]}
      empty="No seats yet."
      rows={snapshot.seats.map((seat) => {
        const organisation = snapshot.organisations.find(
          (row) => row.id === seat.organisationId,
        );
        return [
          seat.email,
          organisation?.name ?? seat.organisationId,
          <Badge key={seat.id} tone={statusTone(seat.status)}>
            {seat.status}
          </Badge>,
          seat.licenseId ?? "—",
          <div key={`${seat.id}-actions`} className="flex flex-wrap gap-2">
            <Button tone="ghost" onClick={() => onToggle(seat)}>
              {seat.status === "suspended" ? "Reactivate seat" : "Suspend seat"}
            </Button>
            <Button tone="ghost" onClick={() => onRemove(seat)}>
              Remove seat
            </Button>
            <Button tone="ghost" onClick={() => onReset(seat)}>
              Deactivate devices
            </Button>
          </div>,
        ];
      })}
    />
  );
}

function ActivationsSection({
  snapshot,
  onDeactivate,
  onRename,
}: {
  snapshot: OperationsSnapshot;
  onDeactivate: (activation: Activation) => void;
  onRename: (activation: Activation) => void;
}) {
  return (
    <DataTable
      headers={[
        "Device",
        "Platform",
        "App version",
        "Customer",
        "Last seen",
        "Status",
        "",
      ]}
      empty="No activations recorded. Desktop license APIs are not connected to Operations."
      rows={snapshot.activations.map((activation) => [
        activation.deviceName,
        activation.platform,
        activation.appVersion,
        customerEmail(snapshot, activation.customerId),
        formatWhen(activation.lastSeenAt),
        <Badge key={activation.id} tone={statusTone(activation.status)}>
          {activation.status}
        </Badge>,
        <div key={`${activation.id}-actions`} className="flex flex-wrap gap-2">
          <Button tone="ghost" onClick={() => onRename(activation)}>
            Rename
          </Button>
          {activation.status === "active" ? (
            <Button tone="danger" onClick={() => onDeactivate(activation)}>
              Deactivate
            </Button>
          ) : null}
        </div>,
      ])}
    />
  );
}

function GiftsSection({
  snapshot,
  onCreate,
  onRevoke,
  onRestore,
  onExpire,
  onExtend,
}: {
  snapshot: OperationsSnapshot;
  onCreate: (
    email: string,
    edition: License["edition"],
    origin: License["origin"],
  ) => void;
  onRevoke: (license: License) => void;
  onRestore: (license: License) => void;
  onExpire: (license: License) => void;
  onExtend: (license: License) => void;
}) {
  const rows = snapshot.licenses.filter((license) =>
    (GIFT_SECTION_ORIGINS as readonly string[]).includes(license.origin),
  );

  return (
    <>
      <Panel title="Issue a gift or manual license">
        <LicenseForm
          editions={["personal_lifetime", "personal_monthly"]}
          origins={[...ADMIN_CREATE_ORIGINS]}
          submitLabel="Issue"
          onCreate={onCreate}
        />
        <p className="mt-3 text-xs text-slate-500">
          Revocation requires a reason and is written to the audit log. Paid
          licenses never appear here as revocable.
        </p>
      </Panel>
      <DataTable
        headers={["License", "Customer", "Edition", "Origin", "Status", "Expiry", ""]}
        empty="No gift, promo, or manual licenses yet."
        rows={rows.map((license) => [
          license.id,
          license.email || customerEmail(snapshot, license.customerId),
          editionLabel(license.edition),
          ORIGIN_LABELS[license.origin],
          <Badge key={license.id} tone={statusTone(license.status)}>
            {license.entitlementStatus}
          </Badge>,
          formatWhen(license.validUntil),
          <div key={`${license.id}-actions`} className="flex flex-wrap gap-2">
            {license.isRevocableByAdmin && license.status === "active" ? (
              <>
                <Button tone="ghost" onClick={() => onExtend(license)}>
                  Extend
                </Button>
                <Button tone="ghost" onClick={() => onExpire(license)}>
                  Expire
                </Button>
                <Button tone="danger" onClick={() => onRevoke(license)}>
                  Revoke
                </Button>
              </>
            ) : license.isRevocableByAdmin ? (
              <Button tone="ghost" onClick={() => onRestore(license)}>
                Restore
              </Button>
            ) : null}
          </div>,
        ])}
      />
    </>
  );
}

function ReleasesSection({ release }: { release: ReleaseManifest | null }) {
  if (!release) return <Empty>No stable release manifest is available.</Empty>;

  return (
    <Panel title="Current stable release">
      <div className="grid gap-3 text-sm text-slate-300">
        <div>Latest {release.version}</div>
        <div>Channel {release.channel}</div>
        <div>Minimum {release.minimumVersion}</div>
        <div>Mandatory {release.mandatory ? "yes" : "no"}</div>
        {release.notes ? <div>Notes {release.notes}</div> : null}
        <div className="break-all">
          Windows URL {release.windows || "empty — installer not published"}
        </div>
        <div className="break-all">
          macOS URL {release.mac || "empty — installer not published"}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Read only. Publish, retire, and rollback stay a later Operations slice.
      </p>
    </Panel>
  );
}

function DiagnosticsSection({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <>
      <p className="text-sm text-slate-400">
        Manual diagnostic exports only. Operations does not collect telemetry.
      </p>
      <DataTable
        headers={["Received", "Source", "Customer", "Compatibility", "Id"]}
        empty="No diagnostic exports have been received."
        rows={snapshot.diagnostics.map((item) => [
          formatWhen(item.receivedAt),
          item.source,
          item.customerEmail ?? "—",
          item.compatibilityStatus ?? "—",
          item.id,
        ])}
      />
    </>
  );
}

function SupportSection({
  snapshot,
  onLookup,
  onRecordActivation,
  onReceiveDiagnostic,
}: {
  snapshot: OperationsSnapshot;
  onLookup: (email: string) => void;
  onRecordActivation: (
    licenseId: string,
    deviceName: string,
    platform: string,
    appVersion: string,
  ) => void;
  onReceiveDiagnostic: (
    source: string,
    customerEmail: string | undefined,
    payload: unknown,
  ) => void;
}) {
  const [email, setEmail] = useState("");
  const [licenseId, setLicenseId] = useState(snapshot.licenses[0]?.id ?? "");
  const [deviceName, setDeviceName] = useState("");
  const [platform, setPlatform] = useState("windows");
  const [appVersion, setAppVersion] = useState("");
  const [source, setSource] = useState("email");
  const [payload, setPayload] = useState("");
  const customer = snapshot.customers.find(
    (row) => row.email === email.trim().toLowerCase(),
  );
  const licenses = customer
    ? licensesForCustomer(snapshot, customer.id)
    : [];
  const activations = customer
    ? snapshot.activations.filter((row) => row.customerId === customer.id)
    : [];
  const diagnostic = snapshot.diagnostics.find(
    (row) => row.customerEmail === customer?.email,
  );

  return (
    <>
      <Panel title="Lookup">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onLookup(email);
          }}
        >
          <div className="min-w-72 flex-1">
            <Field label="Customer email">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
          </div>
          <Button type="submit">Lookup</Button>
        </form>
        {email && !customer ? (
          <p className="mt-4 text-sm text-slate-400">No customer for that email.</p>
        ) : null}
        {customer ? (
          <div className="mt-5 grid gap-4 text-sm text-slate-300">
            <div>
              {customer.email} · {customer.id} · last seen{" "}
              {formatWhen(customer.lastSeenAt)}
            </div>
            <div>
              Licenses:{" "}
              {licenses.length
                ? licenses
                    .map(
                      (license) =>
                        `${license.id} ${editionLabel(license.edition)} ${license.status}`,
                    )
                    .join(" · ")
                : "none"}
            </div>
            <div>
              Activations:{" "}
              {activations.length
                ? activations
                    .map(
                      (item) =>
                        `${item.deviceName} ${item.platform} ${item.status}`,
                    )
                    .join(" · ")
                : "none"}
            </div>
            <div>
              Compatibility: {diagnostic?.compatibilityStatus ?? "not available"}
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel title="Record a reported device">
        <form
          className="grid gap-3 md:grid-cols-5 md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            onRecordActivation(licenseId, deviceName, platform, appVersion);
          }}
        >
          <Field label="License">
            <Select
              value={licenseId}
              onChange={(event) => setLicenseId(event.target.value)}
              required
            >
              {snapshot.licenses.map((license) => (
                <option key={license.id} value={license.id}>
                  {license.id} · {customerEmail(snapshot, license.customerId)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Device name">
            <TextInput
              value={deviceName}
              onChange={(event) => setDeviceName(event.target.value)}
              required
            />
          </Field>
          <Field label="Platform">
            <Select
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
            </Select>
          </Field>
          <Field label="App version">
            <TextInput
              value={appVersion}
              onChange={(event) => setAppVersion(event.target.value)}
              placeholder="0.1.0-pre-rc"
              required
            />
          </Field>
          <Button type="submit" disabled={!snapshot.licenses.length}>
            Record
          </Button>
        </form>
      </Panel>
      <Panel title="Receive diagnostic export">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            let parsed: unknown = payload;
            try {
              parsed = JSON.parse(payload);
            } catch {
              parsed = { text: payload };
            }
            onReceiveDiagnostic(source, email || undefined, parsed);
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Source">
              <TextInput
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="email, ticket, paste"
                required
              />
            </Field>
            <Field label="Customer email (optional)">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Paste export">
            <TextArea
              value={payload}
              onChange={(event) => setPayload(event.target.value)}
              placeholder='{"compatibilityStatus":"ok"}'
              required
            />
          </Field>
          <div>
            <Button type="submit">Store export</Button>
          </div>
        </form>
      </Panel>
    </>
  );
}

function PartnersSection({
  snapshot,
  onCreate,
  onInvite,
  onSuspend,
  onRevoke,
  onReactivate,
  onRevokeDomain,
  onReviewApplication,
  onRejectApplication,
  onApproveApplication,
}: {
  snapshot: OperationsSnapshot;
  onReviewApplication: (applicationId: string, email: string) => void;
  onRejectApplication: (applicationId: string, email: string) => void;
  onApproveApplication: (applicationId: string, email: string, displayName: string) => void;
  onCreate: (
    slug: string,
    displayName: string,
    ownerEmail: string,
    origin: "gift" | "manual" | "internal" | "test",
    validUntil: string,
  ) => void;
  onInvite: (
    partner: OpsPartnerRow,
    email: string,
    role: "partner_admin" | "partner_member",
  ) => void;
  onSuspend: (partner: OpsPartnerRow) => void;
  onRevoke: (partner: OpsPartnerRow) => void;
  onReactivate: (partner: OpsPartnerRow) => void;
  onRevokeDomain: (partner: OpsPartnerRow, domainId: string, hostname: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [origin, setOrigin] = useState<"gift" | "manual" | "internal" | "test">("gift");
  const [validUntil, setValidUntil] = useState("");
  const partners = snapshot.partners ?? [];
  const applications = snapshot.partnerApplications ?? [];

  return (
    <>
      <p className="text-sm text-slate-400">
        Public applications at /partners register interest only — they do not grant entitlements.
        Approve creates the partner (or links an existing one) and surfaces the onboarding invite
        URL in the action notice for manual delivery. One partner type. Roles inside a partner:{" "}
        <code className="text-slate-300">partner_admin</code> (branding, domains, invites) and{" "}
        <code className="text-slate-300">partner_member</code> (read-only). Platform entitlement is{" "}
        <code className="text-slate-300">partner_entitlement</code> (gift/manual/internal/test) —
        not a <code className="text-slate-300">license_grant</code> edition. Existing Business gift
        licenses stay as-is; do not auto-convert them. Create gift partners and send onboarding
        invites — the partner self-service configures brand, hostname, and DNS in{" "}
        <code className="text-slate-300">/partners/portal</code>. Ops does not register hostnames
        or edit branding. Saving a hostname is pending until DNS validates — not immediate
        activation. Example hostname (partner chooses):{" "}
        <code className="text-slate-300">documents.example.com</code>. Optional{" "}
        <code className="text-slate-300">valid_until</code> for a 12-month gift; leave blank for
        indefinite courtesy.
      </p>
      <Panel title={`Applications (${applications.length})`}>
        {applications.length === 0 ? (
          <Empty>No public applications yet.</Empty>
        ) : (
          <DataTable
            headers={["Applicant", "Status", "Partner", "Actions"]}
            empty="No public applications yet."
            rows={applications.map((application) => [
              <div key={`${application.applicationId}-name`}>
                <div className="font-medium text-slate-100">{application.displayName}</div>
                <div className="text-xs text-slate-500">{application.normalizedEmail}</div>
              </div>,
              <Badge key={`${application.applicationId}-status`} tone={statusTone(application.status)}>
                {application.status}
              </Badge>,
              application.partnerId ?? "—",
              <div key={`${application.applicationId}-actions`} className="flex flex-wrap gap-2">
                {application.status === "pending" ? (
                  <Button
                    type="button"
                    tone="muted"
                    onClick={() =>
                      onReviewApplication(application.applicationId, application.normalizedEmail)
                    }
                  >
                    In review
                  </Button>
                ) : null}
                {application.status === "pending" || application.status === "in_review" ? (
                  <>
                    <Button
                      type="button"
                      onClick={() =>
                        onApproveApplication(
                          application.applicationId,
                          application.normalizedEmail,
                          application.displayName,
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() =>
                        onRejectApplication(application.applicationId, application.normalizedEmail)
                      }
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>,
            ])}
          />
        )}
      </Panel>
      <Panel title="Create partner">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(slug, displayName, ownerEmail, origin, validUntil.trim());
            setSlug("");
            setDisplayName("");
            setOwnerEmail("");
            setValidUntil("");
          }}
        >
          <Field label="Slug">
            <TextInput value={slug} onChange={(event) => setSlug(event.target.value)} required />
          </Field>
          <Field label="Display name">
            <TextInput
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </Field>
          <Field label="Owner email">
            <TextInput
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              type="email"
              required
            />
          </Field>
          <Field label="Origin">
            <Select
              value={origin}
              onChange={(event) =>
                setOrigin(event.target.value as "gift" | "manual" | "internal" | "test")
              }
            >
              <option value="gift">gift</option>
              <option value="manual">manual</option>
              <option value="internal">internal</option>
              <option value="test">test</option>
            </Select>
          </Field>
          <Field label="valid_until (optional ISO date)">
            <TextInput
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              placeholder="blank = indefinite · or 2027-09-22"
            />
          </Field>
          <div className="flex items-end">
            <Button type="submit">Create partner</Button>
          </div>
        </form>
      </Panel>
      <Panel title={`Partners (${partners.length})`}>
        {partners.length === 0 ? (
          <Empty>No partners yet.</Empty>
        ) : (
          <DataTable
            headers={["Partner", "Brand", "Status", "Entitlement", "Domains", "Actions"]}
            empty="No partners yet."
            rows={partners.map((partner) => [
              <div key={`${partner.partnerId}-name`}>
                <div className="font-medium text-slate-100">{partner.displayName}</div>
                <div className="text-xs text-slate-500">
                  {partner.slug} · {partner.ownerEmail}
                </div>
              </div>,
              partner.brandId,
              <Badge key={`${partner.partnerId}-status`} tone={statusTone(partner.status)}>
                {partner.status}
              </Badge>,
              partner.entitlementOrigin
                ? `${partner.entitlementOrigin} · ${partner.entitlementStatus}`
                : "—",
              <div key={`${partner.partnerId}-domains`} className="space-y-2 text-xs">
                {(partner.domains ?? []).map((domain) => (
                  <div key={domain.domainId} className="space-y-1 rounded-lg border border-white/5 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {domain.hostname} · {domain.status}
                        {domain.dnsTarget ? ` · CNAME → ${domain.dnsTarget}` : ""}
                      </span>
                      <Button
                        type="button"
                        tone="danger"
                        onClick={() => onRevokeDomain(partner, domain.domainId, domain.hostname)}
                      >
                        Revoke (emergency)
                      </Button>
                    </div>
                    {domain.validationErrors ? (
                      <pre className="whitespace-pre-wrap break-all text-[11px] text-slate-400">
                        {domain.validationErrors}
                      </pre>
                    ) : null}
                  </div>
                ))}
                {(partner.domains ?? []).length === 0 ? (
                  <p className="text-slate-500">Partner configures hostname in /partners/portal</p>
                ) : null}
              </div>,
              <div key={`${partner.partnerId}-actions`} className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const email = window.prompt("Invite email", partner.ownerEmail);
                    if (!email) return;
                    const roleRaw = window.prompt(
                      "Role: partner_admin (configure) or partner_member (read-only)",
                      "partner_admin",
                    );
                    if (!roleRaw) return;
                    const role =
                      roleRaw.trim() === "partner_member" ? "partner_member" : "partner_admin";
                    onInvite(partner, email, role);
                  }}
                >
                  Invite
                </Button>
                <Button type="button" onClick={() => onSuspend(partner)}>
                  Suspend
                </Button>
                <Button type="button" onClick={() => onReactivate(partner)}>
                  Reactivate
                </Button>
                <Button type="button" onClick={() => onRevoke(partner)}>
                  Revoke
                </Button>
              </div>,
            ])}
          />
        )}
      </Panel>
    </>
  );
}

function BillingSection({ snapshot }: { snapshot: OperationsSnapshot }) {
  const paid = snapshot.licenses.filter(
    (license) => license.paymentProvider || license.paymentReference || license.isPaid,
  );
  const issues = snapshot.licenses.filter(
    (license) => license.isPaid && license.status !== "active",
  );

  return (
    <>
      <p className="text-sm text-slate-400">
        Stripe remains the source of paid entitlement. Ops can inspect and request
        quantity changes through the same billing operations — it cannot edit
        charges by hand.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Paid licenses" value={paid.length} />
        <Stat label="Payment issues" value={issues.length} />
        <Stat
          label="Business monthly"
          value={formatMoney(
            snapshot.organisations.reduce((sum, row) => sum + row.monthlyAmountCents, 0),
            snapshot.organisations[0]?.currency ?? "eur",
          )}
        />
      </div>
      <DataTable
        headers={["License", "Email", "Provider", "Reference", "Status", "Period end"]}
        empty="No Stripe-backed licenses yet."
        rows={paid.map((license) => [
          license.id,
          license.email,
          license.paymentProvider ?? "—",
          license.paymentReference ?? "—",
          <Badge key={license.id} tone={statusTone(license.status)}>
            {license.status}
          </Badge>,
          formatDay(license.currentPeriodEnd),
        ])}
      />
    </>
  );
}

function AuditSection({ snapshot }: { snapshot: OperationsSnapshot }) {
  return (
    <DataTable
      headers={["When", "Who", "What", "Target", "Reason"]}
      empty="The audit log is empty."
      rows={snapshot.audit.map((entry) => [
        formatWhen(entry.timestamp),
        entry.actor,
        entry.action,
        `${entry.targetType} ${entry.targetId}`,
        entry.reason,
      ])}
    />
  );
}
