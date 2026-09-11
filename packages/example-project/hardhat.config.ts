import { defineConfig } from "hardhat/config";
import hardhatBlockhertz from "hardhat-blockhertz";

export default defineConfig({
  plugins: [hardhatBlockhertz],
  solidity: "0.8.29",
  blockhertz: {
    apiKey: process.env.BLOCKHERTZ_API_KEY ?? "",
    failOn: "high",
  },
});
