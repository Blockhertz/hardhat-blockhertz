# hardhat-blockhertz

AI-powered smart contract security auditor for Hardhat — powered by [Blockhertz](https://blockhertz.com)

[![npm](https://img.shields.io/npm/v/hardhat-blockhertz)](https://www.npmjs.com/package/hardhat-blockhertz)

## Installation

```bash
npm install hardhat-blockhertz
```

## Setup

```typescript
import hardhatBlockhertz from "hardhat-blockhertz";

const config = {
  plugins: [hardhatBlockhertz],
  blockhertz: {
    apiKey: process.env.BLOCKHERTZ_API_KEY,
    failOn: "high",
  }
};

export default config;
```

## Get Free API Key

https://blockhertz.com/tools/dashboard/api-keys

## Usage

Audit all contracts:
```bash
npx hardhat blockhertz-audit
```

Audit specific contract:
```bash
npx hardhat blockhertz-audit --contract contracts/Lock.sol
```

Skip the credit-usage prompt (required in CI):
```bash
npx hardhat blockhertz-audit --yes
# or -y, or BLOCKHERTZ_YES=1 env var
```

## Credit usage & confirmation

Each audited contract file consumes **one credit** from your Blockhertz
account. Before running, the plugin prints how many files will be audited
and prompts to confirm:

```
Found 6 contract file(s) to audit (2 excluded).
  − contracts/interfaces/IERC20.sol (interface-only)
  − contracts/mocks/MockOracle.sol (test/mock path)

This will use up to 6 credit(s) from your Blockhertz account.
Continue? (y/N)
```

Pass `--yes` (or `-y`, or `BLOCKHERTZ_YES=1`) to skip the prompt in CI.
Non-interactive shells without `--yes` fail fast rather than hang.

## Filtering

By default the plugin excludes files that would waste credits:

- Anything under a `node_modules/` path segment
- Anything under a path segment named `test`, `tests`, `mock`, or `mocks`
  (case-insensitive, segment-matched — `contracts/testing/Real.sol` is
  **kept**; `contracts/test/Real.sol` is excluded)
- Interface-only files (a file whose top-level declarations are
  `interface X { … }` with no `contract` or `library`)

Interface detection is a regex heuristic on the file contents, with
comments stripped first. It gets the common cases right; if it misfires
for you, set `skipBuiltInFilters: true` to force-include every file.

### Custom excludes

Add project-specific globs — these are **additive**, not a replacement
for the built-in filters:

```typescript
blockhertz: {
  apiKey: process.env.BLOCKHERTZ_API_KEY,
  exclude: [
    "contracts/legacy/**",
    "contracts/scripts/**/*.sol",
  ],
}
```

Globs are matched against paths **relative to your project root** (POSIX
style), via [micromatch](https://www.npmjs.com/package/micromatch).

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| apiKey | env BLOCKHERTZ_API_KEY | Your Blockhertz API key |
| apiUrl | env BLOCKHERTZ_API_URL, else production | Audit endpoint (override for preview/staging) |
| failOn | "high" | Minimum severity to fail build |
| contractsPath | "./contracts" | Path to contracts directory |
| exclude | [] | Extra glob patterns (added to built-in filters) |
| skipBuiltInFilters | false | Disable the built-in test/mock/interface filters (node_modules is always excluded) |

## failOn Options

| Value | Description |
|-------|-------------|
| "critical" | Fail only on critical severity |
| "high" | Fail on high + critical (default) |
| "medium" | Fail on medium and above |
| "none" | Never fail the build |

## Links

- [Get API Key](https://blockhertz.com/tools/dashboard/api-keys)
- [Blockhertz](https://blockhertz.com)
- [Issues](https://github.com/Blockhertz/hardhat-blockhertz/issues)
