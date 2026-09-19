/**
 * ELECTRON-SOURCE-ADAPTER-001
 *
 * Desktop path → SourceHandle infrastructure.
 * Node fs stays in the desktop host. This module only wires the frozen contract.
 *
 * Sync Engine rule: Sync Engine → Handle → Provider. Never Sync Engine → Node fs.
 */

import {
  createElectronHandle,
  type HandleCapabilities,
  type HandleStatus,
  type SourceHandle,
  type SourceHandleWatch,
} from "../source-handles.ts";

export const ELECTRON_ADAPTER_ID = "electron" as const;

export type ElectronPathProbe = () => HandleStatus | Promise<HandleStatus>;

export type ElectronHandleAdapterOptions = {
  probe?: ElectronPathProbe;
  requestAccess?: () => boolean | Promise<boolean>;
  watchPath?: () => SourceHandleWatch | null | Promise<SourceHandleWatch | null>;
  dispose?: () => void | Promise<void>;
  capabilities?: Partial<HandleCapabilities>;
};

function isPresent(status: HandleStatus): boolean {
  return status === "available" || status === "busy";
}

/** Real Electron adapter. Inject a path probe from the desktop host. */
export function createElectronHandleAdapter(options: ElectronHandleAdapterOptions = {}): SourceHandle {
  const probe = options.probe;
  return createElectronHandle({
    capabilities: options.capabilities,
    pathExists: probe
      ? async () => {
          const status = await probe();
          return status !== "notFound" && status !== "unknown";
        }
      : undefined,
    requestAccess: options.requestAccess
      ? async () => Boolean(await options.requestAccess!())
      : undefined,
    async status() {
      if (!probe) return "unknown";
      return probe();
    },
    async requestPermission() {
      if (options.requestAccess) {
        return (await options.requestAccess()) ? "available" : "permissionDenied";
      }
      if (!probe) return "unknown";
      const status = await probe();
      return isPresent(status) ? status : status;
    },
    async open() {
      if (!probe) return { ok: false, status: "unknown" };
      const status = await probe();
      return { ok: status === "available", status };
    },
    async refresh() {
      if (!probe) return { ok: false, status: "unknown" };
      const status = await probe();
      return { ok: status === "available", status };
    },
    watch: options.watchPath
      ? async () => (await options.watchPath!()) ?? null
      : undefined,
    dispose: options.dispose
      ? async () => {
          await options.dispose!();
        }
      : undefined,
  });
}
