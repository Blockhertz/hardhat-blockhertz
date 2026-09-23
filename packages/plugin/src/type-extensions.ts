declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    blockhertz?: {
      apiKey?: string;
      apiUrl?: string;
      failOn?: "critical" | "high" | "medium" | "none";
      contractsPath?: string;
      exclude?: string[];
      skipBuiltInFilters?: boolean;
    };
  }

  interface HardhatConfig {
    blockhertz: {
      apiKey: string;
      apiUrl: string;
      failOn: "critical" | "high" | "medium" | "none";
      contractsPath: string;
      exclude: string[];
      skipBuiltInFilters: boolean;
    };
  }
}
