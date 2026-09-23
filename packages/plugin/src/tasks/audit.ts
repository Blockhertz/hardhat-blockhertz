import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname } from "path";

interface AuditArgs {
  contract: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  gas: 0,
  info: 0,
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "\x1b[31m",
  high: "\x1b[33m",
  medium: "\x1b[36m",
  low: "\x1b[32m",
  gas: "\x1b[35m",
  info: "\x1b[37m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const DEFAULT_API_URL = "https://blockhertz.com/api/v1/audit";

interface ApiErrorBody {
  error?: string;
  detail?: string;
  resetIn?: number;
}

function describeApiError(data: ApiErrorBody): string {
  switch (data.error) {
    case "contract_not_found":
      return "Contract not found or not verified on the block explorer.";
    case "invalid_api_key":
      return "Invalid API key. Check blockhertz.apiKey or BLOCKHERTZ_API_KEY (get one at blockhertz.com/tools/dashboard/api-keys).";
    case "rate_limit_exceeded":
      return typeof data.resetIn === "number"
        ? `Rate limit exceeded. Try again in ~${Math.ceil(data.resetIn / 60)} min.`
        : "Rate limit exceeded. Try again later.";
    case "insufficient_credits":
      return "No credits remaining. Visit blockhertz.com/pricing";
    default:
      return data.error ?? "Unknown error";
  }
}

function findSolFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findSolFiles(fullPath, files);
      } else if (extname(entry) === ".sol") {
        files.push(fullPath);
      }
    }
  } catch {
    // directory not found
  }
  return files;
}

export default async function runAudit(
  args: AuditArgs,
  hre: HardhatRuntimeEnvironment,
): Promise<void> {
  const contractPath = args.contract;
  const cfg = hre.config.blockhertz ?? ({} as any);

  const apiKey = cfg.apiKey || process.env.BLOCKHERTZ_API_KEY || "";
  const apiUrl =
    cfg.apiUrl || process.env.BLOCKHERTZ_API_URL || DEFAULT_API_URL;
  const failOn = cfg.failOn ?? "high";
  const contractsDir = cfg.contractsPath || join(process.cwd(), "contracts");

  if (!apiKey) {
    console.error(
      `\n${BOLD}\x1b[31m✗ Blockhertz:${RESET} No API key found.\n` +
        `  Set BLOCKHERTZ_API_KEY or add blockhertz.apiKey to hardhat.config.ts\n` +
        `  Get free key at: https://blockhertz.com/tools/dashboard/api-keys\n`,
    );
    process.exit(1);
  }

  const contractFiles: string[] = contractPath
    ? [contractPath]
    : findSolFiles(contractsDir);

  if (contractFiles.length === 0) {
    console.log(`\n⚠️  No .sol files found in ${contractsDir}\n`);
    return;
  }

  console.log(
    `\n${BOLD}🔍 Blockhertz AI Auditor${RESET}\n` +
      `Auditing ${contractFiles.length} contract(s)...\n`,
  );

  let hasBlockingIssues = false;
  let totalFindings = 0;
  let failedAudits = 0;

  for (const filePath of contractFiles) {
    const code = readFileSync(filePath, "utf-8");
    const fileName = filePath.split(/[\\/]/).pop() ?? filePath;

    console.log(`${BOLD}📄 ${fileName}${RESET}`);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          contract: code,
          language: "solidity",
        }),
      });

      let data: any;
      try {
        data = await res.json();
      } catch {
        failedAudits++;
        console.log(
          `  \x1b[31m✗ Server returned an unexpected response (${res.status}).${RESET}\n`,
        );
        continue;
      }

      if (!res.ok || !data.success) {
        failedAudits++;
        console.log(
          `  \x1b[31m✗ ${describeApiError(data as ApiErrorBody)}${RESET}\n`,
        );
        continue;
      }

      const scoreColor =
        data.riskScore > 70
          ? "\x1b[31m"
          : data.riskScore > 40
            ? "\x1b[33m"
            : "\x1b[32m";

      console.log(
        `  Risk Score: ${scoreColor}${BOLD}${data.riskScore}/100${RESET} (${data.severity})`,
      );

      const findings = data.findings ?? [];
      totalFindings += findings.length;

      if (findings.length === 0) {
        console.log(`  ${BOLD}\x1b[32m✓ No issues found${RESET}`);
      } else {
        console.log(`  Findings: ${findings.length}`);
        for (const f of findings) {
          const color = SEVERITY_COLORS[f.severity] ?? RESET;
          console.log(
            `\n  ${color}${BOLD}[${f.severity.toUpperCase()}]${RESET} ${f.title}`,
          );
          console.log(`  ${f.description}`);
          if (f.fix) {
            console.log(`  ${BOLD}Fix:${RESET} ${f.fix}`);
          }

          const sLevel = SEVERITY_ORDER[f.severity] ?? 0;
          const fLevel = SEVERITY_ORDER[failOn] ?? 0;

          if (failOn !== "none" && sLevel >= fLevel) {
            hasBlockingIssues = true;
          }
        }
      }

      if (data.summary) {
        console.log(`\n  ${BOLD}Summary:${RESET} ${data.summary}`);
      }
    } catch (err: any) {
      failedAudits++;
      console.log(`  \x1b[31m✗ Request failed:${RESET} ${err.message}`);
    }
    console.log("");
  }

  console.log("─".repeat(50));
  console.log(
    `${BOLD}Audit finished:${RESET} ${contractFiles.length - failedAudits} of ${contractFiles.length} contract(s) audited, ${totalFindings} finding(s)`,
  );

  if (failedAudits > 0) {
    console.log(
      `\n${BOLD}\x1b[31m✗ Audit could not complete:${RESET} ${failedAudits} of ${contractFiles.length} contract(s) were not audited (see errors above).\n` +
        `  This is a failed run, not a pass. Fix the error and re-run.\n`,
    );
  }

  if (hasBlockingIssues) {
    console.log(
      `\n${BOLD}\x1b[31m✗ Build failed:${RESET} Found ${failOn}+ severity issues.\n` +
        `  Fix issues or set blockhertz.failOn = 'none'\n`,
    );
    process.exit(1);
  }

  if (failedAudits > 0) {
    process.exit(1);
  }

  console.log(`${BOLD}\x1b[32m✓ All checks passed${RESET}\n`);
}
