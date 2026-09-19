"use client";

import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useState } from "react";

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-white/8 text-slate-200",
    good: "bg-emerald-500/15 text-emerald-300",
    warn: "bg-amber-500/15 text-amber-200",
    bad: "bg-rose-500/15 text-rose-300",
    info: "bg-sky-500/15 text-sky-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  tone = "primary",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "ghost" | "danger" | "muted";
  disabled?: boolean;
}) {
  const tones = {
    primary: "bg-sky-500 text-slate-950 hover:bg-sky-400",
    ghost: "bg-white/6 text-slate-100 hover:bg-white/10",
    danger: "bg-rose-500/90 text-white hover:bg-rose-400",
    muted: "bg-transparent text-slate-300 hover:bg-white/6",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[#0b0f14] px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClass} min-h-24 resize-y ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/3 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-slate-100">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-50">{value}</div>
    </div>
  );
}

export function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-slate-500">
            {headers.map((header) => (
              <th key={header} className="border-b border-white/8 pb-2 pr-4 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="align-top text-slate-200">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-white/6 py-3 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "active") return "good";
  if (status === "invited" || status === "expired") return "warn";
  if (status === "suspended" || status === "revoked" || status === "deactivated") {
    return "bad";
  }
  return "neutral";
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export type PendingAction = {
  title: string;
  description: string;
  extra?: ReactNode;
  onConfirm: (reason: string) => Promise<void> | void;
};

export function ReasonDialog({
  pending,
  busy,
  error,
  onClose,
}: {
  pending: PendingAction | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [pending]);

  if (!pending) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await pending?.onConfirm(reason);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#121821] p-5 shadow-2xl"
      >
        <h3 className="text-base font-semibold text-slate-50">{pending.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{pending.description}</p>
        {pending.extra ? <div className="mt-4 grid gap-3">{pending.extra}</div> : null}
        <div className="mt-4">
          <Field label="Reason (required, stored in the audit log)">
            <TextArea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this change being made?"
              required
              minLength={8}
            />
          </Field>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button tone="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy || reason.trim().length < 8}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </form>
    </div>
  );
}
