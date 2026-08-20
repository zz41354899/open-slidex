#!/usr/bin/env node
import{readFile as f}from"node:fs/promises";import d from"node:path";import{fileURLToPath as w}from"node:url";function u(e){if(e.length===0||e.includes("--help")||e.includes("-h"))return{action:"help"};if(e.includes("--version")||e.includes("-v"))return{action:"version"};let[t,...n]=e;if(t==="validate")return{action:"validate",file:h(n,"validate")};if(t==="render")return c(n);if(t==="export")return m(n);throw new Error(`Unknown command: ${t}. Run open-slidex --help.`)}function p(){return`Validate, render, and export an OpenSlideX MotionDoc.

Usage:
  open-slidex validate [presentation.mdx]
  open-slidex render [presentation.mdx] --montage --out <file.png>
  open-slidex render [presentation.mdx] --slide <index> --out <file.png>
  open-slidex export [presentation.mdx] --format <html|mdx|pptx> --out <file> [--overwrite]

Options:
  --montage       Render every slide into one contact sheet
  --slide <index> Render one zero-based slide index
  --format        Export as html, mdx, or pptx
  --out           Required output path for render and export
  --overwrite     Replace an existing export
  -h, --help      Show this help
  -v, --version   Show the installed SDK version
`}function c(e){let t,n,o,s;for(let r=0;r<e.length;r+=1){let i=e[r];if(i==="--montage"){if(n)throw new Error("Choose either --montage or --slide.");n="montage";continue}if(i==="--slide"){if(n)throw new Error("Choose either --montage or --slide.");let l=a(e,r,"--slide");if(s=Number(l),!Number.isInteger(s)||s<0)throw new Error("--slide must be a non-negative integer.");n="slide",r+=1;continue}if(i==="--out"){o=a(e,r,"--out"),r+=1;continue}if(i.startsWith("-"))throw new Error(`Unknown render option: ${i}.`);if(t)throw new Error("render accepts only one presentation file.");t=i}if(!n)throw new Error("render requires --montage or --slide <index>.");if(!o)throw new Error("render requires --out <file.png>.");return{action:"render",file:t??"presentation.mdx",mode:n,outputPath:o,...s===void 0?{}:{slideIndex:s}}}function m(e){let t,n,o,s=!1;for(let r=0;r<e.length;r+=1){let i=e[r];if(i==="--format"){let l=a(e,r,"--format");if(l!=="html"&&l!=="mdx"&&l!=="pptx")throw new Error("--format must be html, mdx, or pptx.");n=l,r+=1;continue}if(i==="--out"){o=a(e,r,"--out"),r+=1;continue}if(i==="--overwrite"){s=!0;continue}if(i.startsWith("-"))throw new Error(`Unknown export option: ${i}.`);if(t)throw new Error("export accepts only one presentation file.");t=i}if(!n)throw new Error("export requires --format <html|mdx|pptx>.");if(!o)throw new Error("export requires --out <file>.");return{action:"export",file:t??"presentation.mdx",format:n,outputPath:o,overwrite:s}}function h(e,t){let n=e.filter(s=>!s.startsWith("-")),o=e.find(s=>s.startsWith("-"));if(o)throw new Error(`Unknown ${t} option: ${o}.`);if(n.length>1)throw new Error(`${t} accepts only one presentation file.`);return n[0]??"presentation.mdx"}function a(e,t,n){let o=e[t+1];if(!o||o.startsWith("-"))throw new Error(`${n} requires a value.`);return o}import{exportSlideXDocument as x,renderSlideXDocument as g}from"./node.js";import{summarizeMotionDoc as v}from"./index.js";E().catch(e=>{let t=e instanceof Error?e.message:"Unknown OpenSlideX CLI failure.";process.stderr.write(`slidex: ${t}
`),process.exitCode=1});async function E(){let e=u(process.argv.slice(2));if(e.action==="help"){process.stdout.write(p());return}if(e.action==="version"){process.stdout.write(`${await S()}
`);return}let t=d.resolve(e.file),n=await f(t,"utf8");if(e.action==="validate"){let r=v(n),i={file:t,sceneCount:r.stats.sceneCount,valid:r.validation.isValid,issues:r.validation.issues};process.stdout.write(`${JSON.stringify(i,null,2)}
`),r.validation.isValid||(process.exitCode=1);return}let o=d.resolve(e.outputPath);if(e.action==="render"){let r=await g({mode:e.mode,outputPath:o,projectRoot:d.dirname(t),...e.slideIndex===void 0?{}:{slideIndex:e.slideIndex},source:n});process.stdout.write(`${JSON.stringify(r,null,2)}
`);return}let s=await x({format:e.format,outputPath:o,overwrite:e.overwrite,projectRoot:d.dirname(t),source:n});process.stdout.write(`${JSON.stringify(s,null,2)}
`)}async function S(){let e=w(new URL("../package.json",import.meta.url)),t=await f(e,"utf8"),n=JSON.parse(t);if(typeof n.version!="string")throw new Error("The installed SDK package has no version.");return n.version}
