/**
 * Prints wrangler commands for SuHuella Email Routing setup.
 * Does not run them — destination addresses must be verified by clicking
 * Cloudflare's confirmation email in each real inbox first.
 *
 * Usage:
 *   SUPPORT_DEST=you@example.com SALES_DEST=you@example.com node scripts/suhuella-email-routing-setup.mjs
 */

const domain = "suhuella.com";
const supportDest = process.env.SUPPORT_DEST?.trim();
const salesDest = process.env.SALES_DEST?.trim();

const supportGroup = [
  "support@suhuella.com",
  "licenses@suhuella.com",
  "billing@suhuella.com",
  "privacy@suhuella.com",
  "security@suhuella.com",
];

const salesGroup = [
  "sales@suhuella.com",
  "partners@suhuella.com",
  "operations@suhuella.com",
];

console.log(`# SuHuella Email Routing — ${domain}\n`);
console.log("# 1. Enable routing");
console.log(`npx wrangler email routing enable ${domain}\n`);

if (!supportDest || !salesDest) {
  console.log("# Set destination inboxes, then re-run this script:");
  console.log("#   SUPPORT_DEST=your-support-inbox@example.com \\");
  console.log("#   SALES_DEST=your-commercial-inbox@example.com \\");
  console.log("#   node scripts/suhuella-email-routing-setup.mjs\n");
  process.exit(0);
}

console.log("# 2. Verify destination addresses (click links in each inbox)");
console.log(`npx wrangler email routing addresses create ${supportDest}`);
if (salesDest !== supportDest) {
  console.log(`npx wrangler email routing addresses create ${salesDest}`);
}
console.log("npx wrangler email routing addresses list\n");

console.log("# 3. Forward aliases");
for (const alias of supportGroup) {
  const local = alias.split("@")[0];
  console.log(
    `npx wrangler email routing rules create ${domain} --name "${local}" --match-type literal --match-field to --match-value ${alias} --action-type forward --action-value ${supportDest}`,
  );
}
for (const alias of salesGroup) {
  const local = alias.split("@")[0];
  console.log(
    `npx wrangler email routing rules create ${domain} --name "${local}" --match-type literal --match-field to --match-value ${alias} --action-type forward --action-value ${salesDest}`,
  );
}

console.log("\n# 4. Smoke — send one real email to each alias and confirm inbox delivery");
console.log(`npx wrangler email routing rules list ${domain}`);
