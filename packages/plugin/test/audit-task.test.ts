import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createFixtureProjectHRE } from "./helpers/fixture-projects.js";

describe("hardhat-blockhertz plugin", () => {
  it("loads the plugin without errors", async () => {
    const hre = await createFixtureProjectHRE("base-project");
    assert.ok(hre, "HRE should be created");
  });

  it("registers the blockhertz-audit task", async () => {
    const hre = await createFixtureProjectHRE("base-project");
    assert.doesNotThrow(
      () => hre.tasks.getTask("blockhertz-audit"),
      "blockhertz-audit task should be registered",
    );
  });
});
