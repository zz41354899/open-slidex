import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupportedNodeVersion,
  createSlideXHelp,
  installCommand,
  packageManagerFromUserAgent,
  parseCreateSlideXArguments
} from "./cliOptions";

test("CLI exposes help and version actions without creating a project", () => {
  assert.deepEqual(parseCreateSlideXArguments(["--help"]), { action: "help" });
  assert.deepEqual(parseCreateSlideXArguments(["-v"]), { action: "version" });
  assert.match(createSlideXHelp(), /--package-manager <manager>/);
  assert.match(createSlideXHelp(), /npx open-slidex@latest init my-deck/);
  assert.match(createSlideXHelp(), /pnpm dlx open-slidex@latest init my-deck/);
  assert.match(createSlideXHelp(), /yarn dlx open-slidex@latest init my-deck/);
  assert.match(createSlideXHelp(), /bunx open-slidex@latest init my-deck/);
  assert.match(createSlideXHelp(), /--template <official-template-id>/);
});

test("CLI parses an official template and locale", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["team-deck", "--template", "summer-time-report", "--locale", "zh-TW", "--no-install"], "npm/11.19.0 node/v22.19.0"),
    {
      action: "create",
      installDependencies: false,
      packageManager: "npm",
      target: "team-deck",
      template: { id: "summer-time-report", locale: "zh-TW" }
    }
  );
  assert.throws(() => parseCreateSlideXArguments(["deck", "--template", "../escape"]), /official template ID/);
  assert.throws(() => parseCreateSlideXArguments(["deck", "--locale", "fr"]), /en or zh-TW/);
});

test("CLI keeps starter options minimal", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["customer-deck", "--no-install"], "npm/11.19.0 node/v22.19.0"),
    {
      action: "create",
      installDependencies: false,
      packageManager: "npm",
      target: "customer-deck"
    }
  );
});

test("CLI selects a package manager from the runner or explicit option", () => {
  assert.equal(packageManagerFromUserAgent("pnpm/11.18.0 npm/? node/v22.19.0"), "pnpm");
  assert.equal(packageManagerFromUserAgent("yarn/4.9.1 npm/? node/v22.19.0"), "yarn");
  assert.equal(packageManagerFromUserAgent("bun/1.3.0 npm/? node/v22.19.0"), "bun");
  assert.equal(packageManagerFromUserAgent(undefined), "npm");
  assert.deepEqual(installCommand("pnpm"), { command: "pnpm", args: ["install"] });
  assert.deepEqual(
    parseCreateSlideXArguments(["deck", "--package-manager", "bun"], "npm/11.19.0 node/v22.19.0"),
    { action: "create", installDependencies: true, packageManager: "bun", target: "deck" }
  );
});

test("CLI rejects unknown, conflicting, and malformed options", () => {
  assert.throws(
    () => parseCreateSlideXArguments(["deck", "--package-manager", "deno"]),
    /package-manager requires npm, pnpm, yarn, or bun/
  );
  assert.throws(
    () => parseCreateSlideXArguments(["--pnpm"]),
    /Unknown option/
  );
  assert.throws(
    () => parseCreateSlideXArguments(["first", "second"]),
    /Only one target/
  );
});

test("CLI enforces the Node.js version required by the starter", () => {
  assert.doesNotThrow(() => assertSupportedNodeVersion("22.12.0"));
  assert.doesNotThrow(() => assertSupportedNodeVersion("22.19.0"));
  assert.throws(
    () => assertSupportedNodeVersion("22.11.1"),
    /Node\.js 22\.12\.0 or newer/
  );
  assert.throws(
    () => assertSupportedNodeVersion("18.20.0"),
    /Current version: 18\.20\.0/
  );
  assert.throws(
    () => assertSupportedNodeVersion("21.99.0"),
    /Node\.js 22\.12\.0 or newer/
  );
});
