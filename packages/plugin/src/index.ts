import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-blockhertz",
  hookHandlers: {},
  tasks: [
    task("blockhertz-audit", "Audit smart contracts using Blockhertz AI Security Scanner")
      .addOption({
        name: "contract",
        description: "Path to specific contract file (optional)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "yes",
        description: "Skip the credit-usage confirmation prompt (required in non-interactive shells / CI)",
        type: ArgumentType.BOOLEAN,
        defaultValue: false,
      })
      .setAction(() => import("./tasks/audit.js"))
      .build(),
  ],
};

export default plugin;
