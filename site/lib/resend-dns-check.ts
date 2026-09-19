import { Resolver } from "node:dns/promises";
import { brand } from "@suhuella/brand";
import {
  collectDmarcRecords,
  collectSpfRecords,
  dkimPresence,
  dkimSelectorsToProbe,
  dmarcPresence,
  flattenTxtAnswers,
  spfStatus,
} from "./resend-dns.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function resolveTxt(resolver: Resolver, name: string): Promise<string[]> {
  try {
    return flattenTxtAnswers(await resolver.resolveTxt(name));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "SERVFAIL") return [];
    throw error;
  }
}

async function resolveMx(resolver: Resolver, name: string): Promise<string[]> {
  try {
    return (await resolver.resolveMx(name)).map((item) => item.exchange);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "SERVFAIL") return [];
    throw error;
  }
}

async function resolveCname(resolver: Resolver, name: string): Promise<string[]> {
  try {
    return await resolver.resolveCname(name);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "SERVFAIL") return [];
    throw error;
  }
}

async function runResendDnsCheck(): Promise<void> {
  const domain = brand.primaryDomain;
  const requireVerified =
    process.argv.includes("--require") || process.env.RESEND_DNS_REQUIRE === "1";
  const resolver = new Resolver();

  assert(domain === "suhuella.com", "Resend DNS proof is SuHuella-only");

  const apexTxt = await resolveTxt(resolver, domain);
  const sendTxt = await resolveTxt(resolver, `send.${domain}`);
  const dmarcTxt = await resolveTxt(resolver, `_dmarc.${domain}`);
  const sendMx = await resolveMx(resolver, `send.${domain}`);
  const apexMx = await resolveMx(resolver, domain);

  const apexSpf = spfStatus(apexTxt);
  const sendSpf = spfStatus(sendTxt);
  const spfFound = apexSpf !== "missing" || sendSpf !== "missing";
  const dmarc = dmarcPresence(dmarcTxt);

  const selectors = dkimSelectorsToProbe();
  const dkimHits: string[] = [];
  for (const selector of selectors) {
    const host = `${selector}._domainkey.${domain}`;
    const txtRecords = await resolveTxt(resolver, host);
    const cnameTargets = await resolveCname(resolver, host);
    if (dkimPresence({ txtRecords, cnameTargets }) === "present") {
      dkimHits.push(selector);
    }
  }

  console.log(`RESEND-DNS domain=${domain}`);
  console.log(`SPF apex=${apexSpf}${collectSpfRecords(apexTxt).length ? ` count=${collectSpfRecords(apexTxt).length}` : ""}`);
  console.log(`SPF send.${domain}=${sendSpf}`);
  console.log(`DKIM selectors_present=${dkimHits.length ? dkimHits.join(",") : "none"}`);
  console.log(`DMARC=${dmarc}${collectDmarcRecords(dmarcTxt).length ? ` policy=${collectDmarcRecords(dmarcTxt)[0]}` : ""}`);
  console.log(`MX apex=${apexMx.length ? apexMx.join(",") : "none"}`);
  console.log(`MX send.${domain}=${sendMx.length ? sendMx.join(",") : "none"}`);

  if (apexSpf === "multiple" || sendSpf === "multiple") {
    console.log("STATUS=FAIL");
    throw new Error("Multiple SPF TXT records at the same name break deliverability. Merge into one v=spf1 record.");
  }

  const ready = spfFound && dkimHits.length > 0 && dmarc === "present";
  if (!ready) {
    console.log("STATUS=MANUAL ACTION REQUIRED");
    console.log(
      "Copy exact SPF/DKIM values from the SuHuella Resend dashboard. Do not invent record values. Cloudflare CNAMEs must be DNS-only.",
    );
  } else {
    console.log("STATUS=PASS");
    console.log("Public SPF/DKIM/DMARC names are present. Confirm the values still match the SuHuella Resend dashboard.");
  }

  if (requireVerified && !ready) {
    throw new Error("RESEND_DNS_REQUIRE is set and public SPF/DKIM/DMARC are not all present.");
  }

  console.log("RESEND-PRODUCTION-DNS-001 check passed");
}

void runResendDnsCheck().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
