import type { HardhatUserConfig } from "hardhat/types/config";
import type {
  ConfigHooks,
  HardhatUserConfigValidationError,
} from "hardhat/types/hooks";

import type { BlockhertzUserConfig } from "./type-extensions.js";

const STRING_FIELDS: Array<keyof BlockhertzUserConfig> = [
  "apiKey",
  "apiUrl",
  "failOn",
  "contractsPath",
];

export const validatePluginConfig: ConfigHooks["validateUserConfig"] = async (
  userConfig: HardhatUserConfig,
): Promise<HardhatUserConfigValidationError[]> => {
  const errors: HardhatUserConfigValidationError[] = [];
  const bh = userConfig.blockhertz as unknown;

  if (bh === undefined) return errors;

  if (typeof bh !== "object" || bh === null || Array.isArray(bh)) {
    errors.push({
      path: ["blockhertz"],
      message: "`blockhertz` must be an object",
    });
    return errors;
  }

  const cfg = bh as Record<string, unknown>;

  for (const field of STRING_FIELDS) {
    const v = cfg[field];
    if (v !== undefined && typeof v !== "string") {
      errors.push({
        path: ["blockhertz", field],
        message: `\`blockhertz.${field}\` must be a string`,
      });
    }
  }

  if (cfg.exclude !== undefined) {
    if (
      !Array.isArray(cfg.exclude) ||
      !cfg.exclude.every((v) => typeof v === "string")
    ) {
      errors.push({
        path: ["blockhertz", "exclude"],
        message: "`blockhertz.exclude` must be an array of strings",
      });
    }
  }

  if (
    cfg.skipBuiltInFilters !== undefined &&
    typeof cfg.skipBuiltInFilters !== "boolean"
  ) {
    errors.push({
      path: ["blockhertz", "skipBuiltInFilters"],
      message: "`blockhertz.skipBuiltInFilters` must be a boolean",
    });
  }

  return errors;
};

export const resolvePluginConfig: ConfigHooks["resolveUserConfig"] = async (
  userConfig,
  resolveConfigurationVariable,
  next,
) => {
  const resolved = await next(userConfig, resolveConfigurationVariable);
  return {
    ...resolved,
    blockhertz: userConfig.blockhertz,
  };
};
