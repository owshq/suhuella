import { PartnerApplicationStoreUnavailableError } from "./application-types.ts";

type D1DatabaseLike = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
    };
  };
};

export type PartnerCheckoutAttempt = {
  attemptId: string;
  normalizedEmail: string;
  priceId: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  updatedAt: string;
};

export type PartnerStripeFulfillment = {
  stripeSubscriptionId: string;
  normalizedEmail: string;
  stripeCustomerId: string | null;
  stripeCheckoutSessionId: string | null;
  partnerId: string | null;
  status: "processing" | "fulfilled";
  createdAt: string;
  updatedAt: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}`;
}

export type PartnerStripeLedger = {
  findOpenAttempt(email: string): Promise<PartnerCheckoutAttempt | null>;
  insertOpenAttempt(input: { email: string; priceId: string }): Promise<PartnerCheckoutAttempt>;
  attachCheckoutSession(input: {
    attemptId: string;
    sessionId: string;
    checkoutUrl: string;
  }): Promise<void>;
  completeAttempt(email: string): Promise<void>;
  claimFulfillment(input: {
    stripeSubscriptionId: string;
    email: string;
    stripeCustomerId: string | null;
    stripeCheckoutSessionId: string | null;
  }): Promise<"claimed" | "resume" | "fulfilled" | "busy">;
  markFulfillment(input: {
    stripeSubscriptionId: string;
    partnerId: string;
  }): Promise<void>;
  releaseUnfinishedClaim(stripeSubscriptionId: string): Promise<void>;
  findFulfillment(stripeSubscriptionId: string): Promise<PartnerStripeFulfillment | null>;
};

function mapAttempt(row: Record<string, unknown>): PartnerCheckoutAttempt {
  return {
    attemptId: String(row.attempt_id),
    normalizedEmail: String(row.normalized_email),
    priceId: String(row.price_id),
    stripeCheckoutSessionId: row.stripe_checkout_session_id
      ? String(row.stripe_checkout_session_id)
      : null,
    checkoutUrl: row.checkout_url ? String(row.checkout_url) : null,
    status: row.status as PartnerCheckoutAttempt["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapFulfillment(row: Record<string, unknown>): PartnerStripeFulfillment {
  return {
    stripeSubscriptionId: String(row.stripe_subscription_id),
    normalizedEmail: String(row.normalized_email),
    stripeCustomerId: row.stripe_customer_id ? String(row.stripe_customer_id) : null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id
      ? String(row.stripe_checkout_session_id)
      : null,
    partnerId: row.partner_id ? String(row.partner_id) : null,
    status: row.status as PartnerStripeFulfillment["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

class MemoryLedger implements PartnerStripeLedger {
  attempts: PartnerCheckoutAttempt[] = [];
  fulfillments: PartnerStripeFulfillment[] = [];

  async findOpenAttempt(email: string): Promise<PartnerCheckoutAttempt | null> {
    const normalized = normalizeEmail(email);
    return (
      this.attempts.find((item) => item.normalizedEmail === normalized && item.status === "open") ??
      null
    );
  }

  async insertOpenAttempt(input: { email: string; priceId: string }): Promise<PartnerCheckoutAttempt> {
    const normalized = normalizeEmail(input.email);
    const existing = await this.findOpenAttempt(normalized);
    if (existing) return existing;
    const now = new Date().toISOString();
    const row: PartnerCheckoutAttempt = {
      attemptId: createId("ptr_chk"),
      normalizedEmail: normalized,
      priceId: input.priceId,
      stripeCheckoutSessionId: null,
      checkoutUrl: null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.attempts.push(row);
    return row;
  }

  async attachCheckoutSession(input: {
    attemptId: string;
    sessionId: string;
    checkoutUrl: string;
  }): Promise<void> {
    const row = this.attempts.find((item) => item.attemptId === input.attemptId);
    if (!row) return;
    row.stripeCheckoutSessionId = input.sessionId;
    row.checkoutUrl = input.checkoutUrl;
    row.updatedAt = new Date().toISOString();
  }

  async completeAttempt(email: string): Promise<void> {
    const normalized = normalizeEmail(email);
    const now = new Date().toISOString();
    for (const row of this.attempts) {
      if (row.normalizedEmail === normalized && row.status === "open") {
        row.status = "completed";
        row.updatedAt = now;
      }
    }
  }

  async claimFulfillment(input: {
    stripeSubscriptionId: string;
    email: string;
    stripeCustomerId: string | null;
    stripeCheckoutSessionId: string | null;
  }): Promise<"claimed" | "resume" | "fulfilled" | "busy"> {
    const existing = this.fulfillments.find(
      (item) => item.stripeSubscriptionId === input.stripeSubscriptionId,
    );
    if (!existing) {
      const now = new Date().toISOString();
      this.fulfillments.push({
        stripeSubscriptionId: input.stripeSubscriptionId,
        normalizedEmail: normalizeEmail(input.email),
        stripeCustomerId: input.stripeCustomerId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        partnerId: null,
        status: "processing",
        createdAt: now,
        updatedAt: now,
      });
      return "claimed";
    }
    if (existing.partnerId) return "fulfilled";
    const stale = Date.now() - Date.parse(existing.updatedAt) > 120_000;
    if (!stale && existing.status === "processing") return "busy";
    existing.updatedAt = new Date().toISOString();
    existing.status = "processing";
    return "resume";
  }

  async markFulfillment(input: { stripeSubscriptionId: string; partnerId: string }): Promise<void> {
    const row = this.fulfillments.find(
      (item) => item.stripeSubscriptionId === input.stripeSubscriptionId,
    );
    if (!row) return;
    row.partnerId = input.partnerId;
    row.status = "fulfilled";
    row.updatedAt = new Date().toISOString();
  }

  async releaseUnfinishedClaim(stripeSubscriptionId: string): Promise<void> {
    this.fulfillments = this.fulfillments.filter(
      (item) => item.stripeSubscriptionId !== stripeSubscriptionId || item.partnerId,
    );
  }

  async findFulfillment(stripeSubscriptionId: string): Promise<PartnerStripeFulfillment | null> {
    return (
      this.fulfillments.find((item) => item.stripeSubscriptionId === stripeSubscriptionId) ?? null
    );
  }
}

function createD1Ledger(db: D1DatabaseLike): PartnerStripeLedger {
  return {
    async findOpenAttempt(email) {
      const row = await db
        .prepare(
          `SELECT * FROM partner_checkout_attempt WHERE normalized_email = ? AND status = 'open' LIMIT 1`,
        )
        .bind(normalizeEmail(email))
        .first<Record<string, unknown>>();
      return row ? mapAttempt(row) : null;
    },
    async insertOpenAttempt(input) {
      const existing = await this.findOpenAttempt(input.email);
      if (existing) return existing;
      const now = new Date().toISOString();
      const attemptId = createId("ptr_chk");
      try {
        await db
          .prepare(
            `INSERT INTO partner_checkout_attempt
             (attempt_id, normalized_email, price_id, status, created_at, updated_at)
             VALUES (?, ?, ?, 'open', ?, ?)`,
          )
          .bind(attemptId, normalizeEmail(input.email), input.priceId, now, now)
          .run();
      } catch {
        const raced = await this.findOpenAttempt(input.email);
        if (raced) return raced;
        throw new PartnerApplicationStoreUnavailableError("Could not reserve a checkout attempt.");
      }
      const row = await this.findOpenAttempt(input.email);
      if (!row) throw new PartnerApplicationStoreUnavailableError("Checkout attempt missing after insert.");
      return row;
    },
    async attachCheckoutSession(input) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_checkout_attempt
           SET stripe_checkout_session_id = ?, checkout_url = ?, updated_at = ?
           WHERE attempt_id = ? AND status = 'open'`,
        )
        .bind(input.sessionId, input.checkoutUrl, now, input.attemptId)
        .run();
    },
    async completeAttempt(email) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_checkout_attempt SET status = 'completed', updated_at = ?
           WHERE normalized_email = ? AND status = 'open'`,
        )
        .bind(now, normalizeEmail(email))
        .run();
    },
    async claimFulfillment(input) {
      const now = new Date().toISOString();
      try {
        await db
          .prepare(
            `INSERT INTO partner_stripe_fulfillment
             (stripe_subscription_id, normalized_email, stripe_customer_id, stripe_checkout_session_id, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'processing', ?, ?)`,
          )
          .bind(
            input.stripeSubscriptionId,
            normalizeEmail(input.email),
            input.stripeCustomerId,
            input.stripeCheckoutSessionId,
            now,
            now,
          )
          .run();
        return "claimed";
      } catch {
        const row = await this.findFulfillment(input.stripeSubscriptionId);
        if (!row) return "busy";
        if (row.partnerId) return "fulfilled";
        const stale = Date.now() - Date.parse(row.updatedAt) > 120_000;
        if (!stale) return "busy";
        await db
          .prepare(
            `UPDATE partner_stripe_fulfillment SET updated_at = ?, status = 'processing'
             WHERE stripe_subscription_id = ? AND partner_id IS NULL AND updated_at = ?`,
          )
          .bind(now, input.stripeSubscriptionId, row.updatedAt)
          .run();
        const after = await this.findFulfillment(input.stripeSubscriptionId);
        return after?.updatedAt === now ? "resume" : "busy";
      }
    },
    async markFulfillment(input) {
      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE partner_stripe_fulfillment
           SET partner_id = ?, status = 'fulfilled', updated_at = ?
           WHERE stripe_subscription_id = ?`,
        )
        .bind(input.partnerId, now, input.stripeSubscriptionId)
        .run();
    },
    async releaseUnfinishedClaim(stripeSubscriptionId) {
      await db
        .prepare(
          `DELETE FROM partner_stripe_fulfillment
           WHERE stripe_subscription_id = ? AND partner_id IS NULL`,
        )
        .bind(stripeSubscriptionId)
        .run();
    },
    async findFulfillment(stripeSubscriptionId) {
      const row = await db
        .prepare(`SELECT * FROM partner_stripe_fulfillment WHERE stripe_subscription_id = ? LIMIT 1`)
        .bind(stripeSubscriptionId)
        .first<Record<string, unknown>>();
      return row ? mapFulfillment(row) : null;
    },
  };
}

let override: PartnerStripeLedger | null = null;

export function createMemoryPartnerStripeLedger(): PartnerStripeLedger {
  return new MemoryLedger();
}

export function createPartnerStripeLedgerFromDatabase(db: D1DatabaseLike): PartnerStripeLedger {
  return createD1Ledger(db);
}

export function setPartnerStripeLedgerForTests(ledger: PartnerStripeLedger | null): void {
  override = ledger;
}

export async function getPartnerStripeLedger(): Promise<PartnerStripeLedger> {
  if (override) return override;
  if (process.env.SUHUELLA_DEV_OPENNEXT === "0") {
    if (process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production") {
      throw new PartnerApplicationStoreUnavailableError("Partner Stripe ledger is unavailable.");
    }
    override = new MemoryLedger();
    return override;
  }
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const db = (env as { LICENSE_DB?: D1DatabaseLike }).LICENSE_DB;
    if (db) return createD1Ledger(db);
  } catch {
    // local node
  }
  if (process.env.NODE_ENV === "production" || process.env.NEXTJS_ENV === "production") {
    throw new PartnerApplicationStoreUnavailableError("Partner Stripe ledger is unavailable.");
  }
  override = new MemoryLedger();
  return override;
}
