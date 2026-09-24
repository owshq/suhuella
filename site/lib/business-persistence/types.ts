import type { BusinessStoreShape } from "../business-store.ts";

export type BusinessPersistenceKind = "d1" | "file" | "memory" | "unavailable";

export class BusinessPersistenceUnavailableError extends Error {
  readonly code = "business_persistence_unavailable";

  constructor() {
    super("Business persistence requires LICENSE_DB with migration 0014 in production");
    this.name = "BusinessPersistenceUnavailableError";
  }
}

export type BusinessPersistenceStore = {
  readonly kind: BusinessPersistenceKind;
  isReady(): Promise<boolean>;
  read(): Promise<BusinessStoreShape>;
  write(document: BusinessStoreShape): Promise<void>;
};
