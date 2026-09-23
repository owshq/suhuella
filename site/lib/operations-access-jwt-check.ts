import { readFileSync } from "node:fs";
import { stripeLiveFixtureSecret } from "./test/stripe-fixture-secret.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactAuditValue } from "./operations/audit-redact.ts";
import {
  parseAccessAudience,
  parseAccessTeamDomain,
  parseSuperadminEmails,
} from "./operations/access-config.ts";
import { setAccessCertsForTests } from "./operations/access-jwt.ts";
import { authenticateOperations } from "./operations/auth.ts";
import { parseOperationsAction } from "./operations/actions.ts";
import { isLocalhostHost, isWorkersDevHost } from "./operations/host.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const TEAM = "suhuella.cloudflareaccess.com";
const AUD = "0123456789abcdef0123456789abcdef";
const ADMIN = "admin@suhuella.com";

function b64url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function b64urlJson(value: unknown): string {
  return b64url(new TextEncoder().encode(JSON.stringify(value)));
}

async function signJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  kid = "ops-test-key",
): Promise<string> {
  const header = b64urlJson({ alg: "RS256", kid, typ: "JWT" });
  const body = b64urlJson(payload);
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privateKey,
      new TextEncoder().encode(`${header}.${body}`),
    ),
  );
  return `${header}.${body}.${b64url(signature)}`;
}

function claims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    email: ADMIN,
    iss: `https://${TEAM}`,
    aud: AUD,
    exp: now + 300,
    nbf: now - 10,
    ...overrides,
  };
}

const previousEnv = {
  NODE_ENV: process.env.NODE_ENV,
  SUPERADMIN_EMAILS: process.env.SUPERADMIN_EMAILS,
  CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN,
  CF_ACCESS_AUD: process.env.CF_ACCESS_AUD,
};

function configureProduction() {
  process.env.NODE_ENV = "production";
  process.env.SUPERADMIN_EMAILS = ADMIN;
  process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;
  process.env.CF_ACCESS_AUD = AUD;
}

function restoreEnv() {
  process.env.NODE_ENV = previousEnv.NODE_ENV;
  if (previousEnv.SUPERADMIN_EMAILS === undefined) delete process.env.SUPERADMIN_EMAILS;
  else process.env.SUPERADMIN_EMAILS = previousEnv.SUPERADMIN_EMAILS;
  if (previousEnv.CF_ACCESS_TEAM_DOMAIN === undefined) delete process.env.CF_ACCESS_TEAM_DOMAIN;
  else process.env.CF_ACCESS_TEAM_DOMAIN = previousEnv.CF_ACCESS_TEAM_DOMAIN;
  if (previousEnv.CF_ACCESS_AUD === undefined) delete process.env.CF_ACCESS_AUD;
  else process.env.CF_ACCESS_AUD = previousEnv.CF_ACCESS_AUD;
  setAccessCertsForTests(null);
}

async function main() {
  assert(parseSuperadminEmails(" Admin@SuHuella.com, ops@suhuella.com ")?.join(",") === "admin@suhuella.com,ops@suhuella.com", "allowlist is comma-separated emails");
  assert(parseSuperadminEmails("not-an-email") === null, "invalid allowlist entry fails closed");
  assert(parseAccessTeamDomain(TEAM) === TEAM, "team domain is a cloudflareaccess hostname");
  assert(parseAccessTeamDomain(`https://${TEAM}`) === null, "team domain rejects a URL");
  assert(parseAccessAudience(AUD) === AUD, "audience is the raw AUD tag");
  assert(parseAccessAudience("short") === null, "audience rejects a short value");

  assert(isWorkersDevHost("suhuella.example.workers.dev"), "workers.dev is recognized");
  assert(!isLocalhostHost("suhuella.example.workers.dev"), "workers.dev is not localhost");
  assert(!isWorkersDevHost("ops.suhuella.com"), "ops hostname is not workers.dev");

  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  setAccessCertsForTests([{ ...publicJwk, kid: "ops-test-key", alg: "RS256", use: "sig" }]);
  configureProduction();

  try {
    const headersFor = (host: string, token?: string) =>
      new Headers({
        host,
        ...(token ? { "cf-access-jwt-assertion": token } : {}),
      });

    const allowed = await authenticateOperations(
      headersFor("ops.suhuella.com", await signJwt(pair.privateKey, claims())),
    );
    assert(allowed.ok && allowed.actor.email === ADMIN, "allowlisted Access identity opens Ops");

    const stranger = await authenticateOperations(
      headersFor(
        "ops.suhuella.com",
        await signJwt(pair.privateKey, claims({ email: "stranger@example.com" })),
      ),
    );
    assert(!stranger.ok && stranger.status === 403, "valid JWT outside the allowlist is forbidden");

    const forged = await signJwt(pair.privateKey, claims());
    const [h, p, s] = forged.split(".");
    const broken = await authenticateOperations(
      headersFor("ops.suhuella.com", `${h}.${p}.${s.slice(0, -4)}aaaa`),
    );
    assert(!broken.ok && broken.status === 401, "forged JWT is rejected");

    const wrongAud = await authenticateOperations(
      headersFor(
        "ops.suhuella.com",
        await signJwt(pair.privateKey, claims({ aud: "fedcba9876543210fedcba9876543210" })),
      ),
    );
    assert(!wrongAud.ok && wrongAud.status === 401, "wrong audience is rejected");

    const wrongIss = await authenticateOperations(
      headersFor(
        "ops.suhuella.com",
        await signJwt(pair.privateKey, claims({ iss: "https://other.cloudflareaccess.com" })),
      ),
    );
    assert(!wrongIss.ok && wrongIss.status === 401, "wrong issuer is rejected");

    const workersDev = await authenticateOperations(headersFor("suhuella.example.workers.dev"));
    assert(!workersDev.ok && workersDev.status === 401, "workers.dev without Access is rejected");

    const workersDevAllowed = await authenticateOperations(
      headersFor("suhuella.example.workers.dev", await signJwt(pair.privateKey, claims())),
    );
    assert(
      workersDevAllowed.ok && workersDevAllowed.actor.email === ADMIN,
      "workers.dev uses the same Access allowlist",
    );

    delete process.env.CF_ACCESS_AUD;
    const missing = await authenticateOperations(headersFor("ops.suhuella.com"));
    assert(!missing.ok && missing.status === 503 && !missing.config, "missing production config is a generic 503");
    process.env.CF_ACCESS_AUD = AUD;
  } finally {
    restoreEnv();
  }

  for (const origin of ["gift", "promo", "manual", "internal", "test"] as const) {
    const action = parseOperationsAction({
      action: "create_license",
      reason: "support issued a complimentary license",
      email: "gift@suhuella.com",
      edition: "personal_lifetime",
      origin,
    });
    assert(action.action === "create_license" && action.origin === origin, `${origin} remains creatable`);
  }
  let stripeBlocked = false;
  try {
    parseOperationsAction({
      action: "create_license",
      reason: "support issued a complimentary license",
      email: "paid@suhuella.com",
      edition: "personal_lifetime",
      origin: "stripe",
    });
  } catch {
    stripeBlocked = true;
  }
  assert(stripeBlocked, "Ops cannot create a Stripe-origin license");

  const redacted = redactAuditValue({
    email: ADMIN,
    stripeSecret: stripeLiveFixtureSecret("OpsNotRealSecret01"),
    accessJwt: "eyJhbGciOiJub25lIn0.payload.sig",
    licenseId: "lic_1",
  });
  assert(redacted?.email === ADMIN && redacted.licenseId === "lic_1", "audit keeps operational fields");
  assert(!("stripeSecret" in (redacted ?? {})), "audit drops secret fields");
  assert(!("accessJwt" in (redacted ?? {})), "audit drops JWT values");

  const adminRoute = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/api/admin/business/route.ts"),
    "utf8",
  );
  assert(adminRoute.includes("requireOperationsActor"), "admin Business API uses Operations auth");
  assert(!adminRoute.includes("actorFromRequest"), "admin Business API does not trust a raw email header");

  const wrangler = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../wrangler.jsonc"),
    "utf8",
  );
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "false"'), "personal checkout stays off");

  console.log("OPERATIONS access JWT check passed");
}

void main();
