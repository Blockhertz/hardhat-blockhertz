# Changelog

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
