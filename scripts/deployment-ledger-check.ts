import { readFileSync } from "node:fs";

const ledgers = [
  "docs/azure-resource-ledger.md",
  "docs/aws-resource-ledger.md",
  "docs/gcp-resource-ledger.md",
];

const forbiddenPatterns = [
  /aws_access_key_id/i,
  /aws_secret_access_key/i,
  /aws_session_token/i,
  /AccountKey=/i,
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/,
  /client-secret/i,
  /kubeconfig/i,
  /-----BEGIN CERTIFICATE-----/,
];

let failed = false;

for (const path of ledgers) {
  const text = readFileSync(path, "utf8");
  for (const row of tableRows(text)) {
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(row)) {
        console.error(`${path}: forbidden secret-like pattern ${pattern}`);
        failed = true;
      }
    }
    const cells = row.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 7 || cells[0] === "status" || cells[0].match(/^-+$/)) {
      continue;
    }
    const [status, resourceClass, scope, purpose, owner, cleanup] = cells;
    if (status === "active" && (!cleanup || cleanup.toLowerCase() === "tbd")) {
      console.error(`${path}: active ${resourceClass} in ${scope} (${owner}, ${purpose}) is missing cleanup instructions`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log(`Checked ${ledgers.length} provider ledgers`);

function tableRows(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.startsWith("|"));
}
