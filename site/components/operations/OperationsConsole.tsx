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
  type Organisation,
  type Seat,
} from "@/lib/operations/types";
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
  ["licenses", "Licenses"],
  ["business", "Business Accounts"],
  ["seats", "Seats"],
  ["activations", "Activations"],
  ["gifts", "Gifts / Manual"],
  ["releases", "Releases"],
  ["diagnostics", "Diagnostics"],
  ["support", "Support"],
  ["audit", "Audit log"],
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
}: {
  initialSnapshot: OperationsSnapshot;
  initialRelease: ReleaseManifest | null;
  initialSession: OperationsSession;
}) {
  const [state, setState] = useState<ConsoleState>({
    snapshot: initialSnapshot,
    release: initialRelease,
  });
  const [section, setSection] = useState<Section>("dashboard");
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
        | ConsoleState & { ok: true }
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
      setNotice("Change saved and written to the audit log.");
    } catch (caught) {
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

  return (
    <div className="flex min-h-screen bg-[#0b0f14] text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/8 bg-[#0e141c] px-4 py-5">
        <div className="px-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
            Operations
          </div>
          <div className="mt-1 text-sm text-slate-400">{brand.displayName} console</div>
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
          Admin console manages access and support actions. Billing provider
          controls paid entitlement. Never the recommendation engine, knowledge
          index, or local user files.
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">
              {SECTIONS.find(([id]) => id === section)?.[1]}
            </h1>
            <p className="text-sm text-slate-500">{snapshot.actor.email}</p>
          </div>
          <div className="flex items-center gap-2">
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
            />
          ) : null}
          {section === "seats" ? (
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
          ) : null}
          {section === "activations" ? (
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
          ) : null}
          {section === "gifts" ? (
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
          ) : null}
          {section === "releases" ? <ReleasesSection release={state.release} /> : null}
          {section === "diagnostics" ? (
            <DiagnosticsSection snapshot={snapshot} />
          ) : null}
          {section === "support" ? (
            <SupportSection
              snapshot={snapshot}
              onLookup={(email) => {
                const customer = snapshot.customers.find(
                  (row) => row.email === email.trim().toLowerCase(),
                );
                setSelectedCustomerId(customer?.id ?? null);
                setQuery(email);
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
          ) : null}
          {section === "audit" ? <AuditSection snapshot={snapshot} /> : null}
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
  const activeDevices = snapshot.activations.filter((row) => row.status === "active");
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
                      "Last-resort: new browser backend operations pause. Local Home, Search, and Organise stay available.",
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customers" value={snapshot.customers.length} />
        <Stat label="Active licenses" value={activeLicenses.length} />
        <Stat label="Active devices" value={activeDevices.length} />
        <Stat label="Organisations" value={snapshot.organisations.length} />
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
      <Field label="Search">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="email or customerId"
        />
      </Field>
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
              <p className="mb-4 text-sm text-slate-400">
                {organisation.id} · {PLAN_LABELS[organisation.plan]} ·{" "}
                {organisation.isPaid ? "Paid" : "Trial / gifted"} ·{" "}
                {organisation.seatCount} seats · billing {organisation.billingEmail} ·
                admin {customerEmail(snapshot, organisation.adminCustomerId)}
              </p>
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
        <div>Version {release.version}</div>
        <div>Channel {release.channel}</div>
        <div>Minimum version {release.minimumVersion}</div>
        <div>Mandatory {release.mandatory ? "yes" : "no"}</div>
        <div className="break-all">
          Windows URL {release.windows || "empty — installer not published"}
        </div>
        <div className="break-all">
          macOS URL {release.mac || "empty — installer not published"}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Display only. This slice does not implement the updater.
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
