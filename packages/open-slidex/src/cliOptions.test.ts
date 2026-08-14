import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupportedNodeVersion,
  createSlideXHelp,
  detectPackageManager,
  parseCreateSlideXArguments,
  runScriptCommand
} from "./cliOptions";

test("CLI exposes help and version actions without creating a project", () => {
  assert.deepEqual(parseCreateSlideXArguments(["--help"]), { action: "help" });
  assert.deepEqual(parseCreateSlideXArguments(["-v"]), { action: "version" });
  assert.match(createSlideXHelp(), /--package-manager <npm\|pnpm\|bun>/);
  assert.match(createSlideXHelp(), /npx open-slidex@0\.3\.4 init my-deck/);
  assert.match(createSlideXHelp(), /pnpm dlx open-slidex@0\.3\.4 init my-deck/);
  assert.match(createSlideXHelp(), /bunx open-slidex@0\.3\.4 init my-deck/);
  assert.match(createSlideXHelp(), /--template <official-template-id>/);
});

test("CLI parses an official template and locale", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["team-deck", "--template", "summer-time-report", "--locale", "zh-TW", "--no-install"]),
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

test("CLI parses explicit package-manager choices and no-install", () => {
  assert.deepEqual(
    parseCreateSlideXArguments([
      "customer-deck",
      "--package-manager=pnpm",
      "--no-install"
    ]),
    {
      action: "create",
      installDependencies: false,
      packageManager: "pnpm",
      target: "customer-deck"
    }
  );
  assert.equal(runScriptCommand("pnpm", "validate"), "pnpm validate");
  assert.equal(runScriptCommand("bun", "render"), "bun run render");
  assert.equal(
    runScriptCommand("npm", "export:pptx"),
    "npm run export:pptx"
  );
  assert.equal(
    runScriptCommand("pnpm", "export:html"),
    "pnpm export:html"
  );
});

test("CLI detects the invoking package manager and defaults to npm", () => {
  assert.equal(detectPackageManager("pnpm/10.0.0 npm/? node/v22"), "pnpm");
  assert.equal(detectPackageManager("bun/1.2.0 npm/? node/v22"), "bun");
  assert.equal(detectPackageManager(undefined, "/opt/pnpm/bin/pnpm.cjs"), "pnpm");
  assert.equal(detectPackageManager(undefined, "/opt/bun/bin/bun"), "bun");
  assert.equal(detectPackageManager(undefined, undefined, "1.2.0"), "bun");
  assert.equal(detectPackageManager("yarn/1.22.0 npm/? node/v22"), "npm");
  assert.equal(detectPackageManager(undefined), "npm");
});

test("CLI automatically keeps the package manager used to create the project", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["pnpm-deck", "--no-install"], {
      npm_config_user_agent: "pnpm/11.9.0 npm/? node/v22"
    }),
    {
      action: "create",
      installDependencies: false,
      packageManager: "pnpm",
      target: "pnpm-deck"
    }
  );
  assert.deepEqual(
    parseCreateSlideXArguments(["bun-deck", "--no-install"], {
      npm_execpath: "/opt/bun/bin/bun"
    }),
    {
      action: "create",
      installDependencies: false,
      packageManager: "bun",
      target: "bun-deck"
    }
  );
});

test("CLI rejects unknown, conflicting, and malformed options", () => {
  assert.throws(
    () => parseCreateSlideXArguments(["deck", "--yarn"]),
    /Unknown option/
  );
  assert.throws(
    () => parseCreateSlideXArguments(["--npm", "--bun"]),
    /Choose only one/
  );
  assert.throws(
    () => parseCreateSlideXArguments(["--package-manager"]),
    /requires npm, pnpm, or bun/
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
