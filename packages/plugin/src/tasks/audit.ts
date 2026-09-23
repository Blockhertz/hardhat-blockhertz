import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, relative, sep as pathSep } from "path";
import { createInterface } from "readline/promises";
import micromatch from "micromatch";

interface AuditArgs {
  contract: string;
  yes: boolean;
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

const TEST_PATH_SEGMENTS = new Set(["test", "tests", "mock", "mocks"]);

type ExcludeReason = "node_modules" | "test-path" | "interface" | "user-glob";

interface ExcludedFile {
  path: string;
  reason: ExcludeReason;
}

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

function segmentsOf(p: string): string[] {
  return p.split(/[\\/]/).filter(Boolean);
}

function isInNodeModules(fullPath: string): boolean {
  return segmentsOf(fullPath).includes("node_modules");
}

function isInTestPath(relPath: string): boolean {
  return segmentsOf(relPath).some((seg) =>
    TEST_PATH_SEGMENTS.has(seg.toLowerCase()),
  );
}

function stripSolComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

// Heuristic: file has one or more `interface X {}` blocks and no
// `contract X` / `abstract contract X` / `library X`. Comments are
// stripped first so commented-out declarations don't defeat the check.
// Trade-off documented in README — pass file via `exclude: []` inverse
// or `skipBuiltInFilters: true` to force-include if this misfires.
function isInterfaceOnly(src: string): boolean {
  const stripped = stripSolComments(src);
  const hasInterface = /^\s*interface\s+\w+/m.test(stripped);
  if (!hasInterface) return false;
  const hasContractOrLibrary =
    /^\s*(abstract\s+)?(contract|library)\s+\w+/m.test(stripped);
  return !hasContractOrLibrary;
}

function toPosix(p: string): string {
  return p.split(pathSep).join("/");
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function reasonLabel(reason: ExcludeReason): string {
  switch (reason) {
    case "node_modules":
      return "node_modules";
    case "test-path":
      return "test/mock path";
    case "interface":
      return "interface-only";
    case "user-glob":
      return "user exclude";
  }
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
  const userExcludes: string[] = Array.isArray(cfg.exclude) ? cfg.exclude : [];
  const skipBuiltInFilters: boolean = cfg.skipBuiltInFilters === true;

  const yesFlag =
    args.yes === true ||
    process.argv.includes("-y") ||
    process.env.BLOCKHERTZ_YES === "1";

  if (!apiKey) {
    console.error(
      `\n${BOLD}\x1b[31m✗ Blockhertz:${RESET} No API key found.\n` +
        `  Set BLOCKHERTZ_API_KEY or add blockhertz.apiKey to hardhat.config.ts\n` +
        `  Get free key at: https://blockhertz.com/tools/dashboard/api-keys\n`,
    );
    process.exit(1);
  }

  // ── File discovery ─────────────────────────────────────────────
  const discovered: string[] = contractPath
    ? [contractPath]
    : findSolFiles(contractsDir);

  if (discovered.length === 0) {
    console.log(`\n⚠️  No .sol files found in ${contractsDir}\n`);
    return;
  }

  // ── Filtering pipeline ─────────────────────────────────────────
  const included: string[] = [];
  const excluded: ExcludedFile[] = [];
  const cwd = process.cwd();

  for (const fullPath of discovered) {
    const relFromCwd = toPosix(relative(cwd, fullPath));

    // 1. node_modules (always applied)
    if (isInNodeModules(fullPath)) {
      excluded.push({ path: relFromCwd, reason: "node_modules" });
      continue;
    }

    // 2. test/mock path segments (skippable)
    if (!skipBuiltInFilters && isInTestPath(relFromCwd)) {
      excluded.push({ path: relFromCwd, reason: "test-path" });
      continue;
    }

    // 3. user glob excludes (always applied)
    if (userExcludes.length > 0 && micromatch.isMatch(relFromCwd, userExcludes)) {
      excluded.push({ path: relFromCwd, reason: "user-glob" });
      continue;
    }

    // 4. interface-only heuristic (skippable, reads file)
    if (!skipBuiltInFilters) {
      let src = "";
      try {
        src = readFileSync(fullPath, "utf-8");
      } catch {
        // if we can't read it, let the audit call fail per-file downstream
      }
      if (src && isInterfaceOnly(src)) {
        excluded.push({ path: relFromCwd, reason: "interface" });
        continue;
      }
    }

    included.push(fullPath);
  }

  // ── Report exclusions & pre-flight confirmation ────────────────
  console.log(`\n${BOLD}🔍 Blockhertz AI Auditor${RESET}`);
  console.log(
    `Found ${included.length} contract file(s) to audit` +
      (excluded.length > 0 ? ` (${excluded.length} excluded)` : "") +
      ".",
  );

  if (excluded.length > 0) {
    const cap = 10;
    const shown = excluded.slice(0, cap);
    for (const ex of shown) {
      console.log(`  \x1b[90m− ${ex.path} (${reasonLabel(ex.reason)})${RESET}`);
    }
    if (excluded.length > cap) {
      console.log(`  \x1b[90m…and ${excluded.length - cap} more${RESET}`);
    }
  }

  if (included.length === 0) {
    console.log(
      `\n⚠️  All discovered .sol files were filtered out — nothing to audit.\n`,
    );
    return;
  }

  console.log(
    `\nThis will use up to ${BOLD}${included.length}${RESET} credit(s) from your Blockhertz account.`,
  );

  if (!yesFlag) {
    const interactive = Boolean(process.stdout.isTTY && process.stdin.isTTY);
    if (!interactive) {
      console.error(
        `\n${BOLD}\x1b[31m✗ Blockhertz:${RESET} non-interactive shell detected.\n` +
          `  Pass ${BOLD}--yes${RESET} (or set ${BOLD}BLOCKHERTZ_YES=1${RESET}) to run in CI.\n`,
      );
      process.exit(1);
    }
    const ok = await promptYesNo("Continue? (y/N) ");
    if (!ok) {
      console.log("Aborted. No credits used.\n");
      return;
    }
  } else {
    console.log(`(--yes passed — skipping confirmation.)`);
  }

  console.log(`\nAuditing ${included.length} contract(s)...\n`);

  // ── Audit loop ─────────────────────────────────────────────────
  let hasBlockingIssues = false;
  let totalFindings = 0;
  let failedAudits = 0;

  for (const filePath of included) {
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
    `${BOLD}Audit finished:${RESET} ${included.length - failedAudits} of ${included.length} contract(s) audited, ${totalFindings} finding(s)`,
  );

  if (failedAudits > 0) {
    console.log(
      `\n${BOLD}\x1b[31m✗ Audit could not complete:${RESET} ${failedAudits} of ${included.length} contract(s) were not audited (see errors above).\n` +
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
