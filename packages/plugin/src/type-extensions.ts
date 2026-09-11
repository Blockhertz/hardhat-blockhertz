declare module "hardhat/types/config" {
  interface HardhatUserConfig {
    blockhertz?: {
      apiKey?: string;
      failOn?: "critical" | "high" | "medium" | "none";
      contractsPath?: string;
    };
  }

  interface HardhatConfig {
    blockhertz: {
      apiKey: string;
      failOn: "critical" | "high" | "medium" | "none";
      contractsPath: string;
    };
  }
}
