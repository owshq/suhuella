/**
 * Adapter Contract — one suite for every provider.
 *
 * The same checks run against Browser, Electron, Drive, and every future adapter.
 * If a provider fails here, the infrastructure contract — not a bespoke test — is wrong.
 */

import {
  createSourceHandleRegistry,
  type HandleStatus,
  type SourceHandle,
  type SourceProvider,
} from "../source-handles.ts";

export type AdapterContractScenario =
  | "startup"
  | "available"
  | "permissionDenied"
  | "unavailable"
  | "watchable";

export type AdapterContractFixture = {
  provider: SourceProvider;
  create(scenario: AdapterContractScenario): SourceHandle;
};

export type AdapterContractCheck =
  | "identity"
  | "startupUnknown"
  | "open"
  | "refresh"
  | "permission"
  | "unavailable"
  | "watch"
  | "dispose";

export type AdapterContractReport = {
  provider: SourceProvider;
  passed: AdapterContractCheck[];
};

const HANDLE_STATUSES: HandleStatus[] = [
  "unknown",
  "available",
  "permissionDenied",
  "notFound",
  "offline",
  "busy",
  "unsupported",
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function trackDispose(handle: SourceHandle, onDispose: () => void): SourceHandle {
  const dispose = handle.dispose.bind(handle);
  return {
    ...handle,
    dispose: async () => {
      await dispose();
      onDispose();
    },
  };
}

/** Same suite for every adapter. Throws with provider label on failure. */
export async function runAdapterContract(
  fixture: AdapterContractFixture,
): Promise<AdapterContractReport> {
  const { provider } = fixture;
  const passed: AdapterContractCheck[] = [];
  const label = provider;

  const startup = fixture.create("startup");
  assert(startup.provider === provider, `${label}: identity`);
  assert(typeof startup.contractVersion === "number", `${label}: contractVersion`);
  assert(typeof startup.capabilities === "object", `${label}: capabilities`);
  for (const key of ["watch", "open", "organise", "rename", "move", "sync"] as const) {
    assert(typeof startup.capabilities[key] === "boolean", `${label}: capabilities.${key}`);
  }
  passed.push("identity");

  assert((await startup.status()) === "unknown", `${label}: startupUnknown`);
  passed.push("startupUnknown");

  const available = fixture.create("available");
  const opened = await available.open();
  assert(typeof opened.ok === "boolean", `${label}: open.ok`);
  assert(HANDLE_STATUSES.includes(opened.status), `${label}: open.status`);
  assert(opened.ok === true && opened.status === "available", `${label}: open available`);
  passed.push("open");

  const refreshed = await available.refresh();
  assert(typeof refreshed.ok === "boolean", `${label}: refresh.ok`);
  assert(HANDLE_STATUSES.includes(refreshed.status), `${label}: refresh.status`);
  assert(refreshed.ok === true, `${label}: refresh available`);
  passed.push("refresh");

  const permission = await available.requestPermission();
  assert(HANDLE_STATUSES.includes(permission), `${label}: permission token`);
  assert(permission === "available", `${label}: permission granted path`);
  passed.push("permission");

  const denied = fixture.create("permissionDenied");
  const deniedStatus = await denied.status();
  assert(deniedStatus === "permissionDenied", `${label}: permissionDenied path`);
  passed.push("unavailable");

  const offline = fixture.create("unavailable");
  const offlineStatus = await offline.status();
  assert(
    offlineStatus === "offline" || offlineStatus === "notFound" || offlineStatus === "unsupported",
    `${label}: unavailable path`,
  );

  if (startup.capabilities.watch) {
    const watchable = fixture.create("watchable");
    assert(typeof watchable.watch === "function", `${label}: watch when watchable`);
    const watch = await watchable.watch!();
    assert(watch === null || typeof watch.stop === "function", `${label}: watch stop()`);
    passed.push("watch");
  } else {
    assert(startup.watch === undefined, `${label}: no watch when not watchable`);
  }

  const registry = createSourceHandleRegistry();
  let disposed = false;
  registry.bind(`src_${provider}`, trackDispose(fixture.create("available"), () => {
    disposed = true;
  }));
  await registry.replace(`src_${provider}`, fixture.create("available"));
  if (!disposed) throw new Error(`${label}: dispose via registry.replace`);
  await registry.dispose();
  passed.push("dispose");

  return { provider, passed };
}
