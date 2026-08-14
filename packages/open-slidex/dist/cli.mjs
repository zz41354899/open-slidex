#!/usr/bin/env node
import{spawn as x}from"node:child_process";import{readFile as f}from"node:fs/promises";import i from"node:path";import{fileURLToPath as w}from"node:url";var c=i.resolve(i.dirname(w(import.meta.url)),"..");k().catch(e=>{let n=e instanceof Error?e.message:"Unknown OpenSlideX CLI failure.";process.stderr.write(`open-slidex: ${n}
`),process.exitCode=1});async function k(){let[e="help",...n]=process.argv.slice(2);if(e==="--version"||e==="-v"){let o=JSON.parse(await f(i.join(c,"package.json"),"utf8"));if(typeof o.version!="string")throw new Error("Package version is unavailable.");process.stdout.write(`${o.version}
`);return}if(e==="help"||e==="--help"||e==="-h"){process.stdout.write(v());return}let t=g(e),s=t==="create"||t==="mcp"?n:[e,...n];await h(u(t),s)}function g(e){if(e==="init")return"create";if(e==="mcp")return"mcp";if(["workspace","dev","build","preview","sync:skills"].includes(e))return"workbench";if(["validate","render","export"].includes(e))return"sdk";throw new Error(`Unknown command: ${e}. Run open-slidex --help.`)}function u(e){let n={create:"dist/create.mjs",mcp:"runtime/mcp/server.mjs",sdk:"runtime/sdk/cli.js",workbench:"runtime/workbench/cli.mjs"};return i.join(c,n[e])}function h(e,n){return new Promise((t,s)=>{let o=x(process.execPath,[e,...n],{cwd:process.cwd(),env:{...process.env,...e===u("workbench")?{OPEN_SLIDEX_TEMPLATE_ROOT:i.join(c,"template")}:{}},stdio:"inherit"}),p=r=>{o.exitCode===null&&o.signalCode===null&&o.kill(r)},d=()=>p("SIGINT"),a=()=>p("SIGTERM"),l=()=>{process.off("SIGINT",d),process.off("SIGTERM",a)};process.once("SIGINT",d),process.once("SIGTERM",a),o.once("error",r=>{l(),s(r)}),o.once("exit",(r,m)=>{l(),r===0||m==="SIGINT"||m==="SIGTERM"?t():s(new Error(`open-slidex ${n[0]??""} exited with code ${r??"unknown"}.`))})})}function v(){return`OpenSlideX

Usage:
  open-slidex workspace [directory] [--port 4172] [--no-open]
  open-slidex init [directory] [--template <id>] [--locale <en|zh-TW>] [--no-install]
  open-slidex dev [--port 4173] [--no-open]
  open-slidex build
  open-slidex preview [--port 4174]
  open-slidex mcp --project <directory> [--print-config <codex|claude-code|claude-desktop>]
  open-slidex mcp --workspace <directory> [--print-config <codex|claude-code|claude-desktop>]
  open-slidex mcp --project <directory> [--print-setup-prompt <codex|claude-code|claude-desktop>]
  open-slidex mcp --workspace <directory> [--print-setup-prompt <codex|claude-code|claude-desktop>]
  open-slidex validate [presentation.mdx]
  open-slidex render [presentation.mdx] --montage --out <file.png>
  open-slidex export [presentation.mdx] --format <html|mdx|pptx> --out <file> [--overwrite]

Examples:
  open-slidex workspace ~/Presentations
  npx open-slidex@latest init my-deck
  open-slidex init my-deck --template summer-time-report --locale zh-TW
  cd my-deck && npm run dev
  open-slidex mcp --project ./my-deck --print-config codex
  open-slidex mcp --workspace ~/Presentations --print-config codex
`}
