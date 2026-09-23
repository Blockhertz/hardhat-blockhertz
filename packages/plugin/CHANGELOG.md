# Changelog

## 0.3.0

### Billing safety: file filtering & pre-flight confirmation

Every audited `.sol` file consumes one credit. Previously the plugin
recursively audited every file found under `contractsPath` with no
filtering and no upfront disclosure, so a run could silently spend
credits on interfaces, mocks, or test helpers.

### Added

- **Built-in filters.** Files under any `node_modules/` path segment are
  always excluded. Files under a `test`/`tests`/`mock`/`mocks` path
  segment (case-insensitive) and pure interface-only files (heuristic:
  contains `interface X {}` and no `contract`/`library`) are excluded by
  default and can be turned off with `blockhertz.skipBuiltInFilters: true`.
- **`blockhertz.exclude`** — extra glob patterns (via
  [micromatch](https://www.npmjs.com/package/micromatch)) matched
  against project-root-relative paths. Additive to the built-in filters,
  not a replacement.
- **Pre-flight confirmation.** The task now prints the file count, lists
  excluded files (capped at 10 with "…and N more"), states the credit
  cost, and prompts `Continue? (y/N)` before making any API calls.
- **`--yes` / `-y` flag** (also `BLOCKHERTZ_YES=1`) to skip the prompt.
  Required in non-interactive shells — CI runs without it fail fast with
  a clear message instead of hanging.

### Notes

- Interface detection is a regex on the file contents (comments stripped
  first). It handles the common cases; if it misfires, set
  `skipBuiltInFilters: true` to force-include every file.
- Users on 0.2.x whose runs previously counted N files may see fewer
  audited on the same repo — this is intentional (interfaces and tests
  no longer bill by default). Review the pre-flight summary the first
  time you upgrade.

## 0.2.0

### Behavior change: dedicated "high" severity

The Blockhertz API now classifies findings with a dedicated `high` severity level, previously merged into `critical`/`medium`. If you use the default `failOn: "high"` setting, your CI may now fail on findings that previously passed, because true high-severity issues are now correctly classified as `high` instead of being silently absorbed into other buckets.

Review your `failOn` threshold if you want to preserve prior behavior (e.g. set `failOn: "critical"` to match old behavior).

### Added

- `blockhertz.apiUrl` config option and `BLOCKHERTZ_API_URL` environment variable to point the plugin at a preview or staging deployment. Defaults to `https://blockhertz.com/api/v1/audit`.
- Clearer developer-facing messages for the API error codes `contract_not_found`, `invalid_api_key`, `rate_limit_exceeded` and `insufficient_credits`. Unrecognized errors still print the raw error.

### Fixed

- A failed audit no longer looks like a passed one. If any API call fails (invalid key, rate limit, no credits, contract not found, network error, unparseable response, any non-2xx response), the task now prints "Audit could not complete" and exits with code 1. Previously it printed the error, continued, and ended with "All checks passed" and exit code 0. This applies regardless of `failOn`, including `failOn: "none"`.

## 0.1.0

- Initial release: `npx hardhat blockhertz-audit`.
