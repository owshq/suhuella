import {
  acceptOnboardingInvite,
  createOnboardingInvite,
  createPartner,
  createMemoryPartnerStore,
  getPartnerStore,
  getPartnerSummary,
  isReservedPlatformHostname,
  isPlatformPublicHostname,
  listPartners,
  normalizeHostname,
  decidePartnerHostnameGate,
  hostnameFromRequestHeaders,
  shouldBypassPartnerHostnamePath,
  partnerHostnameMayUseOptionalDcvDelegation,
  partnerHostnameUsesStandardCustomHostnameDns,
  PartnerAuthzError,
  PartnerError,
  peekOnboardingInvite,
  reactivatePartner,
  recordStripePartnerEntitlement,
  registerPartnerDomain,
  rejectClientAuthorityFields,
  rejectClientBrandId,
  requireBrandIdForHostname,
  resetPartnerStoreForTests,
  resolveBrandIdForHostname,
  resolvePartnerActorFromEmail,
  resolvePartnerActorFromSessionToken,
  resolveRequestBrandForHostname,
  toPublicRequestBrand,
  readPartnerSessionToken,
  signPartnerSession,
  revokePartner,
  suggestOpsHostname,
  suspendPartner,
  updatePartnerBranding,
  type PartnerActor,
} from "./partners/index.ts";
import { parseLicenseEdition } from "./license-context.ts";
import {
  normalizeCustomHostnameStatus,
  requireCustomHostnameEnv,
  setCustomHostnameEnvForTests,
  setCustomHostnameFetchForTests,
  CustomHostnameConfigError,
} from "./cloudflare/custom-hostnames.ts";
import {
  refreshPartnerCustomDomain,
  registerPartnerCustomDomain,
} from "./partners/custom-domains.ts";
import { isPartnerAdminCreateOrigin } from "./partners/types.ts";
import { parseOperationsAction } from "./operations/actions.ts";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectThrow(
  fn: () => Promise<unknown>,
  includes: string,
  label: string,
): Promise<void> {
  let message = "";
  try {
    await fn();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assert(message.includes(includes), `${label}: expected "${includes}", got "${message}"`);
}

async function main() {
  resetPartnerStoreForTests();

  const platform: PartnerActor = { kind: "platform", email: "admin@suhuella.com" };

  await expectThrow(
    () =>
      createPartner(platform, {
        slug: "evil",
        displayName: "Evil",
        ownerEmail: "owner@evil.test",
        origin: "stripe" as never,
        reason: "trying to mint a paid partner from Ops",
      }),
    "gift, manual, internal, or test",
    "stripe origin blocked from Ops create",
  );

  const created = await createPartner(platform, {
    slug: "acme-cloud",
    displayName: "Acme Cloud",
    ownerEmail: "owner@acme-cloud.example",
    origin: "gift",
    reason: "first partner gift entitlement",
    primaryDomain: "app.acme-cloud.example",
  });
  assert(created.summary.partner.slug === "acme-cloud", "partner slug");
  assert(created.summary.brand.brandId === "acme-cloud", "brand_id from slug");
  assert(created.onboarding.token.startsWith("onb_"), "one-time token returned once");
  assert(created.onboarding.path.includes(created.onboarding.token), "path carries token once");
  assert(
    !JSON.stringify(created.summary).includes(created.onboarding.token),
    "token is not stored on partner summary",
  );

  const listed = await listPartners(platform);
  assert(listed.length === 1, "platform lists partners");

  const outsider: PartnerActor = {
    kind: "partner",
    email: "outsider@other.test",
    partnerId: "ptr_other",
    role: "partner_admin",
  };
  await expectThrow(
    () => getPartnerSummary(outsider, created.summary.partner.partnerId),
    "another partner",
    "partner_admin cannot read another tenant",
  );

  const inviteToken = created.onboarding.token;
  await expectThrow(
    () =>
      acceptOnboardingInvite({
        token: inviteToken,
        verifiedEmail: "wrong@acme-cloud.example",
      }),
    "does not match",
    "invite email must match verified email",
  );

  const accepted = await acceptOnboardingInvite({
    token: inviteToken,
    verifiedEmail: "owner@acme-cloud.example",
  });
  assert(accepted.partner.status === "active", "accepting invite activates partner");
  assert(
    accepted.members.some((m) => m.email === "owner@acme-cloud.example" && m.status === "active"),
    "owner becomes active member",
  );

  await expectThrow(
    () =>
      acceptOnboardingInvite({
        token: inviteToken,
        verifiedEmail: "owner@acme-cloud.example",
      }),
    "already",
    "invite is single-use",
  );

  resetPartnerStoreForTests();
  const fresh = await createPartner(platform, {
    slug: "acme",
    displayName: "Acme",
    ownerEmail: "owner@acme.test",
    origin: "manual",
    reason: "manual partner for expiry test",
  });
  const { getPartnerStore } = await import("./partners/store.ts");
  const store = await getPartnerStore();
  const doc = await store.read();
  const invite = doc.invites[0];
  assert(invite, "invite exists");
  invite.expiresAt = new Date(Date.now() - 60_000).toISOString();
  await store.write(doc);
  await expectThrow(
    () =>
      acceptOnboardingInvite({
        token: fresh.onboarding.token,
        verifiedEmail: "owner@acme.test",
      }),
    "expired",
    "expired invite is rejected",
  );

  resetPartnerStoreForTests();
  const a = await createPartner(platform, {
    slug: "alpha",
    displayName: "Alpha",
    ownerEmail: "a@alpha.test",
    origin: "internal",
    reason: "isolation partner alpha",
    primaryDomain: "alpha.test",
  });
  const b = await createPartner(platform, {
    slug: "beta",
    displayName: "Beta",
    ownerEmail: "b@beta.test",
    origin: "test",
    reason: "isolation partner beta",
    primaryDomain: "beta.test",
  });
  await expectThrow(
    () =>
      registerPartnerDomain(
        { kind: "partner", email: "a@alpha.test", partnerId: a.summary.partner.partnerId, role: "partner_admin" },
        { partnerId: a.summary.partner.partnerId, hostname: "beta.test" },
      ),
    "already associated",
    "duplicate domain across partners is rejected",
  );

  const alphaActor = {
    kind: "partner" as const,
    email: "a@alpha.test",
    partnerId: a.summary.partner.partnerId,
    role: "partner_admin" as const,
  };
  const domainReg = await registerPartnerDomain(alphaActor, {
    partnerId: a.summary.partner.partnerId,
    hostname: "app.alpha.test",
    kind: "alias",
  });
  assert(domainReg.dns.cnameTarget.length > 0, "DNS CNAME target present");
  assert(domainReg.dns.notes.some((note) => note.toLowerCase().includes("nameserver")), "nameservers stay with partner");
  const activated = await refreshPartnerCustomDomain(alphaActor, {
    partnerId: a.summary.partner.partnerId,
    domainId: domainReg.domain.domainId,
  });
  assert(activated.domain.status === "active", "local refresh activates domain");
  assert(
    (await resolveBrandIdForHostname("app.alpha.test")) === a.summary.brand.brandId,
    "hostname resolves to partner brand_id",
  );
  assert((await resolveBrandIdForHostname("suhuella.com")) === "suhuella", "platform hostname");
  assert((await resolveBrandIdForHostname("unknown.example")) === null, "unknown hostname is null");
  assert(suggestOpsHostname("app.partner.example") === "ops.app.partner.example", "optional partner ops host");
  assert(
    (await resolveBrandIdForHostname("dbasenet.com")) === null,
    "no hardcoded partner catalog hostname",
  );

  await updatePartnerBranding(
    { kind: "partner", email: "a@alpha.test", partnerId: a.summary.partner.partnerId, role: "partner_admin" },
    {
      partnerId: a.summary.partner.partnerId,
      displayName: "Alpha Cloud",
      accent: "#123456",
      logoUrl: "/alpha-logo.svg",
    },
  );
  const branded = await getPartnerSummary(platform, a.summary.partner.partnerId);
  assert(branded.brand.displayName === "Alpha Cloud", "branding updates by partner_admin");
  assert(branded.brand.accent === "#123456", "accent stored");

  let brandReject = "";
  try {
    rejectClientBrandId("sneaky");
  } catch (error) {
    brandReject = error instanceof Error ? error.message : "";
  }
  assert(brandReject.includes("not trusted"), "client brand_id rejected");

  await suspendPartner(platform, a.summary.partner.partnerId, "suspend for policy review");
  const suspended = await getPartnerSummary(platform, a.summary.partner.partnerId);
  assert(suspended.partner.status === "suspended", "partner suspended");
  assert(
    suspended.domains.every((d) => d.status === "suspended" || d.status === "failed"),
    "domains suspend with partner",
  );
  assert(
    (await resolveBrandIdForHostname("app.alpha.test")) === null,
    "suspended partner hostname does not resolve",
  );

  const restored = await reactivatePartner(
    platform,
    a.summary.partner.partnerId,
    "restore after policy review",
  );
  assert(restored.partner.status === "active", "suspended partner can be reactivated");
  assert(
    (await resolveBrandIdForHostname("app.alpha.test")) === a.summary.brand.brandId,
    "reactivated verified domain resolves again",
  );

  await acceptOnboardingInvite({
    token: a.onboarding.token,
    verifiedEmail: "a@alpha.test",
  });

  await expectThrow(
    () =>
      registerPartnerDomain(
        {
          kind: "partner",
          email: "member@alpha.test",
          partnerId: a.summary.partner.partnerId,
          role: "partner_member",
        },
        { partnerId: a.summary.partner.partnerId, hostname: "member.alpha.test" },
      ),
    "Partner admin role required",
    "partner_member cannot manage domains",
  );

  await expectThrow(
    () => requireBrandIdForHostname("unknown-partner.example"),
    "Unknown hostname",
    "unknown hostname is rejected",
  );

  const memberActor = await resolvePartnerActorFromEmail("a@alpha.test", ["admin@suhuella.com"]);
  assert(
    memberActor?.kind === "partner" && memberActor.partnerId === a.summary.partner.partnerId,
    "active member resolves to tenant actor",
  );
  const platformActor = await resolvePartnerActorFromEmail("admin@suhuella.com", [
    "admin@suhuella.com",
  ]);
  assert(platformActor?.kind === "platform", "SUPERADMIN_EMAILS resolve to platform actor only");

  await revokePartner(platform, b.summary.partner.partnerId, "revoke test partner entirely");
  const revoked = await getPartnerSummary(platform, b.summary.partner.partnerId);
  assert(revoked.partner.status === "revoked", "partner revoked");
  assert(revoked.members.every((m) => m.status === "revoked"), "members revoked with partner");
  assert(revoked.domains.every((d) => d.status === "revoked"), "domains revoked with partner");

  const revokedInvitePartner = await createPartner(platform, {
    slug: "gone",
    displayName: "Gone Co",
    ownerEmail: "owner@gone.test",
    origin: "test",
    reason: "partner for revoked invite test",
  });
  await revokePartner(
    platform,
    revokedInvitePartner.summary.partner.partnerId,
    "revoke before invite accept",
  );
  const revokedPeek = await peekOnboardingInvite(revokedInvitePartner.onboarding.token);
  assert(revokedPeek.status === "revoked" || revokedPeek.status === "consumed", "revoked partner invite closed");
  await expectThrow(
    () =>
      acceptOnboardingInvite({
        token: revokedInvitePartner.onboarding.token,
        verifiedEmail: "owner@gone.test",
      }),
    "already",
    "revoked partner invite cannot be accepted",
  );

  await expectThrow(
    () =>
      registerPartnerDomain(
        { kind: "partner", email: "b@beta.test", partnerId: b.summary.partner.partnerId, role: "partner_admin" },
        { partnerId: b.summary.partner.partnerId, hostname: "new.beta.test" },
      ),
    "cannot register domains",
    "revoked partner cannot register domains",
  );

  let stripeActionBlocked = false;
  try {
    parseOperationsAction({
      action: "create_partner",
      reason: "trying paid partner from Ops form",
      slug: "paid",
      displayName: "Paid",
      ownerEmail: "paid@example.com",
      origin: "stripe",
    });
  } catch {
    stripeActionBlocked = true;
  }
  assert(stripeActionBlocked, "Ops parse blocks origin=stripe for create_partner");

  const paid = await createPartner(platform, {
    slug: "paidco",
    displayName: "Paid Co",
    ownerEmail: "bill@paid.co",
    origin: "gift",
    reason: "seed before stripe reconciliation",
  });
  const reconciled = await recordStripePartnerEntitlement(platform, {
    partnerId: paid.summary.partner.partnerId,
    stripeSubscriptionId: "sub_partner_annual",
    stripeCustomerId: "cus_partner",
    validUntil: "2027-09-21T00:00:00.000Z",
  });
  assert(reconciled.entitlement?.origin === "stripe", "stripe entitlement from reconciliation");
  assert(reconciled.partner.status === "active", "stripe reconciliation activates partner");

  const inviteAgain = await createOnboardingInvite(platform, {
    partnerId: paid.summary.partner.partnerId,
    email: "second@paid.co",
    reason: "extra admin after stripe reconcile",
  });
  assert(inviteAgain.token.startsWith("onb_"), "later invites still one-time");

  assert(normalizeHostname("HTTPS://App.Example.COM/path") === "app.example.com", "normalize strips scheme/path");
  assert(normalizeHostname("app.example.com.") === "app.example.com", "normalize strips trailing dot");
  assert(normalizeHostname("ops.suhuella.com:443") === "ops.suhuella.com", "normalize strips host port");
  assert(normalizeHostname("localhost:3000") === "localhost", "localhost normalizes for dev");
  assert(normalizeHostname("localhost") === "localhost", "bare localhost normalizes");
  assert(normalizeHostname("*.example.com") === null, "wildcard rejected");
  assert(isReservedPlatformHostname("suhuella.com"), "platform apex reserved");
  assert(isReservedPlatformHostname("ops.suhuella.com"), "platform ops reserved");
  assert(isReservedPlatformHostname("foo.workers.dev"), "workers.dev reserved");
  assert(!isReservedPlatformHostname("app.partner.example"), "partner host allowed");
  assert(isPlatformPublicHostname("ops.suhuella.com"), "ops is platform public host");
  assert(isPlatformPublicHostname("suhuella.com"), "apex is platform public host");
  assert(isPlatformPublicHostname("localhost"), "localhost is platform public host");
  assert(isPlatformPublicHostname("127.0.0.1"), "127.0.0.1 is platform public host");
  assert(isPlatformPublicHostname("[::1]:3000"), "IPv6 loopback is platform public host");
  assert(isPlatformPublicHostname("suhuella.staging.workers.dev"), "authorized workers.dev is platform");
  assert(!isPlatformPublicHostname("foo.workers.dev"), "foreign workers.dev is not platform");

  assert(
    decidePartnerHostnameGate({ hostname: "ops.suhuella.com", pathname: "/" }).action === "next",
    "ops.suhuella.com → next (no partner resolution)",
  );
  assert(
    decidePartnerHostnameGate({ hostname: "suhuella.com", pathname: "/home" }).action === "next",
    "suhuella.com → platform next",
  );
  assert(
    shouldBypassPartnerHostnamePath("/cdn-cgi/access/login") === true,
    "/cdn-cgi/access/* bypasses partner gate",
  );
  assert(
    decidePartnerHostnameGate({
      hostname: "app.partner.example",
      pathname: "/cdn-cgi/access/callback",
      status: "pending",
    }).action === "next",
    "Access paths never rewrite even on partner hosts",
  );
  assert(
    decidePartnerHostnameGate({
      hostname: "app.partner.example",
      pathname: "/",
      status: "active",
    }).action === "next",
    "active partner host serves brand",
  );
  assert(
    decidePartnerHostnameGate({
      hostname: "app.partner.example",
      pathname: "/",
      status: "pending",
    }).action === "rewrite_status",
    "pending partner host rewrites to status",
  );
  assert(
    hostnameFromRequestHeaders(new Headers({ host: "ops.suhuella.com:443" })) === "ops.suhuella.com",
    "hostnameFromRequestHeaders strips port",
  );

  // Brand isolation via hostname resolution (generic partners only).
  const brandHostPartner = await createPartner(platform, {
    slug: "brand-host",
    displayName: "Brand Host",
    ownerEmail: "owner@brand-host.example",
    origin: "test",
    reason: "hostname brand isolation",
  });
  await registerPartnerDomain(
    {
      kind: "partner",
      email: "owner@brand-host.example",
      partnerId: brandHostPartner.summary.partner.partnerId,
      role: "partner_admin",
    },
    {
      partnerId: brandHostPartner.summary.partner.partnerId,
      hostname: "app.brand-host.example",
    },
  );
  // Mark active in memory for resolution test.
  {
    const store = await getPartnerStore();
    const doc = await store.read();
    const domain = doc.domains.find((d) => d.hostname === "app.brand-host.example");
    assert(domain, "domain registered");
    domain.status = "active";
    domain.normalizedHostname = "app.brand-host.example";
    await store.write(doc);
  }
  assert(
    (await resolveBrandIdForHostname("app.brand-host.example")) ===
      brandHostPartner.summary.brand.brandId,
    "active hostname resolves brand_id",
  );
  assert(
    (await resolveBrandIdForHostname("ops.suhuella.com")) === "suhuella",
    "ops hostname never resolves to a partner brand",
  );
  assert(
    decidePartnerHostnameGate({
      hostname: "ops.suhuella.com",
      pathname: "/",
      status: "pending",
    }).action === "next",
    "ops never rewrites to domain-status even if status is pending",
  );

  // Request-time brand context (dynamic partner branding).
  {
    const platformHost = await resolveRequestBrandForHostname("suhuella.com");
    assert(platformHost.kind === "platform", "suhuella.com is platform brand");
    assert(platformHost.brandId === "suhuella", "platform brand_id is suhuella");
    assert(platformHost.displayName.length > 0, "platform has display name");
    const localhostHost = await resolveRequestBrandForHostname("localhost:3000");
    assert(localhostHost.kind === "platform", "localhost dev host is platform brand");
    assert(localhostHost.displayName === platformHost.displayName, "localhost uses SuHuella display name");
    const publicPlatform = toPublicRequestBrand(platformHost);
    assert(!JSON.stringify(publicPlatform).includes("cloudflare"), "public brand has no CF ids");
    assert(!("partnerId" in publicPlatform), "public brand omits partnerId");

    const alpha = await createPartner(platform, {
      slug: "brand-alpha",
      displayName: "Brand Alpha",
      ownerEmail: "owner@brand-alpha.example",
      origin: "test",
      reason: "request brand isolation A",
    });
    const beta = await createPartner(platform, {
      slug: "brand-beta",
      displayName: "Brand Beta",
      ownerEmail: "owner@brand-beta.example",
      origin: "test",
      reason: "request brand isolation B",
    });
    const alphaActor = {
      kind: "partner" as const,
      email: "owner@brand-alpha.example",
      partnerId: alpha.summary.partner.partnerId,
      role: "partner_admin" as const,
    };
    const betaActor = {
      kind: "partner" as const,
      email: "owner@brand-beta.example",
      partnerId: beta.summary.partner.partnerId,
      role: "partner_admin" as const,
    };
    await updatePartnerBranding(alphaActor, {
      partnerId: alpha.summary.partner.partnerId,
      logoUrl: "https://cdn.example/alpha-logo.svg",
      accent: "#111111",
    });
    await updatePartnerBranding(betaActor, {
      partnerId: beta.summary.partner.partnerId,
      logoUrl: "https://cdn.example/beta-logo.svg",
      accent: "#222222",
    });
    await registerPartnerDomain(alphaActor, {
      partnerId: alpha.summary.partner.partnerId,
      hostname: "app.brand-alpha.example",
    });
    await registerPartnerDomain(betaActor, {
      partnerId: beta.summary.partner.partnerId,
      hostname: "app.brand-beta.example",
    });
    {
      const store = await getPartnerStore();
      const doc = await store.read();
      for (const host of ["app.brand-alpha.example", "app.brand-beta.example"]) {
        const domain = doc.domains.find((d) => d.hostname === host);
        assert(domain, `domain ${host}`);
        domain.status = "active";
        domain.normalizedHostname = host;
      }
      for (const partner of doc.partners) {
        if (partner.slug === "brand-alpha" || partner.slug === "brand-beta") {
          partner.status = "active";
        }
      }
      await store.write(doc);
    }

    const alphaBrand = await resolveRequestBrandForHostname("app.brand-alpha.example");
    const betaBrand = await resolveRequestBrandForHostname("app.brand-beta.example");
    assert(alphaBrand.kind === "partner", "active alpha hostname is partner brand");
    assert(betaBrand.kind === "partner", "active beta hostname is partner brand");
    assert(alphaBrand.brandId === "brand-alpha", "alpha brand_id");
    assert(betaBrand.brandId === "brand-beta", "beta brand_id");
    assert(alphaBrand.logoUrl !== betaBrand.logoUrl, "partners do not share logo");
    assert(alphaBrand.accent !== betaBrand.accent, "partners do not share accent");
    assert(alphaBrand.displayName === "Brand Alpha", "alpha display name");
    assert(betaBrand.displayName === "Brand Beta", "beta display name");

    {
      const store = await getPartnerStore();
      const doc = await store.read();
      const domain = doc.domains.find((d) => d.hostname === "app.brand-alpha.example");
      assert(domain, "alpha domain");
      domain.status = "pending";
      await store.write(doc);
    }
    const pendingBrand = await resolveRequestBrandForHostname("app.brand-alpha.example");
    assert(pendingBrand.kind === "status", "pending hostname is status, not partner app brand");
    assert(pendingBrand.brandId === null, "pending does not expose brand_id for app serving");
    assert(pendingBrand.logoUrl === null, "pending does not serve partner logo");

    const unknown = await resolveRequestBrandForHostname("unknown-no-partner.example");
    assert(unknown.kind === "unknown", "unknown hostname has no brand");
    assert(unknown.brandId === null, "unknown does not leak brand_id");
    assert(unknown.logoUrl === null, "unknown does not leak logo");

    const opsBrand = await resolveRequestBrandForHostname("ops.suhuella.com");
    assert(opsBrand.kind === "platform", "Operations host stays platform brand");
    assert(opsBrand.brandId === "suhuella", "Operations never inherits partner brand_id");
  }

  assert(normalizeCustomHostnameStatus({ ownership: "active", ssl: "active" }) === "active", "cf active");
  assert(normalizeCustomHostnameStatus({ ownership: "pending", ssl: "pending_validation" }) === "pending", "cf pending");

  let missingSecrets = false;
  try {
    requireCustomHostnameEnv({});
  } catch (error) {
    missingSecrets = error instanceof CustomHostnameConfigError;
  }
  assert(missingSecrets, "missing Cloudflare secrets fail closed");

  setCustomHostnameEnvForTests({
    CLOUDFLARE_API_TOKEN: "test-token",
    CLOUDFLARE_ACCOUNT_ID: "acct_test",
    CLOUDFLARE_SAAS_ZONE_ID: "zone_test",
    CLOUDFLARE_SAAS_CNAME_TARGET: "customers.example-fallback.net",
  });
  let createCalls = 0;
  setCustomHostnameFetchForTests(async (input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && url.includes("/custom_hostnames")) {
      createCalls += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as { hostname?: string };
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "ch_1",
            hostname: body.hostname,
            status: "pending",
            ssl: { status: "pending_validation" },
          },
        }),
        { status: 200 },
      );
    }
    if (method === "GET") {
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "ch_1",
            hostname: "app.gamma.example",
            status: "active",
            ssl: { status: "active" },
          },
        }),
        { status: 200 },
      );
    }
    if (method === "DELETE") {
      return new Response(JSON.stringify({ success: true, result: { id: "ch_1" } }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: false, errors: [{ message: "unexpected" }] }), {
      status: 500,
    });
  });

  const gamma = await createPartner(platform, {
    slug: "gamma",
    displayName: "Gamma",
    ownerEmail: "owner@gamma.example",
    origin: "test",
    reason: "custom hostname mock partner",
  });
  const gammaActor = {
    kind: "partner" as const,
    email: "owner@gamma.example",
    partnerId: gamma.summary.partner.partnerId,
    role: "partner_admin" as const,
  };
  const registered = await registerPartnerCustomDomain(gammaActor, {
    partnerId: gamma.summary.partner.partnerId,
    hostname: "app.gamma.example",
  });
  assert(registered.domain.status === "pending", "cf create starts pending");
  assert(registered.domain.dnsTarget === "customers.example-fallback.net", "cname target from env");
  assert(registered.steps.length >= 3, "partner sees DNS activation steps");
  assert(!JSON.stringify(registered).includes("test-token"), "token never returned");
  const again = await registerPartnerCustomDomain(gammaActor, {
    partnerId: gamma.summary.partner.partnerId,
    hostname: "app.gamma.example",
  });
  assert(again.domain.domainId === registered.domain.domainId, "domain register is idempotent");
  assert(createCalls === 1, "Cloudflare create called once for idempotent register");

  await expectThrow(
    () =>
      registerPartnerCustomDomain(platform, {
        partnerId: gamma.summary.partner.partnerId,
        hostname: "suhuella.com",
      }),
    "Partners configure brand, hostname, and DNS",
    "platform actor cannot register partner hostname",
  );

  await expectThrow(
    () =>
      registerPartnerCustomDomain(gammaActor, {
        partnerId: gamma.summary.partner.partnerId,
        hostname: "suhuella.com",
      }),
    "reserved",
    "reserved platform hostname rejected",
  );

  setCustomHostnameEnvForTests(null);
  setCustomHostnameFetchForTests(null);

  // Partner self-service session (onboarding → brand → hostname).
  {
    const previousSecret = process.env.PARTNER_SESSION_SECRET;
    process.env.PARTNER_SESSION_SECRET = "partner-self-service-check-secret";

    assert(
      rejectClientAuthorityFields({ partnerId: "ptr_x" }) === "invalid_request",
      "client partner_id rejected",
    );
    assert(
      rejectClientAuthorityFields({ dnsTarget: "evil.example" }) === "invalid_request",
      "client dns target rejected",
    );
    assert(rejectClientAuthorityFields({ hostname: "app.ok.example" }) === null, "hostname allowed");

    const self = await createPartner(platform, {
      slug: "self-serve",
      displayName: "Self Serve Co",
      ownerEmail: "admin@self-serve.example",
      origin: "gift",
      reason: "self-service onboarding partner",
    });
    const accepted = await acceptOnboardingInvite({
      token: self.onboarding.token,
      verifiedEmail: "admin@self-serve.example",
    });
    assert(accepted.partner.status === "active", "onboarding accept activates partner");
    const member = accepted.members.find((item) => item.email === "admin@self-serve.example");
    assert(member?.role === "partner_admin", "owner becomes partner_admin");
    assert(member?.status === "active", "member active after accept");

    const sessionToken = await signPartnerSession({
      email: "admin@self-serve.example",
      partnerId: accepted.partner.partnerId,
      role: "partner_admin",
    });
    const sessionPayload = await readPartnerSessionToken(sessionToken);
    assert(sessionPayload?.partnerId === accepted.partner.partnerId, "session carries partner");
    assert(sessionToken.includes("."), "session token is signed");
    assert(!sessionToken.includes("test-token"), "session has no API secrets");
    const sessionActor = await resolvePartnerActorFromSessionToken(sessionToken);
    assert(sessionActor?.kind === "partner", "session resolves partner actor");
    assert(sessionActor?.role === "partner_admin", "session role is partner_admin");

    await updatePartnerBranding(sessionActor!, {
      partnerId: accepted.partner.partnerId,
      displayName: "Self Serve Brand",
      accent: "#ABCDEF",
      logoUrl: "https://cdn.example/self-serve.svg",
    });
    const branded = await getPartnerSummary(sessionActor!, accepted.partner.partnerId);
    assert(branded.brand.displayName === "Self Serve Brand", "partner_admin updates own brand");
    assert(branded.brand.brandId === "self-serve", "brand_id stays server-derived");

    await expectThrow(
      () =>
        updatePartnerBranding(
          {
            kind: "partner",
            email: "member@self-serve.example",
            partnerId: accepted.partner.partnerId,
            role: "partner_member",
          },
          { partnerId: accepted.partner.partnerId, displayName: "Nope" },
        ),
      "Partner admin role required",
      "partner_member cannot edit branding",
    );

    setCustomHostnameEnvForTests({ CLOUDFLARE_SAAS_CNAME_TARGET: "" });
    delete process.env.CLOUDFLARE_SAAS_CNAME_TARGET;
    const localSim = await registerPartnerCustomDomain(sessionActor!, {
      partnerId: accepted.partner.partnerId,
      hostname: "app.dbasenet.test",
    });
    assert(localSim.localDevMode === true, "local dev sim mode flagged");
    assert(localSim.domain.status === "pending", "local sim saves pending hostname");
    assert(
      localSim.instructions.some((row) => row.type === "CNAME"),
      "local sim shows CNAME record",
    );
    assert(
      localSim.instructions.some((row) => row.type === "TXT"),
      "local sim shows fixture TXT records",
    );
    const { refreshPartnerCustomDomain } = await import("./partners/custom-domains.ts");
    const activated = await refreshPartnerCustomDomain(sessionActor!, {
      partnerId: accepted.partner.partnerId,
      domainId: localSim.domain.domainId,
    });
    assert(activated.domain.status === "active", "local refresh activates without Cloudflare");

    setCustomHostnameEnvForTests({
      CLOUDFLARE_API_TOKEN: "test-token",
      CLOUDFLARE_ACCOUNT_ID: "acct_test",
      CLOUDFLARE_SAAS_ZONE_ID: "zone_test",
      CLOUDFLARE_SAAS_CNAME_TARGET: "customers.example-fallback.net",
    });
    let pendingThenActive = false;
    setCustomHostnameFetchForTests(async (input, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}")) as { hostname?: string };
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "ch_self",
              hostname: body.hostname,
              status: "pending",
              ssl: {
                status: "pending_validation",
                validation_records: [
                  { txt_name: "_cf-challenge.app.partner-domain.com", txt_value: "cf-txt-value" },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      if (method === "GET") {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "ch_self",
              hostname: "app.partner-domain.com",
              status: pendingThenActive ? "active" : "pending",
              ssl: {
                status: pendingThenActive ? "active" : "pending_validation",
                validation_records: pendingThenActive
                  ? []
                  : [{ txt_name: "_cf-challenge.app.partner-domain.com", txt_value: "cf-txt-value" }],
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: false }), { status: 500 });
    });

    const registered = await registerPartnerCustomDomain(sessionActor!, {
      partnerId: accepted.partner.partnerId,
      hostname: "app.partner-domain.com",
    });
    assert(registered.domain.status === "pending", "self-service hostname starts pending");
    assert(
      registered.instructions.some((row) => row.type === "CNAME"),
      "pending hostname shows CNAME instruction",
    );
    assert(
      registered.instructions.some((row) => row.type === "TXT"),
      "pending hostname shows TXT instruction",
    );
    assert(
      !JSON.stringify(registered).includes("test-token"),
      "self-service domain view has no API token",
    );
    assert(
      !JSON.stringify(registered).toLowerCase().includes("cloudflare_api"),
      "self-service domain view has no secret names",
    );

    pendingThenActive = true;
    const refreshed = await refreshPartnerCustomDomain(sessionActor!, {
      partnerId: accepted.partner.partnerId,
      domainId: registered.domain.domainId,
    });
    assert(refreshed.domain.status === "active", "refresh promotes domain to active");
    const activeBrand = await resolveRequestBrandForHostname("app.partner-domain.com");
    assert(activeBrand.kind === "partner", "active self-service host serves partner brand");
    assert(activeBrand.brandId === "self-serve", "active host brand_id isolated");
    assert(activeBrand.displayName === "Self Serve Brand", "active host display name");

    const unknown = await resolveRequestBrandForHostname("unknown-self-service.example");
    assert(unknown.kind === "unknown", "unknown hostname still has no brand");

    const opsBrand = await resolveRequestBrandForHostname("ops.suhuella.com");
    assert(opsBrand.kind === "platform", "Operations never inherits partner branding");

    await suspendPartner(platform, accepted.partner.partnerId, "suspend self-service partner");
    assert(
      (await resolvePartnerActorFromSessionToken(sessionToken)) === null,
      "suspended partner session is rejected",
    );
    assert(
      (await resolveRequestBrandForHostname("app.partner-domain.com")).kind !== "partner",
      "suspend blocks partner content",
    );

    setCustomHostnameEnvForTests(null);
    setCustomHostnameFetchForTests(null);
    if (previousSecret === undefined) delete process.env.PARTNER_SESSION_SECRET;
    else process.env.PARTNER_SESSION_SECRET = previousSecret;
  }

  const migration8 = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../migrations/0008_partner_domain.sql"),
    "utf8",
  );
  assert(migration8.includes("normalized_hostname"), "0008 adds normalized_hostname");
  assert(migration8.includes("cloudflare_custom_hostname_id"), "0008 adds CF id");
  assert(!/dbasenet/i.test(migration8), "migration has no partner-specific names");

  const middleware = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../middleware.ts"),
    "utf8",
  );
  assert(middleware.includes("NextResponse.rewrite"), "partner hosts rewrite without redirect");
  assert(!middleware.includes("suhuella.com/home"), "no forced redirect to suhuella.com");
  assert(!middleware.includes('"/api/partners/domain-lookup"'), "no same-origin Access-prone fetch");
  assert(
    middleware.includes('"/api/internal/partner-domain-state"'),
    "middleware uses internal partner-domain-state lookup",
  );
  assert(
    middleware.includes('"x-suhuella-middleware": "1"'),
    "middleware internal fetch carries auth header",
  );
  assert(middleware.includes("shouldBypassPartnerHostnamePath"), "Access/cdn-cgi bypass wired");
  assert(middleware.includes("isPlatformPublicHostname"), "platform host short-circuit wired");
  assert(middleware.includes("decideOpsHostGate"), "ops host gate prevents /ops bounce loop");
  assert(!middleware.includes('redirect("/ops")'), "middleware does not emit relative /ops redirect");

  const wrangler = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../wrangler.jsonc"),
    "utf8",
  );
  assert(wrangler.includes('"PAID_CHECKOUT_ENABLED": "true"'), "personal checkout is on");
  assert(wrangler.includes('"PARTNER_CHECKOUT_ENABLED": "false"'), "partner checkout stays off");
  assert(isPartnerAdminCreateOrigin("gift") === true, "gift is an admin create origin");
  assert(isPartnerAdminCreateOrigin("stripe") === false, "stripe is not an admin create origin");
  assert(PartnerError.name === "PartnerError", "PartnerError exports");
  assert(PartnerAuthzError.name === "PartnerAuthzError", "PartnerAuthzError exports");
  assert((await getPartnerStore()).kind === "memory", "tests use memory partner store");
  assert(createMemoryPartnerStore().kind === "memory", "explicit memory store for tests");

  const domainsDoc = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../PARTNER-CUSTOM-DOMAINS-001.md"),
    "utf8",
  );
  assert(
    domainsDoc.includes("There is **no** `license_grant.edition = partner`"),
    "docs reject partner as license edition",
  );
  assert(domainsDoc.includes("personal_lifetime"), "docs list personal editions");
  assert(domainsDoc.includes("business"), "docs list business edition");
  assert(domainsDoc.includes("DCV Delegation"), "docs cover optional DCV Delegation");
  assert(
    domainsDoc.includes("not** required for ordinary partner subdomains"),
    "docs state DCV is optional for normal subdomains",
  );
  assert(!/fca590/i.test(domainsDoc), "docs never hardcode a DCV zone hash");
  assert(
    partnerHostnameUsesStandardCustomHostnameDns("app.partner-domain.com"),
    "app.partner-domain.com uses standard Custom Hostname DNS only",
  );
  assert(
    !partnerHostnameMayUseOptionalDcvDelegation("app.partner-domain.com"),
    "app.partner-domain.com does not need DCV Delegation",
  );
  assert(
    partnerHostnameMayUseOptionalDcvDelegation("partner-domain.com"),
    "apex may optionally use DCV Delegation later",
  );
  assert(parseLicenseEdition("partner") === null, "partner is not a license_grant edition");
  assert(parseLicenseEdition("full") === null, "full is not a license_grant edition");
  assert(parseLicenseEdition("business") === "business", "business remains a valid edition");

  const roleInvite = await createPartner(platform, {
    slug: "roles-co",
    displayName: "Roles Co",
    ownerEmail: "owner@roles-co.example",
    origin: "gift",
    reason: "role invite coverage partner",
    validUntil: null,
  });
  assert(
    roleInvite.summary.entitlement?.origin === "gift",
    "gift partner entitlement is not a license edition",
  );
  assert(roleInvite.summary.entitlement?.validUntil === null, "indefinite gift has no valid_until");
  const memberInvite = await createOnboardingInvite(platform, {
    partnerId: roleInvite.summary.partner.partnerId,
    email: "member@roles-co.example",
    role: "partner_member",
    reason: "invite read-only member",
  });
  assert(memberInvite.email === "member@roles-co.example", "member invite email");
  const memberPeek = await peekOnboardingInvite(memberInvite.token);
  assert(memberPeek.role === "partner_member", "invite preserves partner_member role");

  // PARTNER-DOMAIN-ONBOARDING-COPY-003 — UI/docs must not present app. as mandatory.
  {
    const setupSource = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "../components/PartnerSetupClient.tsx"),
      "utf8",
    );
    const onboardingSource = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../components/PartnerOnboardingClient.tsx",
      ),
      "utf8",
    );
    const opsSource = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../components/operations/OperationsConsole.tsx",
      ),
      "utf8",
    );
    const copyModule = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "./partners/domain-onboarding-copy.ts"),
      "utf8",
    );

    assert(!setupSource.includes('useState("app.")'), "setup form has no app. default value");
    assert(!setupSource.includes("app.your-domain.com"), "setup does not mandate app.your-domain.com");
    assert(!setupSource.includes("prefer app"), "setup does not say prefer app");
    assert(setupSource.includes("domain-onboarding-copy"), "setup uses shared copy module");
    assert(setupSource.includes("PARTNER_DOMAIN_HOSTNAME_PLACEHOLDER"), "setup uses example placeholder constant");
    assert(setupSource.includes("saveNotActive"), "setup explains save ≠ active via copy module");

    assert(!onboardingSource.includes("app.your-domain.com"), "onboarding does not mandate app.");
    assert(onboardingSource.includes("domain-onboarding-copy"), "onboarding uses shared copy module");

    assert(!opsSource.includes("app.your-domain.com"), "ops UI does not default to app.your-domain");
    assert(
      opsSource.includes("Ops does not register hostnames"),
      "ops console defers hostname registration to partner portal",
    );
    assert(
      opsSource.includes("Partner configures hostname in /partners/portal"),
      "ops shows partner self-service hostname path",
    );

    assert(copyModule.includes("documents.example.com"), "copy module EN example");
    assert(copyModule.includes("documentos.example.com"), "copy module ES example");
    assert(!copyModule.includes("cloud.tu-dominio"), "copy avoids cloud.tu-dominio phrasing");
    assert(
      copyModule.includes("The prefix is not fixed"),
      "copy states subdomain prefix is free",
    );
    assert(
      domainsDoc.includes("The subdomain label is **not fixed**"),
      "docs state subdomain prefix is free",
    );
    assert(!domainsDoc.includes("app.partner-domain.com"), "docs no longer mandate app.partner-domain");
  }

  {
    const { partnerProgramCopy, resolvePartnerPublicPrice } = await import(
      "./partners/program-copy.ts"
    );
    const { isPartnerCheckoutEnvEnabled } = await import("./paid-checkout.ts");
    const { isPartnerCheckoutPubliclyEnabled, resolvePartnerProgramJourney } = await import(
      "./partners/program-journey.ts"
    );
    const programPage = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../app/(suhuella)/partners/page.tsx",
      ),
      "utf8",
    );
    const applyRoute = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../app/api/partners/apply/route.ts",
      ),
      "utf8",
    );

    assert(programPage.includes("PartnerProgramPageContent"), "public /partners program page exists");
    assert(programPage.includes("isPlatformPublicHostname"), "/partners is platform-host only");
    assert(!programPage.includes("domain-onboarding-copy"), "/partners has no DNS onboarding copy");

    const esPrice = await resolvePartnerPublicPrice("es");
    const esCopy = partnerProgramCopy("es", esPrice);
    assert(esCopy.metaTitle.includes("Hazte partner"), "ES public meta title");
    assert(esCopy.heroTitle.includes("marca"), "ES public hero focuses on brand");
    assert(esCopy.applicationReceived.includes("Solicitud recibida"), "post-submit copy");
    assert(esCopy.steps.some((step) => step.id === "checkout"), "journey includes Stripe checkout step");
    const publicSurface = [
      esCopy.heroBody,
      esCopy.priceNote,
      esCopy.priceCtaHint,
      esCopy.paidClosedNotice,
      esCopy.paidReadyNotice,
      esCopy.emailVerifiedClosedCheckout,
      ...esCopy.steps.map((step) => step.body),
      ...esCopy.requirements,
    ].join("\n");
    assert(!/gift|concesión|Operations/i.test(publicSurface), "public copy never mentions internal grants");
    assert(esCopy.checkoutButton.includes("Stripe"), "public checkout CTA names Stripe");
    assert(esPrice.taxNote.length > 0, "price includes tax disclaimer");
    assert(isPartnerCheckoutEnvEnabled({ PARTNER_CHECKOUT_ENABLED: "false" }) === false, "partner env off");
    assert(isPartnerCheckoutPubliclyEnabled({ PAID_CHECKOUT_ENABLED: "false" }) === false, "partner checkout off");
    assert(
      isPartnerCheckoutPubliclyEnabled({
        PAID_CHECKOUT_ENABLED: "true",
        PARTNER_CHECKOUT_ENABLED: "false",
      }) === false,
      "paid on without partner flag keeps partner checkout closed",
    );

    const journey = await resolvePartnerProgramJourney("new-applicant@example.com");
    assert(journey.step === "entitlement", "new email starts at entitlement");
    assert(journey.entitlement.checkoutAvailable === false, "checkout not available for new applicant");

    assert(applyRoute.includes("PARTNER_APPLICATION"), "apply API uses public application purpose");
    assert(applyRoute.includes("submit_interest"), "apply API records interest when checkout closed");
    assert(applyRoute.includes("resolvePartnerProgramJourney"), "apply API resolves journey");
  }

  {
    const hostnameStatusPage = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../app/(suhuella)/hostname-status/page.tsx",
      ),
      "utf8",
    );
    const { unconfiguredHostnameCopy } = await import("./partners/unconfigured-hostname-copy.ts");
    assert(hostnameStatusPage.includes("UnconfiguredHostnameScreen"), "hostname-status uses public screen");
    assert(hostnameStatusPage.includes("notFound()"), "hostname-status is blocked on platform hosts");
    assert(!hostnameStatusPage.includes("searchParams"), "hostname-status has no ?state= preview URL");
    assert(!hostnameStatusPage.includes("domain-onboarding-copy"), "hostname-status has no DNS onboarding copy");
    const publicPending = unconfiguredHostnameCopy({
      kind: "status",
      domainStatus: "pending",
      locale: "en",
    });
    assert(!publicPending.body.toLowerCase().includes("dns"), "public pending copy has no DNS");
    assert(!publicPending.body.toLowerCase().includes("cname"), "public pending copy has no CNAME");
  }

  console.log("PARTNER-MULTI-TENANT-001 / CUSTOM-DOMAINS check passed");
}

void main();
