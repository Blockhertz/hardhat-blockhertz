export interface BlockhertzUserConfig {
  apiKey?: string;
  apiUrl?: string;
  failOn?: "critical" | "high" | "medium" | "none";
  contractsPath?: string;
  exclude?: string[];
  skipBuiltInFilters?: boolean;
}

declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    blockhertz?: BlockhertzUserConfig;
  }

  interface HardhatConfig {
    blockhertz?: BlockhertzUserConfig;
  }
}
