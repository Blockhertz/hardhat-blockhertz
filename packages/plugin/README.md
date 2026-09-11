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

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| apiKey | env BLOCKHERTZ_API_KEY | Your Blockhertz API key |
| failOn | "high" | Minimum severity to fail build |
| contractsPath | "./contracts" | Path to contracts directory |

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
