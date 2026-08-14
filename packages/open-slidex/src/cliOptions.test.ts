import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupportedNodeVersion,
  createSlideXHelp,
  parseCreateSlideXArguments
} from "./cliOptions";

test("CLI exposes help and version actions without creating a project", () => {
  assert.deepEqual(parseCreateSlideXArguments(["--help"]), { action: "help" });
  assert.deepEqual(parseCreateSlideXArguments(["-v"]), { action: "version" });
  assert.doesNotMatch(createSlideXHelp(), /package-manager|pnpm|bun/);
  assert.match(createSlideXHelp(), /npx open-slidex@latest init my-deck/);
  assert.match(createSlideXHelp(), /--template <official-template-id>/);
});

test("CLI parses an official template and locale", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["team-deck", "--template", "summer-time-report", "--locale", "zh-TW", "--no-install"]),
    {
      action: "create",
      installDependencies: false,
      target: "team-deck",
      template: { id: "summer-time-report", locale: "zh-TW" }
    }
  );
  assert.throws(() => parseCreateSlideXArguments(["deck", "--template", "../escape"]), /official template ID/);
  assert.throws(() => parseCreateSlideXArguments(["deck", "--locale", "fr"]), /en or zh-TW/);
});

test("CLI keeps starter options minimal", () => {
  assert.deepEqual(
    parseCreateSlideXArguments(["customer-deck", "--no-install"]),
    {
      action: "create",
      installDependencies: false,
      target: "customer-deck"
    }
  );
});

test("CLI rejects unknown, conflicting, and malformed options", () => {
  assert.throws(
    () => parseCreateSlideXArguments(["deck", "--yarn"]),
    /Unknown option/
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
