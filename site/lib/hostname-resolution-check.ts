import { brand } from "@suhuella/brand";
import { requestHost } from "./operations/host.ts";
import {
  createMemoryPartnerStore,
  createPartner,
  getPartnerStore,
  hostnameFromRequestHeaders,
  isAuthorizedWorkersDevHostname,
  isDevelopmentLoopbackHostname,
  isPartnerRegisterableHostname,
  isPlatformPublicHostname,
  isReservedPlatformHostname,
  isWorkersDevHostname,
  normalizeHostname,
  resetPartnerStoreForTests,
  resolveRequestBrandForHostname,
  seedPartnerDomainForTests,
  type PartnerActor,
} from "./partners/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function seedActivePartner(input: {
  slug: string;
  displayName: string;
  hostname: string;
  accent: string;
}) {
  const platform: PartnerActor = { kind: "platform", email: "admin@suhuella.com" };
  const created = await createPartner(platform, {
    slug: input.slug,
    displayName: input.displayName,
    ownerEmail: `owner@${input.slug}.example`,
    origin: "test",
    reason: "hostname-resolution-check",
  });
  await seedPartnerDomainForTests({
    partnerId: created.summary.partner.partnerId,
    brandId: created.summary.brand.brandId,
    hostname: input.hostname,
    accent: input.accent,
    displayName: input.displayName,
  });
  return created;
}

async function runHostnameResolutionCheck(): Promise<void> {
  // --- Normalization ---
  assert(normalizeHostname("HTTPS://SuHuella.COM/home") === "suhuella.com", "scheme + case");
  assert(normalizeHostname("www.suhuella.com.") === "www.suhuella.com", "trailing dot");
  assert(normalizeHostname("localhost:3000") === "localhost", "localhost + port");
  assert(normalizeHostname("127.0.0.1:8787") === "127.0.0.1", "127.0.0.1 + port");
  assert(normalizeHostname("[::1]:3000") === "::1", "IPv6 loopback + port");
  assert(normalizeHostname("") === null, "empty");
  assert(normalizeHostname("   ") === null, "whitespace");
  assert(normalizeHostname("*.evil.com") === null, "wildcard");
  assert(normalizeHostname("not a host") === null, "spaces");
  assert(normalizeHostname("192.168.1.10") === "192.168.1.10", "private IP normalizes but is not platform");

  assert(isDevelopmentLoopbackHostname("localhost"), "localhost is dev loopback");
  assert(isDevelopmentLoopbackHostname("::1"), "::1 is dev loopback");
  assert(!isDevelopmentLoopbackHostname("suhuella.com"), "production is not loopback");

  // --- Platform classification ---
  assert(isPlatformPublicHostname("suhuella.com"), "apex platform");
  assert(isPlatformPublicHostname("www.suhuella.com"), "www platform");
  assert(isPlatformPublicHostname("ops.suhuella.com"), "ops platform");
  assert(isPlatformPublicHostname("localhost"), "localhost platform dev");
  assert(isPlatformPublicHostname("127.0.0.1"), "127.0.0.1 platform dev");
  assert(isPlatformPublicHostname("[::1]:3000"), "IPv6 loopback platform dev");
  assert(isPlatformPublicHostname("suhuella.staging.workers.dev"), "authorized workers.dev");
  assert(!isPlatformPublicHostname("evil.workers.dev"), "foreign workers.dev is not platform");
  assert(!isPlatformPublicHostname("192.168.1.10"), "LAN IP is not platform");
  assert(!isPlatformPublicHostname("unknown.example"), "unknown domain is not platform");

  assert(isWorkersDevHostname("evil.workers.dev"), "foreign workers.dev detected");
  assert(isAuthorizedWorkersDevHostname("suhuella.account.workers.dev"), "authorized worker prefix");
  assert(!isAuthorizedWorkersDevHostname("evil.workers.dev"), "foreign worker rejected");

  // --- Partner registration validation ---
  assert(isReservedPlatformHostname("localhost"), "localhost reserved");
  assert(isReservedPlatformHostname("suhuella.com"), "apex reserved");
  assert(isReservedPlatformHostname("foo.workers.dev"), "all workers.dev reserved");
  assert(!isPartnerRegisterableHostname("localhost"), "partners cannot register localhost");
  assert(!isPartnerRegisterableHostname("suhuella.com"), "partners cannot register apex");
  assert(isPartnerRegisterableHostname("cloud.acme.example"), "partner subdomain allowed");

  // --- Header trust ---
  assert(
    requestHost(new Headers({ host: "localhost:3000" })) === "localhost:3000",
    "localhost uses Host only",
  );
  assert(
    requestHost(
      new Headers({
        host: "suhuella.com",
        "x-forwarded-host": "evil-partner.example",
      }),
    ) === "suhuella.com",
    "public host ignores spoofed X-Forwarded-Host",
  );
  assert(
    requestHost(
      new Headers({
        host: "localhost:3000",
        "x-forwarded-host": "evil-partner.example",
      }),
    ) === "localhost:3000",
    "localhost ignores spoofed X-Forwarded-Host",
  );
  assert(
    requestHost(
      new Headers({
        host: "suhuella.staging.workers.dev",
        "x-forwarded-host": "ops.suhuella.com",
      }),
    ) === "ops.suhuella.com",
    "authorized workers.dev trusts forwarded public hostname",
  );
  assert(
    requestHost(
      new Headers({
        host: "evil.workers.dev",
        "x-forwarded-host": "ops.suhuella.com",
      }),
    ) === "evil.workers.dev",
    "foreign workers.dev ignores forwarded host",
  );
  assert(
    hostnameFromRequestHeaders({
      get(name: string) {
        if (name === "host") return "localhost:3000";
        return null;
      },
    }) === "localhost",
    "middleware gate normalizes localhost",
  );

  // --- Brand resolution (fixtures only) ---
  createMemoryPartnerStore();
  resetPartnerStoreForTests();

  const alpha = await seedActivePartner({
    slug: "hr-alpha",
    displayName: "HR Alpha",
    hostname: "cloud.hr-alpha.example",
    accent: "#111111",
  });
  const beta = await seedActivePartner({
    slug: "hr-beta",
    displayName: "HR Beta",
    hostname: "cloud.hr-beta.example",
    accent: "#222222",
  });

  const platform = await resolveRequestBrandForHostname("suhuella.com");
  assert(platform.kind === "platform", "suhuella.com → platform");
  assert(platform.displayName === brand.displayName, "platform display name");

  const localhostBrand = await resolveRequestBrandForHostname("localhost:3000");
  assert(localhostBrand.kind === "platform", "localhost → platform");
  assert(localhostBrand.displayName === brand.displayName, "localhost uses SuHuella name");

  const opsBrand = await resolveRequestBrandForHostname("ops.suhuella.com");
  assert(opsBrand.kind === "platform", "ops → platform brand context");

  const workerBrand = await resolveRequestBrandForHostname("suhuella.dev.workers.dev");
  assert(workerBrand.kind === "platform", "authorized workers.dev → platform");

  const foreignWorker = await resolveRequestBrandForHostname("evil.workers.dev");
  assert(foreignWorker.kind === "unknown", "foreign workers.dev → unknown");

  const alphaBrand = await resolveRequestBrandForHostname("cloud.hr-alpha.example");
  const betaBrand = await resolveRequestBrandForHostname("cloud.hr-beta.example");
  assert(alphaBrand.kind === "partner" && alphaBrand.brandId === "hr-alpha", "active alpha partner");
  assert(betaBrand.kind === "partner" && betaBrand.brandId === "hr-beta", "active beta partner");
  assert(alphaBrand.displayName === "HR Alpha", "alpha display name");
  assert(betaBrand.displayName === "HR Beta", "beta display name");
  assert(alphaBrand.accent !== betaBrand.accent, "partners do not share accent");

  {
    const store = await getPartnerStore();
    const doc = await store.read();
    const domain = doc.domains.find((item) => item.hostname === "cloud.hr-alpha.example");
    assert(domain, "alpha domain");
    domain.status = "pending";
    await store.write(doc);
  }
  const pendingBrand = await resolveRequestBrandForHostname("cloud.hr-alpha.example");
  assert(pendingBrand.kind === "status", "pending → status not partner app");
  assert(pendingBrand.brandId === null, "pending does not expose brand_id");

  {
    const store = await getPartnerStore();
    const doc = await store.read();
    const domain = doc.domains.find((item) => item.hostname === "cloud.hr-beta.example");
    assert(domain, "beta domain");
    domain.status = "active";
    const partner = doc.partners.find((item) => item.slug === "hr-beta");
    assert(partner, "beta partner");
    partner.status = "suspended";
    await store.write(doc);
  }
  const suspendedBrand = await resolveRequestBrandForHostname("cloud.hr-beta.example");
  assert(suspendedBrand.kind === "status", "suspended partner → status");
  assert(suspendedBrand.domainStatus === "suspended", "suspended domain status");

  const unknownBrand = await resolveRequestBrandForHostname("no-such-host.example");
  assert(unknownBrand.kind === "unknown", "unknown host → unknown");
  assert(unknownBrand.brandId === null, "unknown does not leak brand_id");

  // Consecutive requests must not cross-contaminate brand context.
  const againAlpha = await resolveRequestBrandForHostname("cloud.hr-alpha.example");
  const againPlatform = await resolveRequestBrandForHostname("suhuella.com");
  assert(againAlpha.kind === "status", "alpha still pending after platform request");
  assert(againPlatform.kind === "platform", "platform unchanged after partner request");
  assert(againPlatform.displayName === brand.displayName, "platform name stable");

  assert(alpha.summary.partner.partnerId !== beta.summary.partner.partnerId, "fixture isolation");

  console.log("HOSTNAME-RESOLUTION-001 check passed");
}

runHostnameResolutionCheck().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
