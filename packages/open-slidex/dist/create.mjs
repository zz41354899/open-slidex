#!/usr/bin/env node
var __defProp = Object.defineProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};

// packages/open-slidex/src/cli.ts
import { spawn } from "node:child_process";
import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  writeFile
} from "node:fs/promises";
import path2 from "node:path";
import { fileURLToPath } from "node:url";

// core/motion-doc/domain/officialTemplateDefinitions.ts
var officialTemplatePackageVersion = "1.0.0";
var officialTemplateCompatibility = { motionDoc: "1.0.0", openSlideX: "0.3.0" };
var officialTemplateDefinitions = [
  {
    id: "summer-time-report",
    cover: "",
    catalog: {
      author: "OpenSlideX Contributors",
      category: "report",
      featured: true,
      slideCount: 7,
      sortOrder: 20,
      tags: ["Summer", "Report", "Seasonal", "Team"]
    },
    locales: {
      en: {
        description: "A bright seven-slide seasonal report for shared context, highlights, metrics, and next steps.",
        name: "Summer Time Report",
        useCase: "Seasonal recaps, team updates, and program reports"
      },
      "zh-TW": {
        description: "\u660E\u4EAE\u7684\u4E03\u9801\u5B63\u7BC0\u5831\u544A\uFF0C\u9069\u5408\u6574\u7406\u8108\u7D61\u3001\u4EAE\u9EDE\u3001\u6307\u6A19\u8207\u4E0B\u4E00\u6B65\u3002",
        name: "\u590F\u65E5\u6642\u5149\u5831\u544A",
        useCase: "\u5B63\u7BC0\u56DE\u9867\u3001\u5718\u968A\u66F4\u65B0\u8207\u8A08\u756B\u5831\u544A"
      }
    },
    blueprint: {
      schemaVersion: 1,
      narrative: {
        objective: "Turn a season of work into a clear recap with shared context, evidence, and next actions.",
        slideRoles: ["cover", "about", "highlights", "metrics", "timeline", "next-steps", "closing"]
      },
      design: {
        colorTokens: ["#38BDF8", "#0A84FF", "#223E53", "#FFBC90", "#F2FAFF", "#FFFFFF", "#0A2540"],
        composition: "Airy editorial layouts with a left-aligned text hierarchy, rounded metric surfaces, and simple seasonal geometric accents.",
        imageTreatment: "No images are required; preserve the editable circle, star, and geometric shape accents.",
        typography: "Large bold Arial headlines, concise labels, and high-contrast supporting copy."
      },
      imageSlots: [],
      layoutRoles: ["cover", "about", "highlights", "metrics", "timeline", "next-steps", "closing"],
      prohibitions: [
        "Do not depend on Cloud authentication or remote persistence.",
        "Do not use remote or Base64 media in local projects.",
        "Do not replace the editable seasonal shape accents with raster artwork."
      ],
      qaRules: [
        "Keep every visible element editable MotionDoc content.",
        "Preserve one clear reporting message per slide.",
        "Validate and render the deck before completion."
      ]
    }
  },
  definition("moodboard", "marketing", true, 60, 14, ["Moodboard", "Brand", "Creative Direction"], {
    en: { description: "A 14-slide visual direction deck exploring typography, imagery, motion, texture, and composition.", name: "Moodboard", useCase: "Brand direction, visual research, and creative concept alignment" },
    "zh-TW": { description: "\u4EE5 14 \u9801\u63A2\u7D22\u5B57\u9AD4\u3001\u5F71\u50CF\u3001\u52D5\u614B\u3001\u6750\u8CEA\u8207\u69CB\u5716\u7684\u8996\u89BA\u65B9\u5411\u6A21\u677F\u3002", name: "\u60C5\u7DD2\u677F", useCase: "\u54C1\u724C\u65B9\u5411\u3001\u8996\u89BA\u7814\u7A76\u8207\u5275\u610F\u6982\u5FF5\u5C0D\u9F4A" }
  }, blueprint("Align a team on one coherent visual direction.", ["cover", "concept", "type", "palette", "imagery", "texture", "composition", "motion", "applications", "comparison", "principles", "system", "recommendation", "closing"], "Experimental editorial art direction with deliberate variation and a coherent visual world.", ["#111111", "#F5F0E8", "#D94B32", "#5C6CFF"], "Expressive display typography balanced by disciplined captions.", "Treat every image as material: crop, filter, sequence, and contrast consistently.", ["hero", "texture", "reference"]))
];
function definition(id, category, featured, sortOrder, slideCount, tags, locales, blueprintValue) {
  return {
    blueprint: blueprintValue,
    catalog: { author: "SlideX", category, featured, slideCount, sortOrder, tags },
    cover: "",
    id,
    locales
  };
}
function blueprint(objective, slideRoles, composition, colorTokens, typography, imageTreatment, imageRoles) {
  return {
    design: { colorTokens, composition, imageTreatment, typography },
    imageSlots: imageRoles.map((role) => ({ aspectRatio: role === "hero" ? "16:9" : "4:3", required: false, role })),
    layoutRoles: [...new Set(slideRoles)],
    narrative: { objective, slideRoles },
    prohibitions: [
      "Do not execute template code or add unregistered components.",
      "Do not preserve remote image URLs or Base64 media in OpenSlideX projects.",
      "Do not repeat one generic card grid across the deck."
    ],
    qaRules: [
      "Keep every visible element editable MotionDoc content.",
      "Validate the complete source and inspect rendered slides before completion.",
      "Preserve readable contrast, safe margins, and one dominant focal point per slide."
    ],
    schemaVersion: 1
  };
}

// node_modules/mdast-util-to-string/lib/index.js
var emptyOptions = {};
function toString(value, options) {
  const settings = options || emptyOptions;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one(value, includeImageAlt, includeHtml);
}
function one(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// node_modules/character-entities/index.js
var characterEntities = {
  AElig: "\xC6",
  AMP: "&",
  Aacute: "\xC1",
  Abreve: "\u0102",
  Acirc: "\xC2",
  Acy: "\u0410",
  Afr: "\u{1D504}",
  Agrave: "\xC0",
  Alpha: "\u0391",
  Amacr: "\u0100",
  And: "\u2A53",
  Aogon: "\u0104",
  Aopf: "\u{1D538}",
  ApplyFunction: "\u2061",
  Aring: "\xC5",
  Ascr: "\u{1D49C}",
  Assign: "\u2254",
  Atilde: "\xC3",
  Auml: "\xC4",
  Backslash: "\u2216",
  Barv: "\u2AE7",
  Barwed: "\u2306",
  Bcy: "\u0411",
  Because: "\u2235",
  Bernoullis: "\u212C",
  Beta: "\u0392",
  Bfr: "\u{1D505}",
  Bopf: "\u{1D539}",
  Breve: "\u02D8",
  Bscr: "\u212C",
  Bumpeq: "\u224E",
  CHcy: "\u0427",
  COPY: "\xA9",
  Cacute: "\u0106",
  Cap: "\u22D2",
  CapitalDifferentialD: "\u2145",
  Cayleys: "\u212D",
  Ccaron: "\u010C",
  Ccedil: "\xC7",
  Ccirc: "\u0108",
  Cconint: "\u2230",
  Cdot: "\u010A",
  Cedilla: "\xB8",
  CenterDot: "\xB7",
  Cfr: "\u212D",
  Chi: "\u03A7",
  CircleDot: "\u2299",
  CircleMinus: "\u2296",
  CirclePlus: "\u2295",
  CircleTimes: "\u2297",
  ClockwiseContourIntegral: "\u2232",
  CloseCurlyDoubleQuote: "\u201D",
  CloseCurlyQuote: "\u2019",
  Colon: "\u2237",
  Colone: "\u2A74",
  Congruent: "\u2261",
  Conint: "\u222F",
  ContourIntegral: "\u222E",
  Copf: "\u2102",
  Coproduct: "\u2210",
  CounterClockwiseContourIntegral: "\u2233",
  Cross: "\u2A2F",
  Cscr: "\u{1D49E}",
  Cup: "\u22D3",
  CupCap: "\u224D",
  DD: "\u2145",
  DDotrahd: "\u2911",
  DJcy: "\u0402",
  DScy: "\u0405",
  DZcy: "\u040F",
  Dagger: "\u2021",
  Darr: "\u21A1",
  Dashv: "\u2AE4",
  Dcaron: "\u010E",
  Dcy: "\u0414",
  Del: "\u2207",
  Delta: "\u0394",
  Dfr: "\u{1D507}",
  DiacriticalAcute: "\xB4",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  DiacriticalGrave: "`",
  DiacriticalTilde: "\u02DC",
  Diamond: "\u22C4",
  DifferentialD: "\u2146",
  Dopf: "\u{1D53B}",
  Dot: "\xA8",
  DotDot: "\u20DC",
  DotEqual: "\u2250",
  DoubleContourIntegral: "\u222F",
  DoubleDot: "\xA8",
  DoubleDownArrow: "\u21D3",
  DoubleLeftArrow: "\u21D0",
  DoubleLeftRightArrow: "\u21D4",
  DoubleLeftTee: "\u2AE4",
  DoubleLongLeftArrow: "\u27F8",
  DoubleLongLeftRightArrow: "\u27FA",
  DoubleLongRightArrow: "\u27F9",
  DoubleRightArrow: "\u21D2",
  DoubleRightTee: "\u22A8",
  DoubleUpArrow: "\u21D1",
  DoubleUpDownArrow: "\u21D5",
  DoubleVerticalBar: "\u2225",
  DownArrow: "\u2193",
  DownArrowBar: "\u2913",
  DownArrowUpArrow: "\u21F5",
  DownBreve: "\u0311",
  DownLeftRightVector: "\u2950",
  DownLeftTeeVector: "\u295E",
  DownLeftVector: "\u21BD",
  DownLeftVectorBar: "\u2956",
  DownRightTeeVector: "\u295F",
  DownRightVector: "\u21C1",
  DownRightVectorBar: "\u2957",
  DownTee: "\u22A4",
  DownTeeArrow: "\u21A7",
  Downarrow: "\u21D3",
  Dscr: "\u{1D49F}",
  Dstrok: "\u0110",
  ENG: "\u014A",
  ETH: "\xD0",
  Eacute: "\xC9",
  Ecaron: "\u011A",
  Ecirc: "\xCA",
  Ecy: "\u042D",
  Edot: "\u0116",
  Efr: "\u{1D508}",
  Egrave: "\xC8",
  Element: "\u2208",
  Emacr: "\u0112",
  EmptySmallSquare: "\u25FB",
  EmptyVerySmallSquare: "\u25AB",
  Eogon: "\u0118",
  Eopf: "\u{1D53C}",
  Epsilon: "\u0395",
  Equal: "\u2A75",
  EqualTilde: "\u2242",
  Equilibrium: "\u21CC",
  Escr: "\u2130",
  Esim: "\u2A73",
  Eta: "\u0397",
  Euml: "\xCB",
  Exists: "\u2203",
  ExponentialE: "\u2147",
  Fcy: "\u0424",
  Ffr: "\u{1D509}",
  FilledSmallSquare: "\u25FC",
  FilledVerySmallSquare: "\u25AA",
  Fopf: "\u{1D53D}",
  ForAll: "\u2200",
  Fouriertrf: "\u2131",
  Fscr: "\u2131",
  GJcy: "\u0403",
  GT: ">",
  Gamma: "\u0393",
  Gammad: "\u03DC",
  Gbreve: "\u011E",
  Gcedil: "\u0122",
  Gcirc: "\u011C",
  Gcy: "\u0413",
  Gdot: "\u0120",
  Gfr: "\u{1D50A}",
  Gg: "\u22D9",
  Gopf: "\u{1D53E}",
  GreaterEqual: "\u2265",
  GreaterEqualLess: "\u22DB",
  GreaterFullEqual: "\u2267",
  GreaterGreater: "\u2AA2",
  GreaterLess: "\u2277",
  GreaterSlantEqual: "\u2A7E",
  GreaterTilde: "\u2273",
  Gscr: "\u{1D4A2}",
  Gt: "\u226B",
  HARDcy: "\u042A",
  Hacek: "\u02C7",
  Hat: "^",
  Hcirc: "\u0124",
  Hfr: "\u210C",
  HilbertSpace: "\u210B",
  Hopf: "\u210D",
  HorizontalLine: "\u2500",
  Hscr: "\u210B",
  Hstrok: "\u0126",
  HumpDownHump: "\u224E",
  HumpEqual: "\u224F",
  IEcy: "\u0415",
  IJlig: "\u0132",
  IOcy: "\u0401",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Icy: "\u0418",
  Idot: "\u0130",
  Ifr: "\u2111",
  Igrave: "\xCC",
  Im: "\u2111",
  Imacr: "\u012A",
  ImaginaryI: "\u2148",
  Implies: "\u21D2",
  Int: "\u222C",
  Integral: "\u222B",
  Intersection: "\u22C2",
  InvisibleComma: "\u2063",
  InvisibleTimes: "\u2062",
  Iogon: "\u012E",
  Iopf: "\u{1D540}",
  Iota: "\u0399",
  Iscr: "\u2110",
  Itilde: "\u0128",
  Iukcy: "\u0406",
  Iuml: "\xCF",
  Jcirc: "\u0134",
  Jcy: "\u0419",
  Jfr: "\u{1D50D}",
  Jopf: "\u{1D541}",
  Jscr: "\u{1D4A5}",
  Jsercy: "\u0408",
  Jukcy: "\u0404",
  KHcy: "\u0425",
  KJcy: "\u040C",
  Kappa: "\u039A",
  Kcedil: "\u0136",
  Kcy: "\u041A",
  Kfr: "\u{1D50E}",
  Kopf: "\u{1D542}",
  Kscr: "\u{1D4A6}",
  LJcy: "\u0409",
  LT: "<",
  Lacute: "\u0139",
  Lambda: "\u039B",
  Lang: "\u27EA",
  Laplacetrf: "\u2112",
  Larr: "\u219E",
  Lcaron: "\u013D",
  Lcedil: "\u013B",
  Lcy: "\u041B",
  LeftAngleBracket: "\u27E8",
  LeftArrow: "\u2190",
  LeftArrowBar: "\u21E4",
  LeftArrowRightArrow: "\u21C6",
  LeftCeiling: "\u2308",
  LeftDoubleBracket: "\u27E6",
  LeftDownTeeVector: "\u2961",
  LeftDownVector: "\u21C3",
  LeftDownVectorBar: "\u2959",
  LeftFloor: "\u230A",
  LeftRightArrow: "\u2194",
  LeftRightVector: "\u294E",
  LeftTee: "\u22A3",
  LeftTeeArrow: "\u21A4",
  LeftTeeVector: "\u295A",
  LeftTriangle: "\u22B2",
  LeftTriangleBar: "\u29CF",
  LeftTriangleEqual: "\u22B4",
  LeftUpDownVector: "\u2951",
  LeftUpTeeVector: "\u2960",
  LeftUpVector: "\u21BF",
  LeftUpVectorBar: "\u2958",
  LeftVector: "\u21BC",
  LeftVectorBar: "\u2952",
  Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4",
  LessEqualGreater: "\u22DA",
  LessFullEqual: "\u2266",
  LessGreater: "\u2276",
  LessLess: "\u2AA1",
  LessSlantEqual: "\u2A7D",
  LessTilde: "\u2272",
  Lfr: "\u{1D50F}",
  Ll: "\u22D8",
  Lleftarrow: "\u21DA",
  Lmidot: "\u013F",
  LongLeftArrow: "\u27F5",
  LongLeftRightArrow: "\u27F7",
  LongRightArrow: "\u27F6",
  Longleftarrow: "\u27F8",
  Longleftrightarrow: "\u27FA",
  Longrightarrow: "\u27F9",
  Lopf: "\u{1D543}",
  LowerLeftArrow: "\u2199",
  LowerRightArrow: "\u2198",
  Lscr: "\u2112",
  Lsh: "\u21B0",
  Lstrok: "\u0141",
  Lt: "\u226A",
  Map: "\u2905",
  Mcy: "\u041C",
  MediumSpace: "\u205F",
  Mellintrf: "\u2133",
  Mfr: "\u{1D510}",
  MinusPlus: "\u2213",
  Mopf: "\u{1D544}",
  Mscr: "\u2133",
  Mu: "\u039C",
  NJcy: "\u040A",
  Nacute: "\u0143",
  Ncaron: "\u0147",
  Ncedil: "\u0145",
  Ncy: "\u041D",
  NegativeMediumSpace: "\u200B",
  NegativeThickSpace: "\u200B",
  NegativeThinSpace: "\u200B",
  NegativeVeryThinSpace: "\u200B",
  NestedGreaterGreater: "\u226B",
  NestedLessLess: "\u226A",
  NewLine: "\n",
  Nfr: "\u{1D511}",
  NoBreak: "\u2060",
  NonBreakingSpace: "\xA0",
  Nopf: "\u2115",
  Not: "\u2AEC",
  NotCongruent: "\u2262",
  NotCupCap: "\u226D",
  NotDoubleVerticalBar: "\u2226",
  NotElement: "\u2209",
  NotEqual: "\u2260",
  NotEqualTilde: "\u2242\u0338",
  NotExists: "\u2204",
  NotGreater: "\u226F",
  NotGreaterEqual: "\u2271",
  NotGreaterFullEqual: "\u2267\u0338",
  NotGreaterGreater: "\u226B\u0338",
  NotGreaterLess: "\u2279",
  NotGreaterSlantEqual: "\u2A7E\u0338",
  NotGreaterTilde: "\u2275",
  NotHumpDownHump: "\u224E\u0338",
  NotHumpEqual: "\u224F\u0338",
  NotLeftTriangle: "\u22EA",
  NotLeftTriangleBar: "\u29CF\u0338",
  NotLeftTriangleEqual: "\u22EC",
  NotLess: "\u226E",
  NotLessEqual: "\u2270",
  NotLessGreater: "\u2278",
  NotLessLess: "\u226A\u0338",
  NotLessSlantEqual: "\u2A7D\u0338",
  NotLessTilde: "\u2274",
  NotNestedGreaterGreater: "\u2AA2\u0338",
  NotNestedLessLess: "\u2AA1\u0338",
  NotPrecedes: "\u2280",
  NotPrecedesEqual: "\u2AAF\u0338",
  NotPrecedesSlantEqual: "\u22E0",
  NotReverseElement: "\u220C",
  NotRightTriangle: "\u22EB",
  NotRightTriangleBar: "\u29D0\u0338",
  NotRightTriangleEqual: "\u22ED",
  NotSquareSubset: "\u228F\u0338",
  NotSquareSubsetEqual: "\u22E2",
  NotSquareSuperset: "\u2290\u0338",
  NotSquareSupersetEqual: "\u22E3",
  NotSubset: "\u2282\u20D2",
  NotSubsetEqual: "\u2288",
  NotSucceeds: "\u2281",
  NotSucceedsEqual: "\u2AB0\u0338",
  NotSucceedsSlantEqual: "\u22E1",
  NotSucceedsTilde: "\u227F\u0338",
  NotSuperset: "\u2283\u20D2",
  NotSupersetEqual: "\u2289",
  NotTilde: "\u2241",
  NotTildeEqual: "\u2244",
  NotTildeFullEqual: "\u2247",
  NotTildeTilde: "\u2249",
  NotVerticalBar: "\u2224",
  Nscr: "\u{1D4A9}",
  Ntilde: "\xD1",
  Nu: "\u039D",
  OElig: "\u0152",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Ocy: "\u041E",
  Odblac: "\u0150",
  Ofr: "\u{1D512}",
  Ograve: "\xD2",
  Omacr: "\u014C",
  Omega: "\u03A9",
  Omicron: "\u039F",
  Oopf: "\u{1D546}",
  OpenCurlyDoubleQuote: "\u201C",
  OpenCurlyQuote: "\u2018",
  Or: "\u2A54",
  Oscr: "\u{1D4AA}",
  Oslash: "\xD8",
  Otilde: "\xD5",
  Otimes: "\u2A37",
  Ouml: "\xD6",
  OverBar: "\u203E",
  OverBrace: "\u23DE",
  OverBracket: "\u23B4",
  OverParenthesis: "\u23DC",
  PartialD: "\u2202",
  Pcy: "\u041F",
  Pfr: "\u{1D513}",
  Phi: "\u03A6",
  Pi: "\u03A0",
  PlusMinus: "\xB1",
  Poincareplane: "\u210C",
  Popf: "\u2119",
  Pr: "\u2ABB",
  Precedes: "\u227A",
  PrecedesEqual: "\u2AAF",
  PrecedesSlantEqual: "\u227C",
  PrecedesTilde: "\u227E",
  Prime: "\u2033",
  Product: "\u220F",
  Proportion: "\u2237",
  Proportional: "\u221D",
  Pscr: "\u{1D4AB}",
  Psi: "\u03A8",
  QUOT: '"',
  Qfr: "\u{1D514}",
  Qopf: "\u211A",
  Qscr: "\u{1D4AC}",
  RBarr: "\u2910",
  REG: "\xAE",
  Racute: "\u0154",
  Rang: "\u27EB",
  Rarr: "\u21A0",
  Rarrtl: "\u2916",
  Rcaron: "\u0158",
  Rcedil: "\u0156",
  Rcy: "\u0420",
  Re: "\u211C",
  ReverseElement: "\u220B",
  ReverseEquilibrium: "\u21CB",
  ReverseUpEquilibrium: "\u296F",
  Rfr: "\u211C",
  Rho: "\u03A1",
  RightAngleBracket: "\u27E9",
  RightArrow: "\u2192",
  RightArrowBar: "\u21E5",
  RightArrowLeftArrow: "\u21C4",
  RightCeiling: "\u2309",
  RightDoubleBracket: "\u27E7",
  RightDownTeeVector: "\u295D",
  RightDownVector: "\u21C2",
  RightDownVectorBar: "\u2955",
  RightFloor: "\u230B",
  RightTee: "\u22A2",
  RightTeeArrow: "\u21A6",
  RightTeeVector: "\u295B",
  RightTriangle: "\u22B3",
  RightTriangleBar: "\u29D0",
  RightTriangleEqual: "\u22B5",
  RightUpDownVector: "\u294F",
  RightUpTeeVector: "\u295C",
  RightUpVector: "\u21BE",
  RightUpVectorBar: "\u2954",
  RightVector: "\u21C0",
  RightVectorBar: "\u2953",
  Rightarrow: "\u21D2",
  Ropf: "\u211D",
  RoundImplies: "\u2970",
  Rrightarrow: "\u21DB",
  Rscr: "\u211B",
  Rsh: "\u21B1",
  RuleDelayed: "\u29F4",
  SHCHcy: "\u0429",
  SHcy: "\u0428",
  SOFTcy: "\u042C",
  Sacute: "\u015A",
  Sc: "\u2ABC",
  Scaron: "\u0160",
  Scedil: "\u015E",
  Scirc: "\u015C",
  Scy: "\u0421",
  Sfr: "\u{1D516}",
  ShortDownArrow: "\u2193",
  ShortLeftArrow: "\u2190",
  ShortRightArrow: "\u2192",
  ShortUpArrow: "\u2191",
  Sigma: "\u03A3",
  SmallCircle: "\u2218",
  Sopf: "\u{1D54A}",
  Sqrt: "\u221A",
  Square: "\u25A1",
  SquareIntersection: "\u2293",
  SquareSubset: "\u228F",
  SquareSubsetEqual: "\u2291",
  SquareSuperset: "\u2290",
  SquareSupersetEqual: "\u2292",
  SquareUnion: "\u2294",
  Sscr: "\u{1D4AE}",
  Star: "\u22C6",
  Sub: "\u22D0",
  Subset: "\u22D0",
  SubsetEqual: "\u2286",
  Succeeds: "\u227B",
  SucceedsEqual: "\u2AB0",
  SucceedsSlantEqual: "\u227D",
  SucceedsTilde: "\u227F",
  SuchThat: "\u220B",
  Sum: "\u2211",
  Sup: "\u22D1",
  Superset: "\u2283",
  SupersetEqual: "\u2287",
  Supset: "\u22D1",
  THORN: "\xDE",
  TRADE: "\u2122",
  TSHcy: "\u040B",
  TScy: "\u0426",
  Tab: "	",
  Tau: "\u03A4",
  Tcaron: "\u0164",
  Tcedil: "\u0162",
  Tcy: "\u0422",
  Tfr: "\u{1D517}",
  Therefore: "\u2234",
  Theta: "\u0398",
  ThickSpace: "\u205F\u200A",
  ThinSpace: "\u2009",
  Tilde: "\u223C",
  TildeEqual: "\u2243",
  TildeFullEqual: "\u2245",
  TildeTilde: "\u2248",
  Topf: "\u{1D54B}",
  TripleDot: "\u20DB",
  Tscr: "\u{1D4AF}",
  Tstrok: "\u0166",
  Uacute: "\xDA",
  Uarr: "\u219F",
  Uarrocir: "\u2949",
  Ubrcy: "\u040E",
  Ubreve: "\u016C",
  Ucirc: "\xDB",
  Ucy: "\u0423",
  Udblac: "\u0170",
  Ufr: "\u{1D518}",
  Ugrave: "\xD9",
  Umacr: "\u016A",
  UnderBar: "_",
  UnderBrace: "\u23DF",
  UnderBracket: "\u23B5",
  UnderParenthesis: "\u23DD",
  Union: "\u22C3",
  UnionPlus: "\u228E",
  Uogon: "\u0172",
  Uopf: "\u{1D54C}",
  UpArrow: "\u2191",
  UpArrowBar: "\u2912",
  UpArrowDownArrow: "\u21C5",
  UpDownArrow: "\u2195",
  UpEquilibrium: "\u296E",
  UpTee: "\u22A5",
  UpTeeArrow: "\u21A5",
  Uparrow: "\u21D1",
  Updownarrow: "\u21D5",
  UpperLeftArrow: "\u2196",
  UpperRightArrow: "\u2197",
  Upsi: "\u03D2",
  Upsilon: "\u03A5",
  Uring: "\u016E",
  Uscr: "\u{1D4B0}",
  Utilde: "\u0168",
  Uuml: "\xDC",
  VDash: "\u22AB",
  Vbar: "\u2AEB",
  Vcy: "\u0412",
  Vdash: "\u22A9",
  Vdashl: "\u2AE6",
  Vee: "\u22C1",
  Verbar: "\u2016",
  Vert: "\u2016",
  VerticalBar: "\u2223",
  VerticalLine: "|",
  VerticalSeparator: "\u2758",
  VerticalTilde: "\u2240",
  VeryThinSpace: "\u200A",
  Vfr: "\u{1D519}",
  Vopf: "\u{1D54D}",
  Vscr: "\u{1D4B1}",
  Vvdash: "\u22AA",
  Wcirc: "\u0174",
  Wedge: "\u22C0",
  Wfr: "\u{1D51A}",
  Wopf: "\u{1D54E}",
  Wscr: "\u{1D4B2}",
  Xfr: "\u{1D51B}",
  Xi: "\u039E",
  Xopf: "\u{1D54F}",
  Xscr: "\u{1D4B3}",
  YAcy: "\u042F",
  YIcy: "\u0407",
  YUcy: "\u042E",
  Yacute: "\xDD",
  Ycirc: "\u0176",
  Ycy: "\u042B",
  Yfr: "\u{1D51C}",
  Yopf: "\u{1D550}",
  Yscr: "\u{1D4B4}",
  Yuml: "\u0178",
  ZHcy: "\u0416",
  Zacute: "\u0179",
  Zcaron: "\u017D",
  Zcy: "\u0417",
  Zdot: "\u017B",
  ZeroWidthSpace: "\u200B",
  Zeta: "\u0396",
  Zfr: "\u2128",
  Zopf: "\u2124",
  Zscr: "\u{1D4B5}",
  aacute: "\xE1",
  abreve: "\u0103",
  ac: "\u223E",
  acE: "\u223E\u0333",
  acd: "\u223F",
  acirc: "\xE2",
  acute: "\xB4",
  acy: "\u0430",
  aelig: "\xE6",
  af: "\u2061",
  afr: "\u{1D51E}",
  agrave: "\xE0",
  alefsym: "\u2135",
  aleph: "\u2135",
  alpha: "\u03B1",
  amacr: "\u0101",
  amalg: "\u2A3F",
  amp: "&",
  and: "\u2227",
  andand: "\u2A55",
  andd: "\u2A5C",
  andslope: "\u2A58",
  andv: "\u2A5A",
  ang: "\u2220",
  ange: "\u29A4",
  angle: "\u2220",
  angmsd: "\u2221",
  angmsdaa: "\u29A8",
  angmsdab: "\u29A9",
  angmsdac: "\u29AA",
  angmsdad: "\u29AB",
  angmsdae: "\u29AC",
  angmsdaf: "\u29AD",
  angmsdag: "\u29AE",
  angmsdah: "\u29AF",
  angrt: "\u221F",
  angrtvb: "\u22BE",
  angrtvbd: "\u299D",
  angsph: "\u2222",
  angst: "\xC5",
  angzarr: "\u237C",
  aogon: "\u0105",
  aopf: "\u{1D552}",
  ap: "\u2248",
  apE: "\u2A70",
  apacir: "\u2A6F",
  ape: "\u224A",
  apid: "\u224B",
  apos: "'",
  approx: "\u2248",
  approxeq: "\u224A",
  aring: "\xE5",
  ascr: "\u{1D4B6}",
  ast: "*",
  asymp: "\u2248",
  asympeq: "\u224D",
  atilde: "\xE3",
  auml: "\xE4",
  awconint: "\u2233",
  awint: "\u2A11",
  bNot: "\u2AED",
  backcong: "\u224C",
  backepsilon: "\u03F6",
  backprime: "\u2035",
  backsim: "\u223D",
  backsimeq: "\u22CD",
  barvee: "\u22BD",
  barwed: "\u2305",
  barwedge: "\u2305",
  bbrk: "\u23B5",
  bbrktbrk: "\u23B6",
  bcong: "\u224C",
  bcy: "\u0431",
  bdquo: "\u201E",
  becaus: "\u2235",
  because: "\u2235",
  bemptyv: "\u29B0",
  bepsi: "\u03F6",
  bernou: "\u212C",
  beta: "\u03B2",
  beth: "\u2136",
  between: "\u226C",
  bfr: "\u{1D51F}",
  bigcap: "\u22C2",
  bigcirc: "\u25EF",
  bigcup: "\u22C3",
  bigodot: "\u2A00",
  bigoplus: "\u2A01",
  bigotimes: "\u2A02",
  bigsqcup: "\u2A06",
  bigstar: "\u2605",
  bigtriangledown: "\u25BD",
  bigtriangleup: "\u25B3",
  biguplus: "\u2A04",
  bigvee: "\u22C1",
  bigwedge: "\u22C0",
  bkarow: "\u290D",
  blacklozenge: "\u29EB",
  blacksquare: "\u25AA",
  blacktriangle: "\u25B4",
  blacktriangledown: "\u25BE",
  blacktriangleleft: "\u25C2",
  blacktriangleright: "\u25B8",
  blank: "\u2423",
  blk12: "\u2592",
  blk14: "\u2591",
  blk34: "\u2593",
  block: "\u2588",
  bne: "=\u20E5",
  bnequiv: "\u2261\u20E5",
  bnot: "\u2310",
  bopf: "\u{1D553}",
  bot: "\u22A5",
  bottom: "\u22A5",
  bowtie: "\u22C8",
  boxDL: "\u2557",
  boxDR: "\u2554",
  boxDl: "\u2556",
  boxDr: "\u2553",
  boxH: "\u2550",
  boxHD: "\u2566",
  boxHU: "\u2569",
  boxHd: "\u2564",
  boxHu: "\u2567",
  boxUL: "\u255D",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxUr: "\u2559",
  boxV: "\u2551",
  boxVH: "\u256C",
  boxVL: "\u2563",
  boxVR: "\u2560",
  boxVh: "\u256B",
  boxVl: "\u2562",
  boxVr: "\u255F",
  boxbox: "\u29C9",
  boxdL: "\u2555",
  boxdR: "\u2552",
  boxdl: "\u2510",
  boxdr: "\u250C",
  boxh: "\u2500",
  boxhD: "\u2565",
  boxhU: "\u2568",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxminus: "\u229F",
  boxplus: "\u229E",
  boxtimes: "\u22A0",
  boxuL: "\u255B",
  boxuR: "\u2558",
  boxul: "\u2518",
  boxur: "\u2514",
  boxv: "\u2502",
  boxvH: "\u256A",
  boxvL: "\u2561",
  boxvR: "\u255E",
  boxvh: "\u253C",
  boxvl: "\u2524",
  boxvr: "\u251C",
  bprime: "\u2035",
  breve: "\u02D8",
  brvbar: "\xA6",
  bscr: "\u{1D4B7}",
  bsemi: "\u204F",
  bsim: "\u223D",
  bsime: "\u22CD",
  bsol: "\\",
  bsolb: "\u29C5",
  bsolhsub: "\u27C8",
  bull: "\u2022",
  bullet: "\u2022",
  bump: "\u224E",
  bumpE: "\u2AAE",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  cacute: "\u0107",
  cap: "\u2229",
  capand: "\u2A44",
  capbrcup: "\u2A49",
  capcap: "\u2A4B",
  capcup: "\u2A47",
  capdot: "\u2A40",
  caps: "\u2229\uFE00",
  caret: "\u2041",
  caron: "\u02C7",
  ccaps: "\u2A4D",
  ccaron: "\u010D",
  ccedil: "\xE7",
  ccirc: "\u0109",
  ccups: "\u2A4C",
  ccupssm: "\u2A50",
  cdot: "\u010B",
  cedil: "\xB8",
  cemptyv: "\u29B2",
  cent: "\xA2",
  centerdot: "\xB7",
  cfr: "\u{1D520}",
  chcy: "\u0447",
  check: "\u2713",
  checkmark: "\u2713",
  chi: "\u03C7",
  cir: "\u25CB",
  cirE: "\u29C3",
  circ: "\u02C6",
  circeq: "\u2257",
  circlearrowleft: "\u21BA",
  circlearrowright: "\u21BB",
  circledR: "\xAE",
  circledS: "\u24C8",
  circledast: "\u229B",
  circledcirc: "\u229A",
  circleddash: "\u229D",
  cire: "\u2257",
  cirfnint: "\u2A10",
  cirmid: "\u2AEF",
  cirscir: "\u29C2",
  clubs: "\u2663",
  clubsuit: "\u2663",
  colon: ":",
  colone: "\u2254",
  coloneq: "\u2254",
  comma: ",",
  commat: "@",
  comp: "\u2201",
  compfn: "\u2218",
  complement: "\u2201",
  complexes: "\u2102",
  cong: "\u2245",
  congdot: "\u2A6D",
  conint: "\u222E",
  copf: "\u{1D554}",
  coprod: "\u2210",
  copy: "\xA9",
  copysr: "\u2117",
  crarr: "\u21B5",
  cross: "\u2717",
  cscr: "\u{1D4B8}",
  csub: "\u2ACF",
  csube: "\u2AD1",
  csup: "\u2AD0",
  csupe: "\u2AD2",
  ctdot: "\u22EF",
  cudarrl: "\u2938",
  cudarrr: "\u2935",
  cuepr: "\u22DE",
  cuesc: "\u22DF",
  cularr: "\u21B6",
  cularrp: "\u293D",
  cup: "\u222A",
  cupbrcap: "\u2A48",
  cupcap: "\u2A46",
  cupcup: "\u2A4A",
  cupdot: "\u228D",
  cupor: "\u2A45",
  cups: "\u222A\uFE00",
  curarr: "\u21B7",
  curarrm: "\u293C",
  curlyeqprec: "\u22DE",
  curlyeqsucc: "\u22DF",
  curlyvee: "\u22CE",
  curlywedge: "\u22CF",
  curren: "\xA4",
  curvearrowleft: "\u21B6",
  curvearrowright: "\u21B7",
  cuvee: "\u22CE",
  cuwed: "\u22CF",
  cwconint: "\u2232",
  cwint: "\u2231",
  cylcty: "\u232D",
  dArr: "\u21D3",
  dHar: "\u2965",
  dagger: "\u2020",
  daleth: "\u2138",
  darr: "\u2193",
  dash: "\u2010",
  dashv: "\u22A3",
  dbkarow: "\u290F",
  dblac: "\u02DD",
  dcaron: "\u010F",
  dcy: "\u0434",
  dd: "\u2146",
  ddagger: "\u2021",
  ddarr: "\u21CA",
  ddotseq: "\u2A77",
  deg: "\xB0",
  delta: "\u03B4",
  demptyv: "\u29B1",
  dfisht: "\u297F",
  dfr: "\u{1D521}",
  dharl: "\u21C3",
  dharr: "\u21C2",
  diam: "\u22C4",
  diamond: "\u22C4",
  diamondsuit: "\u2666",
  diams: "\u2666",
  die: "\xA8",
  digamma: "\u03DD",
  disin: "\u22F2",
  div: "\xF7",
  divide: "\xF7",
  divideontimes: "\u22C7",
  divonx: "\u22C7",
  djcy: "\u0452",
  dlcorn: "\u231E",
  dlcrop: "\u230D",
  dollar: "$",
  dopf: "\u{1D555}",
  dot: "\u02D9",
  doteq: "\u2250",
  doteqdot: "\u2251",
  dotminus: "\u2238",
  dotplus: "\u2214",
  dotsquare: "\u22A1",
  doublebarwedge: "\u2306",
  downarrow: "\u2193",
  downdownarrows: "\u21CA",
  downharpoonleft: "\u21C3",
  downharpoonright: "\u21C2",
  drbkarow: "\u2910",
  drcorn: "\u231F",
  drcrop: "\u230C",
  dscr: "\u{1D4B9}",
  dscy: "\u0455",
  dsol: "\u29F6",
  dstrok: "\u0111",
  dtdot: "\u22F1",
  dtri: "\u25BF",
  dtrif: "\u25BE",
  duarr: "\u21F5",
  duhar: "\u296F",
  dwangle: "\u29A6",
  dzcy: "\u045F",
  dzigrarr: "\u27FF",
  eDDot: "\u2A77",
  eDot: "\u2251",
  eacute: "\xE9",
  easter: "\u2A6E",
  ecaron: "\u011B",
  ecir: "\u2256",
  ecirc: "\xEA",
  ecolon: "\u2255",
  ecy: "\u044D",
  edot: "\u0117",
  ee: "\u2147",
  efDot: "\u2252",
  efr: "\u{1D522}",
  eg: "\u2A9A",
  egrave: "\xE8",
  egs: "\u2A96",
  egsdot: "\u2A98",
  el: "\u2A99",
  elinters: "\u23E7",
  ell: "\u2113",
  els: "\u2A95",
  elsdot: "\u2A97",
  emacr: "\u0113",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  emsp13: "\u2004",
  emsp14: "\u2005",
  emsp: "\u2003",
  eng: "\u014B",
  ensp: "\u2002",
  eogon: "\u0119",
  eopf: "\u{1D556}",
  epar: "\u22D5",
  eparsl: "\u29E3",
  eplus: "\u2A71",
  epsi: "\u03B5",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  eqcirc: "\u2256",
  eqcolon: "\u2255",
  eqsim: "\u2242",
  eqslantgtr: "\u2A96",
  eqslantless: "\u2A95",
  equals: "=",
  equest: "\u225F",
  equiv: "\u2261",
  equivDD: "\u2A78",
  eqvparsl: "\u29E5",
  erDot: "\u2253",
  erarr: "\u2971",
  escr: "\u212F",
  esdot: "\u2250",
  esim: "\u2242",
  eta: "\u03B7",
  eth: "\xF0",
  euml: "\xEB",
  euro: "\u20AC",
  excl: "!",
  exist: "\u2203",
  expectation: "\u2130",
  exponentiale: "\u2147",
  fallingdotseq: "\u2252",
  fcy: "\u0444",
  female: "\u2640",
  ffilig: "\uFB03",
  fflig: "\uFB00",
  ffllig: "\uFB04",
  ffr: "\u{1D523}",
  filig: "\uFB01",
  fjlig: "fj",
  flat: "\u266D",
  fllig: "\uFB02",
  fltns: "\u25B1",
  fnof: "\u0192",
  fopf: "\u{1D557}",
  forall: "\u2200",
  fork: "\u22D4",
  forkv: "\u2AD9",
  fpartint: "\u2A0D",
  frac12: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044",
  frown: "\u2322",
  fscr: "\u{1D4BB}",
  gE: "\u2267",
  gEl: "\u2A8C",
  gacute: "\u01F5",
  gamma: "\u03B3",
  gammad: "\u03DD",
  gap: "\u2A86",
  gbreve: "\u011F",
  gcirc: "\u011D",
  gcy: "\u0433",
  gdot: "\u0121",
  ge: "\u2265",
  gel: "\u22DB",
  geq: "\u2265",
  geqq: "\u2267",
  geqslant: "\u2A7E",
  ges: "\u2A7E",
  gescc: "\u2AA9",
  gesdot: "\u2A80",
  gesdoto: "\u2A82",
  gesdotol: "\u2A84",
  gesl: "\u22DB\uFE00",
  gesles: "\u2A94",
  gfr: "\u{1D524}",
  gg: "\u226B",
  ggg: "\u22D9",
  gimel: "\u2137",
  gjcy: "\u0453",
  gl: "\u2277",
  glE: "\u2A92",
  gla: "\u2AA5",
  glj: "\u2AA4",
  gnE: "\u2269",
  gnap: "\u2A8A",
  gnapprox: "\u2A8A",
  gne: "\u2A88",
  gneq: "\u2A88",
  gneqq: "\u2269",
  gnsim: "\u22E7",
  gopf: "\u{1D558}",
  grave: "`",
  gscr: "\u210A",
  gsim: "\u2273",
  gsime: "\u2A8E",
  gsiml: "\u2A90",
  gt: ">",
  gtcc: "\u2AA7",
  gtcir: "\u2A7A",
  gtdot: "\u22D7",
  gtlPar: "\u2995",
  gtquest: "\u2A7C",
  gtrapprox: "\u2A86",
  gtrarr: "\u2978",
  gtrdot: "\u22D7",
  gtreqless: "\u22DB",
  gtreqqless: "\u2A8C",
  gtrless: "\u2277",
  gtrsim: "\u2273",
  gvertneqq: "\u2269\uFE00",
  gvnE: "\u2269\uFE00",
  hArr: "\u21D4",
  hairsp: "\u200A",
  half: "\xBD",
  hamilt: "\u210B",
  hardcy: "\u044A",
  harr: "\u2194",
  harrcir: "\u2948",
  harrw: "\u21AD",
  hbar: "\u210F",
  hcirc: "\u0125",
  hearts: "\u2665",
  heartsuit: "\u2665",
  hellip: "\u2026",
  hercon: "\u22B9",
  hfr: "\u{1D525}",
  hksearow: "\u2925",
  hkswarow: "\u2926",
  hoarr: "\u21FF",
  homtht: "\u223B",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  hopf: "\u{1D559}",
  horbar: "\u2015",
  hscr: "\u{1D4BD}",
  hslash: "\u210F",
  hstrok: "\u0127",
  hybull: "\u2043",
  hyphen: "\u2010",
  iacute: "\xED",
  ic: "\u2063",
  icirc: "\xEE",
  icy: "\u0438",
  iecy: "\u0435",
  iexcl: "\xA1",
  iff: "\u21D4",
  ifr: "\u{1D526}",
  igrave: "\xEC",
  ii: "\u2148",
  iiiint: "\u2A0C",
  iiint: "\u222D",
  iinfin: "\u29DC",
  iiota: "\u2129",
  ijlig: "\u0133",
  imacr: "\u012B",
  image: "\u2111",
  imagline: "\u2110",
  imagpart: "\u2111",
  imath: "\u0131",
  imof: "\u22B7",
  imped: "\u01B5",
  in: "\u2208",
  incare: "\u2105",
  infin: "\u221E",
  infintie: "\u29DD",
  inodot: "\u0131",
  int: "\u222B",
  intcal: "\u22BA",
  integers: "\u2124",
  intercal: "\u22BA",
  intlarhk: "\u2A17",
  intprod: "\u2A3C",
  iocy: "\u0451",
  iogon: "\u012F",
  iopf: "\u{1D55A}",
  iota: "\u03B9",
  iprod: "\u2A3C",
  iquest: "\xBF",
  iscr: "\u{1D4BE}",
  isin: "\u2208",
  isinE: "\u22F9",
  isindot: "\u22F5",
  isins: "\u22F4",
  isinsv: "\u22F3",
  isinv: "\u2208",
  it: "\u2062",
  itilde: "\u0129",
  iukcy: "\u0456",
  iuml: "\xEF",
  jcirc: "\u0135",
  jcy: "\u0439",
  jfr: "\u{1D527}",
  jmath: "\u0237",
  jopf: "\u{1D55B}",
  jscr: "\u{1D4BF}",
  jsercy: "\u0458",
  jukcy: "\u0454",
  kappa: "\u03BA",
  kappav: "\u03F0",
  kcedil: "\u0137",
  kcy: "\u043A",
  kfr: "\u{1D528}",
  kgreen: "\u0138",
  khcy: "\u0445",
  kjcy: "\u045C",
  kopf: "\u{1D55C}",
  kscr: "\u{1D4C0}",
  lAarr: "\u21DA",
  lArr: "\u21D0",
  lAtail: "\u291B",
  lBarr: "\u290E",
  lE: "\u2266",
  lEg: "\u2A8B",
  lHar: "\u2962",
  lacute: "\u013A",
  laemptyv: "\u29B4",
  lagran: "\u2112",
  lambda: "\u03BB",
  lang: "\u27E8",
  langd: "\u2991",
  langle: "\u27E8",
  lap: "\u2A85",
  laquo: "\xAB",
  larr: "\u2190",
  larrb: "\u21E4",
  larrbfs: "\u291F",
  larrfs: "\u291D",
  larrhk: "\u21A9",
  larrlp: "\u21AB",
  larrpl: "\u2939",
  larrsim: "\u2973",
  larrtl: "\u21A2",
  lat: "\u2AAB",
  latail: "\u2919",
  late: "\u2AAD",
  lates: "\u2AAD\uFE00",
  lbarr: "\u290C",
  lbbrk: "\u2772",
  lbrace: "{",
  lbrack: "[",
  lbrke: "\u298B",
  lbrksld: "\u298F",
  lbrkslu: "\u298D",
  lcaron: "\u013E",
  lcedil: "\u013C",
  lceil: "\u2308",
  lcub: "{",
  lcy: "\u043B",
  ldca: "\u2936",
  ldquo: "\u201C",
  ldquor: "\u201E",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  ldsh: "\u21B2",
  le: "\u2264",
  leftarrow: "\u2190",
  leftarrowtail: "\u21A2",
  leftharpoondown: "\u21BD",
  leftharpoonup: "\u21BC",
  leftleftarrows: "\u21C7",
  leftrightarrow: "\u2194",
  leftrightarrows: "\u21C6",
  leftrightharpoons: "\u21CB",
  leftrightsquigarrow: "\u21AD",
  leftthreetimes: "\u22CB",
  leg: "\u22DA",
  leq: "\u2264",
  leqq: "\u2266",
  leqslant: "\u2A7D",
  les: "\u2A7D",
  lescc: "\u2AA8",
  lesdot: "\u2A7F",
  lesdoto: "\u2A81",
  lesdotor: "\u2A83",
  lesg: "\u22DA\uFE00",
  lesges: "\u2A93",
  lessapprox: "\u2A85",
  lessdot: "\u22D6",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  lessgtr: "\u2276",
  lesssim: "\u2272",
  lfisht: "\u297C",
  lfloor: "\u230A",
  lfr: "\u{1D529}",
  lg: "\u2276",
  lgE: "\u2A91",
  lhard: "\u21BD",
  lharu: "\u21BC",
  lharul: "\u296A",
  lhblk: "\u2584",
  ljcy: "\u0459",
  ll: "\u226A",
  llarr: "\u21C7",
  llcorner: "\u231E",
  llhard: "\u296B",
  lltri: "\u25FA",
  lmidot: "\u0140",
  lmoust: "\u23B0",
  lmoustache: "\u23B0",
  lnE: "\u2268",
  lnap: "\u2A89",
  lnapprox: "\u2A89",
  lne: "\u2A87",
  lneq: "\u2A87",
  lneqq: "\u2268",
  lnsim: "\u22E6",
  loang: "\u27EC",
  loarr: "\u21FD",
  lobrk: "\u27E6",
  longleftarrow: "\u27F5",
  longleftrightarrow: "\u27F7",
  longmapsto: "\u27FC",
  longrightarrow: "\u27F6",
  looparrowleft: "\u21AB",
  looparrowright: "\u21AC",
  lopar: "\u2985",
  lopf: "\u{1D55D}",
  loplus: "\u2A2D",
  lotimes: "\u2A34",
  lowast: "\u2217",
  lowbar: "_",
  loz: "\u25CA",
  lozenge: "\u25CA",
  lozf: "\u29EB",
  lpar: "(",
  lparlt: "\u2993",
  lrarr: "\u21C6",
  lrcorner: "\u231F",
  lrhar: "\u21CB",
  lrhard: "\u296D",
  lrm: "\u200E",
  lrtri: "\u22BF",
  lsaquo: "\u2039",
  lscr: "\u{1D4C1}",
  lsh: "\u21B0",
  lsim: "\u2272",
  lsime: "\u2A8D",
  lsimg: "\u2A8F",
  lsqb: "[",
  lsquo: "\u2018",
  lsquor: "\u201A",
  lstrok: "\u0142",
  lt: "<",
  ltcc: "\u2AA6",
  ltcir: "\u2A79",
  ltdot: "\u22D6",
  lthree: "\u22CB",
  ltimes: "\u22C9",
  ltlarr: "\u2976",
  ltquest: "\u2A7B",
  ltrPar: "\u2996",
  ltri: "\u25C3",
  ltrie: "\u22B4",
  ltrif: "\u25C2",
  lurdshar: "\u294A",
  luruhar: "\u2966",
  lvertneqq: "\u2268\uFE00",
  lvnE: "\u2268\uFE00",
  mDDot: "\u223A",
  macr: "\xAF",
  male: "\u2642",
  malt: "\u2720",
  maltese: "\u2720",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  marker: "\u25AE",
  mcomma: "\u2A29",
  mcy: "\u043C",
  mdash: "\u2014",
  measuredangle: "\u2221",
  mfr: "\u{1D52A}",
  mho: "\u2127",
  micro: "\xB5",
  mid: "\u2223",
  midast: "*",
  midcir: "\u2AF0",
  middot: "\xB7",
  minus: "\u2212",
  minusb: "\u229F",
  minusd: "\u2238",
  minusdu: "\u2A2A",
  mlcp: "\u2ADB",
  mldr: "\u2026",
  mnplus: "\u2213",
  models: "\u22A7",
  mopf: "\u{1D55E}",
  mp: "\u2213",
  mscr: "\u{1D4C2}",
  mstpos: "\u223E",
  mu: "\u03BC",
  multimap: "\u22B8",
  mumap: "\u22B8",
  nGg: "\u22D9\u0338",
  nGt: "\u226B\u20D2",
  nGtv: "\u226B\u0338",
  nLeftarrow: "\u21CD",
  nLeftrightarrow: "\u21CE",
  nLl: "\u22D8\u0338",
  nLt: "\u226A\u20D2",
  nLtv: "\u226A\u0338",
  nRightarrow: "\u21CF",
  nVDash: "\u22AF",
  nVdash: "\u22AE",
  nabla: "\u2207",
  nacute: "\u0144",
  nang: "\u2220\u20D2",
  nap: "\u2249",
  napE: "\u2A70\u0338",
  napid: "\u224B\u0338",
  napos: "\u0149",
  napprox: "\u2249",
  natur: "\u266E",
  natural: "\u266E",
  naturals: "\u2115",
  nbsp: "\xA0",
  nbump: "\u224E\u0338",
  nbumpe: "\u224F\u0338",
  ncap: "\u2A43",
  ncaron: "\u0148",
  ncedil: "\u0146",
  ncong: "\u2247",
  ncongdot: "\u2A6D\u0338",
  ncup: "\u2A42",
  ncy: "\u043D",
  ndash: "\u2013",
  ne: "\u2260",
  neArr: "\u21D7",
  nearhk: "\u2924",
  nearr: "\u2197",
  nearrow: "\u2197",
  nedot: "\u2250\u0338",
  nequiv: "\u2262",
  nesear: "\u2928",
  nesim: "\u2242\u0338",
  nexist: "\u2204",
  nexists: "\u2204",
  nfr: "\u{1D52B}",
  ngE: "\u2267\u0338",
  nge: "\u2271",
  ngeq: "\u2271",
  ngeqq: "\u2267\u0338",
  ngeqslant: "\u2A7E\u0338",
  nges: "\u2A7E\u0338",
  ngsim: "\u2275",
  ngt: "\u226F",
  ngtr: "\u226F",
  nhArr: "\u21CE",
  nharr: "\u21AE",
  nhpar: "\u2AF2",
  ni: "\u220B",
  nis: "\u22FC",
  nisd: "\u22FA",
  niv: "\u220B",
  njcy: "\u045A",
  nlArr: "\u21CD",
  nlE: "\u2266\u0338",
  nlarr: "\u219A",
  nldr: "\u2025",
  nle: "\u2270",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nleq: "\u2270",
  nleqq: "\u2266\u0338",
  nleqslant: "\u2A7D\u0338",
  nles: "\u2A7D\u0338",
  nless: "\u226E",
  nlsim: "\u2274",
  nlt: "\u226E",
  nltri: "\u22EA",
  nltrie: "\u22EC",
  nmid: "\u2224",
  nopf: "\u{1D55F}",
  not: "\xAC",
  notin: "\u2209",
  notinE: "\u22F9\u0338",
  notindot: "\u22F5\u0338",
  notinva: "\u2209",
  notinvb: "\u22F7",
  notinvc: "\u22F6",
  notni: "\u220C",
  notniva: "\u220C",
  notnivb: "\u22FE",
  notnivc: "\u22FD",
  npar: "\u2226",
  nparallel: "\u2226",
  nparsl: "\u2AFD\u20E5",
  npart: "\u2202\u0338",
  npolint: "\u2A14",
  npr: "\u2280",
  nprcue: "\u22E0",
  npre: "\u2AAF\u0338",
  nprec: "\u2280",
  npreceq: "\u2AAF\u0338",
  nrArr: "\u21CF",
  nrarr: "\u219B",
  nrarrc: "\u2933\u0338",
  nrarrw: "\u219D\u0338",
  nrightarrow: "\u219B",
  nrtri: "\u22EB",
  nrtrie: "\u22ED",
  nsc: "\u2281",
  nsccue: "\u22E1",
  nsce: "\u2AB0\u0338",
  nscr: "\u{1D4C3}",
  nshortmid: "\u2224",
  nshortparallel: "\u2226",
  nsim: "\u2241",
  nsime: "\u2244",
  nsimeq: "\u2244",
  nsmid: "\u2224",
  nspar: "\u2226",
  nsqsube: "\u22E2",
  nsqsupe: "\u22E3",
  nsub: "\u2284",
  nsubE: "\u2AC5\u0338",
  nsube: "\u2288",
  nsubset: "\u2282\u20D2",
  nsubseteq: "\u2288",
  nsubseteqq: "\u2AC5\u0338",
  nsucc: "\u2281",
  nsucceq: "\u2AB0\u0338",
  nsup: "\u2285",
  nsupE: "\u2AC6\u0338",
  nsupe: "\u2289",
  nsupset: "\u2283\u20D2",
  nsupseteq: "\u2289",
  nsupseteqq: "\u2AC6\u0338",
  ntgl: "\u2279",
  ntilde: "\xF1",
  ntlg: "\u2278",
  ntriangleleft: "\u22EA",
  ntrianglelefteq: "\u22EC",
  ntriangleright: "\u22EB",
  ntrianglerighteq: "\u22ED",
  nu: "\u03BD",
  num: "#",
  numero: "\u2116",
  numsp: "\u2007",
  nvDash: "\u22AD",
  nvHarr: "\u2904",
  nvap: "\u224D\u20D2",
  nvdash: "\u22AC",
  nvge: "\u2265\u20D2",
  nvgt: ">\u20D2",
  nvinfin: "\u29DE",
  nvlArr: "\u2902",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrArr: "\u2903",
  nvrtrie: "\u22B5\u20D2",
  nvsim: "\u223C\u20D2",
  nwArr: "\u21D6",
  nwarhk: "\u2923",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  nwnear: "\u2927",
  oS: "\u24C8",
  oacute: "\xF3",
  oast: "\u229B",
  ocir: "\u229A",
  ocirc: "\xF4",
  ocy: "\u043E",
  odash: "\u229D",
  odblac: "\u0151",
  odiv: "\u2A38",
  odot: "\u2299",
  odsold: "\u29BC",
  oelig: "\u0153",
  ofcir: "\u29BF",
  ofr: "\u{1D52C}",
  ogon: "\u02DB",
  ograve: "\xF2",
  ogt: "\u29C1",
  ohbar: "\u29B5",
  ohm: "\u03A9",
  oint: "\u222E",
  olarr: "\u21BA",
  olcir: "\u29BE",
  olcross: "\u29BB",
  oline: "\u203E",
  olt: "\u29C0",
  omacr: "\u014D",
  omega: "\u03C9",
  omicron: "\u03BF",
  omid: "\u29B6",
  ominus: "\u2296",
  oopf: "\u{1D560}",
  opar: "\u29B7",
  operp: "\u29B9",
  oplus: "\u2295",
  or: "\u2228",
  orarr: "\u21BB",
  ord: "\u2A5D",
  order: "\u2134",
  orderof: "\u2134",
  ordf: "\xAA",
  ordm: "\xBA",
  origof: "\u22B6",
  oror: "\u2A56",
  orslope: "\u2A57",
  orv: "\u2A5B",
  oscr: "\u2134",
  oslash: "\xF8",
  osol: "\u2298",
  otilde: "\xF5",
  otimes: "\u2297",
  otimesas: "\u2A36",
  ouml: "\xF6",
  ovbar: "\u233D",
  par: "\u2225",
  para: "\xB6",
  parallel: "\u2225",
  parsim: "\u2AF3",
  parsl: "\u2AFD",
  part: "\u2202",
  pcy: "\u043F",
  percnt: "%",
  period: ".",
  permil: "\u2030",
  perp: "\u22A5",
  pertenk: "\u2031",
  pfr: "\u{1D52D}",
  phi: "\u03C6",
  phiv: "\u03D5",
  phmmat: "\u2133",
  phone: "\u260E",
  pi: "\u03C0",
  pitchfork: "\u22D4",
  piv: "\u03D6",
  planck: "\u210F",
  planckh: "\u210E",
  plankv: "\u210F",
  plus: "+",
  plusacir: "\u2A23",
  plusb: "\u229E",
  pluscir: "\u2A22",
  plusdo: "\u2214",
  plusdu: "\u2A25",
  pluse: "\u2A72",
  plusmn: "\xB1",
  plussim: "\u2A26",
  plustwo: "\u2A27",
  pm: "\xB1",
  pointint: "\u2A15",
  popf: "\u{1D561}",
  pound: "\xA3",
  pr: "\u227A",
  prE: "\u2AB3",
  prap: "\u2AB7",
  prcue: "\u227C",
  pre: "\u2AAF",
  prec: "\u227A",
  precapprox: "\u2AB7",
  preccurlyeq: "\u227C",
  preceq: "\u2AAF",
  precnapprox: "\u2AB9",
  precneqq: "\u2AB5",
  precnsim: "\u22E8",
  precsim: "\u227E",
  prime: "\u2032",
  primes: "\u2119",
  prnE: "\u2AB5",
  prnap: "\u2AB9",
  prnsim: "\u22E8",
  prod: "\u220F",
  profalar: "\u232E",
  profline: "\u2312",
  profsurf: "\u2313",
  prop: "\u221D",
  propto: "\u221D",
  prsim: "\u227E",
  prurel: "\u22B0",
  pscr: "\u{1D4C5}",
  psi: "\u03C8",
  puncsp: "\u2008",
  qfr: "\u{1D52E}",
  qint: "\u2A0C",
  qopf: "\u{1D562}",
  qprime: "\u2057",
  qscr: "\u{1D4C6}",
  quaternions: "\u210D",
  quatint: "\u2A16",
  quest: "?",
  questeq: "\u225F",
  quot: '"',
  rAarr: "\u21DB",
  rArr: "\u21D2",
  rAtail: "\u291C",
  rBarr: "\u290F",
  rHar: "\u2964",
  race: "\u223D\u0331",
  racute: "\u0155",
  radic: "\u221A",
  raemptyv: "\u29B3",
  rang: "\u27E9",
  rangd: "\u2992",
  range: "\u29A5",
  rangle: "\u27E9",
  raquo: "\xBB",
  rarr: "\u2192",
  rarrap: "\u2975",
  rarrb: "\u21E5",
  rarrbfs: "\u2920",
  rarrc: "\u2933",
  rarrfs: "\u291E",
  rarrhk: "\u21AA",
  rarrlp: "\u21AC",
  rarrpl: "\u2945",
  rarrsim: "\u2974",
  rarrtl: "\u21A3",
  rarrw: "\u219D",
  ratail: "\u291A",
  ratio: "\u2236",
  rationals: "\u211A",
  rbarr: "\u290D",
  rbbrk: "\u2773",
  rbrace: "}",
  rbrack: "]",
  rbrke: "\u298C",
  rbrksld: "\u298E",
  rbrkslu: "\u2990",
  rcaron: "\u0159",
  rcedil: "\u0157",
  rceil: "\u2309",
  rcub: "}",
  rcy: "\u0440",
  rdca: "\u2937",
  rdldhar: "\u2969",
  rdquo: "\u201D",
  rdquor: "\u201D",
  rdsh: "\u21B3",
  real: "\u211C",
  realine: "\u211B",
  realpart: "\u211C",
  reals: "\u211D",
  rect: "\u25AD",
  reg: "\xAE",
  rfisht: "\u297D",
  rfloor: "\u230B",
  rfr: "\u{1D52F}",
  rhard: "\u21C1",
  rharu: "\u21C0",
  rharul: "\u296C",
  rho: "\u03C1",
  rhov: "\u03F1",
  rightarrow: "\u2192",
  rightarrowtail: "\u21A3",
  rightharpoondown: "\u21C1",
  rightharpoonup: "\u21C0",
  rightleftarrows: "\u21C4",
  rightleftharpoons: "\u21CC",
  rightrightarrows: "\u21C9",
  rightsquigarrow: "\u219D",
  rightthreetimes: "\u22CC",
  ring: "\u02DA",
  risingdotseq: "\u2253",
  rlarr: "\u21C4",
  rlhar: "\u21CC",
  rlm: "\u200F",
  rmoust: "\u23B1",
  rmoustache: "\u23B1",
  rnmid: "\u2AEE",
  roang: "\u27ED",
  roarr: "\u21FE",
  robrk: "\u27E7",
  ropar: "\u2986",
  ropf: "\u{1D563}",
  roplus: "\u2A2E",
  rotimes: "\u2A35",
  rpar: ")",
  rpargt: "\u2994",
  rppolint: "\u2A12",
  rrarr: "\u21C9",
  rsaquo: "\u203A",
  rscr: "\u{1D4C7}",
  rsh: "\u21B1",
  rsqb: "]",
  rsquo: "\u2019",
  rsquor: "\u2019",
  rthree: "\u22CC",
  rtimes: "\u22CA",
  rtri: "\u25B9",
  rtrie: "\u22B5",
  rtrif: "\u25B8",
  rtriltri: "\u29CE",
  ruluhar: "\u2968",
  rx: "\u211E",
  sacute: "\u015B",
  sbquo: "\u201A",
  sc: "\u227B",
  scE: "\u2AB4",
  scap: "\u2AB8",
  scaron: "\u0161",
  sccue: "\u227D",
  sce: "\u2AB0",
  scedil: "\u015F",
  scirc: "\u015D",
  scnE: "\u2AB6",
  scnap: "\u2ABA",
  scnsim: "\u22E9",
  scpolint: "\u2A13",
  scsim: "\u227F",
  scy: "\u0441",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  sdote: "\u2A66",
  seArr: "\u21D8",
  searhk: "\u2925",
  searr: "\u2198",
  searrow: "\u2198",
  sect: "\xA7",
  semi: ";",
  seswar: "\u2929",
  setminus: "\u2216",
  setmn: "\u2216",
  sext: "\u2736",
  sfr: "\u{1D530}",
  sfrown: "\u2322",
  sharp: "\u266F",
  shchcy: "\u0449",
  shcy: "\u0448",
  shortmid: "\u2223",
  shortparallel: "\u2225",
  shy: "\xAD",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  sim: "\u223C",
  simdot: "\u2A6A",
  sime: "\u2243",
  simeq: "\u2243",
  simg: "\u2A9E",
  simgE: "\u2AA0",
  siml: "\u2A9D",
  simlE: "\u2A9F",
  simne: "\u2246",
  simplus: "\u2A24",
  simrarr: "\u2972",
  slarr: "\u2190",
  smallsetminus: "\u2216",
  smashp: "\u2A33",
  smeparsl: "\u29E4",
  smid: "\u2223",
  smile: "\u2323",
  smt: "\u2AAA",
  smte: "\u2AAC",
  smtes: "\u2AAC\uFE00",
  softcy: "\u044C",
  sol: "/",
  solb: "\u29C4",
  solbar: "\u233F",
  sopf: "\u{1D564}",
  spades: "\u2660",
  spadesuit: "\u2660",
  spar: "\u2225",
  sqcap: "\u2293",
  sqcaps: "\u2293\uFE00",
  sqcup: "\u2294",
  sqcups: "\u2294\uFE00",
  sqsub: "\u228F",
  sqsube: "\u2291",
  sqsubset: "\u228F",
  sqsubseteq: "\u2291",
  sqsup: "\u2290",
  sqsupe: "\u2292",
  sqsupset: "\u2290",
  sqsupseteq: "\u2292",
  squ: "\u25A1",
  square: "\u25A1",
  squarf: "\u25AA",
  squf: "\u25AA",
  srarr: "\u2192",
  sscr: "\u{1D4C8}",
  ssetmn: "\u2216",
  ssmile: "\u2323",
  sstarf: "\u22C6",
  star: "\u2606",
  starf: "\u2605",
  straightepsilon: "\u03F5",
  straightphi: "\u03D5",
  strns: "\xAF",
  sub: "\u2282",
  subE: "\u2AC5",
  subdot: "\u2ABD",
  sube: "\u2286",
  subedot: "\u2AC3",
  submult: "\u2AC1",
  subnE: "\u2ACB",
  subne: "\u228A",
  subplus: "\u2ABF",
  subrarr: "\u2979",
  subset: "\u2282",
  subseteq: "\u2286",
  subseteqq: "\u2AC5",
  subsetneq: "\u228A",
  subsetneqq: "\u2ACB",
  subsim: "\u2AC7",
  subsub: "\u2AD5",
  subsup: "\u2AD3",
  succ: "\u227B",
  succapprox: "\u2AB8",
  succcurlyeq: "\u227D",
  succeq: "\u2AB0",
  succnapprox: "\u2ABA",
  succneqq: "\u2AB6",
  succnsim: "\u22E9",
  succsim: "\u227F",
  sum: "\u2211",
  sung: "\u266A",
  sup1: "\xB9",
  sup2: "\xB2",
  sup3: "\xB3",
  sup: "\u2283",
  supE: "\u2AC6",
  supdot: "\u2ABE",
  supdsub: "\u2AD8",
  supe: "\u2287",
  supedot: "\u2AC4",
  suphsol: "\u27C9",
  suphsub: "\u2AD7",
  suplarr: "\u297B",
  supmult: "\u2AC2",
  supnE: "\u2ACC",
  supne: "\u228B",
  supplus: "\u2AC0",
  supset: "\u2283",
  supseteq: "\u2287",
  supseteqq: "\u2AC6",
  supsetneq: "\u228B",
  supsetneqq: "\u2ACC",
  supsim: "\u2AC8",
  supsub: "\u2AD4",
  supsup: "\u2AD6",
  swArr: "\u21D9",
  swarhk: "\u2926",
  swarr: "\u2199",
  swarrow: "\u2199",
  swnwar: "\u292A",
  szlig: "\xDF",
  target: "\u2316",
  tau: "\u03C4",
  tbrk: "\u23B4",
  tcaron: "\u0165",
  tcedil: "\u0163",
  tcy: "\u0442",
  tdot: "\u20DB",
  telrec: "\u2315",
  tfr: "\u{1D531}",
  there4: "\u2234",
  therefore: "\u2234",
  theta: "\u03B8",
  thetasym: "\u03D1",
  thetav: "\u03D1",
  thickapprox: "\u2248",
  thicksim: "\u223C",
  thinsp: "\u2009",
  thkap: "\u2248",
  thksim: "\u223C",
  thorn: "\xFE",
  tilde: "\u02DC",
  times: "\xD7",
  timesb: "\u22A0",
  timesbar: "\u2A31",
  timesd: "\u2A30",
  tint: "\u222D",
  toea: "\u2928",
  top: "\u22A4",
  topbot: "\u2336",
  topcir: "\u2AF1",
  topf: "\u{1D565}",
  topfork: "\u2ADA",
  tosa: "\u2929",
  tprime: "\u2034",
  trade: "\u2122",
  triangle: "\u25B5",
  triangledown: "\u25BF",
  triangleleft: "\u25C3",
  trianglelefteq: "\u22B4",
  triangleq: "\u225C",
  triangleright: "\u25B9",
  trianglerighteq: "\u22B5",
  tridot: "\u25EC",
  trie: "\u225C",
  triminus: "\u2A3A",
  triplus: "\u2A39",
  trisb: "\u29CD",
  tritime: "\u2A3B",
  trpezium: "\u23E2",
  tscr: "\u{1D4C9}",
  tscy: "\u0446",
  tshcy: "\u045B",
  tstrok: "\u0167",
  twixt: "\u226C",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  uArr: "\u21D1",
  uHar: "\u2963",
  uacute: "\xFA",
  uarr: "\u2191",
  ubrcy: "\u045E",
  ubreve: "\u016D",
  ucirc: "\xFB",
  ucy: "\u0443",
  udarr: "\u21C5",
  udblac: "\u0171",
  udhar: "\u296E",
  ufisht: "\u297E",
  ufr: "\u{1D532}",
  ugrave: "\xF9",
  uharl: "\u21BF",
  uharr: "\u21BE",
  uhblk: "\u2580",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  ulcrop: "\u230F",
  ultri: "\u25F8",
  umacr: "\u016B",
  uml: "\xA8",
  uogon: "\u0173",
  uopf: "\u{1D566}",
  uparrow: "\u2191",
  updownarrow: "\u2195",
  upharpoonleft: "\u21BF",
  upharpoonright: "\u21BE",
  uplus: "\u228E",
  upsi: "\u03C5",
  upsih: "\u03D2",
  upsilon: "\u03C5",
  upuparrows: "\u21C8",
  urcorn: "\u231D",
  urcorner: "\u231D",
  urcrop: "\u230E",
  uring: "\u016F",
  urtri: "\u25F9",
  uscr: "\u{1D4CA}",
  utdot: "\u22F0",
  utilde: "\u0169",
  utri: "\u25B5",
  utrif: "\u25B4",
  uuarr: "\u21C8",
  uuml: "\xFC",
  uwangle: "\u29A7",
  vArr: "\u21D5",
  vBar: "\u2AE8",
  vBarv: "\u2AE9",
  vDash: "\u22A8",
  vangrt: "\u299C",
  varepsilon: "\u03F5",
  varkappa: "\u03F0",
  varnothing: "\u2205",
  varphi: "\u03D5",
  varpi: "\u03D6",
  varpropto: "\u221D",
  varr: "\u2195",
  varrho: "\u03F1",
  varsigma: "\u03C2",
  varsubsetneq: "\u228A\uFE00",
  varsubsetneqq: "\u2ACB\uFE00",
  varsupsetneq: "\u228B\uFE00",
  varsupsetneqq: "\u2ACC\uFE00",
  vartheta: "\u03D1",
  vartriangleleft: "\u22B2",
  vartriangleright: "\u22B3",
  vcy: "\u0432",
  vdash: "\u22A2",
  vee: "\u2228",
  veebar: "\u22BB",
  veeeq: "\u225A",
  vellip: "\u22EE",
  verbar: "|",
  vert: "|",
  vfr: "\u{1D533}",
  vltri: "\u22B2",
  vnsub: "\u2282\u20D2",
  vnsup: "\u2283\u20D2",
  vopf: "\u{1D567}",
  vprop: "\u221D",
  vrtri: "\u22B3",
  vscr: "\u{1D4CB}",
  vsubnE: "\u2ACB\uFE00",
  vsubne: "\u228A\uFE00",
  vsupnE: "\u2ACC\uFE00",
  vsupne: "\u228B\uFE00",
  vzigzag: "\u299A",
  wcirc: "\u0175",
  wedbar: "\u2A5F",
  wedge: "\u2227",
  wedgeq: "\u2259",
  weierp: "\u2118",
  wfr: "\u{1D534}",
  wopf: "\u{1D568}",
  wp: "\u2118",
  wr: "\u2240",
  wreath: "\u2240",
  wscr: "\u{1D4CC}",
  xcap: "\u22C2",
  xcirc: "\u25EF",
  xcup: "\u22C3",
  xdtri: "\u25BD",
  xfr: "\u{1D535}",
  xhArr: "\u27FA",
  xharr: "\u27F7",
  xi: "\u03BE",
  xlArr: "\u27F8",
  xlarr: "\u27F5",
  xmap: "\u27FC",
  xnis: "\u22FB",
  xodot: "\u2A00",
  xopf: "\u{1D569}",
  xoplus: "\u2A01",
  xotime: "\u2A02",
  xrArr: "\u27F9",
  xrarr: "\u27F6",
  xscr: "\u{1D4CD}",
  xsqcup: "\u2A06",
  xuplus: "\u2A04",
  xutri: "\u25B3",
  xvee: "\u22C1",
  xwedge: "\u22C0",
  yacute: "\xFD",
  yacy: "\u044F",
  ycirc: "\u0177",
  ycy: "\u044B",
  yen: "\xA5",
  yfr: "\u{1D536}",
  yicy: "\u0457",
  yopf: "\u{1D56A}",
  yscr: "\u{1D4CE}",
  yucy: "\u044E",
  yuml: "\xFF",
  zacute: "\u017A",
  zcaron: "\u017E",
  zcy: "\u0437",
  zdot: "\u017C",
  zeetrf: "\u2128",
  zeta: "\u03B6",
  zfr: "\u{1D537}",
  zhcy: "\u0436",
  zigrarr: "\u21DD",
  zopf: "\u{1D56B}",
  zscr: "\u{1D4CF}",
  zwj: "\u200D",
  zwnj: "\u200C"
};

// node_modules/decode-named-character-reference/index.js
var own = {}.hasOwnProperty;
function decodeNamedCharacterReference(value) {
  return own.call(characterEntities, value) ? characterEntities[value] : false;
}

// node_modules/micromark-util-chunked/index.js
function splice(list2, start, remove, items) {
  const end = list2.length;
  let chunkStart = 0;
  let parameters;
  if (start < 0) {
    start = -start > end ? 0 : end + start;
  } else {
    start = start > end ? end : start;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < 1e4) {
    parameters = Array.from(items);
    parameters.unshift(start, remove);
    list2.splice(...parameters);
  } else {
    if (remove) list2.splice(start, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + 1e4);
      parameters.unshift(start, 0);
      list2.splice(...parameters);
      chunkStart += 1e4;
      start += 1e4;
    }
  }
}
function push(list2, items) {
  if (list2.length > 0) {
    splice(list2, list2.length, 0, items);
    return list2;
  }
  return items;
}

// node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension2) {
  let hook;
  for (hook in extension2) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : void 0;
    const left = maybe || (all2[hook] = {});
    const right = extension2[hook];
    let code2;
    if (right) {
      for (code2 in right) {
        if (!hasOwnProperty.call(left, code2)) left[code2] = [];
        const value = right[code2];
        constructs(
          // @ts-expect-error Looks like a list.
          left[code2],
          Array.isArray(value) ? value : value ? [value] : []
        );
      }
    }
  }
}
function constructs(existing, list2) {
  let index2 = -1;
  const before = [];
  while (++index2 < list2.length) {
    ;
    (list2[index2].add === "after" ? existing : before).push(list2[index2]);
  }
  splice(existing, 0, 0, before);
}

// node_modules/micromark-util-decode-numeric-character-reference/index.js
function decodeNumericCharacterReference(value, base) {
  const code2 = Number.parseInt(value, base);
  if (
    // C0 except for HT, LF, FF, CR, space.
    code2 < 9 || code2 === 11 || code2 > 13 && code2 < 32 || // Control character (DEL) of C0, and C1 controls.
    code2 > 126 && code2 < 160 || // Lone high surrogates and low surrogates.
    code2 > 55295 && code2 < 57344 || // Noncharacters.
    code2 > 64975 && code2 < 65008 || /* eslint-disable no-bitwise */
    (code2 & 65535) === 65535 || (code2 & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    code2 > 1114111
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(code2);
}

// node_modules/micromark-util-normalize-identifier/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// node_modules/micromark-util-character/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code2) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code2 !== null && (code2 < 32 || code2 === 127)
  );
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code2) {
  return code2 !== null && code2 < -2;
}
function markdownLineEndingOrSpace(code2) {
  return code2 !== null && (code2 < 0 || code2 === 32);
}
function markdownSpace(code2) {
  return code2 === -2 || code2 === -1 || code2 === 32;
}
var unicodePunctuation = regexCheck(new RegExp("\\p{P}|\\p{S}", "u"));
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code2) {
    return code2 !== null && code2 > -1 && regex.test(String.fromCharCode(code2));
  }
}

// node_modules/micromark-factory-space/index.js
function factorySpace(effects, ok3, type, max) {
  const limit = max ? max - 1 : Number.POSITIVE_INFINITY;
  let size = 0;
  return start;
  function start(code2) {
    if (markdownSpace(code2)) {
      effects.enter(type);
      return prefix(code2);
    }
    return ok3(code2);
  }
  function prefix(code2) {
    if (markdownSpace(code2) && size++ < limit) {
      effects.consume(code2);
      return prefix;
    }
    effects.exit(type);
    return ok3(code2);
  }
}

// node_modules/micromark/lib/initialize/content.js
var content = {
  tokenize: initializeContent
};
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous3;
  return contentStart;
  function afterContentStartConstruct(code2) {
    if (code2 === null) {
      effects.consume(code2);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return factorySpace(effects, contentStart, "linePrefix");
  }
  function paragraphInitial(code2) {
    effects.enter("paragraph");
    return lineStart(code2);
  }
  function lineStart(code2) {
    const token = effects.enter("chunkText", {
      contentType: "text",
      previous: previous3
    });
    if (previous3) {
      previous3.next = token;
    }
    previous3 = token;
    return data(code2);
  }
  function data(code2) {
    if (code2 === null) {
      effects.exit("chunkText");
      effects.exit("paragraph");
      effects.consume(code2);
      return;
    }
    if (markdownLineEnding(code2)) {
      effects.consume(code2);
      effects.exit("chunkText");
      return lineStart;
    }
    effects.consume(code2);
    return data;
  }
}

// node_modules/micromark/lib/initialize/document.js
var document = {
  tokenize: initializeDocument
};
var containerConstruct = {
  tokenize: tokenizeContainer
};
function initializeDocument(effects) {
  const self = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start;
  function start(code2) {
    if (continued < stack.length) {
      const item = stack[continued];
      self.containerState = item[1];
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code2);
    }
    return checkNewContainers(code2);
  }
  function documentContinue(code2) {
    continued++;
    if (self.containerState._closeFlow) {
      self.containerState._closeFlow = void 0;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          point3 = self.events[indexBeforeFlow][1].end;
          break;
        }
      }
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
      return checkNewContainers(code2);
    }
    return start(code2);
  }
  function checkNewContainers(code2) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code2);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code2);
      }
      self.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code2);
  }
  function thereIsANewContainer(code2) {
    if (childFlow) closeFlow();
    exitContainers(continued);
    return documentContinued(code2);
  }
  function thereIsNoNewContainer(code2) {
    self.parser.lazy[self.now().line] = continued !== stack.length;
    lineStartOffset = self.now().offset;
    return flowStart(code2);
  }
  function documentContinued(code2) {
    self.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code2);
  }
  function containerContinue(code2) {
    continued++;
    stack.push([self.currentConstruct, self.containerState]);
    return documentContinued(code2);
  }
  function flowStart(code2) {
    if (code2 === null) {
      if (childFlow) closeFlow();
      exitContainers(0);
      effects.consume(code2);
      return;
    }
    childFlow = childFlow || self.parser.flow(self.now());
    effects.enter("chunkFlow", {
      _tokenizer: childFlow,
      contentType: "flow",
      previous: childToken
    });
    return flowContinue(code2);
  }
  function flowContinue(code2) {
    if (code2 === null) {
      writeToChild(effects.exit("chunkFlow"), true);
      exitContainers(0);
      effects.consume(code2);
      return;
    }
    if (markdownLineEnding(code2)) {
      effects.consume(code2);
      writeToChild(effects.exit("chunkFlow"));
      continued = 0;
      self.interrupt = void 0;
      return start;
    }
    effects.consume(code2);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    const stream = self.sliceStream(token);
    if (endOfFile) stream.push(null);
    token.previous = childToken;
    if (childToken) childToken.next = token;
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (
          // The token starts before the line ending…
          childFlow.events[index2][1].start.offset < lineStartOffset && // …and either is not ended yet…
          (!childFlow.events[index2][1].end || // …or ends after it.
          childFlow.events[index2][1].end.offset > lineStartOffset)
        ) {
          return;
        }
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          if (seen) {
            point3 = self.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      splice(self.events, indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      self.events.length = index2;
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self.containerState = entry[1];
      entry[0].exit.call(self, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    childFlow.write([null]);
    childToken = void 0;
    childFlow = void 0;
    self.containerState._closeFlow = void 0;
  }
}
function tokenizeContainer(effects, ok3, nok) {
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok3, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}

// node_modules/micromark-util-classify-character/index.js
function classifyCharacter(code2) {
  if (code2 === null || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2)) {
    return 1;
  }
  if (unicodePunctuation(code2)) {
    return 2;
  }
}

// node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve = constructs2[index2].resolveAll;
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }
  return events;
}

// node_modules/micromark-core-commonmark/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let open;
  let group;
  let text4;
  let openingSequence;
  let closingSequence;
  let use;
  let nextEvents;
  let offset;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      open = index2;
      while (open--) {
        if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start = {
            ...events[open][1].end
          };
          const end = {
            ...events[index2][1].start
          };
          movePoint(start, -use);
          movePoint(end, use);
          openingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start,
            end: {
              ...events[open][1].end
            }
          };
          closingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...events[index2][1].start
            },
            end
          };
          text4 = {
            type: use > 1 ? "strongText" : "emphasisText",
            start: {
              ...events[open][1].end
            },
            end: {
              ...events[index2][1].start
            }
          };
          group = {
            type: use > 1 ? "strong" : "emphasis",
            start: {
              ...openingSequence.start
            },
            end: {
              ...closingSequence.end
            }
          };
          events[open][1].end = {
            ...openingSequence.start
          };
          events[index2][1].start = {
            ...closingSequence.end
          };
          nextEvents = [];
          if (events[open][1].end.offset - events[open][1].start.offset) {
            nextEvents = push(nextEvents, [["enter", events[open][1], context], ["exit", events[open][1], context]]);
          }
          nextEvents = push(nextEvents, [["enter", group, context], ["enter", openingSequence, context], ["exit", openingSequence, context], ["enter", text4, context]]);
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index2), context));
          nextEvents = push(nextEvents, [["exit", text4, context], ["enter", closingSequence, context], ["exit", closingSequence, context], ["exit", group, context]]);
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [["enter", events[index2][1], context], ["exit", events[index2][1], context]]);
          } else {
            offset = 0;
          }
          splice(events, open - 1, index2 - open + 3, nextEvents);
          index2 = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok3) {
  const attentionMarkers2 = this.parser.constructs.attentionMarkers.null;
  const previous3 = this.previous;
  const before = classifyCharacter(previous3);
  let marker;
  return start;
  function start(code2) {
    marker = code2;
    effects.enter("attentionSequence");
    return inside(code2);
  }
  function inside(code2) {
    if (code2 === marker) {
      effects.consume(code2);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code2);
    const open = !after || after === 2 && before || attentionMarkers2.includes(code2);
    const close = !before || before === 2 && after || attentionMarkers2.includes(previous3);
    token._open = Boolean(marker === 42 ? open : open && (before || !close));
    token._close = Boolean(marker === 42 ? close : close && (after || !open));
    return ok3(code2);
  }
}
function movePoint(point3, offset) {
  point3.column += offset;
  point3.offset += offset;
  point3._bufferIndex += offset;
}

// node_modules/micromark-core-commonmark/lib/autolink.js
var autolink = {
  name: "autolink",
  tokenize: tokenizeAutolink
};
function tokenizeAutolink(effects, ok3, nok) {
  let size = 0;
  return start;
  function start(code2) {
    effects.enter("autolink");
    effects.enter("autolinkMarker");
    effects.consume(code2);
    effects.exit("autolinkMarker");
    effects.enter("autolinkProtocol");
    return open;
  }
  function open(code2) {
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      return schemeOrEmailAtext;
    }
    if (code2 === 64) {
      return nok(code2);
    }
    return emailAtext(code2);
  }
  function schemeOrEmailAtext(code2) {
    if (code2 === 43 || code2 === 45 || code2 === 46 || asciiAlphanumeric(code2)) {
      size = 1;
      return schemeInsideOrEmailAtext(code2);
    }
    return emailAtext(code2);
  }
  function schemeInsideOrEmailAtext(code2) {
    if (code2 === 58) {
      effects.consume(code2);
      size = 0;
      return urlInside;
    }
    if ((code2 === 43 || code2 === 45 || code2 === 46 || asciiAlphanumeric(code2)) && size++ < 32) {
      effects.consume(code2);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code2);
  }
  function urlInside(code2) {
    if (code2 === 62) {
      effects.exit("autolinkProtocol");
      effects.enter("autolinkMarker");
      effects.consume(code2);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    if (code2 === null || code2 === 32 || code2 === 60 || asciiControl(code2)) {
      return nok(code2);
    }
    effects.consume(code2);
    return urlInside;
  }
  function emailAtext(code2) {
    if (code2 === 64) {
      effects.consume(code2);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code2)) {
      effects.consume(code2);
      return emailAtext;
    }
    return nok(code2);
  }
  function emailAtSignOrDot(code2) {
    return asciiAlphanumeric(code2) ? emailLabel(code2) : nok(code2);
  }
  function emailLabel(code2) {
    if (code2 === 46) {
      effects.consume(code2);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code2 === 62) {
      effects.exit("autolinkProtocol").type = "autolinkEmail";
      effects.enter("autolinkMarker");
      effects.consume(code2);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok3;
    }
    return emailValue(code2);
  }
  function emailValue(code2) {
    if ((code2 === 45 || asciiAlphanumeric(code2)) && size++ < 63) {
      const next = code2 === 45 ? emailValue : emailLabel;
      effects.consume(code2);
      return next;
    }
    return nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/blank-line.js
var blankLine = {
  partial: true,
  tokenize: tokenizeBlankLine
};
function tokenizeBlankLine(effects, ok3, nok) {
  return start;
  function start(code2) {
    return markdownSpace(code2) ? factorySpace(effects, after, "linePrefix")(code2) : after(code2);
  }
  function after(code2) {
    return code2 === null || markdownLineEnding(code2) ? ok3(code2) : nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/block-quote.js
var blockQuote = {
  continuation: {
    tokenize: tokenizeBlockQuoteContinuation
  },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    if (code2 === 62) {
      const state = self.containerState;
      if (!state.open) {
        effects.enter("blockQuote", {
          _container: true
        });
        state.open = true;
      }
      effects.enter("blockQuotePrefix");
      effects.enter("blockQuoteMarker");
      effects.consume(code2);
      effects.exit("blockQuoteMarker");
      return after;
    }
    return nok(code2);
  }
  function after(code2) {
    if (markdownSpace(code2)) {
      effects.enter("blockQuotePrefixWhitespace");
      effects.consume(code2);
      effects.exit("blockQuotePrefixWhitespace");
      effects.exit("blockQuotePrefix");
      return ok3;
    }
    effects.exit("blockQuotePrefix");
    return ok3(code2);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok3, nok) {
  const self = this;
  return contStart;
  function contStart(code2) {
    if (markdownSpace(code2)) {
      return factorySpace(effects, contBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code2);
    }
    return contBefore(code2);
  }
  function contBefore(code2) {
    return effects.attempt(blockQuote, ok3, nok)(code2);
  }
}
function exit(effects) {
  effects.exit("blockQuote");
}

// node_modules/micromark-core-commonmark/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok3, nok) {
  return start;
  function start(code2) {
    effects.enter("characterEscape");
    effects.enter("escapeMarker");
    effects.consume(code2);
    effects.exit("escapeMarker");
    return inside;
  }
  function inside(code2) {
    if (asciiPunctuation(code2)) {
      effects.enter("characterEscapeValue");
      effects.consume(code2);
      effects.exit("characterEscapeValue");
      effects.exit("characterEscape");
      return ok3;
    }
    return nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok3, nok) {
  const self = this;
  let size = 0;
  let max;
  let test;
  return start;
  function start(code2) {
    effects.enter("characterReference");
    effects.enter("characterReferenceMarker");
    effects.consume(code2);
    effects.exit("characterReferenceMarker");
    return open;
  }
  function open(code2) {
    if (code2 === 35) {
      effects.enter("characterReferenceMarkerNumeric");
      effects.consume(code2);
      effects.exit("characterReferenceMarkerNumeric");
      return numeric;
    }
    effects.enter("characterReferenceValue");
    max = 31;
    test = asciiAlphanumeric;
    return value(code2);
  }
  function numeric(code2) {
    if (code2 === 88 || code2 === 120) {
      effects.enter("characterReferenceMarkerHexadecimal");
      effects.consume(code2);
      effects.exit("characterReferenceMarkerHexadecimal");
      effects.enter("characterReferenceValue");
      max = 6;
      test = asciiHexDigit;
      return value;
    }
    effects.enter("characterReferenceValue");
    max = 7;
    test = asciiDigit;
    return value(code2);
  }
  function value(code2) {
    if (code2 === 59 && size) {
      const token = effects.exit("characterReferenceValue");
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self.sliceSerialize(token))) {
        return nok(code2);
      }
      effects.enter("characterReferenceMarker");
      effects.consume(code2);
      effects.exit("characterReferenceMarker");
      effects.exit("characterReference");
      return ok3;
    }
    if (test(code2) && size++ < max) {
      effects.consume(code2);
      return value;
    }
    return nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/code-fenced.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok3, nok) {
  const self = this;
  const closeStart = {
    partial: true,
    tokenize: tokenizeCloseStart
  };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start;
  function start(code2) {
    return beforeSequenceOpen(code2);
  }
  function beforeSequenceOpen(code2) {
    const tail = self.events[self.events.length - 1];
    initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code2;
    effects.enter("codeFenced");
    effects.enter("codeFencedFence");
    effects.enter("codeFencedFenceSequence");
    return sequenceOpen(code2);
  }
  function sequenceOpen(code2) {
    if (code2 === marker) {
      sizeOpen++;
      effects.consume(code2);
      return sequenceOpen;
    }
    if (sizeOpen < 3) {
      return nok(code2);
    }
    effects.exit("codeFencedFenceSequence");
    return markdownSpace(code2) ? factorySpace(effects, infoBefore, "whitespace")(code2) : infoBefore(code2);
  }
  function infoBefore(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("codeFencedFence");
      return self.interrupt ? ok3(code2) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code2);
    }
    effects.enter("codeFencedFenceInfo");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return info(code2);
  }
  function info(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return infoBefore(code2);
    }
    if (markdownSpace(code2)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return factorySpace(effects, metaBefore, "whitespace")(code2);
    }
    if (code2 === 96 && code2 === marker) {
      return nok(code2);
    }
    effects.consume(code2);
    return info;
  }
  function metaBefore(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      return infoBefore(code2);
    }
    effects.enter("codeFencedFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code2);
  }
  function meta(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceMeta");
      return infoBefore(code2);
    }
    if (code2 === 96 && code2 === marker) {
      return nok(code2);
    }
    effects.consume(code2);
    return meta;
  }
  function atNonLazyBreak(code2) {
    return effects.attempt(closeStart, after, contentBefore)(code2);
  }
  function contentBefore(code2) {
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return contentStart;
  }
  function contentStart(code2) {
    return initialPrefix > 0 && markdownSpace(code2) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code2) : beforeContentChunk(code2);
  }
  function beforeContentChunk(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code2);
    }
    effects.enter("codeFlowValue");
    return contentChunk(code2);
  }
  function contentChunk(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("codeFlowValue");
      return beforeContentChunk(code2);
    }
    effects.consume(code2);
    return contentChunk;
  }
  function after(code2) {
    effects.exit("codeFenced");
    return ok3(code2);
  }
  function tokenizeCloseStart(effects2, ok4, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code2) {
      effects2.enter("lineEnding");
      effects2.consume(code2);
      effects2.exit("lineEnding");
      return start2;
    }
    function start2(code2) {
      effects2.enter("codeFencedFence");
      return markdownSpace(code2) ? factorySpace(effects2, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code2) : beforeSequenceClose(code2);
    }
    function beforeSequenceClose(code2) {
      if (code2 === marker) {
        effects2.enter("codeFencedFenceSequence");
        return sequenceClose(code2);
      }
      return nok2(code2);
    }
    function sequenceClose(code2) {
      if (code2 === marker) {
        size++;
        effects2.consume(code2);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit("codeFencedFenceSequence");
        return markdownSpace(code2) ? factorySpace(effects2, sequenceCloseAfter, "whitespace")(code2) : sequenceCloseAfter(code2);
      }
      return nok2(code2);
    }
    function sequenceCloseAfter(code2) {
      if (code2 === null || markdownLineEnding(code2)) {
        effects2.exit("codeFencedFence");
        return ok4(code2);
      }
      return nok2(code2);
    }
  }
}
function tokenizeNonLazyContinuation(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return lineStart;
  }
  function lineStart(code2) {
    return self.parser.lazy[self.now().line] ? nok(code2) : ok3(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = {
  partial: true,
  tokenize: tokenizeFurtherStart
};
function tokenizeCodeIndented(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    effects.enter("codeIndented");
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code2);
  }
  function afterPrefix(code2) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? atBreak(code2) : nok(code2);
  }
  function atBreak(code2) {
    if (code2 === null) {
      return after(code2);
    }
    if (markdownLineEnding(code2)) {
      return effects.attempt(furtherStart, atBreak, after)(code2);
    }
    effects.enter("codeFlowValue");
    return inside(code2);
  }
  function inside(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("codeFlowValue");
      return atBreak(code2);
    }
    effects.consume(code2);
    return inside;
  }
  function after(code2) {
    effects.exit("codeIndented");
    return ok3(code2);
  }
}
function tokenizeFurtherStart(effects, ok3, nok) {
  const self = this;
  return furtherStart2;
  function furtherStart2(code2) {
    if (self.parser.lazy[self.now().line]) {
      return nok(code2);
    }
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      return furtherStart2;
    }
    return factorySpace(effects, afterPrefix, "linePrefix", 4 + 1)(code2);
  }
  function afterPrefix(code2) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4 ? ok3(code2) : markdownLineEnding(code2) ? furtherStart2(code2) : nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/code-text.js
var codeText = {
  name: "codeText",
  previous,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "codeTextData") {
        events[headEnterIndex][1].type = "codeTextPadding";
        events[tailExitIndex][1].type = "codeTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "codeTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous(code2) {
  return code2 !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function tokenizeCodeText(effects, ok3, nok) {
  const self = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start;
  function start(code2) {
    effects.enter("codeText");
    effects.enter("codeTextSequence");
    return sequenceOpen(code2);
  }
  function sequenceOpen(code2) {
    if (code2 === 96) {
      effects.consume(code2);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit("codeTextSequence");
    return between(code2);
  }
  function between(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    if (code2 === 32) {
      effects.enter("space");
      effects.consume(code2);
      effects.exit("space");
      return between;
    }
    if (code2 === 96) {
      token = effects.enter("codeTextSequence");
      size = 0;
      return sequenceClose(code2);
    }
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      return between;
    }
    effects.enter("codeTextData");
    return data(code2);
  }
  function data(code2) {
    if (code2 === null || code2 === 32 || code2 === 96 || markdownLineEnding(code2)) {
      effects.exit("codeTextData");
      return between(code2);
    }
    effects.consume(code2);
    return data;
  }
  function sequenceClose(code2) {
    if (code2 === 96) {
      effects.consume(code2);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit("codeTextSequence");
      effects.exit("codeText");
      return ok3(code2);
    }
    token.type = "codeTextData";
    return data(code2);
  }
}

// node_modules/micromark-util-subtokenize/lib/splice-buffer.js
var SpliceBuffer = class {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length) return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(start, end) {
    const stop = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
    if (stop < this.left.length) {
      return this.left.slice(start, stop);
    }
    if (start > this.left.length) {
      return this.right.slice(this.right.length - stop + this.left.length, this.right.length - start + this.left.length).reverse();
    }
    return this.left.slice(start).concat(this.right.slice(this.right.length - stop + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(start, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items) chunkedPush(this.left, items);
    return removed.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
};
function chunkedPush(list2, right) {
  let chunkStart = 0;
  if (right.length < 1e4) {
    list2.push(...right);
  } else {
    while (chunkStart < right.length) {
      list2.push(...right.slice(chunkStart, chunkStart + 1e4));
      chunkStart += 1e4;
    }
  }
}

// node_modules/micromark-util-subtokenize/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === "chunkFlow" && events.get(index2 - 1)[1].type === "listItemPrefix") {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === "content") {
            break;
          }
          if (subevents[otherIndex][1].type === "chunkText") {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = void 0;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = "lineEndingBlank";
            }
            otherEvent[1].type = "lineEnding";
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {
        } else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = {
          ...events.get(lineIndex)[1].start
        };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous3;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start = 0;
  const breaks = [start];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {
    }
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(null);
      }
      if (previous3) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = void 0;
      }
    }
    previous3 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (
      // Find a void token that includes a break.
      childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line
    ) {
      start = index2 + 1;
      breaks.push(start);
      current._tokenizer = void 0;
      current.previous = void 0;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = void 0;
    current.previous = void 0;
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start2 = startPositions.pop();
    jumps.push([start2, start2 + slice.length - 1]);
    events.splice(start2, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// node_modules/micromark-core-commonmark/lib/content.js
var content2 = {
  resolve: resolveContent,
  tokenize: tokenizeContent
};
var continuationConstruct = {
  partial: true,
  tokenize: tokenizeContinuation
};
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok3) {
  let previous3;
  return chunkStart;
  function chunkStart(code2) {
    effects.enter("content");
    previous3 = effects.enter("chunkContent", {
      contentType: "content"
    });
    return chunkInside(code2);
  }
  function chunkInside(code2) {
    if (code2 === null) {
      return contentEnd(code2);
    }
    if (markdownLineEnding(code2)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code2);
    }
    effects.consume(code2);
    return chunkInside;
  }
  function contentEnd(code2) {
    effects.exit("chunkContent");
    effects.exit("content");
    return ok3(code2);
  }
  function contentContinue(code2) {
    effects.consume(code2);
    effects.exit("chunkContent");
    previous3.next = effects.enter("chunkContent", {
      contentType: "content",
      previous: previous3
    });
    previous3 = previous3.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok3, nok) {
  const self = this;
  return startLookahead;
  function startLookahead(code2) {
    effects.exit("chunkContent");
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return factorySpace(effects, prefixed, "linePrefix");
  }
  function prefixed(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      return nok(code2);
    }
    const tail = self.events[self.events.length - 1];
    if (!self.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) {
      return ok3(code2);
    }
    return effects.interrupt(self.parser.constructs.flow, nok, ok3)(code2);
  }
}

// node_modules/micromark-factory-destination/index.js
function factoryDestination(effects, ok3, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  const limit = max || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start;
  function start(code2) {
    if (code2 === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code2);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code2 === null || code2 === 32 || code2 === 41 || asciiControl(code2)) {
      return nok(code2);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return raw(code2);
  }
  function enclosedBefore(code2) {
    if (code2 === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code2);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return enclosed(code2);
  }
  function enclosed(code2) {
    if (code2 === 62) {
      effects.exit("chunkString");
      effects.exit(stringType);
      return enclosedBefore(code2);
    }
    if (code2 === null || code2 === 60 || markdownLineEnding(code2)) {
      return nok(code2);
    }
    effects.consume(code2);
    return code2 === 92 ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code2) {
    if (code2 === 60 || code2 === 62 || code2 === 92) {
      effects.consume(code2);
      return enclosed;
    }
    return enclosed(code2);
  }
  function raw(code2) {
    if (!balance && (code2 === null || code2 === 41 || markdownLineEndingOrSpace(code2))) {
      effects.exit("chunkString");
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok3(code2);
    }
    if (balance < limit && code2 === 40) {
      effects.consume(code2);
      balance++;
      return raw;
    }
    if (code2 === 41) {
      effects.consume(code2);
      balance--;
      return raw;
    }
    if (code2 === null || code2 === 32 || code2 === 40 || asciiControl(code2)) {
      return nok(code2);
    }
    effects.consume(code2);
    return code2 === 92 ? rawEscape : raw;
  }
  function rawEscape(code2) {
    if (code2 === 40 || code2 === 41 || code2 === 92) {
      effects.consume(code2);
      return raw;
    }
    return raw(code2);
  }
}

// node_modules/micromark-factory-label/index.js
function factoryLabel(effects, ok3, nok, type, markerType, stringType) {
  const self = this;
  let size = 0;
  let seen;
  return start;
  function start(code2) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code2);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code2) {
    if (size > 999 || code2 === null || code2 === 91 || code2 === 93 && !seen || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    code2 === 94 && !size && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code2);
    }
    if (code2 === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code2);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      return atBreak;
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return labelInside(code2);
  }
  function labelInside(code2) {
    if (code2 === null || code2 === 91 || code2 === 93 || markdownLineEnding(code2) || size++ > 999) {
      effects.exit("chunkString");
      return atBreak(code2);
    }
    effects.consume(code2);
    if (!seen) seen = !markdownSpace(code2);
    return code2 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code2) {
    if (code2 === 91 || code2 === 92 || code2 === 93) {
      effects.consume(code2);
      size++;
      return labelInside;
    }
    return labelInside(code2);
  }
}

// node_modules/micromark-factory-title/index.js
function factoryTitle(effects, ok3, nok, type, markerType, stringType) {
  let marker;
  return start;
  function start(code2) {
    if (code2 === 34 || code2 === 39 || code2 === 40) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code2);
      effects.exit(markerType);
      marker = code2 === 40 ? 41 : code2;
      return begin;
    }
    return nok(code2);
  }
  function begin(code2) {
    if (code2 === marker) {
      effects.enter(markerType);
      effects.consume(code2);
      effects.exit(markerType);
      effects.exit(type);
      return ok3;
    }
    effects.enter(stringType);
    return atBreak(code2);
  }
  function atBreak(code2) {
    if (code2 === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code2 === null) {
      return nok(code2);
    }
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      return factorySpace(effects, atBreak, "linePrefix");
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return inside(code2);
  }
  function inside(code2) {
    if (code2 === marker || code2 === null || markdownLineEnding(code2)) {
      effects.exit("chunkString");
      return atBreak(code2);
    }
    effects.consume(code2);
    return code2 === 92 ? escape : inside;
  }
  function escape(code2) {
    if (code2 === marker || code2 === 92) {
      effects.consume(code2);
      return inside;
    }
    return inside(code2);
  }
}

// node_modules/micromark-factory-whitespace/index.js
function factoryWhitespace(effects, ok3) {
  let seen;
  return start;
  function start(code2) {
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      seen = true;
      return start;
    }
    if (markdownSpace(code2)) {
      return factorySpace(effects, start, seen ? "linePrefix" : "lineSuffix")(code2);
    }
    return ok3(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/definition.js
var definition2 = {
  name: "definition",
  tokenize: tokenizeDefinition
};
var titleBefore = {
  partial: true,
  tokenize: tokenizeTitleBefore
};
function tokenizeDefinition(effects, ok3, nok) {
  const self = this;
  let identifier;
  return start;
  function start(code2) {
    effects.enter("definition");
    return before(code2);
  }
  function before(code2) {
    return factoryLabel.call(
      self,
      effects,
      labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(code2);
  }
  function labelAfter(code2) {
    identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));
    if (code2 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code2);
      effects.exit("definitionMarker");
      return markerAfter;
    }
    return nok(code2);
  }
  function markerAfter(code2) {
    return markdownLineEndingOrSpace(code2) ? factoryWhitespace(effects, destinationBefore)(code2) : destinationBefore(code2);
  }
  function destinationBefore(code2) {
    return factoryDestination(
      effects,
      destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(code2);
  }
  function destinationAfter(code2) {
    return effects.attempt(titleBefore, after, after)(code2);
  }
  function after(code2) {
    return markdownSpace(code2) ? factorySpace(effects, afterWhitespace, "whitespace")(code2) : afterWhitespace(code2);
  }
  function afterWhitespace(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("definition");
      self.parser.defined.push(identifier);
      return ok3(code2);
    }
    return nok(code2);
  }
}
function tokenizeTitleBefore(effects, ok3, nok) {
  return titleBefore2;
  function titleBefore2(code2) {
    return markdownLineEndingOrSpace(code2) ? factoryWhitespace(effects, beforeMarker)(code2) : nok(code2);
  }
  function beforeMarker(code2) {
    return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code2);
  }
  function titleAfter(code2) {
    return markdownSpace(code2) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code2) : titleAfterOptionalWhitespace(code2);
  }
  function titleAfterOptionalWhitespace(code2) {
    return code2 === null || markdownLineEnding(code2) ? ok3(code2) : nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok3, nok) {
  return start;
  function start(code2) {
    effects.enter("hardBreakEscape");
    effects.consume(code2);
    return after;
  }
  function after(code2) {
    if (markdownLineEnding(code2)) {
      effects.exit("hardBreakEscape");
      return ok3(code2);
    }
    return nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  let content3;
  let text4;
  if (events[contentStart][1].type === "whitespace") {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    content3 = {
      type: "atxHeadingText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    text4 = {
      type: "chunkText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: "text"
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [["enter", content3, context], ["enter", text4, context], ["exit", text4, context], ["exit", content3, context]]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok3, nok) {
  let size = 0;
  return start;
  function start(code2) {
    effects.enter("atxHeading");
    return before(code2);
  }
  function before(code2) {
    effects.enter("atxHeadingSequence");
    return sequenceOpen(code2);
  }
  function sequenceOpen(code2) {
    if (code2 === 35 && size++ < 6) {
      effects.consume(code2);
      return sequenceOpen;
    }
    if (code2 === null || markdownLineEndingOrSpace(code2)) {
      effects.exit("atxHeadingSequence");
      return atBreak(code2);
    }
    return nok(code2);
  }
  function atBreak(code2) {
    if (code2 === 35) {
      effects.enter("atxHeadingSequence");
      return sequenceFurther(code2);
    }
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("atxHeading");
      return ok3(code2);
    }
    if (markdownSpace(code2)) {
      return factorySpace(effects, atBreak, "whitespace")(code2);
    }
    effects.enter("atxHeadingText");
    return data(code2);
  }
  function sequenceFurther(code2) {
    if (code2 === 35) {
      effects.consume(code2);
      return sequenceFurther;
    }
    effects.exit("atxHeadingSequence");
    return atBreak(code2);
  }
  function data(code2) {
    if (code2 === null || code2 === 35 || markdownLineEndingOrSpace(code2)) {
      effects.exit("atxHeadingText");
      return atBreak(code2);
    }
    effects.consume(code2);
    return data;
  }
}

// node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// node_modules/micromark-core-commonmark/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = {
  partial: true,
  tokenize: tokenizeBlankLineBefore
};
var nonLazyContinuationStart = {
  partial: true,
  tokenize: tokenizeNonLazyContinuationStart
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === "htmlFlow") {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === "linePrefix") {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok3, nok) {
  const self = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start;
  function start(code2) {
    return before(code2);
  }
  function before(code2) {
    effects.enter("htmlFlow");
    effects.enter("htmlFlowData");
    effects.consume(code2);
    return open;
  }
  function open(code2) {
    if (code2 === 33) {
      effects.consume(code2);
      return declarationOpen;
    }
    if (code2 === 47) {
      effects.consume(code2);
      closingTag = true;
      return tagCloseStart;
    }
    if (code2 === 63) {
      effects.consume(code2);
      marker = 3;
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      buffer = String.fromCharCode(code2);
      return tagName;
    }
    return nok(code2);
  }
  function declarationOpen(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      marker = 2;
      return commentOpenInside;
    }
    if (code2 === 91) {
      effects.consume(code2);
      marker = 5;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      marker = 4;
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code2);
  }
  function commentOpenInside(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return self.interrupt ? ok3 : continuationDeclarationInside;
    }
    return nok(code2);
  }
  function cdataOpenInside(code2) {
    const value = "CDATA[";
    if (code2 === value.charCodeAt(index2++)) {
      effects.consume(code2);
      if (index2 === value.length) {
        return self.interrupt ? ok3 : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code2);
  }
  function tagCloseStart(code2) {
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      buffer = String.fromCharCode(code2);
      return tagName;
    }
    return nok(code2);
  }
  function tagName(code2) {
    if (code2 === null || code2 === 47 || code2 === 62 || markdownLineEndingOrSpace(code2)) {
      const slash = code2 === 47;
      const name = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name)) {
        marker = 1;
        return self.interrupt ? ok3(code2) : continuation(code2);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = 6;
        if (slash) {
          effects.consume(code2);
          return basicSelfClosing;
        }
        return self.interrupt ? ok3(code2) : continuation(code2);
      }
      marker = 7;
      return self.interrupt && !self.parser.lazy[self.now().line] ? nok(code2) : closingTag ? completeClosingTagAfter(code2) : completeAttributeNameBefore(code2);
    }
    if (code2 === 45 || asciiAlphanumeric(code2)) {
      effects.consume(code2);
      buffer += String.fromCharCode(code2);
      return tagName;
    }
    return nok(code2);
  }
  function basicSelfClosing(code2) {
    if (code2 === 62) {
      effects.consume(code2);
      return self.interrupt ? ok3 : continuation;
    }
    return nok(code2);
  }
  function completeClosingTagAfter(code2) {
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return completeClosingTagAfter;
    }
    return completeEnd(code2);
  }
  function completeAttributeNameBefore(code2) {
    if (code2 === 47) {
      effects.consume(code2);
      return completeEnd;
    }
    if (code2 === 58 || code2 === 95 || asciiAlpha(code2)) {
      effects.consume(code2);
      return completeAttributeName;
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return completeAttributeNameBefore;
    }
    return completeEnd(code2);
  }
  function completeAttributeName(code2) {
    if (code2 === 45 || code2 === 46 || code2 === 58 || code2 === 95 || asciiAlphanumeric(code2)) {
      effects.consume(code2);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code2);
  }
  function completeAttributeNameAfter(code2) {
    if (code2 === 61) {
      effects.consume(code2);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code2);
  }
  function completeAttributeValueBefore(code2) {
    if (code2 === null || code2 === 60 || code2 === 61 || code2 === 62 || code2 === 96) {
      return nok(code2);
    }
    if (code2 === 34 || code2 === 39) {
      effects.consume(code2);
      markerB = code2;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code2);
  }
  function completeAttributeValueQuoted(code2) {
    if (code2 === markerB) {
      effects.consume(code2);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code2 === null || markdownLineEnding(code2)) {
      return nok(code2);
    }
    effects.consume(code2);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code2) {
    if (code2 === null || code2 === 34 || code2 === 39 || code2 === 47 || code2 === 60 || code2 === 61 || code2 === 62 || code2 === 96 || markdownLineEndingOrSpace(code2)) {
      return completeAttributeNameAfter(code2);
    }
    effects.consume(code2);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code2) {
    if (code2 === 47 || code2 === 62 || markdownSpace(code2)) {
      return completeAttributeNameBefore(code2);
    }
    return nok(code2);
  }
  function completeEnd(code2) {
    if (code2 === 62) {
      effects.consume(code2);
      return completeAfter;
    }
    return nok(code2);
  }
  function completeAfter(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      return continuation(code2);
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return completeAfter;
    }
    return nok(code2);
  }
  function continuation(code2) {
    if (code2 === 45 && marker === 2) {
      effects.consume(code2);
      return continuationCommentInside;
    }
    if (code2 === 60 && marker === 1) {
      effects.consume(code2);
      return continuationRawTagOpen;
    }
    if (code2 === 62 && marker === 4) {
      effects.consume(code2);
      return continuationClose;
    }
    if (code2 === 63 && marker === 3) {
      effects.consume(code2);
      return continuationDeclarationInside;
    }
    if (code2 === 93 && marker === 5) {
      effects.consume(code2);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code2) && (marker === 6 || marker === 7)) {
      effects.exit("htmlFlowData");
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code2);
    }
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("htmlFlowData");
      return continuationStart(code2);
    }
    effects.consume(code2);
    return continuation;
  }
  function continuationStart(code2) {
    return effects.check(nonLazyContinuationStart, continuationStartNonLazy, continuationAfter)(code2);
  }
  function continuationStartNonLazy(code2) {
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return continuationBefore;
  }
  function continuationBefore(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      return continuationStart(code2);
    }
    effects.enter("htmlFlowData");
    return continuation(code2);
  }
  function continuationCommentInside(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return continuationDeclarationInside;
    }
    return continuation(code2);
  }
  function continuationRawTagOpen(code2) {
    if (code2 === 47) {
      effects.consume(code2);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code2);
  }
  function continuationRawEndTag(code2) {
    if (code2 === 62) {
      const name = buffer.toLowerCase();
      if (htmlRawNames.includes(name)) {
        effects.consume(code2);
        return continuationClose;
      }
      return continuation(code2);
    }
    if (asciiAlpha(code2) && buffer.length < 8) {
      effects.consume(code2);
      buffer += String.fromCharCode(code2);
      return continuationRawEndTag;
    }
    return continuation(code2);
  }
  function continuationCdataInside(code2) {
    if (code2 === 93) {
      effects.consume(code2);
      return continuationDeclarationInside;
    }
    return continuation(code2);
  }
  function continuationDeclarationInside(code2) {
    if (code2 === 62) {
      effects.consume(code2);
      return continuationClose;
    }
    if (code2 === 45 && marker === 2) {
      effects.consume(code2);
      return continuationDeclarationInside;
    }
    return continuation(code2);
  }
  function continuationClose(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("htmlFlowData");
      return continuationAfter(code2);
    }
    effects.consume(code2);
    return continuationClose;
  }
  function continuationAfter(code2) {
    effects.exit("htmlFlow");
    return ok3(code2);
  }
}
function tokenizeNonLazyContinuationStart(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    if (markdownLineEnding(code2)) {
      effects.enter("lineEnding");
      effects.consume(code2);
      effects.exit("lineEnding");
      return after;
    }
    return nok(code2);
  }
  function after(code2) {
    return self.parser.lazy[self.now().line] ? nok(code2) : ok3(code2);
  }
}
function tokenizeBlankLineBefore(effects, ok3, nok) {
  return start;
  function start(code2) {
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return effects.attempt(blankLine, ok3, nok);
  }
}

// node_modules/micromark-core-commonmark/lib/html-text.js
var htmlText = {
  name: "htmlText",
  tokenize: tokenizeHtmlText
};
function tokenizeHtmlText(effects, ok3, nok) {
  const self = this;
  let marker;
  let index2;
  let returnState;
  return start;
  function start(code2) {
    effects.enter("htmlText");
    effects.enter("htmlTextData");
    effects.consume(code2);
    return open;
  }
  function open(code2) {
    if (code2 === 33) {
      effects.consume(code2);
      return declarationOpen;
    }
    if (code2 === 47) {
      effects.consume(code2);
      return tagCloseStart;
    }
    if (code2 === 63) {
      effects.consume(code2);
      return instruction;
    }
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      return tagOpen;
    }
    return nok(code2);
  }
  function declarationOpen(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return commentOpenInside;
    }
    if (code2 === 91) {
      effects.consume(code2);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      return declaration;
    }
    return nok(code2);
  }
  function commentOpenInside(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return commentEnd;
    }
    return nok(code2);
  }
  function comment(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    if (code2 === 45) {
      effects.consume(code2);
      return commentClose;
    }
    if (markdownLineEnding(code2)) {
      returnState = comment;
      return lineEndingBefore(code2);
    }
    effects.consume(code2);
    return comment;
  }
  function commentClose(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return commentEnd;
    }
    return comment(code2);
  }
  function commentEnd(code2) {
    return code2 === 62 ? end(code2) : code2 === 45 ? commentClose(code2) : comment(code2);
  }
  function cdataOpenInside(code2) {
    const value = "CDATA[";
    if (code2 === value.charCodeAt(index2++)) {
      effects.consume(code2);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code2);
  }
  function cdata(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    if (code2 === 93) {
      effects.consume(code2);
      return cdataClose;
    }
    if (markdownLineEnding(code2)) {
      returnState = cdata;
      return lineEndingBefore(code2);
    }
    effects.consume(code2);
    return cdata;
  }
  function cdataClose(code2) {
    if (code2 === 93) {
      effects.consume(code2);
      return cdataEnd;
    }
    return cdata(code2);
  }
  function cdataEnd(code2) {
    if (code2 === 62) {
      return end(code2);
    }
    if (code2 === 93) {
      effects.consume(code2);
      return cdataEnd;
    }
    return cdata(code2);
  }
  function declaration(code2) {
    if (code2 === null || code2 === 62) {
      return end(code2);
    }
    if (markdownLineEnding(code2)) {
      returnState = declaration;
      return lineEndingBefore(code2);
    }
    effects.consume(code2);
    return declaration;
  }
  function instruction(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    if (code2 === 63) {
      effects.consume(code2);
      return instructionClose;
    }
    if (markdownLineEnding(code2)) {
      returnState = instruction;
      return lineEndingBefore(code2);
    }
    effects.consume(code2);
    return instruction;
  }
  function instructionClose(code2) {
    return code2 === 62 ? end(code2) : instruction(code2);
  }
  function tagCloseStart(code2) {
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      return tagClose;
    }
    return nok(code2);
  }
  function tagClose(code2) {
    if (code2 === 45 || asciiAlphanumeric(code2)) {
      effects.consume(code2);
      return tagClose;
    }
    return tagCloseBetween(code2);
  }
  function tagCloseBetween(code2) {
    if (markdownLineEnding(code2)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code2);
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return tagCloseBetween;
    }
    return end(code2);
  }
  function tagOpen(code2) {
    if (code2 === 45 || asciiAlphanumeric(code2)) {
      effects.consume(code2);
      return tagOpen;
    }
    if (code2 === 47 || code2 === 62 || markdownLineEndingOrSpace(code2)) {
      return tagOpenBetween(code2);
    }
    return nok(code2);
  }
  function tagOpenBetween(code2) {
    if (code2 === 47) {
      effects.consume(code2);
      return end;
    }
    if (code2 === 58 || code2 === 95 || asciiAlpha(code2)) {
      effects.consume(code2);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code2)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code2);
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return tagOpenBetween;
    }
    return end(code2);
  }
  function tagOpenAttributeName(code2) {
    if (code2 === 45 || code2 === 46 || code2 === 58 || code2 === 95 || asciiAlphanumeric(code2)) {
      effects.consume(code2);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code2);
  }
  function tagOpenAttributeNameAfter(code2) {
    if (code2 === 61) {
      effects.consume(code2);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code2)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code2);
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code2);
  }
  function tagOpenAttributeValueBefore(code2) {
    if (code2 === null || code2 === 60 || code2 === 61 || code2 === 62 || code2 === 96) {
      return nok(code2);
    }
    if (code2 === 34 || code2 === 39) {
      effects.consume(code2);
      marker = code2;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code2)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code2);
    }
    if (markdownSpace(code2)) {
      effects.consume(code2);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code2);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code2) {
    if (code2 === marker) {
      effects.consume(code2);
      marker = void 0;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code2 === null) {
      return nok(code2);
    }
    if (markdownLineEnding(code2)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code2);
    }
    effects.consume(code2);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code2) {
    if (code2 === null || code2 === 34 || code2 === 39 || code2 === 60 || code2 === 61 || code2 === 96) {
      return nok(code2);
    }
    if (code2 === 47 || code2 === 62 || markdownLineEndingOrSpace(code2)) {
      return tagOpenBetween(code2);
    }
    effects.consume(code2);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code2) {
    if (code2 === 47 || code2 === 62 || markdownLineEndingOrSpace(code2)) {
      return tagOpenBetween(code2);
    }
    return nok(code2);
  }
  function end(code2) {
    if (code2 === 62) {
      effects.consume(code2);
      effects.exit("htmlTextData");
      effects.exit("htmlText");
      return ok3;
    }
    return nok(code2);
  }
  function lineEndingBefore(code2) {
    effects.exit("htmlTextData");
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return lineEndingAfter;
  }
  function lineEndingAfter(code2) {
    return markdownSpace(code2) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code2) : lineEndingAfterPrefix(code2);
  }
  function lineEndingAfterPrefix(code2) {
    effects.enter("htmlTextData");
    return returnState(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = {
  tokenize: tokenizeResource
};
var referenceFullConstruct = {
  tokenize: tokenizeReferenceFull
};
var referenceCollapsedConstruct = {
  tokenize: tokenizeReferenceCollapsed
};
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
      const offset = token.type === "labelImage" ? 4 : 2;
      token.type = "data";
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let token;
  let open;
  let close;
  let media;
  while (index2--) {
    token = events[index2][1];
    if (open) {
      if (token.type === "link" || token.type === "labelLink" && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === "labelLink") {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
        open = index2;
        if (token.type !== "labelLink") {
          offset = 2;
          break;
        }
      }
    } else if (token.type === "labelEnd") {
      close = index2;
    }
  }
  const group = {
    type: events[open][1].type === "labelLink" ? "link" : "image",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  const label = {
    type: "label",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[close][1].end
    }
  };
  const text4 = {
    type: "labelText",
    start: {
      ...events[open + offset + 2][1].end
    },
    end: {
      ...events[close - 2][1].start
    }
  };
  media = [["enter", group, context], ["enter", label, context]];
  media = push(media, events.slice(open + 1, open + offset + 3));
  media = push(media, [["enter", text4, context]]);
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
  media = push(media, [["exit", text4, context], events[close - 2], events[close - 1], ["exit", label, context]]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok3, nok) {
  const self = this;
  let index2 = self.events.length;
  let labelStart;
  let defined;
  while (index2--) {
    if ((self.events[index2][1].type === "labelImage" || self.events[index2][1].type === "labelLink") && !self.events[index2][1]._balanced) {
      labelStart = self.events[index2][1];
      break;
    }
  }
  return start;
  function start(code2) {
    if (!labelStart) {
      return nok(code2);
    }
    if (labelStart._inactive) {
      return labelEndNok(code2);
    }
    defined = self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    })));
    effects.enter("labelEnd");
    effects.enter("labelMarker");
    effects.consume(code2);
    effects.exit("labelMarker");
    effects.exit("labelEnd");
    return after;
  }
  function after(code2) {
    if (code2 === 40) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code2);
    }
    if (code2 === 91) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code2);
    }
    return defined ? labelEndOk(code2) : labelEndNok(code2);
  }
  function referenceNotFull(code2) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code2);
  }
  function labelEndOk(code2) {
    return ok3(code2);
  }
  function labelEndNok(code2) {
    labelStart._balanced = true;
    return nok(code2);
  }
}
function tokenizeResource(effects, ok3, nok) {
  return resourceStart;
  function resourceStart(code2) {
    effects.enter("resource");
    effects.enter("resourceMarker");
    effects.consume(code2);
    effects.exit("resourceMarker");
    return resourceBefore;
  }
  function resourceBefore(code2) {
    return markdownLineEndingOrSpace(code2) ? factoryWhitespace(effects, resourceOpen)(code2) : resourceOpen(code2);
  }
  function resourceOpen(code2) {
    if (code2 === 41) {
      return resourceEnd(code2);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code2);
  }
  function resourceDestinationAfter(code2) {
    return markdownLineEndingOrSpace(code2) ? factoryWhitespace(effects, resourceBetween)(code2) : resourceEnd(code2);
  }
  function resourceDestinationMissing(code2) {
    return nok(code2);
  }
  function resourceBetween(code2) {
    if (code2 === 34 || code2 === 39 || code2 === 40) {
      return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code2);
    }
    return resourceEnd(code2);
  }
  function resourceTitleAfter(code2) {
    return markdownLineEndingOrSpace(code2) ? factoryWhitespace(effects, resourceEnd)(code2) : resourceEnd(code2);
  }
  function resourceEnd(code2) {
    if (code2 === 41) {
      effects.enter("resourceMarker");
      effects.consume(code2);
      effects.exit("resourceMarker");
      effects.exit("resource");
      return ok3;
    }
    return nok(code2);
  }
}
function tokenizeReferenceFull(effects, ok3, nok) {
  const self = this;
  return referenceFull;
  function referenceFull(code2) {
    return factoryLabel.call(self, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code2);
  }
  function referenceFullAfter(code2) {
    return self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) ? ok3(code2) : nok(code2);
  }
  function referenceFullMissing(code2) {
    return nok(code2);
  }
}
function tokenizeReferenceCollapsed(effects, ok3, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code2) {
    effects.enter("reference");
    effects.enter("referenceMarker");
    effects.consume(code2);
    effects.exit("referenceMarker");
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code2) {
    if (code2 === 93) {
      effects.enter("referenceMarker");
      effects.consume(code2);
      effects.exit("referenceMarker");
      effects.exit("reference");
      return ok3;
    }
    return nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    effects.enter("labelImage");
    effects.enter("labelImageMarker");
    effects.consume(code2);
    effects.exit("labelImageMarker");
    return open;
  }
  function open(code2) {
    if (code2 === 91) {
      effects.enter("labelMarker");
      effects.consume(code2);
      effects.exit("labelMarker");
      effects.exit("labelImage");
      return after;
    }
    return nok(code2);
  }
  function after(code2) {
    return code2 === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code2) : ok3(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok3, nok) {
  const self = this;
  return start;
  function start(code2) {
    effects.enter("labelLink");
    effects.enter("labelMarker");
    effects.consume(code2);
    effects.exit("labelMarker");
    effects.exit("labelLink");
    return after;
  }
  function after(code2) {
    return code2 === 94 && "_hiddenFootnoteSupport" in self.parser.constructs ? nok(code2) : ok3(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/line-ending.js
var lineEnding = {
  name: "lineEnding",
  tokenize: tokenizeLineEnding
};
function tokenizeLineEnding(effects, ok3) {
  return start;
  function start(code2) {
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    return factorySpace(effects, ok3, "linePrefix");
  }
}

// node_modules/micromark-core-commonmark/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok3, nok) {
  let size = 0;
  let marker;
  return start;
  function start(code2) {
    effects.enter("thematicBreak");
    return before(code2);
  }
  function before(code2) {
    marker = code2;
    return atBreak(code2);
  }
  function atBreak(code2) {
    if (code2 === marker) {
      effects.enter("thematicBreakSequence");
      return sequence(code2);
    }
    if (size >= 3 && (code2 === null || markdownLineEnding(code2))) {
      effects.exit("thematicBreak");
      return ok3(code2);
    }
    return nok(code2);
  }
  function sequence(code2) {
    if (code2 === marker) {
      effects.consume(code2);
      size++;
      return sequence;
    }
    effects.exit("thematicBreakSequence");
    return markdownSpace(code2) ? factorySpace(effects, atBreak, "whitespace")(code2) : atBreak(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/list.js
var list = {
  continuation: {
    tokenize: tokenizeListContinuation
  },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = {
  partial: true,
  tokenize: tokenizeIndent
};
function tokenizeListStart(effects, ok3, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];
  let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start;
  function start(code2) {
    const kind = self.containerState.type || (code2 === 42 || code2 === 43 || code2 === 45 ? "listUnordered" : "listOrdered");
    if (kind === "listUnordered" ? !self.containerState.marker || code2 === self.containerState.marker : asciiDigit(code2)) {
      if (!self.containerState.type) {
        self.containerState.type = kind;
        effects.enter(kind, {
          _container: true
        });
      }
      if (kind === "listUnordered") {
        effects.enter("listItemPrefix");
        return code2 === 42 || code2 === 45 ? effects.check(thematicBreak, nok, atMarker)(code2) : atMarker(code2);
      }
      if (!self.interrupt || code2 === 49) {
        effects.enter("listItemPrefix");
        effects.enter("listItemValue");
        return inside(code2);
      }
    }
    return nok(code2);
  }
  function inside(code2) {
    if (asciiDigit(code2) && ++size < 10) {
      effects.consume(code2);
      return inside;
    }
    if ((!self.interrupt || size < 2) && (self.containerState.marker ? code2 === self.containerState.marker : code2 === 41 || code2 === 46)) {
      effects.exit("listItemValue");
      return atMarker(code2);
    }
    return nok(code2);
  }
  function atMarker(code2) {
    effects.enter("listItemMarker");
    effects.consume(code2);
    effects.exit("listItemMarker");
    self.containerState.marker = self.containerState.marker || code2;
    return effects.check(
      blankLine,
      // Can’t be empty when interrupting.
      self.interrupt ? nok : onBlank,
      effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix)
    );
  }
  function onBlank(code2) {
    self.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code2);
  }
  function otherPrefix(code2) {
    if (markdownSpace(code2)) {
      effects.enter("listItemPrefixWhitespace");
      effects.consume(code2);
      effects.exit("listItemPrefixWhitespace");
      return endOfPrefix;
    }
    return nok(code2);
  }
  function endOfPrefix(code2) {
    self.containerState.size = initialSize + self.sliceSerialize(effects.exit("listItemPrefix"), true).length;
    return ok3(code2);
  }
}
function tokenizeListContinuation(effects, ok3, nok) {
  const self = this;
  self.containerState._closeFlow = void 0;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code2) {
    self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
    return factorySpace(effects, ok3, "listItemIndent", self.containerState.size + 1)(code2);
  }
  function notBlank(code2) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code2)) {
      self.containerState.furtherBlankLines = void 0;
      self.containerState.initialBlankLine = void 0;
      return notInCurrentItem(code2);
    }
    self.containerState.furtherBlankLines = void 0;
    self.containerState.initialBlankLine = void 0;
    return effects.attempt(indentConstruct, ok3, notInCurrentItem)(code2);
  }
  function notInCurrentItem(code2) {
    self.containerState._closeFlow = true;
    self.interrupt = void 0;
    return factorySpace(effects, effects.attempt(list, ok3, nok), "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code2);
  }
}
function tokenizeIndent(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemIndent", self.containerState.size + 1);
  function afterPrefix(code2) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self.containerState.size ? ok3(code2) : nok(code2);
  }
}
function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4 + 1);
  function afterPrefix(code2) {
    const tail = self.events[self.events.length - 1];
    return !markdownSpace(code2) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok3(code2) : nok(code2);
  }
}

// node_modules/micromark-core-commonmark/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  let index2 = events.length;
  let content3;
  let text4;
  let definition3;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === "content") {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === "paragraph") {
        text4 = index2;
      }
    } else {
      if (events[index2][1].type === "content") {
        events.splice(index2, 1);
      }
      if (!definition3 && events[index2][1].type === "definition") {
        definition3 = index2;
      }
    }
  }
  const heading = {
    type: "setextHeading",
    start: {
      ...events[content3][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  events[text4][1].type = "setextHeadingText";
  if (definition3) {
    events.splice(text4, 0, ["enter", heading, context]);
    events.splice(definition3 + 1, 0, ["exit", events[content3][1], context]);
    events[content3][1].end = {
      ...events[definition3][1].end
    };
  } else {
    events[content3][1] = heading;
  }
  events.push(["exit", heading, context]);
  return events;
}
function tokenizeSetextUnderline(effects, ok3, nok) {
  const self = this;
  let marker;
  return start;
  function start(code2) {
    let index2 = self.events.length;
    let paragraph;
    while (index2--) {
      if (self.events[index2][1].type !== "lineEnding" && self.events[index2][1].type !== "linePrefix" && self.events[index2][1].type !== "content") {
        paragraph = self.events[index2][1].type === "paragraph";
        break;
      }
    }
    if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph)) {
      effects.enter("setextHeadingLine");
      marker = code2;
      return before(code2);
    }
    return nok(code2);
  }
  function before(code2) {
    effects.enter("setextHeadingLineSequence");
    return inside(code2);
  }
  function inside(code2) {
    if (code2 === marker) {
      effects.consume(code2);
      return inside;
    }
    effects.exit("setextHeadingLineSequence");
    return markdownSpace(code2) ? factorySpace(effects, after, "lineSuffix")(code2) : after(code2);
  }
  function after(code2) {
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("setextHeadingLine");
      return ok3(code2);
    }
    return nok(code2);
  }
}

// node_modules/micromark/lib/initialize/flow.js
var flow = {
  tokenize: initializeFlow
};
function initializeFlow(effects) {
  const self = this;
  const initial = effects.attempt(
    // Try to parse a blank line.
    blankLine,
    atBlankEnding,
    // Try to parse initial flow (essentially, only code).
    effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), "linePrefix"))
  );
  return initial;
  function atBlankEnding(code2) {
    if (code2 === null) {
      effects.consume(code2);
      return;
    }
    effects.enter("lineEndingBlank");
    effects.consume(code2);
    effects.exit("lineEndingBlank");
    self.currentConstruct = void 0;
    return initial;
  }
  function afterConstruct(code2) {
    if (code2 === null) {
      effects.consume(code2);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code2);
    effects.exit("lineEnding");
    self.currentConstruct = void 0;
    return initial;
  }
}

// node_modules/micromark/lib/initialize/text.js
var resolver = {
  resolveAll: createResolver()
};
var string = initializeFactory("string");
var text = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self = this;
    const constructs2 = this.parser.constructs[field];
    const text4 = effects.attempt(constructs2, start, notText);
    return start;
    function start(code2) {
      return atBreak(code2) ? text4(code2) : notText(code2);
    }
    function notText(code2) {
      if (code2 === null) {
        effects.consume(code2);
        return;
      }
      effects.enter("data");
      effects.consume(code2);
      return data;
    }
    function data(code2) {
      if (atBreak(code2)) {
        effects.exit("data");
        return text4(code2);
      }
      effects.consume(code2);
      return data;
    }
    function atBreak(code2) {
      if (code2 === null) {
        return true;
      }
      const list2 = constructs2[code2];
      let index2 = -1;
      if (list2) {
        while (++index2 < list2.length) {
          const item = list2[index2];
          if (!item.previous || item.previous.call(self, self.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === void 0) {
        if (events[index2] && events[index2][1].type === "data") {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== "data") {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = void 0;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex) break;
          bufferIndex = -1;
        } else if (chunk === -2) {
          tabs = true;
          size++;
        } else if (chunk === -1) {
        } else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: {
            ...data.end
          }
        };
        data.end = {
          ...token.start
        };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          events.splice(eventIndex, 0, ["enter", token, context], ["exit", token, context]);
          eventIndex += 2;
        }
      }
      eventIndex++;
    }
  }
  return events;
}

// node_modules/micromark/lib/constructs.js
var constructs_exports = {};
__export(constructs_exports, {
  attentionMarkers: () => attentionMarkers,
  contentInitial: () => contentInitial,
  disable: () => disable,
  document: () => document2,
  flow: () => flow2,
  flowInitial: () => flowInitial,
  insideSpan: () => insideSpan,
  string: () => string2,
  text: () => text2
});
var document2 = {
  [42]: list,
  [43]: list,
  [45]: list,
  [48]: list,
  [49]: list,
  [50]: list,
  [51]: list,
  [52]: list,
  [53]: list,
  [54]: list,
  [55]: list,
  [56]: list,
  [57]: list,
  [62]: blockQuote
};
var contentInitial = {
  [91]: definition2
};
var flowInitial = {
  [-2]: codeIndented,
  [-1]: codeIndented,
  [32]: codeIndented
};
var flow2 = {
  [35]: headingAtx,
  [42]: thematicBreak,
  [45]: [setextUnderline, thematicBreak],
  [60]: htmlFlow,
  [61]: setextUnderline,
  [95]: thematicBreak,
  [96]: codeFenced,
  [126]: codeFenced
};
var string2 = {
  [38]: characterReference,
  [92]: characterEscape
};
var text2 = {
  [-5]: lineEnding,
  [-4]: lineEnding,
  [-3]: lineEnding,
  [33]: labelStartImage,
  [38]: characterReference,
  [42]: attention,
  [60]: [autolink, htmlText],
  [91]: labelStartLink,
  [92]: [hardBreakEscape, characterEscape],
  [93]: labelEnd,
  [95]: attention,
  [96]: codeText
};
var insideSpan = {
  null: [attention, resolver]
};
var attentionMarkers = {
  null: [42, 95]
};
var disable = {
  null: []
};

// node_modules/micromark/lib/create-tokenizer.js
function createTokenizer(parser, initialize, from) {
  let point3 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit3,
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    })
  };
  const context = {
    code: null,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: null,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main2();
    if (chunks[chunks.length - 1] !== null) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    } = point3;
    return {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  }
  function main2() {
    let chunkIndex;
    while (point3._index < chunks.length) {
      const chunk = chunks[point3._index];
      if (typeof chunk === "string") {
        chunkIndex = point3._index;
        if (point3._bufferIndex < 0) {
          point3._bufferIndex = 0;
        }
        while (point3._index === chunkIndex && point3._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point3._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code2) {
    consumed = void 0;
    expectedCode = code2;
    state = state(code2);
  }
  function consume(code2) {
    if (markdownLineEnding(code2)) {
      point3.line++;
      point3.column = 1;
      point3.offset += code2 === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code2 !== -1) {
      point3.column++;
      point3.offset++;
    }
    if (point3._bufferIndex < 0) {
      point3._index++;
    } else {
      point3._bufferIndex++;
      if (point3._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
      // strings.
      /** @type {string} */
      chunks[point3._index].length) {
        point3._bufferIndex = -1;
        point3._index++;
      }
    }
    context.previous = code2;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit3(type) {
    const token = stack.pop();
    token.end = now();
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? (
        /* c8 ignore next 1 */
        handleListOfConstructs(constructs2)
      ) : "tokenize" in constructs2 ? (
        // Looks like a construct.
        handleListOfConstructs([
          /** @type {Construct} */
          constructs2
        ])
      ) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map) {
        return start;
        function start(code2) {
          const left = code2 !== null && map[code2];
          const all2 = code2 !== null && map.null;
          const list2 = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list2)(code2);
        }
      }
      function handleListOfConstructs(list2) {
        listOfConstructs = list2;
        constructIndex = 0;
        if (list2.length === 0) {
          return bogusState;
        }
        return handleConstruct(list2[constructIndex]);
      }
      function handleConstruct(construct) {
        return start;
        function start(code2) {
          info = store();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code2);
          }
          return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            fields ? Object.assign(Object.create(context), fields) : context,
            effects,
            ok3,
            nok
          )(code2);
        }
      }
      function ok3(code2) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code2) {
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }
  function store() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return {
      from: startEventsIndex,
      restore
    };
    function restore() {
      point3 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }
  function accountForPotentialSkip() {
    if (point3.line in columnStart && point3.column < 2) {
      point3.column = columnStart[point3.line];
      point3.offset += columnStart[point3.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else switch (chunk) {
      case -5: {
        value = "\r";
        break;
      }
      case -4: {
        value = "\n";
        break;
      }
      case -3: {
        value = "\r\n";
        break;
      }
      case -2: {
        value = expandTabs ? " " : "	";
        break;
      }
      case -1: {
        if (!expandTabs && atTab) continue;
        value = " ";
        break;
      }
      default: {
        value = String.fromCharCode(chunk);
      }
    }
    atTab = chunk === -2;
    result.push(value);
  }
  return result.join("");
}

// node_modules/micromark/lib/parse.js
function parse(options) {
  const settings = options || {};
  const constructs2 = (
    /** @type {FullNormalizedExtension} */
    combineExtensions([constructs_exports, ...settings.extensions || []])
  );
  const parser = {
    constructs: constructs2,
    content: create(content),
    defined: [],
    document: create(document),
    flow: create(flow),
    lazy: {},
    string: create(string),
    text: create(text)
  };
  return parser;
  function create(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// node_modules/micromark/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {
  }
  return events;
}

// node_modules/micromark/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    const chunks = [];
    let match;
    let next;
    let startPosition;
    let endPosition;
    let code2;
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
    startPosition = 0;
    buffer = "";
    if (start) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }
      start = void 0;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      match = search.exec(value);
      endPosition = match && match.index !== void 0 ? match.index : value.length;
      code2 = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code2 === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = void 0;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = void 0;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code2) {
          case 0: {
            chunks.push(65533);
            column++;
            break;
          }
          case 9: {
            next = Math.ceil(column / 4) * 4;
            chunks.push(-2);
            while (column++ < next) chunks.push(-1);
            break;
          }
          case 10: {
            chunks.push(-4);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn) chunks.push(-5);
      if (buffer) chunks.push(buffer);
      chunks.push(null);
    }
    return chunks;
  }
}

// node_modules/micromark-util-decode-string/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === 35) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === 120 || head2 === 88;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position(value.position);
  }
  if ("start" in value || "end" in value) {
    return position(value);
  }
  if ("line" in value || "column" in value) {
    return point(value);
  }
  return "";
}
function point(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position(pos) {
  return point(pos && pos.start) + "-" + point(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/mdast-util-from-markdown/lib/index.js
var own2 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (encoding && typeof encoding === "object") {
    options = encoding;
    encoding = void 0;
  }
  return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition3),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html, buffer),
      htmlTextData: onenterdata,
      image: opener(image),
      label: buffer,
      link: opener(link),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list2, onenterlistordered),
      listUnordered: opener(list2),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak2)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = {
      type: "root",
      children: []
    };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit3,
      buffer,
      resume,
      data
    };
    const listStack = [];
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "listOrdered" || events[index2][1].type === "listUnordered") {
        if (events[index2][0] === "enter") {
          listStack.push(index2);
        } else {
          const tail = listStack.pop();
          index2 = prepareList(events, tail, index2);
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (own2.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call(Object.assign({
          sliceSerialize: events[index2][2].sliceSerialize
        }, context), events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, void 0, tail[0]);
    }
    tree.position = {
      start: point2(events.length > 0 ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point2(events.length > 0 ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function prepareList(events, start, length) {
    let index2 = start - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem2;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    while (++index2 <= length) {
      const event = events[index2];
      switch (event[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = void 0;
          break;
        }
        case "lineEndingBlank": {
          if (event[0] === "enter") {
            if (listItem2 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = void 0;
          }
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace": {
          break;
        }
        default: {
          atMarker = void 0;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
        if (listItem2) {
          let tailIndex = index2;
          lineIndex = void 0;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
              if (tailEvent[0] === "exit") continue;
              if (lineIndex) {
                events[lineIndex][1].type = "lineEndingBlank";
                listSpread = true;
              }
              tailEvent[1].type = "lineEnding";
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {
            } else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem2._spread = true;
          }
          listItem2.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          events.splice(lineIndex || index2, 0, ["exit", listItem2, event[2]]);
          index2++;
          length++;
        }
        if (event[1].type === "listItemPrefix") {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          listItem2 = item;
          events.splice(index2, 0, ["enter", item, event[2]]);
          index2++;
          length++;
          firstBlankLineIndex = void 0;
          atMarker = true;
        }
      }
    }
    events[start][1]._spread = listSpread;
    return length;
  }
  function opener(create, and) {
    return open;
    function open(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || void 0]);
    node2.position = {
      start: point2(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and) and.call(this, token);
      exit3.call(this, token);
    }
  }
  function exit3(token, onExitError) {
    const node2 = this.stack.pop();
    const open = this.tokenStack.pop();
    if (!open) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
        start: token.start,
        end: token.end
      }) + "): it\u2019s not open");
    } else if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0]);
      } else {
        const handler = open[1] || defaultOnError;
        handler.call(this, token, open[0]);
      }
    }
    node2.position.end = point2(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
      this.data.expectingFirstListItemValue = void 0;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside) return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = void 0;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    node2.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text4();
      tail.position = {
        start: point2(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: void 0
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point2(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const tail = context.children[context.children.length - 1];
      tail.position.end = point2(token.end);
      this.data.atHardBreak = void 0;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = void 0;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === "characterReferenceMarkerNumeric" ? 10 : 16);
      this.data.characterReferenceType = void 0;
    } else {
      const result = decodeNamedCharacterReference(data2);
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    tail.position.end = point2(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return {
      type: "blockquote",
      children: []
    };
  }
  function codeFlow() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: ""
    };
  }
  function codeText2() {
    return {
      type: "inlineCode",
      value: ""
    };
  }
  function definition3() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: ""
    };
  }
  function emphasis() {
    return {
      type: "emphasis",
      children: []
    };
  }
  function heading() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: []
    };
  }
  function hardBreak() {
    return {
      type: "break"
    };
  }
  function html() {
    return {
      type: "html",
      value: ""
    };
  }
  function image() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null
    };
  }
  function link() {
    return {
      type: "link",
      title: null,
      url: "",
      children: []
    };
  }
  function list2(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: []
    };
  }
  function listItem(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: []
    };
  }
  function paragraph() {
    return {
      type: "paragraph",
      children: []
    };
  }
  function strong() {
    return {
      type: "strong",
      children: []
    };
  }
  function text4() {
    return {
      type: "text",
      value: ""
    };
  }
  function thematicBreak2() {
    return {
      type: "thematicBreak"
    };
  }
}
function point2(d) {
  return {
    line: d.line,
    column: d.column,
    offset: d.offset
  };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own2.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
      start: left.start,
      end: left.end
    }) + "): a different token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is open");
  } else {
    throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is still open");
  }
}

// node_modules/ccount/index.js
function ccount(value, character) {
  const source = String(value);
  if (typeof character !== "string") {
    throw new TypeError("Expected character");
  }
  let count = 0;
  let index2 = source.indexOf(character);
  while (index2 !== -1) {
    count++;
    index2 = source.indexOf(character, index2 + character.length);
  }
  return count;
}

// node_modules/devlop/lib/default.js
function ok() {
}

// node_modules/escape-string-regexp/index.js
function escapeStringRegexp(string3) {
  if (typeof string3 !== "string") {
    throw new TypeError("Expected a string");
  }
  return string3.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

// node_modules/unist-util-is/lib/index.js
var convert = (
  // Note: overloads in JSDoc can’t yet use different `@template`s.
  /**
   * @type {(
   *   (<Condition extends string>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & {type: Condition}) &
   *   (<Condition extends Props>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Condition) &
   *   (<Condition extends TestFunction>(test: Condition) => (node: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node & Predicate<Condition, Node>) &
   *   ((test?: null | undefined) => (node?: unknown, index?: number | null | undefined, parent?: Parent | null | undefined, context?: unknown) => node is Node) &
   *   ((test?: Test) => Check)
   * )}
   */
  /**
   * @param {Test} [test]
   * @returns {Check}
   */
  (function(test) {
    if (test === null || test === void 0) {
      return ok2;
    }
    if (typeof test === "function") {
      return castFactory(test);
    }
    if (typeof test === "object") {
      return Array.isArray(test) ? anyFactory(test) : (
        // Cast because `ReadonlyArray` goes into the above but `isArray`
        // narrows to `Array`.
        propertiesFactory(
          /** @type {Props} */
          test
        )
      );
    }
    if (typeof test === "string") {
      return typeFactory(test);
    }
    throw new Error("Expected function, string, or object as test");
  })
);
function anyFactory(tests) {
  const checks = [];
  let index2 = -1;
  while (++index2 < tests.length) {
    checks[index2] = convert(tests[index2]);
  }
  return castFactory(any);
  function any(...parameters) {
    let index3 = -1;
    while (++index3 < checks.length) {
      if (checks[index3].apply(this, parameters)) return true;
    }
    return false;
  }
}
function propertiesFactory(check) {
  const checkAsRecord = (
    /** @type {Record<string, unknown>} */
    check
  );
  return castFactory(all2);
  function all2(node2) {
    const nodeAsRecord = (
      /** @type {Record<string, unknown>} */
      /** @type {unknown} */
      node2
    );
    let key;
    for (key in check) {
      if (nodeAsRecord[key] !== checkAsRecord[key]) return false;
    }
    return true;
  }
}
function typeFactory(check) {
  return castFactory(type);
  function type(node2) {
    return node2 && node2.type === check;
  }
}
function castFactory(testFunction) {
  return check;
  function check(value, index2, parent) {
    return Boolean(
      looksLikeANode(value) && testFunction.call(
        this,
        value,
        typeof index2 === "number" ? index2 : void 0,
        parent || void 0
      )
    );
  }
}
function ok2() {
  return true;
}
function looksLikeANode(value) {
  return value !== null && typeof value === "object" && "type" in value;
}

// node_modules/unist-util-visit-parents/lib/color.node.js
function color(d) {
  return "\x1B[33m" + d + "\x1B[39m";
}

// node_modules/unist-util-visit-parents/lib/index.js
var empty = [];
var CONTINUE = true;
var EXIT = false;
var SKIP = "skip";
function visitParents(tree, test, visitor, reverse) {
  let check;
  if (typeof test === "function" && typeof visitor !== "function") {
    reverse = visitor;
    visitor = test;
  } else {
    check = test;
  }
  const is2 = convert(check);
  const step = reverse ? -1 : 1;
  factory(tree, void 0, [])();
  function factory(node2, index2, parents) {
    const value = (
      /** @type {Record<string, unknown>} */
      node2 && typeof node2 === "object" ? node2 : {}
    );
    if (typeof value.type === "string") {
      const name = (
        // `hast`
        typeof value.tagName === "string" ? value.tagName : (
          // `xast`
          typeof value.name === "string" ? value.name : void 0
        )
      );
      Object.defineProperty(visit, "name", {
        value: "node (" + color(node2.type + (name ? "<" + name + ">" : "")) + ")"
      });
    }
    return visit;
    function visit() {
      let result = empty;
      let subresult;
      let offset;
      let grandparents;
      if (!test || is2(node2, index2, parents[parents.length - 1] || void 0)) {
        result = toResult(visitor(node2, parents));
        if (result[0] === EXIT) {
          return result;
        }
      }
      if ("children" in node2 && node2.children) {
        const nodeAsParent = (
          /** @type {UnistParent} */
          node2
        );
        if (nodeAsParent.children && result[0] !== SKIP) {
          offset = (reverse ? nodeAsParent.children.length : -1) + step;
          grandparents = parents.concat(nodeAsParent);
          while (offset > -1 && offset < nodeAsParent.children.length) {
            const child = nodeAsParent.children[offset];
            subresult = factory(child, offset, grandparents)();
            if (subresult[0] === EXIT) {
              return subresult;
            }
            offset = typeof subresult[1] === "number" ? subresult[1] : offset + step;
          }
        }
      }
      return result;
    }
  }
}
function toResult(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "number") {
    return [CONTINUE, value];
  }
  return value === null || value === void 0 ? empty : [value];
}

// node_modules/mdast-util-find-and-replace/lib/index.js
function findAndReplace(tree, list2, options) {
  const settings = options || {};
  const ignored = convert(settings.ignore || []);
  const pairs = toPairs(list2);
  let pairIndex = -1;
  while (++pairIndex < pairs.length) {
    visitParents(tree, "text", visitor);
  }
  function visitor(node2, parents) {
    let index2 = -1;
    let grandparent;
    while (++index2 < parents.length) {
      const parent = parents[index2];
      const siblings = grandparent ? grandparent.children : void 0;
      if (ignored(
        parent,
        siblings ? siblings.indexOf(parent) : void 0,
        grandparent
      )) {
        return;
      }
      grandparent = parent;
    }
    if (grandparent) {
      return handler(node2, parents);
    }
  }
  function handler(node2, parents) {
    const parent = parents[parents.length - 1];
    const find = pairs[pairIndex][0];
    const replace2 = pairs[pairIndex][1];
    let start = 0;
    const siblings = parent.children;
    const index2 = siblings.indexOf(node2);
    let change = false;
    let nodes = [];
    find.lastIndex = 0;
    let match = find.exec(node2.value);
    while (match) {
      const position2 = match.index;
      const matchObject = {
        index: match.index,
        input: match.input,
        stack: [...parents, node2]
      };
      let value = replace2(...match, matchObject);
      if (typeof value === "string") {
        value = value.length > 0 ? { type: "text", value } : void 0;
      }
      if (value === false) {
        find.lastIndex = position2 + 1;
      } else {
        if (start !== position2) {
          nodes.push({
            type: "text",
            value: node2.value.slice(start, position2)
          });
        }
        if (Array.isArray(value)) {
          nodes.push(...value);
        } else if (value) {
          nodes.push(value);
        }
        start = position2 + match[0].length;
        change = true;
      }
      if (!find.global) {
        break;
      }
      match = find.exec(node2.value);
    }
    if (change) {
      if (start < node2.value.length) {
        nodes.push({ type: "text", value: node2.value.slice(start) });
      }
      parent.children.splice(index2, 1, ...nodes);
    } else {
      nodes = [node2];
    }
    return index2 + nodes.length;
  }
}
function toPairs(tupleOrList) {
  const result = [];
  if (!Array.isArray(tupleOrList)) {
    throw new TypeError("Expected find and replace tuple or list of tuples");
  }
  const list2 = !tupleOrList[0] || Array.isArray(tupleOrList[0]) ? tupleOrList : [tupleOrList];
  let index2 = -1;
  while (++index2 < list2.length) {
    const tuple = list2[index2];
    result.push([toExpression(tuple[0]), toFunction(tuple[1])]);
  }
  return result;
}
function toExpression(find) {
  return typeof find === "string" ? new RegExp(escapeStringRegexp(find), "g") : find;
}
function toFunction(replace2) {
  return typeof replace2 === "function" ? replace2 : function() {
    return replace2;
  };
}

// node_modules/mdast-util-gfm-autolink-literal/lib/index.js
function gfmAutolinkLiteralFromMarkdown() {
  return {
    transforms: [transformGfmAutolinkLiterals],
    enter: {
      literalAutolink: enterLiteralAutolink,
      literalAutolinkEmail: enterLiteralAutolinkValue,
      literalAutolinkHttp: enterLiteralAutolinkValue,
      literalAutolinkWww: enterLiteralAutolinkValue
    },
    exit: {
      literalAutolink: exitLiteralAutolink,
      literalAutolinkEmail: exitLiteralAutolinkEmail,
      literalAutolinkHttp: exitLiteralAutolinkHttp,
      literalAutolinkWww: exitLiteralAutolinkWww
    }
  };
}
function enterLiteralAutolink(token) {
  this.enter({ type: "link", title: null, url: "", children: [] }, token);
}
function enterLiteralAutolinkValue(token) {
  this.config.enter.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkHttp(token) {
  this.config.exit.autolinkProtocol.call(this, token);
}
function exitLiteralAutolinkWww(token) {
  this.config.exit.data.call(this, token);
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "link");
  node2.url = "http://" + this.sliceSerialize(token);
}
function exitLiteralAutolinkEmail(token) {
  this.config.exit.autolinkEmail.call(this, token);
}
function exitLiteralAutolink(token) {
  this.exit(token);
}
function transformGfmAutolinkLiterals(tree) {
  findAndReplace(
    tree,
    [
      [/(https?:\/\/|www(?=\.))([-.\w]+)([^ \t\r\n]*)/gi, findUrl],
      [new RegExp("(?<=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@([-\\w]+(?:\\.[-\\w]+)+)", "gu"), findEmail]
    ],
    { ignore: ["link", "linkReference"] }
  );
}
function findUrl(_, protocol, domain2, path3, match) {
  let prefix = "";
  if (!previous2(match)) {
    return false;
  }
  if (/^w/i.test(protocol)) {
    domain2 = protocol + domain2;
    protocol = "";
    prefix = "http://";
  }
  if (!isCorrectDomain(domain2)) {
    return false;
  }
  const parts = splitUrl(domain2 + path3);
  if (!parts[0]) return false;
  const result = {
    type: "link",
    title: null,
    url: prefix + protocol + parts[0],
    children: [{ type: "text", value: protocol + parts[0] }]
  };
  if (parts[1]) {
    return [result, { type: "text", value: parts[1] }];
  }
  return result;
}
function findEmail(_, atext, label, match) {
  if (
    // Not an expected previous character.
    !previous2(match, true) || // Label ends in not allowed character.
    /[-\d_]$/.test(label)
  ) {
    return false;
  }
  return {
    type: "link",
    title: null,
    url: "mailto:" + atext + "@" + label,
    children: [{ type: "text", value: atext + "@" + label }]
  };
}
function isCorrectDomain(domain2) {
  const parts = domain2.split(".");
  if (parts.length < 2 || parts[parts.length - 1] && (/_/.test(parts[parts.length - 1]) || !/[a-zA-Z\d]/.test(parts[parts.length - 1])) || parts[parts.length - 2] && (/_/.test(parts[parts.length - 2]) || !/[a-zA-Z\d]/.test(parts[parts.length - 2]))) {
    return false;
  }
  return true;
}
function splitUrl(url) {
  const trailExec = /[!"&'),.:;<>?\]}]+$/.exec(url);
  if (!trailExec) {
    return [url, void 0];
  }
  url = url.slice(0, trailExec.index);
  let trail2 = trailExec[0];
  let closingParenIndex = trail2.indexOf(")");
  const openingParens = ccount(url, "(");
  let closingParens = ccount(url, ")");
  while (closingParenIndex !== -1 && openingParens > closingParens) {
    url += trail2.slice(0, closingParenIndex + 1);
    trail2 = trail2.slice(closingParenIndex + 1);
    closingParenIndex = trail2.indexOf(")");
    closingParens++;
  }
  return [url, trail2];
}
function previous2(match, email) {
  const code2 = match.input.charCodeAt(match.index - 1);
  return (match.index === 0 || unicodeWhitespace(code2) || unicodePunctuation(code2)) && // If it’s an email, the previous character should not be a slash.
  (!email || code2 !== 47);
}

// node_modules/mdast-util-gfm-footnote/lib/index.js
footnoteReference.peek = footnoteReferencePeek;
function enterFootnoteCallString() {
  this.buffer();
}
function enterFootnoteCall(token) {
  this.enter({ type: "footnoteReference", identifier: "", label: "" }, token);
}
function enterFootnoteDefinitionLabelString() {
  this.buffer();
}
function enterFootnoteDefinition(token) {
  this.enter(
    { type: "footnoteDefinition", identifier: "", label: "", children: [] },
    token
  );
}
function exitFootnoteCallString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteReference");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteCall(token) {
  this.exit(token);
}
function exitFootnoteDefinitionLabelString(token) {
  const label = this.resume();
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "footnoteDefinition");
  node2.identifier = normalizeIdentifier(
    this.sliceSerialize(token)
  ).toLowerCase();
  node2.label = label;
}
function exitFootnoteDefinition(token) {
  this.exit(token);
}
function footnoteReferencePeek() {
  return "[";
}
function footnoteReference(node2, _, state, info) {
  const tracker = state.createTracker(info);
  let value = tracker.move("[^");
  const exit3 = state.enter("footnoteReference");
  const subexit = state.enter("reference");
  value += tracker.move(
    state.safe(state.associationId(node2), { after: "]", before: value })
  );
  subexit();
  exit3();
  value += tracker.move("]");
  return value;
}
function gfmFootnoteFromMarkdown() {
  return {
    enter: {
      gfmFootnoteCallString: enterFootnoteCallString,
      gfmFootnoteCall: enterFootnoteCall,
      gfmFootnoteDefinitionLabelString: enterFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: enterFootnoteDefinition
    },
    exit: {
      gfmFootnoteCallString: exitFootnoteCallString,
      gfmFootnoteCall: exitFootnoteCall,
      gfmFootnoteDefinitionLabelString: exitFootnoteDefinitionLabelString,
      gfmFootnoteDefinition: exitFootnoteDefinition
    }
  };
}

// node_modules/mdast-util-gfm-strikethrough/lib/index.js
handleDelete.peek = peekDelete;
function gfmStrikethroughFromMarkdown() {
  return {
    canContainEols: ["delete"],
    enter: { strikethrough: enterStrikethrough },
    exit: { strikethrough: exitStrikethrough }
  };
}
function enterStrikethrough(token) {
  this.enter({ type: "delete", children: [] }, token);
}
function exitStrikethrough(token) {
  this.exit(token);
}
function handleDelete(node2, _, state, info) {
  const tracker = state.createTracker(info);
  const exit3 = state.enter("strikethrough");
  let value = tracker.move("~~");
  value += state.containerPhrasing(node2, {
    ...tracker.current(),
    before: value,
    after: "~"
  });
  value += tracker.move("~~");
  exit3();
  return value;
}
function peekDelete() {
  return "~";
}

// node_modules/mdast-util-gfm-table/lib/index.js
function gfmTableFromMarkdown() {
  return {
    enter: {
      table: enterTable,
      tableData: enterCell,
      tableHeader: enterCell,
      tableRow: enterRow
    },
    exit: {
      codeText: exitCodeText,
      table: exitTable,
      tableData: exit2,
      tableHeader: exit2,
      tableRow: exit2
    }
  };
}
function enterTable(token) {
  const align = token._align;
  ok(align, "expected `_align` on table");
  this.enter(
    {
      type: "table",
      align: align.map(function(d) {
        return d === "none" ? null : d;
      }),
      children: []
    },
    token
  );
  this.data.inTable = true;
}
function exitTable(token) {
  this.exit(token);
  this.data.inTable = void 0;
}
function enterRow(token) {
  this.enter({ type: "tableRow", children: [] }, token);
}
function exit2(token) {
  this.exit(token);
}
function enterCell(token) {
  this.enter({ type: "tableCell", children: [] }, token);
}
function exitCodeText(token) {
  let value = this.resume();
  if (this.data.inTable) {
    value = value.replace(/\\([\\|])/g, replace);
  }
  const node2 = this.stack[this.stack.length - 1];
  ok(node2.type === "inlineCode");
  node2.value = value;
  this.exit(token);
}
function replace($0, $1) {
  return $1 === "|" ? $1 : $0;
}

// node_modules/mdast-util-gfm-task-list-item/lib/index.js
function gfmTaskListItemFromMarkdown() {
  return {
    exit: {
      taskListCheckValueChecked: exitCheck,
      taskListCheckValueUnchecked: exitCheck,
      paragraph: exitParagraphWithTaskListItem
    }
  };
}
function exitCheck(token) {
  const node2 = this.stack[this.stack.length - 2];
  ok(node2.type === "listItem");
  node2.checked = token.type === "taskListCheckValueChecked";
}
function exitParagraphWithTaskListItem(token) {
  const parent = this.stack[this.stack.length - 2];
  if (parent && parent.type === "listItem" && typeof parent.checked === "boolean") {
    const node2 = this.stack[this.stack.length - 1];
    ok(node2.type === "paragraph");
    const head = node2.children[0];
    if (head && head.type === "text") {
      const siblings = parent.children;
      let index2 = -1;
      let firstParaghraph;
      while (++index2 < siblings.length) {
        const sibling = siblings[index2];
        if (sibling.type === "paragraph") {
          firstParaghraph = sibling;
          break;
        }
      }
      if (firstParaghraph === node2) {
        head.value = head.value.slice(1);
        if (head.value.length === 0) {
          node2.children.shift();
        } else if (node2.position && head.position && typeof head.position.start.offset === "number") {
          head.position.start.column++;
          head.position.start.offset++;
          node2.position.start = Object.assign({}, head.position.start);
        }
      }
    }
  }
  this.exit(token);
}

// node_modules/mdast-util-gfm/lib/index.js
function gfmFromMarkdown() {
  return [
    gfmAutolinkLiteralFromMarkdown(),
    gfmFootnoteFromMarkdown(),
    gfmStrikethroughFromMarkdown(),
    gfmTableFromMarkdown(),
    gfmTaskListItemFromMarkdown()
  ];
}

// node_modules/micromark-extension-gfm-autolink-literal/lib/syntax.js
var wwwPrefix = {
  tokenize: tokenizeWwwPrefix,
  partial: true
};
var domain = {
  tokenize: tokenizeDomain,
  partial: true
};
var path = {
  tokenize: tokenizePath,
  partial: true
};
var trail = {
  tokenize: tokenizeTrail,
  partial: true
};
var emailDomainDotTrail = {
  tokenize: tokenizeEmailDomainDotTrail,
  partial: true
};
var wwwAutolink = {
  name: "wwwAutolink",
  tokenize: tokenizeWwwAutolink,
  previous: previousWww
};
var protocolAutolink = {
  name: "protocolAutolink",
  tokenize: tokenizeProtocolAutolink,
  previous: previousProtocol
};
var emailAutolink = {
  name: "emailAutolink",
  tokenize: tokenizeEmailAutolink,
  previous: previousEmail
};
var text3 = {};
function gfmAutolinkLiteral() {
  return {
    text: text3
  };
}
var code = 48;
while (code < 123) {
  text3[code] = emailAutolink;
  code++;
  if (code === 58) code = 65;
  else if (code === 91) code = 97;
}
text3[43] = emailAutolink;
text3[45] = emailAutolink;
text3[46] = emailAutolink;
text3[95] = emailAutolink;
text3[72] = [emailAutolink, protocolAutolink];
text3[104] = [emailAutolink, protocolAutolink];
text3[87] = [emailAutolink, wwwAutolink];
text3[119] = [emailAutolink, wwwAutolink];
function tokenizeEmailAutolink(effects, ok3, nok) {
  const self = this;
  let dot;
  let data;
  return start;
  function start(code2) {
    if (!gfmAtext(code2) || !previousEmail.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code2);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkEmail");
    return atext(code2);
  }
  function atext(code2) {
    if (gfmAtext(code2)) {
      effects.consume(code2);
      return atext;
    }
    if (code2 === 64) {
      effects.consume(code2);
      return emailDomain;
    }
    return nok(code2);
  }
  function emailDomain(code2) {
    if (code2 === 46) {
      return effects.check(emailDomainDotTrail, emailDomainAfter, emailDomainDot)(code2);
    }
    if (code2 === 45 || code2 === 95 || asciiAlphanumeric(code2)) {
      data = true;
      effects.consume(code2);
      return emailDomain;
    }
    return emailDomainAfter(code2);
  }
  function emailDomainDot(code2) {
    effects.consume(code2);
    dot = true;
    return emailDomain;
  }
  function emailDomainAfter(code2) {
    if (data && dot && asciiAlpha(self.previous)) {
      effects.exit("literalAutolinkEmail");
      effects.exit("literalAutolink");
      return ok3(code2);
    }
    return nok(code2);
  }
}
function tokenizeWwwAutolink(effects, ok3, nok) {
  const self = this;
  return wwwStart;
  function wwwStart(code2) {
    if (code2 !== 87 && code2 !== 119 || !previousWww.call(self, self.previous) || previousUnbalanced(self.events)) {
      return nok(code2);
    }
    effects.enter("literalAutolink");
    effects.enter("literalAutolinkWww");
    return effects.check(wwwPrefix, effects.attempt(domain, effects.attempt(path, wwwAfter), nok), nok)(code2);
  }
  function wwwAfter(code2) {
    effects.exit("literalAutolinkWww");
    effects.exit("literalAutolink");
    return ok3(code2);
  }
}
function tokenizeProtocolAutolink(effects, ok3, nok) {
  const self = this;
  let buffer = "";
  let seen = false;
  return protocolStart;
  function protocolStart(code2) {
    if ((code2 === 72 || code2 === 104) && previousProtocol.call(self, self.previous) && !previousUnbalanced(self.events)) {
      effects.enter("literalAutolink");
      effects.enter("literalAutolinkHttp");
      buffer += String.fromCodePoint(code2);
      effects.consume(code2);
      return protocolPrefixInside;
    }
    return nok(code2);
  }
  function protocolPrefixInside(code2) {
    if (asciiAlpha(code2) && buffer.length < 5) {
      buffer += String.fromCodePoint(code2);
      effects.consume(code2);
      return protocolPrefixInside;
    }
    if (code2 === 58) {
      const protocol = buffer.toLowerCase();
      if (protocol === "http" || protocol === "https") {
        effects.consume(code2);
        return protocolSlashesInside;
      }
    }
    return nok(code2);
  }
  function protocolSlashesInside(code2) {
    if (code2 === 47) {
      effects.consume(code2);
      if (seen) {
        return afterProtocol;
      }
      seen = true;
      return protocolSlashesInside;
    }
    return nok(code2);
  }
  function afterProtocol(code2) {
    return code2 === null || asciiControl(code2) || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2) || unicodePunctuation(code2) ? nok(code2) : effects.attempt(domain, effects.attempt(path, protocolAfter), nok)(code2);
  }
  function protocolAfter(code2) {
    effects.exit("literalAutolinkHttp");
    effects.exit("literalAutolink");
    return ok3(code2);
  }
}
function tokenizeWwwPrefix(effects, ok3, nok) {
  let size = 0;
  return wwwPrefixInside;
  function wwwPrefixInside(code2) {
    if ((code2 === 87 || code2 === 119) && size < 3) {
      size++;
      effects.consume(code2);
      return wwwPrefixInside;
    }
    if (code2 === 46 && size === 3) {
      effects.consume(code2);
      return wwwPrefixAfter;
    }
    return nok(code2);
  }
  function wwwPrefixAfter(code2) {
    return code2 === null ? nok(code2) : ok3(code2);
  }
}
function tokenizeDomain(effects, ok3, nok) {
  let underscoreInLastSegment;
  let underscoreInLastLastSegment;
  let seen;
  return domainInside;
  function domainInside(code2) {
    if (code2 === 46 || code2 === 95) {
      return effects.check(trail, domainAfter, domainAtPunctuation)(code2);
    }
    if (code2 === null || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2) || code2 !== 45 && unicodePunctuation(code2)) {
      return domainAfter(code2);
    }
    seen = true;
    effects.consume(code2);
    return domainInside;
  }
  function domainAtPunctuation(code2) {
    if (code2 === 95) {
      underscoreInLastSegment = true;
    } else {
      underscoreInLastLastSegment = underscoreInLastSegment;
      underscoreInLastSegment = void 0;
    }
    effects.consume(code2);
    return domainInside;
  }
  function domainAfter(code2) {
    if (underscoreInLastLastSegment || underscoreInLastSegment || !seen) {
      return nok(code2);
    }
    return ok3(code2);
  }
}
function tokenizePath(effects, ok3) {
  let sizeOpen = 0;
  let sizeClose = 0;
  return pathInside;
  function pathInside(code2) {
    if (code2 === 40) {
      sizeOpen++;
      effects.consume(code2);
      return pathInside;
    }
    if (code2 === 41 && sizeClose < sizeOpen) {
      return pathAtPunctuation(code2);
    }
    if (code2 === 33 || code2 === 34 || code2 === 38 || code2 === 39 || code2 === 41 || code2 === 42 || code2 === 44 || code2 === 46 || code2 === 58 || code2 === 59 || code2 === 60 || code2 === 63 || code2 === 93 || code2 === 95 || code2 === 126) {
      return effects.check(trail, ok3, pathAtPunctuation)(code2);
    }
    if (code2 === null || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2)) {
      return ok3(code2);
    }
    effects.consume(code2);
    return pathInside;
  }
  function pathAtPunctuation(code2) {
    if (code2 === 41) {
      sizeClose++;
    }
    effects.consume(code2);
    return pathInside;
  }
}
function tokenizeTrail(effects, ok3, nok) {
  return trail2;
  function trail2(code2) {
    if (code2 === 33 || code2 === 34 || code2 === 39 || code2 === 41 || code2 === 42 || code2 === 44 || code2 === 46 || code2 === 58 || code2 === 59 || code2 === 63 || code2 === 95 || code2 === 126) {
      effects.consume(code2);
      return trail2;
    }
    if (code2 === 38) {
      effects.consume(code2);
      return trailCharacterReferenceStart;
    }
    if (code2 === 93) {
      effects.consume(code2);
      return trailBracketAfter;
    }
    if (
      // `<` is an end.
      code2 === 60 || // So is whitespace.
      code2 === null || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2)
    ) {
      return ok3(code2);
    }
    return nok(code2);
  }
  function trailBracketAfter(code2) {
    if (code2 === null || code2 === 40 || code2 === 91 || markdownLineEndingOrSpace(code2) || unicodeWhitespace(code2)) {
      return ok3(code2);
    }
    return trail2(code2);
  }
  function trailCharacterReferenceStart(code2) {
    return asciiAlpha(code2) ? trailCharacterReferenceInside(code2) : nok(code2);
  }
  function trailCharacterReferenceInside(code2) {
    if (code2 === 59) {
      effects.consume(code2);
      return trail2;
    }
    if (asciiAlpha(code2)) {
      effects.consume(code2);
      return trailCharacterReferenceInside;
    }
    return nok(code2);
  }
}
function tokenizeEmailDomainDotTrail(effects, ok3, nok) {
  return start;
  function start(code2) {
    effects.consume(code2);
    return after;
  }
  function after(code2) {
    return asciiAlphanumeric(code2) ? nok(code2) : ok3(code2);
  }
}
function previousWww(code2) {
  return code2 === null || code2 === 40 || code2 === 42 || code2 === 95 || code2 === 91 || code2 === 93 || code2 === 126 || markdownLineEndingOrSpace(code2);
}
function previousProtocol(code2) {
  return !asciiAlpha(code2);
}
function previousEmail(code2) {
  return !(code2 === 47 || gfmAtext(code2));
}
function gfmAtext(code2) {
  return code2 === 43 || code2 === 45 || code2 === 46 || code2 === 95 || asciiAlphanumeric(code2);
}
function previousUnbalanced(events) {
  let index2 = events.length;
  let result = false;
  while (index2--) {
    const token = events[index2][1];
    if ((token.type === "labelLink" || token.type === "labelImage") && !token._balanced) {
      result = true;
      break;
    }
    if (token._gfmAutolinkLiteralWalkedInto) {
      result = false;
      break;
    }
  }
  if (events.length > 0 && !result) {
    events[events.length - 1][1]._gfmAutolinkLiteralWalkedInto = true;
  }
  return result;
}

// node_modules/micromark-extension-gfm-footnote/lib/syntax.js
var indent = {
  tokenize: tokenizeIndent2,
  partial: true
};
function gfmFootnote() {
  return {
    document: {
      [91]: {
        name: "gfmFootnoteDefinition",
        tokenize: tokenizeDefinitionStart,
        continuation: {
          tokenize: tokenizeDefinitionContinuation
        },
        exit: gfmFootnoteDefinitionEnd
      }
    },
    text: {
      [91]: {
        name: "gfmFootnoteCall",
        tokenize: tokenizeGfmFootnoteCall
      },
      [93]: {
        name: "gfmPotentialFootnoteCall",
        add: "after",
        tokenize: tokenizePotentialGfmFootnoteCall,
        resolveTo: resolveToPotentialGfmFootnoteCall
      }
    }
  };
}
function tokenizePotentialGfmFootnoteCall(effects, ok3, nok) {
  const self = this;
  let index2 = self.events.length;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let labelStart;
  while (index2--) {
    const token = self.events[index2][1];
    if (token.type === "labelImage") {
      labelStart = token;
      break;
    }
    if (token.type === "gfmFootnoteCall" || token.type === "labelLink" || token.type === "label" || token.type === "image" || token.type === "link") {
      break;
    }
  }
  return start;
  function start(code2) {
    if (!labelStart || !labelStart._balanced) {
      return nok(code2);
    }
    const id = normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    }));
    if (id.codePointAt(0) !== 94 || !defined.includes(id.slice(1))) {
      return nok(code2);
    }
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code2);
    effects.exit("gfmFootnoteCallLabelMarker");
    return ok3(code2);
  }
}
function resolveToPotentialGfmFootnoteCall(events, context) {
  let index2 = events.length;
  let labelStart;
  while (index2--) {
    if (events[index2][1].type === "labelImage" && events[index2][0] === "enter") {
      labelStart = events[index2][1];
      break;
    }
  }
  events[index2 + 1][1].type = "data";
  events[index2 + 3][1].type = "gfmFootnoteCallLabelMarker";
  const call = {
    type: "gfmFootnoteCall",
    start: Object.assign({}, events[index2 + 3][1].start),
    end: Object.assign({}, events[events.length - 1][1].end)
  };
  const marker = {
    type: "gfmFootnoteCallMarker",
    start: Object.assign({}, events[index2 + 3][1].end),
    end: Object.assign({}, events[index2 + 3][1].end)
  };
  marker.end.column++;
  marker.end.offset++;
  marker.end._bufferIndex++;
  const string3 = {
    type: "gfmFootnoteCallString",
    start: Object.assign({}, marker.end),
    end: Object.assign({}, events[events.length - 1][1].start)
  };
  const chunk = {
    type: "chunkString",
    contentType: "string",
    start: Object.assign({}, string3.start),
    end: Object.assign({}, string3.end)
  };
  const replacement = [
    // Take the `labelImageMarker` (now `data`, the `!`)
    events[index2 + 1],
    events[index2 + 2],
    ["enter", call, context],
    // The `[`
    events[index2 + 3],
    events[index2 + 4],
    // The `^`.
    ["enter", marker, context],
    ["exit", marker, context],
    // Everything in between.
    ["enter", string3, context],
    ["enter", chunk, context],
    ["exit", chunk, context],
    ["exit", string3, context],
    // The ending (`]`, properly parsed and labelled).
    events[events.length - 2],
    events[events.length - 1],
    ["exit", call, context]
  ];
  events.splice(index2, events.length - index2 + 1, ...replacement);
  return events;
}
function tokenizeGfmFootnoteCall(effects, ok3, nok) {
  const self = this;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let size = 0;
  let data;
  return start;
  function start(code2) {
    effects.enter("gfmFootnoteCall");
    effects.enter("gfmFootnoteCallLabelMarker");
    effects.consume(code2);
    effects.exit("gfmFootnoteCallLabelMarker");
    return callStart;
  }
  function callStart(code2) {
    if (code2 !== 94) return nok(code2);
    effects.enter("gfmFootnoteCallMarker");
    effects.consume(code2);
    effects.exit("gfmFootnoteCallMarker");
    effects.enter("gfmFootnoteCallString");
    effects.enter("chunkString").contentType = "string";
    return callData;
  }
  function callData(code2) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code2 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code2 === null || code2 === 91 || markdownLineEndingOrSpace(code2)
    ) {
      return nok(code2);
    }
    if (code2 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteCallString");
      if (!defined.includes(normalizeIdentifier(self.sliceSerialize(token)))) {
        return nok(code2);
      }
      effects.enter("gfmFootnoteCallLabelMarker");
      effects.consume(code2);
      effects.exit("gfmFootnoteCallLabelMarker");
      effects.exit("gfmFootnoteCall");
      return ok3;
    }
    if (!markdownLineEndingOrSpace(code2)) {
      data = true;
    }
    size++;
    effects.consume(code2);
    return code2 === 92 ? callEscape : callData;
  }
  function callEscape(code2) {
    if (code2 === 91 || code2 === 92 || code2 === 93) {
      effects.consume(code2);
      size++;
      return callData;
    }
    return callData(code2);
  }
}
function tokenizeDefinitionStart(effects, ok3, nok) {
  const self = this;
  const defined = self.parser.gfmFootnotes || (self.parser.gfmFootnotes = []);
  let identifier;
  let size = 0;
  let data;
  return start;
  function start(code2) {
    effects.enter("gfmFootnoteDefinition")._container = true;
    effects.enter("gfmFootnoteDefinitionLabel");
    effects.enter("gfmFootnoteDefinitionLabelMarker");
    effects.consume(code2);
    effects.exit("gfmFootnoteDefinitionLabelMarker");
    return labelAtMarker;
  }
  function labelAtMarker(code2) {
    if (code2 === 94) {
      effects.enter("gfmFootnoteDefinitionMarker");
      effects.consume(code2);
      effects.exit("gfmFootnoteDefinitionMarker");
      effects.enter("gfmFootnoteDefinitionLabelString");
      effects.enter("chunkString").contentType = "string";
      return labelInside;
    }
    return nok(code2);
  }
  function labelInside(code2) {
    if (
      // Too long.
      size > 999 || // Closing brace with nothing.
      code2 === 93 && !data || // Space or tab is not supported by GFM for some reason.
      // `\n` and `[` not being supported makes sense.
      code2 === null || code2 === 91 || markdownLineEndingOrSpace(code2)
    ) {
      return nok(code2);
    }
    if (code2 === 93) {
      effects.exit("chunkString");
      const token = effects.exit("gfmFootnoteDefinitionLabelString");
      identifier = normalizeIdentifier(self.sliceSerialize(token));
      effects.enter("gfmFootnoteDefinitionLabelMarker");
      effects.consume(code2);
      effects.exit("gfmFootnoteDefinitionLabelMarker");
      effects.exit("gfmFootnoteDefinitionLabel");
      return labelAfter;
    }
    if (!markdownLineEndingOrSpace(code2)) {
      data = true;
    }
    size++;
    effects.consume(code2);
    return code2 === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code2) {
    if (code2 === 91 || code2 === 92 || code2 === 93) {
      effects.consume(code2);
      size++;
      return labelInside;
    }
    return labelInside(code2);
  }
  function labelAfter(code2) {
    if (code2 === 58) {
      effects.enter("definitionMarker");
      effects.consume(code2);
      effects.exit("definitionMarker");
      if (!defined.includes(identifier)) {
        defined.push(identifier);
      }
      return factorySpace(effects, whitespaceAfter, "gfmFootnoteDefinitionWhitespace");
    }
    return nok(code2);
  }
  function whitespaceAfter(code2) {
    return ok3(code2);
  }
}
function tokenizeDefinitionContinuation(effects, ok3, nok) {
  return effects.check(blankLine, ok3, effects.attempt(indent, ok3, nok));
}
function gfmFootnoteDefinitionEnd(effects) {
  effects.exit("gfmFootnoteDefinition");
}
function tokenizeIndent2(effects, ok3, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "gfmFootnoteDefinitionIndent", 4 + 1);
  function afterPrefix(code2) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "gfmFootnoteDefinitionIndent" && tail[2].sliceSerialize(tail[1], true).length === 4 ? ok3(code2) : nok(code2);
  }
}

// node_modules/micromark-extension-gfm-strikethrough/lib/syntax.js
function gfmStrikethrough(options) {
  const options_ = options || {};
  let single = options_.singleTilde;
  const tokenizer = {
    name: "strikethrough",
    tokenize: tokenizeStrikethrough,
    resolveAll: resolveAllStrikethrough
  };
  if (single === null || single === void 0) {
    single = true;
  }
  return {
    text: {
      [126]: tokenizer
    },
    insideSpan: {
      null: [tokenizer]
    },
    attentionMarkers: {
      null: [126]
    }
  };
  function resolveAllStrikethrough(events, context) {
    let index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][0] === "enter" && events[index2][1].type === "strikethroughSequenceTemporary" && events[index2][1]._close) {
        let open = index2;
        while (open--) {
          if (events[open][0] === "exit" && events[open][1].type === "strikethroughSequenceTemporary" && events[open][1]._open && // If the sizes are the same:
          events[index2][1].end.offset - events[index2][1].start.offset === events[open][1].end.offset - events[open][1].start.offset) {
            events[index2][1].type = "strikethroughSequence";
            events[open][1].type = "strikethroughSequence";
            const strikethrough = {
              type: "strikethrough",
              start: Object.assign({}, events[open][1].start),
              end: Object.assign({}, events[index2][1].end)
            };
            const text4 = {
              type: "strikethroughText",
              start: Object.assign({}, events[open][1].end),
              end: Object.assign({}, events[index2][1].start)
            };
            const nextEvents = [["enter", strikethrough, context], ["enter", events[open][1], context], ["exit", events[open][1], context], ["enter", text4, context]];
            const insideSpan2 = context.parser.constructs.insideSpan.null;
            if (insideSpan2) {
              splice(nextEvents, nextEvents.length, 0, resolveAll(insideSpan2, events.slice(open + 1, index2), context));
            }
            splice(nextEvents, nextEvents.length, 0, [["exit", text4, context], ["enter", events[index2][1], context], ["exit", events[index2][1], context], ["exit", strikethrough, context]]);
            splice(events, open - 1, index2 - open + 3, nextEvents);
            index2 = open + nextEvents.length - 2;
            break;
          }
        }
      }
    }
    index2 = -1;
    while (++index2 < events.length) {
      if (events[index2][1].type === "strikethroughSequenceTemporary") {
        events[index2][1].type = "data";
      }
    }
    return events;
  }
  function tokenizeStrikethrough(effects, ok3, nok) {
    const previous3 = this.previous;
    const events = this.events;
    let size = 0;
    return start;
    function start(code2) {
      if (previous3 === 126 && events[events.length - 1][1].type !== "characterEscape") {
        return nok(code2);
      }
      effects.enter("strikethroughSequenceTemporary");
      return more(code2);
    }
    function more(code2) {
      const before = classifyCharacter(previous3);
      if (code2 === 126) {
        if (size > 1) return nok(code2);
        effects.consume(code2);
        size++;
        return more;
      }
      if (size < 2 && !single) return nok(code2);
      const token = effects.exit("strikethroughSequenceTemporary");
      const after = classifyCharacter(code2);
      token._open = !after || after === 2 && Boolean(before);
      token._close = !before || before === 2 && Boolean(after);
      return ok3(code2);
    }
  }
}

// node_modules/micromark-extension-gfm-table/lib/edit-map.js
var EditMap = class {
  /**
   * Create a new edit map.
   */
  constructor() {
    this.map = [];
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   * @param {number} remove
   * @param {Array<Event>} add
   * @returns {undefined}
   */
  add(index2, remove, add) {
    addImplementation(this, index2, remove, add);
  }
  // To do: add this when moving to `micromark`.
  // /**
  //  * Create an edit: but insert `add` before existing additions.
  //  *
  //  * @param {number} index
  //  * @param {number} remove
  //  * @param {Array<Event>} add
  //  * @returns {undefined}
  //  */
  // addBefore(index, remove, add) {
  //   addImplementation(this, index, remove, add, true)
  // }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   * @returns {undefined}
   */
  consume(events) {
    this.map.sort(function(a, b) {
      return a[0] - b[0];
    });
    if (this.map.length === 0) {
      return;
    }
    let index2 = this.map.length;
    const vecs = [];
    while (index2 > 0) {
      index2 -= 1;
      vecs.push(events.slice(this.map[index2][0] + this.map[index2][1]), this.map[index2][2]);
      events.length = this.map[index2][0];
    }
    vecs.push(events.slice());
    events.length = 0;
    let slice = vecs.pop();
    while (slice) {
      for (const element of slice) {
        events.push(element);
      }
      slice = vecs.pop();
    }
    this.map.length = 0;
  }
};
function addImplementation(editMap, at, remove, add) {
  let index2 = 0;
  if (remove === 0 && add.length === 0) {
    return;
  }
  while (index2 < editMap.map.length) {
    if (editMap.map[index2][0] === at) {
      editMap.map[index2][1] += remove;
      editMap.map[index2][2].push(...add);
      return;
    }
    index2 += 1;
  }
  editMap.map.push([at, remove, add]);
}

// node_modules/micromark-extension-gfm-table/lib/infer.js
function gfmTableAlign(events, index2) {
  let inDelimiterRow = false;
  const align = [];
  while (index2 < events.length) {
    const event = events[index2];
    if (inDelimiterRow) {
      if (event[0] === "enter") {
        if (event[1].type === "tableContent") {
          align.push(events[index2 + 1][1].type === "tableDelimiterMarker" ? "left" : "none");
        }
      } else if (event[1].type === "tableContent") {
        if (events[index2 - 1][1].type === "tableDelimiterMarker") {
          const alignIndex = align.length - 1;
          align[alignIndex] = align[alignIndex] === "left" ? "center" : "right";
        }
      } else if (event[1].type === "tableDelimiterRow") {
        break;
      }
    } else if (event[0] === "enter" && event[1].type === "tableDelimiterRow") {
      inDelimiterRow = true;
    }
    index2 += 1;
  }
  return align;
}

// node_modules/micromark-extension-gfm-table/lib/syntax.js
function gfmTable() {
  return {
    flow: {
      null: {
        name: "table",
        tokenize: tokenizeTable,
        resolveAll: resolveTable
      }
    }
  };
}
function tokenizeTable(effects, ok3, nok) {
  const self = this;
  let size = 0;
  let sizeB = 0;
  let seen;
  return start;
  function start(code2) {
    let index2 = self.events.length - 1;
    while (index2 > -1) {
      const type = self.events[index2][1].type;
      if (type === "lineEnding" || // Note: markdown-rs uses `whitespace` instead of `linePrefix`
      type === "linePrefix") index2--;
      else break;
    }
    const tail = index2 > -1 ? self.events[index2][1].type : null;
    const next = tail === "tableHead" || tail === "tableRow" ? bodyRowStart : headRowBefore;
    if (next === bodyRowStart && self.parser.lazy[self.now().line]) {
      return nok(code2);
    }
    return next(code2);
  }
  function headRowBefore(code2) {
    effects.enter("tableHead");
    effects.enter("tableRow");
    return headRowStart(code2);
  }
  function headRowStart(code2) {
    if (code2 === 124) {
      return headRowBreak(code2);
    }
    seen = true;
    sizeB += 1;
    return headRowBreak(code2);
  }
  function headRowBreak(code2) {
    if (code2 === null) {
      return nok(code2);
    }
    if (markdownLineEnding(code2)) {
      if (sizeB > 1) {
        sizeB = 0;
        self.interrupt = true;
        effects.exit("tableRow");
        effects.enter("lineEnding");
        effects.consume(code2);
        effects.exit("lineEnding");
        return headDelimiterStart;
      }
      return nok(code2);
    }
    if (markdownSpace(code2)) {
      return factorySpace(effects, headRowBreak, "whitespace")(code2);
    }
    sizeB += 1;
    if (seen) {
      seen = false;
      size += 1;
    }
    if (code2 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code2);
      effects.exit("tableCellDivider");
      seen = true;
      return headRowBreak;
    }
    effects.enter("data");
    return headRowData(code2);
  }
  function headRowData(code2) {
    if (code2 === null || code2 === 124 || markdownLineEndingOrSpace(code2)) {
      effects.exit("data");
      return headRowBreak(code2);
    }
    effects.consume(code2);
    return code2 === 92 ? headRowEscape : headRowData;
  }
  function headRowEscape(code2) {
    if (code2 === 92 || code2 === 124) {
      effects.consume(code2);
      return headRowData;
    }
    return headRowData(code2);
  }
  function headDelimiterStart(code2) {
    self.interrupt = false;
    if (self.parser.lazy[self.now().line]) {
      return nok(code2);
    }
    effects.enter("tableDelimiterRow");
    seen = false;
    if (markdownSpace(code2)) {
      return factorySpace(effects, headDelimiterBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code2);
    }
    return headDelimiterBefore(code2);
  }
  function headDelimiterBefore(code2) {
    if (code2 === 45 || code2 === 58) {
      return headDelimiterValueBefore(code2);
    }
    if (code2 === 124) {
      seen = true;
      effects.enter("tableCellDivider");
      effects.consume(code2);
      effects.exit("tableCellDivider");
      return headDelimiterCellBefore;
    }
    return headDelimiterNok(code2);
  }
  function headDelimiterCellBefore(code2) {
    if (markdownSpace(code2)) {
      return factorySpace(effects, headDelimiterValueBefore, "whitespace")(code2);
    }
    return headDelimiterValueBefore(code2);
  }
  function headDelimiterValueBefore(code2) {
    if (code2 === 58) {
      sizeB += 1;
      seen = true;
      effects.enter("tableDelimiterMarker");
      effects.consume(code2);
      effects.exit("tableDelimiterMarker");
      return headDelimiterLeftAlignmentAfter;
    }
    if (code2 === 45) {
      sizeB += 1;
      return headDelimiterLeftAlignmentAfter(code2);
    }
    if (code2 === null || markdownLineEnding(code2)) {
      return headDelimiterCellAfter(code2);
    }
    return headDelimiterNok(code2);
  }
  function headDelimiterLeftAlignmentAfter(code2) {
    if (code2 === 45) {
      effects.enter("tableDelimiterFiller");
      return headDelimiterFiller(code2);
    }
    return headDelimiterNok(code2);
  }
  function headDelimiterFiller(code2) {
    if (code2 === 45) {
      effects.consume(code2);
      return headDelimiterFiller;
    }
    if (code2 === 58) {
      seen = true;
      effects.exit("tableDelimiterFiller");
      effects.enter("tableDelimiterMarker");
      effects.consume(code2);
      effects.exit("tableDelimiterMarker");
      return headDelimiterRightAlignmentAfter;
    }
    effects.exit("tableDelimiterFiller");
    return headDelimiterRightAlignmentAfter(code2);
  }
  function headDelimiterRightAlignmentAfter(code2) {
    if (markdownSpace(code2)) {
      return factorySpace(effects, headDelimiterCellAfter, "whitespace")(code2);
    }
    return headDelimiterCellAfter(code2);
  }
  function headDelimiterCellAfter(code2) {
    if (code2 === 124) {
      return headDelimiterBefore(code2);
    }
    if (code2 === null || markdownLineEnding(code2)) {
      if (!seen || size !== sizeB) {
        return headDelimiterNok(code2);
      }
      effects.exit("tableDelimiterRow");
      effects.exit("tableHead");
      return ok3(code2);
    }
    return headDelimiterNok(code2);
  }
  function headDelimiterNok(code2) {
    return nok(code2);
  }
  function bodyRowStart(code2) {
    effects.enter("tableRow");
    return bodyRowBreak(code2);
  }
  function bodyRowBreak(code2) {
    if (code2 === 124) {
      effects.enter("tableCellDivider");
      effects.consume(code2);
      effects.exit("tableCellDivider");
      return bodyRowBreak;
    }
    if (code2 === null || markdownLineEnding(code2)) {
      effects.exit("tableRow");
      return ok3(code2);
    }
    if (markdownSpace(code2)) {
      return factorySpace(effects, bodyRowBreak, "whitespace")(code2);
    }
    effects.enter("data");
    return bodyRowData(code2);
  }
  function bodyRowData(code2) {
    if (code2 === null || code2 === 124 || markdownLineEndingOrSpace(code2)) {
      effects.exit("data");
      return bodyRowBreak(code2);
    }
    effects.consume(code2);
    return code2 === 92 ? bodyRowEscape : bodyRowData;
  }
  function bodyRowEscape(code2) {
    if (code2 === 92 || code2 === 124) {
      effects.consume(code2);
      return bodyRowData;
    }
    return bodyRowData(code2);
  }
}
function resolveTable(events, context) {
  let index2 = -1;
  let inFirstCellAwaitingPipe = true;
  let rowKind = 0;
  let lastCell = [0, 0, 0, 0];
  let cell = [0, 0, 0, 0];
  let afterHeadAwaitingFirstBodyRow = false;
  let lastTableEnd = 0;
  let currentTable;
  let currentBody;
  let currentCell;
  const map = new EditMap();
  while (++index2 < events.length) {
    const event = events[index2];
    const token = event[1];
    if (event[0] === "enter") {
      if (token.type === "tableHead") {
        afterHeadAwaitingFirstBodyRow = false;
        if (lastTableEnd !== 0) {
          flushTableEnd(map, context, lastTableEnd, currentTable, currentBody);
          currentBody = void 0;
          lastTableEnd = 0;
        }
        currentTable = {
          type: "table",
          start: Object.assign({}, token.start),
          // Note: correct end is set later.
          end: Object.assign({}, token.end)
        };
        map.add(index2, 0, [["enter", currentTable, context]]);
      } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
        inFirstCellAwaitingPipe = true;
        currentCell = void 0;
        lastCell = [0, 0, 0, 0];
        cell = [0, index2 + 1, 0, 0];
        if (afterHeadAwaitingFirstBodyRow) {
          afterHeadAwaitingFirstBodyRow = false;
          currentBody = {
            type: "tableBody",
            start: Object.assign({}, token.start),
            // Note: correct end is set later.
            end: Object.assign({}, token.end)
          };
          map.add(index2, 0, [["enter", currentBody, context]]);
        }
        rowKind = token.type === "tableDelimiterRow" ? 2 : currentBody ? 3 : 1;
      } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
        inFirstCellAwaitingPipe = false;
        if (cell[2] === 0) {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map, context, lastCell, rowKind, void 0, currentCell);
            lastCell = [0, 0, 0, 0];
          }
          cell[2] = index2;
        }
      } else if (token.type === "tableCellDivider") {
        if (inFirstCellAwaitingPipe) {
          inFirstCellAwaitingPipe = false;
        } else {
          if (lastCell[1] !== 0) {
            cell[0] = cell[1];
            currentCell = flushCell(map, context, lastCell, rowKind, void 0, currentCell);
          }
          lastCell = cell;
          cell = [lastCell[1], index2, 0, 0];
        }
      }
    } else if (token.type === "tableHead") {
      afterHeadAwaitingFirstBodyRow = true;
      lastTableEnd = index2;
    } else if (token.type === "tableRow" || token.type === "tableDelimiterRow") {
      lastTableEnd = index2;
      if (lastCell[1] !== 0) {
        cell[0] = cell[1];
        currentCell = flushCell(map, context, lastCell, rowKind, index2, currentCell);
      } else if (cell[1] !== 0) {
        currentCell = flushCell(map, context, cell, rowKind, index2, currentCell);
      }
      rowKind = 0;
    } else if (rowKind && (token.type === "data" || token.type === "tableDelimiterMarker" || token.type === "tableDelimiterFiller")) {
      cell[3] = index2;
    }
  }
  if (lastTableEnd !== 0) {
    flushTableEnd(map, context, lastTableEnd, currentTable, currentBody);
  }
  map.consume(context.events);
  index2 = -1;
  while (++index2 < context.events.length) {
    const event = context.events[index2];
    if (event[0] === "enter" && event[1].type === "table") {
      event[1]._align = gfmTableAlign(context.events, index2);
    }
  }
  return events;
}
function flushCell(map, context, range, rowKind, rowEnd, previousCell) {
  const groupName = rowKind === 1 ? "tableHeader" : rowKind === 2 ? "tableDelimiter" : "tableData";
  const valueName = "tableContent";
  if (range[0] !== 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, range[0]));
    map.add(range[0], 0, [["exit", previousCell, context]]);
  }
  const now = getPoint(context.events, range[1]);
  previousCell = {
    type: groupName,
    start: Object.assign({}, now),
    // Note: correct end is set later.
    end: Object.assign({}, now)
  };
  map.add(range[1], 0, [["enter", previousCell, context]]);
  if (range[2] !== 0) {
    const relatedStart = getPoint(context.events, range[2]);
    const relatedEnd = getPoint(context.events, range[3]);
    const valueToken = {
      type: valueName,
      start: Object.assign({}, relatedStart),
      end: Object.assign({}, relatedEnd)
    };
    map.add(range[2], 0, [["enter", valueToken, context]]);
    if (rowKind !== 2) {
      const start = context.events[range[2]];
      const end = context.events[range[3]];
      start[1].end = Object.assign({}, end[1].end);
      start[1].type = "chunkText";
      start[1].contentType = "text";
      if (range[3] > range[2] + 1) {
        const a = range[2] + 1;
        const b = range[3] - range[2] - 1;
        map.add(a, b, []);
      }
    }
    map.add(range[3] + 1, 0, [["exit", valueToken, context]]);
  }
  if (rowEnd !== void 0) {
    previousCell.end = Object.assign({}, getPoint(context.events, rowEnd));
    map.add(rowEnd, 0, [["exit", previousCell, context]]);
    previousCell = void 0;
  }
  return previousCell;
}
function flushTableEnd(map, context, index2, table, tableBody) {
  const exits = [];
  const related = getPoint(context.events, index2);
  if (tableBody) {
    tableBody.end = Object.assign({}, related);
    exits.push(["exit", tableBody, context]);
  }
  table.end = Object.assign({}, related);
  exits.push(["exit", table, context]);
  map.add(index2 + 1, 0, exits);
}
function getPoint(events, index2) {
  const event = events[index2];
  const side = event[0] === "enter" ? "start" : "end";
  return event[1][side];
}

// node_modules/micromark-extension-gfm-task-list-item/lib/syntax.js
var tasklistCheck = {
  name: "tasklistCheck",
  tokenize: tokenizeTasklistCheck
};
function gfmTaskListItem() {
  return {
    text: {
      [91]: tasklistCheck
    }
  };
}
function tokenizeTasklistCheck(effects, ok3, nok) {
  const self = this;
  return open;
  function open(code2) {
    if (
      // Exit if there’s stuff before.
      self.previous !== null || // Exit if not in the first content that is the first child of a list
      // item.
      !self._gfmTasklistFirstContentOfListItem
    ) {
      return nok(code2);
    }
    effects.enter("taskListCheck");
    effects.enter("taskListCheckMarker");
    effects.consume(code2);
    effects.exit("taskListCheckMarker");
    return inside;
  }
  function inside(code2) {
    if (markdownLineEndingOrSpace(code2)) {
      effects.enter("taskListCheckValueUnchecked");
      effects.consume(code2);
      effects.exit("taskListCheckValueUnchecked");
      return close;
    }
    if (code2 === 88 || code2 === 120) {
      effects.enter("taskListCheckValueChecked");
      effects.consume(code2);
      effects.exit("taskListCheckValueChecked");
      return close;
    }
    return nok(code2);
  }
  function close(code2) {
    if (code2 === 93) {
      effects.enter("taskListCheckMarker");
      effects.consume(code2);
      effects.exit("taskListCheckMarker");
      effects.exit("taskListCheck");
      return after;
    }
    return nok(code2);
  }
  function after(code2) {
    if (markdownLineEnding(code2)) {
      return ok3(code2);
    }
    if (markdownSpace(code2)) {
      return effects.check({
        tokenize: spaceThenNonSpace
      }, ok3, nok)(code2);
    }
    return nok(code2);
  }
}
function spaceThenNonSpace(effects, ok3, nok) {
  return factorySpace(effects, after, "whitespace");
  function after(code2) {
    return code2 === null ? nok(code2) : ok3(code2);
  }
}

// node_modules/micromark-extension-gfm/index.js
function gfm(options) {
  return combineExtensions([
    gfmAutolinkLiteral(),
    gfmFootnote(),
    gfmStrikethrough(options),
    gfmTable(),
    gfmTaskListItem()
  ]);
}

// core/motion-doc/domain/motionDocMarkdown.ts
var markdownIdPattern = /<!--\s*slidex-block-id\s*:\s*([A-Za-z0-9._:-]+)\s*-->/;
var trailingMarkdownIdPattern = /<!--\s*slidex-block-id\s*:\s*([A-Za-z0-9._:-]+)\s*-->\s*$/;
var slideXMarkerPattern = /^\s*<!--\s*slidex-(?:block|note)-id\s*:\s*[A-Za-z0-9._:-]+\s*-->\s*$/;
function parseMotionDocMarkdown(source) {
  const parserSource = source.replace(
    /[ \t]+(<!--\s*slidex-block-id\s*:\s*[A-Za-z0-9._:-]+\s*-->)/g,
    "$1"
  );
  const tree = fromMarkdown(parserSource, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()]
  });
  return tree.children.flatMap(
    (node2) => motionDocBlocksFromMarkdownNode(node2, parserSource)
  );
}
function motionDocBlocksFromMarkdownNode(node2, source) {
  const id = markdownNodeId(node2, source);
  if (node2.type === "heading") {
    const content3 = phrasingText(node2.children);
    const props = markdownProps(
      content3,
      {
        markdownDepth: node2.depth,
        markdownKind: "heading"
      },
      id
    );
    if (node2.depth === 1) {
      return [{ props, text: content3.text, type: "Title" }];
    }
    return [{
      props: {
        ...props,
        fontSize: markdownHeadingFontSize(node2.depth),
        fontWeight: 700
      },
      text: content3.text,
      type: "heading"
    }];
  }
  if (node2.type === "paragraph") {
    const content3 = phrasingText(node2.children);
    return [{
      props: markdownProps(
        content3,
        { markdownKind: "paragraph" },
        id
      ),
      text: content3.text,
      type: "Text"
    }];
  }
  if (node2.type === "blockquote") {
    const content3 = blockText(node2.children);
    const italicized = content3.text ? mergeTextRanges([
      ...content3.ranges,
      { end: content3.text.length, italic: true, start: 0 }
    ]) : content3.ranges;
    return [{
      props: markdownProps(
        { ...content3, ranges: italicized },
        { markdownKind: "blockquote" },
        id
      ),
      text: content3.text,
      type: "Text"
    }];
  }
  if (node2.type === "code") {
    const content3 = {
      ranges: node2.value ? [{
        end: node2.value.length,
        fontFamily: "ui-monospace",
        start: 0
      }] : [],
      text: node2.value
    };
    return [{
      props: markdownProps(
        content3,
        {
          fontFamily: "ui-monospace",
          markdownKind: "code"
        },
        id
      ),
      text: content3.text,
      type: "Text"
    }];
  }
  if (node2.type === "list") {
    const content3 = listText(node2);
    return [{
      props: markdownProps(
        content3,
        {
          listStart: node2.start ?? 1,
          listType: node2.ordered ? "ordered" : "bullet",
          markdownKind: "list"
        },
        id
      ),
      text: content3.text,
      type: "Text"
    }];
  }
  if (node2.type === "table") {
    return [markdownTableBlock(node2, id)];
  }
  if (node2.type === "html") {
    if (slideXMarkerPattern.test(node2.value)) return [];
    return [{
      props: {
        markdownKind: "paragraph"
      },
      text: node2.value,
      type: "Text"
    }];
  }
  return [];
}
function markdownTableBlock(table, id) {
  const rows = table.children.slice(0, 50).map(
    (row) => row.children.slice(0, 50).map((cell) => phrasingText(cell.children).text)
  );
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const normalizedRows = rows.map(
    (row) => Array.from({ length: columns }, (_, columnIndex) => row[columnIndex] ?? "")
  );
  const columnOverrides = Object.fromEntries(
    (table.align ?? []).slice(0, columns).flatMap(
      (alignment, columnIndex) => alignment ? [[columnIndex, { textAlign: alignment }]] : []
    )
  );
  return {
    props: {
      ...id ? { id } : {},
      background: "#ffffff",
      borderColor: "#d1d5db",
      borderWidth: 1,
      cellBackground: "#ffffff",
      cells: serializeMarkdownTableCells(normalizedRows),
      ...Object.keys(columnOverrides).length > 0 ? { colOverrides: JSON.stringify(columnOverrides) } : {},
      columns,
      color: "#111827",
      fontSize: 12,
      h: Math.min(62, Math.max(24, 14 + normalizedRows.length * 5)),
      markdownKind: "table",
      rowOverrides: JSON.stringify({
        0: { background: "#f3f4f6", fontWeight: 700 }
      }),
      rows: Math.max(1, normalizedRows.length),
      stripeBackground: "#f8fafc",
      w: Math.min(86, Math.max(42, 24 + columns * 8)),
      x: 7,
      y: 30
    },
    type: "Table"
  };
}
function serializeMarkdownTableCells(cells) {
  return cells.map((row) => row.map(
    (cell) => cell.replaceAll('"', "'").replaceAll("|", "/").replaceAll(";", ",").trim()
  ).join("|")).join(";");
}
function listText(list2) {
  const result = { ranges: [], text: "" };
  list2.children.forEach((item, index2) => {
    if (index2 > 0) appendText(result, "\n");
    appendTextResult(result, listItemText(item));
  });
  return result;
}
function listItemText(item) {
  const result = { ranges: [], text: "" };
  item.children.forEach((child, index2) => {
    if (index2 > 0) appendText(result, "\n");
    if (child.type === "list") {
      appendTextResult(result, listText(child));
      return;
    }
    appendTextResult(result, blockNodeText(child));
  });
  return result;
}
function blockText(nodes) {
  const result = { ranges: [], text: "" };
  nodes.forEach((node2, index2) => {
    if (index2 > 0) appendText(result, "\n");
    appendTextResult(result, blockNodeText(node2));
  });
  return result;
}
function blockNodeText(node2) {
  if (node2.type === "paragraph" || node2.type === "heading") {
    return phrasingText(node2.children);
  }
  if (node2.type === "code") {
    return {
      ranges: node2.value ? [{
        end: node2.value.length,
        fontFamily: "ui-monospace",
        start: 0
      }] : [],
      text: node2.value
    };
  }
  if (node2.type === "list") return listText(node2);
  if (node2.type === "blockquote") return blockText(node2.children);
  return { ranges: [], text: "" };
}
function phrasingText(nodes) {
  const result = { ranges: [], text: "" };
  nodes.forEach((node2) => appendPhrasingNode(result, node2, {}));
  return {
    ranges: mergeTextRanges(result.ranges),
    text: result.text
  };
}
function appendPhrasingNode(result, node2, inheritedStyle) {
  if (node2.type === "text") {
    appendText(result, node2.value, inheritedStyle);
    return;
  }
  if (node2.type === "inlineCode") {
    appendText(result, node2.value, {
      ...inheritedStyle,
      fontFamily: "ui-monospace"
    });
    return;
  }
  if (node2.type === "break") {
    appendText(result, "\n", inheritedStyle);
    return;
  }
  if (node2.type === "image") {
    appendText(result, node2.alt ?? node2.url, inheritedStyle);
    return;
  }
  if (node2.type === "html") return;
  const nextStyle = node2.type === "strong" ? { ...inheritedStyle, fontWeight: 700 } : node2.type === "emphasis" ? { ...inheritedStyle, italic: true } : node2.type === "link" ? {
    ...inheritedStyle,
    href: safeMarkdownHref(node2.url),
    underline: true
  } : inheritedStyle;
  if ("children" in node2) {
    node2.children.forEach(
      (child) => appendPhrasingNode(result, child, nextStyle)
    );
  }
}
function appendText(result, value, style = {}) {
  const start = result.text.length;
  result.text += value;
  const end = result.text.length;
  if (end > start && hasInlineStyle(style)) {
    result.ranges.push({ ...style, end, start });
  }
}
function appendTextResult(result, value) {
  const offset = result.text.length;
  result.text += value.text;
  result.ranges.push(
    ...value.ranges.map((range) => ({
      ...range,
      end: range.end + offset,
      start: range.start + offset
    }))
  );
}
function markdownProps(content3, baseProps, id) {
  return {
    ...baseProps,
    ...id ? { id } : {},
    ...content3.ranges.length > 0 ? { textStyleRanges: JSON.stringify(content3.ranges) } : {}
  };
}
function markdownNodeId(node2, source) {
  const start = node2.position?.start.offset;
  const end = node2.position?.end.offset;
  if (start === void 0 || end === void 0) return void 0;
  return source.slice(0, start).match(trailingMarkdownIdPattern)?.[1] ?? source.slice(start, end).match(markdownIdPattern)?.[1];
}
function mergeTextRanges(ranges) {
  const boundaries = /* @__PURE__ */ new Set();
  ranges.forEach(({ end, start }) => {
    boundaries.add(start);
    boundaries.add(end);
  });
  const offsets = [...boundaries].sort((left, right) => left - right);
  return offsets.slice(0, -1).flatMap((start, index2) => {
    const end = offsets[index2 + 1];
    const active = ranges.filter(
      (range) => range.start <= start && range.end >= end
    );
    if (active.length === 0) return [];
    const style = active.reduce(
      (combined, range) => ({
        ...combined,
        ...range.color ? { color: range.color } : {},
        ...range.fontFamily ? { fontFamily: range.fontFamily } : {},
        ...range.fontWeight === void 0 ? {} : { fontWeight: range.fontWeight },
        ...range.href ? { href: range.href } : {},
        ...range.italic ? { italic: true } : {},
        ...range.underline ? { underline: true } : {}
      }),
      {}
    );
    return [{ ...style, end, start }];
  });
}
function hasInlineStyle(style) {
  return Boolean(
    style.color || style.fontFamily || style.fontWeight !== void 0 || style.href || style.italic || style.underline
  );
}
function safeMarkdownHref(value) {
  const trimmed = value.trim();
  if (/^(?:https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^(?:\/|#|\.\.?\/)/.test(trimmed)) return trimmed;
  return "";
}
function markdownHeadingFontSize(depth) {
  if (depth === 2) return 30;
  if (depth === 3) return 24;
  if (depth === 4) return 20;
  return 17;
}

// core/motion-doc/domain/mediaSource.ts
var absoluteProtocolPattern = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
var embeddedMediaPattern = /^data:(?:image\/(?:avif|gif|jpeg|png|webp)|video\/(?:mp4|ogg|quicktime|webm));base64,[A-Za-z0-9+/]+={0,2}$/i;
var controlCharacterPattern = /[\u0000-\u001f\u007f]/;
var localHttpHosts = /* @__PURE__ */ new Set(["127.0.0.1", "::1", "localhost"]);
function sanitizeMotionDocMediaSource(value) {
  const source = value.trim();
  if (!source || controlCharacterPattern.test(source) || source.includes("\\")) return "";
  if (!absoluteProtocolPattern.test(source)) {
    if (source.startsWith("//") || source.split("/").includes("..")) return "";
    return source;
  }
  if (embeddedMediaPattern.test(source)) return source;
  try {
    const url = new URL(source);
    if (url.protocol === "https:") return source;
    if (url.protocol === "http:" && localHttpHosts.has(url.hostname)) return source;
    if (url.protocol === "blob:" && /^blob:(?:https?:\/\/|null\/)/i.test(source)) return source;
  } catch {
    return "";
  }
  return "";
}

// core/motion-doc/domain/videoSource.ts
function sanitizeMotionDocVideoSource(value) {
  const source = sanitizeMotionDocMediaSource(value);
  if (source.startsWith("blob:")) return "";
  if (source.startsWith("data:") && !source.toLowerCase().startsWith("data:video/")) return "";
  return source;
}

// core/motion-doc/domain/motionDocParser.ts
var mediaSourcePropNames = /* @__PURE__ */ new Set(["backgroundImage", "poster", "shapeImageSrc", "src"]);
function parseMotionDoc(source) {
  const firstSlideOffset = source.search(/<(?:Slide|Scene)\b/);
  const documentHeader = firstSlideOffset >= 0 ? source.slice(0, firstSlideOffset) : source;
  const title = documentHeader.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Slider Preview";
  const sceneMatches = Array.from(
    source.matchAll(/<(?:Slide|Scene)\b([^>]*)>([\s\S]*?)<\/(?:Slide|Scene)>/g)
  );
  return {
    title,
    scenes: sceneMatches.map((match) => {
      const props = parseProps(match[1] ?? "");
      const durationValue = props.duration;
      const sceneSource = match[2] ?? "";
      return {
        duration: typeof durationValue === "number" && Number.isFinite(durationValue) ? durationValue : 0,
        props,
        blocks: parseSceneBlocks(removeSpeakerNotes(sceneSource)),
        notes: parseSpeakerNotes(sceneSource)
      };
    })
  };
}
function parseSpeakerNotes(sceneSource) {
  const match = sceneSource.match(/<Notes\b[^>]*>([\s\S]*?)<\/Notes>/);
  if (!match) return void 0;
  const markdown = dedentSpeakerNotes(match[1] ?? "");
  const plainText = parseMotionDocMarkdown(markdown).flatMap((block) => "text" in block ? [block.text] : []).join("\n").trim();
  return { markdown, plainText };
}
function dedentSpeakerNotes(source) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  const indent2 = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0)
  );
  return lines.map((line) => line.slice(Number.isFinite(indent2) ? indent2 : 0)).join("\n").trimEnd();
}
function removeSpeakerNotes(sceneSource) {
  return sceneSource.replace(/<Notes\b[^>]*>[\s\S]*?<\/Notes>/g, "\n");
}
function parseSceneBlocks(sceneSource) {
  const normalizedSceneSource = expandGroupMarkup(sceneSource);
  const blocks = [];
  const blockPattern = /<(Title|Text)\b([^>]*)>([\s\S]*?)<\/\1>|<(Card|Chart|ImageBlock|VideoBlock|Metric|Icon|Shape|Stack|Table)\b([\s\S]*?)\/>/g;
  let cursor = 0;
  for (const match of normalizedSceneSource.matchAll(blockPattern)) {
    const matchStart = match.index ?? cursor;
    blocks.push(
      ...parseMotionDocMarkdown(normalizedSceneSource.slice(cursor, matchStart))
    );
    const pairedType = match[1];
    const selfClosingType = match[4];
    cursor = matchStart + match[0].length;
    if (pairedType) {
      blocks.push({
        type: pairedType,
        props: parseProps(match[2] ?? ""),
        text: normalizeText(match[3] ?? "")
      });
      continue;
    }
    if (selfClosingType) {
      const props = parseProps(match[5] ?? "");
      if (selfClosingType === "VideoBlock") {
        delete props.sourceType;
        if (typeof props.src === "string") props.src = sanitizeMotionDocVideoSource(props.src);
      }
      blocks.push({
        type: selfClosingType,
        props
      });
    }
  }
  blocks.push(...parseMotionDocMarkdown(normalizedSceneSource.slice(cursor)));
  return blocks;
}
function expandGroupMarkup(sceneSource) {
  return sceneSource.replace(/<Group\b([^>]*)>([\s\S]*?)<\/Group>/g, (_match, rawProps, children, offset) => {
    const props = parseProps(rawProps);
    const groupId = String(props.id ?? props.groupId ?? `group-${offset}`);
    const groupName = String(props.name ?? props.groupName ?? "Group");
    const groupAttrs = ` groupId="${encodeInjectedAttribute(groupId)}" groupName="${encodeInjectedAttribute(groupName)}"`;
    return children.replace(
      /<(Title|Text|Card|Chart|ImageBlock|VideoBlock|Metric|Icon|Shape|Stack|Table)\b/g,
      (opening) => `${opening}${groupAttrs}`
    );
  });
}
function encodeInjectedAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}
function parseProps(rawProps) {
  const props = {};
  for (const attribute of scanMdxAttributes(rawProps)) {
    const { key } = attribute;
    const value = attribute.kind === "quoted" ? decodeMdxAttribute(attribute.value) : attribute.value;
    const numericValue = Number(value);
    props[key] = mediaSourcePropNames.has(key) ? sanitizeMotionDocMediaSource(value) : key !== "text" && Number.isFinite(numericValue) && value.trim() !== "" ? numericValue : value;
  }
  return props;
}
function scanMdxAttributes(source) {
  const attributes = [];
  let cursor = 0;
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    const keyMatch = source.slice(cursor).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!keyMatch) {
      cursor += 1;
      continue;
    }
    const key = keyMatch[0];
    cursor += key.length;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    if (source[cursor] !== "=") {
      attributes.push({ key, kind: "quoted", value: "true" });
      continue;
    }
    cursor += 1;
    while (/\s/.test(source[cursor] ?? "")) cursor += 1;
    const opening = source[cursor];
    if (opening === '"' || opening === "'") {
      const start = cursor + 1;
      cursor += 1;
      while (cursor < source.length) {
        if (source[cursor] === opening && source[cursor - 1] !== "\\") break;
        cursor += 1;
      }
      attributes.push({ key, kind: "quoted", value: source.slice(start, cursor) });
      cursor += 1;
      continue;
    }
    if (opening === "{") {
      const start = cursor + 1;
      let depth = 1;
      let quote = null;
      cursor += 1;
      while (cursor < source.length && depth > 0) {
        const character = source[cursor];
        if (quote) {
          if (character === quote && source[cursor - 1] !== "\\") quote = null;
        } else if (character === '"' || character === "'") {
          quote = character;
        } else if (character === "{") {
          depth += 1;
        } else if (character === "}") {
          depth -= 1;
        }
        cursor += 1;
      }
      if (depth === 0) {
        attributes.push({ key, kind: "expression", value: source.slice(start, cursor - 1).trim() });
      }
      continue;
    }
  }
  return attributes;
}
function decodeMdxAttribute(value) {
  return value.replaceAll("&#10;", "\n").replaceAll("&#xA;", "\n").replaceAll("&#xa;", "\n").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}
function normalizeText(value) {
  const decoded = decodeMdxText(value).replace(/\r\n?/g, "\n");
  if (!value.includes("\n")) return decoded;
  const lines = decoded.split("\n");
  while (lines[0]?.trim() === "") lines.shift();
  while (lines.at(-1)?.trim() === "") lines.pop();
  const indent2 = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0)
  );
  return lines.map((line) => line.slice(Number.isFinite(indent2) ? indent2 : 0)).join("\n");
}
function decodeMdxText(value) {
  return value.replaceAll("&amp;#10;", "\n").replaceAll("&amp;#xA;", "\n").replaceAll("&amp;#xa;", "\n").replaceAll("&#10;", "\n").replaceAll("&#xA;", "\n").replaceAll("&#xa;", "\n").replaceAll("&#123;", "{").replaceAll("&#x7B;", "{").replaceAll("&#x7b;", "{").replaceAll("&#125;", "}").replaceAll("&#x7D;", "}").replaceAll("&#x7d;", "}").replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
}

// core/motion-doc/application/localMediaPolicy.ts
var localImageAssetPattern = /^assets\/[A-Za-z0-9._-]+\.webp$/i;
var localVideoAssetPattern = /^assets\/[A-Za-z0-9._-]+\.mp4$/i;
var localMediaAttributePattern = /\s+(backgroundImage|poster|shapeImageSrc|src)=("[^"]*"|'[^']*')/g;
function isOpenSlideXLocalAssetSource(value) {
  return isOpenSlideXLocalImageAssetSource(value) || isOpenSlideXLocalVideoAssetSource(value);
}
function isOpenSlideXLocalImageAssetSource(value) {
  return typeof value === "string" && localImageAssetPattern.test(value.trim());
}
function isOpenSlideXLocalVideoAssetSource(value) {
  return typeof value === "string" && localVideoAssetPattern.test(value.trim());
}
function isOpenSlideXCompatibleMediaSource(value) {
  if (isOpenSlideXLocalAssetSource(value)) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}
function stripNonLocalMotionDocMedia(source) {
  return source.replace(localMediaAttributePattern, (attribute, prop, quotedValue) => {
    const value = quotedValue.slice(1, -1);
    return isOpenSlideXCompatibleMediaSource(value) ? attribute : "";
  });
}

// core/motion-doc/application/motionDocBlockIdentity.ts
var blockIdPrefix = "block";
var fallbackBlockIdSequence = 0;
function createMotionDocBlockId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${blockIdPrefix}-${globalThis.crypto.randomUUID()}`;
  }
  fallbackBlockIdSequence += 1;
  return `${blockIdPrefix}-${Date.now().toString(36)}-${fallbackBlockIdSequence.toString(36)}`;
}
function motionDocBlockId(block) {
  const id = block.props.id;
  return typeof id === "string" && id.trim() ? id.trim() : "";
}
function ensureMotionDocBlockIds(blocks) {
  const seenIds = /* @__PURE__ */ new Set();
  let didChange = false;
  const nextBlocks = blocks.map((block) => {
    const currentId = motionDocBlockId(block);
    if (currentId && !seenIds.has(currentId)) {
      seenIds.add(currentId);
      return block;
    }
    didChange = true;
    let nextId = createMotionDocBlockId();
    while (seenIds.has(nextId)) nextId = createMotionDocBlockId();
    seenIds.add(nextId);
    return {
      ...block,
      props: {
        ...block.props,
        id: nextId
      }
    };
  });
  return didChange ? nextBlocks : blocks;
}
function ensureMotionDocSceneBlockIds(scene) {
  const blocks = ensureMotionDocBlockIds(scene.blocks);
  return blocks === scene.blocks ? scene : { ...scene, blocks: [...blocks] };
}

// core/motion-doc/application/motionDocSourceEditor.ts
function motionDocSlideSourceRanges(source) {
  return [...source.matchAll(slidePattern())].map((match) => ({
    end: (match.index ?? 0) + match[0].length,
    openingTag: match[0].slice(0, match[0].indexOf(">") + 1),
    source: match[0],
    start: match.index ?? 0
  }));
}
function slidePattern() {
  return /<(Slide|Scene)\b[^>]*>[\s\S]*?<\/\1>/g;
}

// core/motion-doc/application/motionDocSerialize.ts
function generateSlideString(slide) {
  const identifiedSlide = ensureMotionDocSceneBlockIds(slide);
  const tag = formatSlideTag(identifiedSlide.props);
  const blockStrings = [];
  for (let index2 = 0; index2 < identifiedSlide.blocks.length; ) {
    const block = identifiedSlide.blocks[index2];
    const groupId = groupIdOf(block);
    if (!groupId) {
      blockStrings.push(`  ${generateBlockString(block)}`);
      index2 += 1;
      continue;
    }
    const groupedBlocks = [];
    while (index2 < identifiedSlide.blocks.length && groupIdOf(identifiedSlide.blocks[index2]) === groupId) {
      groupedBlocks.push(identifiedSlide.blocks[index2]);
      index2 += 1;
    }
    blockStrings.push(indentGroupString(generateGroupString(groupedBlocks, groupId)));
  }
  const notes = identifiedSlide.notes?.markdown.trim();
  const notesString = notes ? `
  <Notes>
${notes.split("\n").map((line) => `    ${line}`).join("\n")}
  </Notes>` : "";
  return `${tag}
${blockStrings.join("\n")}${notesString}
</Slide>`;
}
function generateGroupString(blocks, groupId) {
  const identifiedBlocks = ensureMotionDocBlockIds(blocks);
  const namedBlock = identifiedBlocks.find((block) => "props" in block && typeof block.props.groupName === "string");
  const groupName = namedBlock?.props.groupName;
  const nameAttr = typeof groupName === "string" && groupName.trim() ? ` name="${escapeMdxAttribute(groupName)}"` : "";
  const children = identifiedBlocks.map((block) => `  ${generateBlockStringWithProps(block, withoutGroupProps("props" in block ? block.props : void 0))}`);
  return `<Group id="${escapeMdxAttribute(groupId)}"${nameAttr}>
${children.join("\n")}
</Group>`;
}
function indentGroupString(value) {
  return value.split("\n").map((line) => `  ${line}`).join("\n");
}
function groupIdOf(block) {
  return "props" in block && typeof block.props.groupId === "string" && block.props.groupId.trim() ? block.props.groupId : "";
}
function withoutGroupProps(props) {
  if (!props) return props;
  const { groupId, groupName, ...rest } = props;
  void groupId;
  void groupName;
  return rest;
}
function generateBlockString(block) {
  const identifiedBlock = ensureMotionDocBlockIds([block])[0] ?? block;
  return generateBlockStringWithProps(identifiedBlock, "props" in identifiedBlock ? identifiedBlock.props : void 0);
}
function generateBlockStringWithProps(block, overrideProps) {
  if (block.type === "Title" || block.type === "Text") {
    const propsStr = formatTextProps(overrideProps ?? block.props);
    return `<${block.type}${propsStr ? " " + propsStr : ""}>${escapeMdxText(block.text)}</${block.type}>`;
  }
  if (block.type === "heading") {
    const id = motionDocBlockId(block);
    const marker = id ? ` <!-- slidex-block-id:${id} -->` : "";
    return `## ${block.text}${marker}`;
  }
  if ("props" in block) {
    const propsStr = formatProps(overrideProps ?? block.props);
    return `<${block.type}${propsStr ? " " + propsStr : ""} />`;
  }
  return "";
}
function formatProps(props) {
  const entries = Object.entries(props).filter(
    ([key, value]) => !key.startsWith("_") && key !== "duration" && key !== "mb" && key !== "marginBottom" && !removedGroupPropKeys.has(key) && value !== void 0 && value !== ""
  );
  return entries.map(([key, value]) => typeof value === "number" ? `${key}={${value}}` : `${key}="${escapeMdxAttribute(value)}"`).join(" ");
}
function escapeMdxAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "&#10;");
}
function escapeMdxText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("\n", "&#10;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("{", "&#123;").replaceAll("}", "&#125;");
}
function formatTextProps(props) {
  return formatProps(withoutTextFrameOnlyProps(props));
}
function withoutTextFrameOnlyProps(props) {
  const { borderRadius, radius, ...rest } = props;
  void borderRadius;
  void radius;
  return rest;
}
function formatSlideTag(props) {
  const duration = typeof props.duration === "number" ? props.duration : 5;
  const rest = formatProps(props);
  return `<Slide duration={${duration}}${rest ? ` ${rest}` : ""}>`;
}
var removedGroupPropKeys = /* @__PURE__ */ new Set([
  "cardFlow",
  "cardGap",
  "flow",
  "groupFlow",
  "metricFlow",
  "metricGap",
  "stackAlign",
  "stackBackground",
  "stackClipContent",
  "stackColor",
  "stackDirection",
  "stackGap",
  "stackGroup",
  "stackPaddingBottom",
  "stackPaddingLeft",
  "stackPaddingRight",
  "stackPaddingTop",
  "stackPaddingX",
  "stackPaddingY"
]);

// core/motion-doc/application/tableBlock.ts
function parseRowOverrides(props) {
  return parseOverridesJson(props.rowOverrides);
}
function parseColOverrides(props) {
  return parseOverridesJson(props.colOverrides);
}
function serializeOverrides(overrides) {
  const keys = Object.keys(overrides);
  if (keys.length === 0) return "";
  return JSON.stringify(overrides);
}
function parseOverridesJson(value) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
  }
  return {};
}

// core/motion-doc/domain/viewport.ts
var MOTION_DOC_CANVAS_WIDTH = 1920;
var MOTION_DOC_CANVAS_HEIGHT = 1080;
var MOTION_DOC_CANVAS_ASPECT_RATIO = MOTION_DOC_CANVAS_WIDTH / MOTION_DOC_CANVAS_HEIGHT;

// core/motion-doc/domain/typography.ts
var LEGACY_MOTION_DOC_CANVAS_WIDTH = 1024;
var CSS_PIXELS_TO_POINTS = 0.75;
var MOTION_DOC_TYPOGRAPHY_SCALE = MOTION_DOC_CANVAS_WIDTH / LEGACY_MOTION_DOC_CANVAS_WIDTH;
var MOTION_DOC_FONT_SIZE_UNIT = "pt";
var MOTION_DOC_FONT_SIZES = {
  body: 18,
  caption: 13.5,
  display: 54,
  heading: 36,
  largeDisplay: 72,
  lead: 22.5,
  section: 45,
  slideTitle: 27,
  supportingTitle: 24,
  table: 12
};
var MOTION_DOC_CANVAS_PROPS = {
  canvasHeight: MOTION_DOC_CANVAS_HEIGHT,
  canvasWidth: MOTION_DOC_CANVAS_WIDTH,
  fontSizeUnit: MOTION_DOC_FONT_SIZE_UNIT
};
function legacyFontPixelsToPoints(value) {
  return roundFontSize(value * CSS_PIXELS_TO_POINTS);
}
function fullHdFontPixelsToPoints(value) {
  return roundFontSize(value * CSS_PIXELS_TO_POINTS / MOTION_DOC_TYPOGRAPHY_SCALE);
}
function motionDocDefaultFontSize(type) {
  return type === "Title" ? MOTION_DOC_FONT_SIZES.display : MOTION_DOC_FONT_SIZES.body;
}
function roundFontSize(value) {
  return Math.round(value * 1e3) / 1e3;
}

// core/motion-doc/application/motionDocFreeform.ts
function materializeFreeformSource(source) {
  const document3 = parseMotionDoc(source);
  const title = source.match(/^#\s+(.+)$/m)?.[0] ?? `# ${document3.title}`;
  const slides = document3.scenes.map((scene) => generateSlideString(materializeFreeformScene(scene)));
  return `${title}

${slides.join("\n\n")}`;
}
function materializeFreeformScene(scene) {
  const blocksWithProps = scene.blocks.filter((block) => "props" in block);
  const hasCenteredCopy = scene.props.alignX === "center" || scene.props.textAlign === "center";
  const isFullHdSource = Number(scene.props.canvasWidth) === MOTION_DOC_CANVAS_PROPS.canvasWidth && Number(scene.props.canvasHeight) === MOTION_DOC_CANVAS_PROPS.canvasHeight;
  const usesPointFontSizes = scene.props.fontSizeUnit === MOTION_DOC_FONT_SIZE_UNIT;
  return {
    ...scene,
    props: {
      ...scene.props,
      ...MOTION_DOC_CANVAS_PROPS
    },
    blocks: scene.blocks.map((block, index2) => {
      if (!("props" in block)) {
        return block;
      }
      const layout = layoutBlock(block, index2, blocksWithProps, hasCenteredCopy);
      const props = usesPointFontSizes ? block.props : migrateFontSizeToPoints(block.props, isFullHdSource);
      return {
        ...block,
        props: {
          ...props,
          ...defaultFontSize(block) === void 0 || props.fontSize !== void 0 ? {} : { fontSize: defaultFontSize(block) },
          ...props.radius !== void 0 || props.borderRadius !== void 0 ? {} : { radius: defaultRadius(block) },
          x: props.x ?? layout.x,
          y: props.y ?? layout.y,
          w: props.w ?? layout.w,
          h: props.h ?? layout.h
        }
      };
    })
  };
}
function defaultBlockFrame(block) {
  if (block.type === "Title") return { x: 8, y: 12, w: 62, h: 18 };
  if (block.type === "Text") return { x: 8, y: 38, w: 52, h: 16 };
  if (block.type === "Card") return { x: 8, y: 38, w: 40, h: 32 };
  if (block.type === "Metric") return { x: 8, y: 38, w: 32, h: 36 };
  if (block.type === "Icon") return { x: 42, y: 28, w: 16, h: 28 };
  if (block.type === "Shape") return { x: 34, y: 30, w: 28, h: 28 };
  if (block.type === "Stack") return { x: 10, y: 64, w: 80, h: 20 };
  if (block.type === "ImageBlock" || block.type === "VideoBlock") return { x: 8, y: 16, w: 72, h: 52 };
  return { x: 8, y: 12, w: 42, h: 18 };
}
function layoutBlock(block, originalIndex, blocksWithProps, hasCenteredCopy) {
  const defaults = defaultBlockFrame(block);
  const propIndex = blocksWithProps.findIndex((item) => item === block);
  const titleIndex = blocksWithProps.findIndex((item) => item.type === "Title");
  const titleOffset = titleIndex >= 0 && propIndex > titleIndex ? 1 : 0;
  const contentIndex = Math.max(propIndex - titleOffset, 0);
  const contentBlocks = blocksWithProps.filter((item) => item.type !== "Title");
  if (block.type === "Title") {
    return hasCenteredCopy ? { x: 18, y: contentBlocks.length > 0 ? 26 : 34, w: 64, h: 18 } : { x: 8, y: 12, w: 64, h: 18 };
  }
  if (hasCenteredCopy && block.type === "Text") {
    return { x: 22, y: 54, w: 56, h: 16 };
  }
  if (contentBlocks.length === 1) {
    return singleBlockFrame(block, defaults);
  }
  if (contentBlocks.length === 2) {
    const x = contentIndex === 0 ? 8 : 52;
    return { ...defaults, x, y: 38, w: 40 };
  }
  if (contentBlocks.length === 3) {
    return { ...defaults, x: 8 + contentIndex * 30, y: 38, w: 28 };
  }
  const column = contentIndex % 2;
  const row = Math.floor(contentIndex / 2);
  return {
    ...defaults,
    x: column === 0 ? 8 : 52,
    y: 34 + row * 28,
    w: 40,
    h: Math.min(defaults.h, 32)
  };
}
function singleBlockFrame(block, defaults) {
  if (block.type === "ImageBlock" || block.type === "VideoBlock") {
    return { x: 10, y: 20, w: 80, h: 54 };
  }
  if (block.type === "Metric") {
    return { x: 10, y: 40, w: 34, h: 36 };
  }
  return { ...defaults, x: 8, y: 38 };
}
function defaultFontSize(block) {
  if (block.type === "Title" || block.type === "Text") {
    return motionDocDefaultFontSize(block.type);
  }
  return void 0;
}
function migrateFontSizeToPoints(props, isFullHdSource) {
  const convert2 = isFullHdSource ? fullHdFontPixelsToPoints : legacyFontPixelsToPoints;
  const fontSize = Number(props.fontSize);
  const nextProps = {
    ...props,
    ...Number.isFinite(fontSize) ? { fontSize: convert2(fontSize) } : {}
  };
  const rowOverrides = migrateOverrideFontSizes(parseRowOverrides(props), convert2);
  const colOverrides = migrateOverrideFontSizes(parseColOverrides(props), convert2);
  return {
    ...nextProps,
    ...props.rowOverrides === void 0 ? {} : { rowOverrides: serializeOverrides(rowOverrides) },
    ...props.colOverrides === void 0 ? {} : { colOverrides: serializeOverrides(colOverrides) }
  };
}
function migrateOverrideFontSizes(overrides, convert2) {
  return Object.fromEntries(
    Object.entries(overrides).map(([index2, override]) => {
      const fontSize = Number(override.fontSize);
      return [
        index2,
        Number.isFinite(fontSize) ? { ...override, fontSize: convert2(fontSize) } : override
      ];
    })
  );
}
function defaultRadius(block) {
  if (block.type === "Card" || block.type === "Icon" || block.type === "ImageBlock" || block.type === "Metric" || block.type === "Shape" || block.type === "Stack" || block.type === "VideoBlock") {
    return 16;
  }
  return 0;
}

// core/motion-doc/presets/templates/moodboard.ts
var moodboardTemplateId = "moodboard";
var openSlideXMoodboardSource = String.raw`# Moodboard

<Slide duration={5} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5" mutedColor="#b8b8b4" alignX="left" alignY="center" textAlign="left" canvasHeight={1080} canvasWidth={1920}>
  <Text enter="none" x={4.7} y={70.1} w={81.7} h={21.7} id="block-30cc2dc9-763f-4850-bd45-8df0eee65bb3" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Moodboard</Text>
  <Text enter="none" fontSize={18} x={4.7} y={60.6} w={42} h={7.9} id="block-69bcd8fe-9c78-416c-ad27-f66e070cd914" fontFamily="Lato">Project Name</Text>
  <Text enter="none" fontSize={18} x={53.8} y={5.7} w={42} h={7.9} id="block-c8d4c871-7dd2-4c50-95cf-36c01509bcac" textAlign="right" fontFamily="Lato">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.6} y={4.6} w={13.1} h={7.9} id="block-983a868e-19aa-4a7b-b096-2ff6a70e6e48" fontFamily="Lato">2026</Text>
  <Text enter="none" fontSize={18} x={27.1} y={4.6} w={13.1} h={7.9} id="block-7a30f8f7-ba64-4078-a9f0-63f51cd9175f" fontFamily="Lato">July</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111" mutedColor="#656565">
  <Text enter="none" x={4.7} y={70.1} w={81.7} h={21.7} id="block-2e7ad571-4e25-4468-b9e4-3e12f7eccc0a" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#000000">Moodboard</Text>
  <Text enter="none" fontSize={18} x={4.7} y={60.6} w={42} h={7.9} id="block-38dfdc8b-db8a-4fcb-abba-4683f9369163" fontFamily="Lato">Project Name</Text>
  <Text enter="none" fontSize={18} x={53.8} y={5.7} w={42} h={7.9} id="block-cc237fdc-210b-4f62-ab1c-200a11dde395" textAlign="right" fontFamily="Lato">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.6} y={4.6} w={13.1} h={7.9} id="block-c34cdcb7-faf3-4fb8-a7e8-533f7481b98c" fontFamily="Lato">2026</Text>
  <Text enter="none" fontSize={18} x={27.1} y={4.6} w={13.1} h={7.9} id="block-a6f17a67-6738-4b28-be56-8ff943263311" fontFamily="Lato">July</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="auto" mutedColor="auto">
  <ImageBlock fit="cover" scaleX={1} scaleY={1} enter="none" radius={0} x={0} y={0} w={100} h={100} id="block-fb74a8ae-7639-4dad-b563-77ec23077609" src="https://images.unsplash.com/photo-1782241594367-31847ff5b0e1?q=80&amp;w=737&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" filter="fluted-glass" filterDistortion={1} filterSize={0.39} filterPreset="Abstract" filterAngle={30} />
  <Text enter="none" x={4.7} y={70.1} w={81.7} h={21.7} id="block-33148c8a-7fe4-4e30-baea-86011d43b1e3" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#000000">Moodboard</Text>
  <Text enter="none" fontSize={18} x={4.7} y={60.6} w={42} h={7.9} id="block-e3c466cb-8b57-4ae9-88b2-36d9afed4cf7" fontFamily="Lato" color="#111827">Project Name</Text>
  <Text enter="none" fontSize={18} x={53.8} y={5.7} w={42} h={7.9} id="block-89b06c58-9be4-441f-b64b-7d914c094a06" textAlign="right" fontFamily="Lato">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.6} y={4.6} w={13.1} h={7.9} id="block-1eca5923-6c24-4971-8672-124cc9cc19bc" fontFamily="Lato">2026</Text>
  <Text enter="none" fontSize={18} x={27.1} y={4.6} w={13.1} h={7.9} id="block-422ac654-4284-47e2-8b11-b2e39e456dbc" fontFamily="Lato">July</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#000000" accent="#111111" textColor="auto" shaderIntensity={1} shaderSoftness={0.13} shaderSpeed={1.65} shaderScale={1.4} shaderDetail={0.09} shaderAngle={127} mutedColor="auto" shaderColor1="#ffffff" shaderColor2="#000000" shaderColor3="#000000" shaderColor4="#000000" shaderColor5="#000000" shaderColor6="#000000" shader="mesh-gradient" shaderEngine="three" shaderFrame={11683} shaderPreset="Ink">
  <Text enter="none" x={4.7} y={70.1} w={81.7} h={21.7} id="block-efd78638-17b7-4c09-baf6-11e62e177d11" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Moodboard</Text>
  <Text enter="none" fontSize={18} x={4.7} y={60.6} w={42} h={7.9} id="block-8be7b256-f59b-4a37-bdcb-60569a80d122" fontFamily="Lato" color="#ffffff">Project Name</Text>
  <Text enter="none" fontSize={18} x={53.8} y={5.7} w={42} h={7.9} id="block-d324b2b9-5645-40f9-a188-f7f64a208f6f" textAlign="right" fontFamily="Lato" color="#ffffff">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.6} y={4.6} w={13.1} h={7.9} id="block-ecd62a45-93ec-4cf1-b55f-d506b898e961" fontFamily="Lato" color="#ffffff">2026</Text>
  <Text enter="none" fontSize={18} x={27.1} y={4.6} w={13.1} h={7.9} id="block-cd753ea8-d532-43b1-a508-c303fe6b5ee6" fontFamily="Lato" color="#ffffff">July</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111" mutedColor="#656565">
  <Text enter="none" fontSize={36} x={3.2} y={7.9} w={27.3} h={21.8} id="block-1c41692c-41c1-45b9-84fa-3b2e818de57e" textAlign="left" fontFamily="Lato" role="title" lineHeight={1.08} color="#251313" fontWeight={650}>Background
Context</Text>
  <Text enter="none" fontSize={18} x={40.9} y={7.9} w={53.1} h={44.2} id="block-2e6c626d-8e15-4b9c-bfe4-bc1fbd1efc18" lineHeight={1.6} color="#000000" fontWeight={300} fontFamily="Lato">This moodboard explores a modern visual direction that balances simplicity, warmth, and bold expression. Through clean typography, soft color palettes, natural textures, and structured layouts, the design creates an atmosphere that feels contemporary, approachable, and memorable.</Text>
  <Text enter="none" fontSize={18} x={53.4} y={86} w={42} h={7.9} id="block-8d16b5b5-97e2-4094-b980-1af43895f9a8" textAlign="right" fontFamily="Lato" color="#111827">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.2} y={86} w={13.1} h={7.9} id="block-9e2d9670-dc1c-4c43-b352-1498c94a6950" fontFamily="Lato" color="#111827">2026</Text>
  <Text enter="none" fontSize={18} x={26.7} y={86} w={13.1} h={7.9} id="block-2fcb2f38-dead-4012-afda-2d1f56ace986" fontFamily="Lato" color="#111827">July</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111">
  <ImageBlock fit="cover" scaleX={1} scaleY={1} enter="none" radius={0} x={59.8} y={0} w={40.2} h={100} id="block-228f9f2a-a426-4c87-96bf-c0e6841660bf" alt="image.png" src="data:image/webp;base64,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" />
  <Text enter="none" fontSize={22.5} x={4} y={25.9} w={49.2} h={9} id="block-f37c3442-ab3b-41a4-8c43-329f68d4231d" lineHeight={1.28} role="content" fontWeight={700} fontFamily="Lato">Designing the Future</Text>
  <Text enter="none" fontSize={18} x={4} y={37.9} w={46.2} h={32.1} id="block-d60c3fe4-7a99-4d09-9aa8-587003403761" fontFamily="Lato">A visual exploration of color, typography, texture, and composition, created to define a modern, expressive, and memorable design direction.</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111">
  <ImageBlock fit="cover" scaleX={1} scaleY={1} enter="none" radius={0} x={0} y={0} w={33.1} h={100} id="block-720403f9-0490-4c1c-be41-39e11505c8c3" src="https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&amp;w=764&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" />
  <Text enter="none" fontSize={22.5} x={44.6} y={30.8} w={49.2} h={9} id="block-ee28d3b0-24e9-4952-9020-885013b3e581" lineHeight={1.28} role="content" fontWeight={700} fontFamily="Lato">Beyond the Ordinary</Text>
  <Text enter="none" fontSize={18} x={44.6} y={42.8} w={46.2} h={32.1} id="block-08fa2dd7-5a78-4351-a377-66470f316271" fontFamily="Lato">A curated collection of visual references exploring bold ideas, refined details, and unexpected combinations to shape a distinctive creative direction.</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5" mutedColor="#b8b8b4">
  <Text enter="none" x={3.1} y={69.1} w={81.7} h={21.7} id="block-5cb5361e-0c58-455c-9cb1-8b77550f8f27" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Typography</Text>
  <Text enter="none" x={75.2} y={7.8} w={20.2} h={41} id="block-c3e88848-2ce6-4d12-a173-10949e94b3fc" fontSize={120} fontFamily="Lato" fontWeight={700}>01</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111" mutedColor="#656565">
  <ImageBlock fit="cover" scaleX={1} scaleY={1} enter="none" radius={0} x={3} y={4} w={94.4} h={63.3} id="block-eb16a7d0-ad9b-471d-b3ee-f12edac7e7f5" src="https://images.unsplash.com/photo-1581080247575-12fa86f6ef6e?q=80&amp;w=1169&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" />
  <Text enter="none" fontSize={18} x={3} y={78.8} w={81.5} h={7.9} id="block-f4799c30-3f6a-4c91-88fa-44e26fb2d4b9" fontWeight={100} fontFamily="Lato">Typography shapes how a message feels and flows.</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5" mutedColor="#b8b8b4">
  <Text enter="none" x={3.1} y={69.1} w={81.7} h={29.5} id="block-9372f023-c468-45e7-88ab-eb2f97f229b1" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Animations</Text>
  <Text enter="none" x={75.2} y={7.8} w={20.2} h={41} id="block-6a18663e-98cf-4f2e-8053-c4c293f35aef" fontSize={120} fontFamily="Lato" fontWeight={700}>02</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5" layoutPreset="photo">
  <VideoBlock src="https://ik.imagekit.io/9ttej0nsg/slideX%20demo%20launch_IZkFldyGE.mp4" fit="cover" controls="false" loop="true" muted="true" enter="none" radius={16} x={0} y={0} w={100} h={100} id="block-aca0ba12-b9c2-4855-80bc-b21d447db99a" />
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5">
  <Text enter="none" x={3.1} y={69.1} w={81.7} h={29.5} id="block-9531013f-4697-428b-b371-a778b266ecef" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Textures</Text>
  <Text enter="none" x={75.2} y={7.8} w={20.2} h={41} id="block-1b6ab347-3baf-4f6e-9c5d-a378461e1519" fontSize={120} fontFamily="Lato" fontWeight={700}>03</Text>
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="light" background="#ffffff" accent="#111111" textColor="#111111" mutedColor="#656565" layoutPreset="photos-3">
  <ImageBlock src="https://images.unsplash.com/photo-1623410439361-22ac19216577?q=80&amp;w=687&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Photo 1" x={8} y={10} w={40} h={80} fit="cover" radius={0} enter="none" id="block-ac7168b0-9844-442a-8ee0-c38c55f606cd" />
  <ImageBlock src="https://images.unsplash.com/photo-1554755229-ca4470e07232?w=500&amp;auto=format&amp;fit=crop&amp;q=60&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTl8fHRleHR1cmV8ZW58MHx8MHx8fDA%3D" alt="Photo 2" x={52} y={10} w={40} h={38} fit="cover" radius={0} enter="none" id="block-618169a9-6bd6-4ae7-9da8-f9758d8aac78" />
  <ImageBlock src="https://images.unsplash.com/photo-1614292264554-7dca1d6466d6?q=80&amp;w=687&amp;auto=format&amp;fit=crop&amp;ixlib=rb-4.1.0&amp;ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" alt="Photo 3" x={52} y={52} w={40} h={38} fit="cover" radius={0} enter="none" id="block-4aa97f2b-fe6d-432f-a7b0-7ce962a19d07" />
</Slide>

<Slide duration={5} canvasHeight={1080} canvasWidth={1920} fontSizeUnit="pt" theme="dark" background="#000000" accent="#f7f7f5" textColor="#f7f7f5" mutedColor="#b8b8b4">
  <Text enter="none" x={3.1} y={69.1} w={93.5} h={29.5} id="block-1cde3972-8c25-45e4-85d6-4abb8c044f96" lineHeight={1} role="title" textAlign="left" fontFamily="Lato" fontSize={88} fontWeight={900} color="#ffffff">Hello@gmail.com</Text>
  <Text enter="none" x={75.2} y={7.8} w={20.2} h={37} id="block-911e19ad-a070-4249-b97d-b0eeecea327c" fontSize={120} fontFamily="Lato" fontWeight={700}></Text>
  <Text enter="none" fontSize={18} x={53.8} y={5.7} w={42} h={7.9} id="block-7fde3cde-3a7e-4bfc-9f21-fa9788a177f6" textAlign="right" fontFamily="Lato">by SlideX</Text>
  <Text enter="none" fontSize={18} x={3.6} y={4.6} w={13.1} h={7.9} id="block-8a98b55f-02f0-4e3d-b80b-33d513dcb47d" fontFamily="Lato">2026</Text>
  <Text enter="none" fontSize={18} x={27.1} y={4.6} w={13.1} h={7.9} id="block-36b7955a-cbec-438a-817c-78a6f0a7c041" fontFamily="Lato">July</Text>
</Slide>
`;
var moodboardTemplate = {
  category: "Brand & Design",
  description: "A 14-slide visual direction deck for exploring typography, imagery, motion, texture, and composition.",
  duration: "70s",
  id: moodboardTemplateId,
  name: "Moodboard",
  source: openSlideXMoodboardSource,
  sources: {
    en: openSlideXMoodboardSource,
    "zh-TW": openSlideXMoodboardSource
  },
  useCase: "Brand direction, visual research, and creative concept alignment"
};

// core/motion-doc/presets/templates.ts
var motionTemplates = [
  moodboardTemplate
];
var defaultTemplate = motionTemplates[0];

// core/motion-doc/presets/templateLibrarySources.ts
var summerTimeReportSource = `# Summer Time Report

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#38BDF8" accent="#0A84FF" textColor="#FFFFFF" mutedColor="#DFF6FF" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7} shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={18897} shaderSpeed={0} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderAngle={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447" shaderColor5="#BCECF6" shaderColor6="#FFFFFF">
  <Text id="cover-kicker" x={7} y={11} w={52} h={6} fontFamily="Arial" fontWeight={700} fontSize={15} letterSpacing={0.5} enter="fadeIn" delay={0.08} color="#6366f1">SUMMER 2026 | SUMMIT | TOOLKIT</Text>
  <Text id="cover-title-line-one" x={6.6} y={46.4} w={72} h={14} fontFamily="Arial" fontWeight={700} fontSize={68} lineHeight={1} enter="rise" delay={0.16} color="#6366f1">Summer Time</Text>
  <Text id="cover-title-line-two" x={6.6} y={63.4} w={86.8} h={14} fontFamily="Arial" fontWeight={700} fontSize={68} lineHeight={1} enter="rise" delay={0.26} color="#6366f1">Report</Text>
  <Text id="cover-caption" x={7} y={84} w={55} h={6} fontFamily="Arial" fontWeight={400} fontSize={18} lineHeight={1.2} enter="fadeUp" delay={0.38} color="#6366f1">A clear recap of what moved the season forward.</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#F2FAFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="pushLeft" transitionDuration={0.7}>
  <Text id="about-title" x={6.6} y={10} w={52} h={14} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={64} lineHeight={1} enter="rise">Who We Are</Text>
  <Text id="about-lede" x={6.8} y={35} w={45} h={20} color="#223E53" fontFamily="Arial" fontWeight={400} fontSize={24} lineHeight={1.25} enter="fadeUp" delay={0.14}>The starting point we use to align the work, the people, and the season ahead.</Text>
  <Shape id="about-orbit-one" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={68} y={21.9} w={9} h={16} radius={16} />
  <Shape id="about-orbit-two" shape="circle" fill="#4D81D2" stroke="transparent" strokeWidth={0} x={77} y={42} w={6} h={10.7} radius={16} />
  <Shape id="about-star" shape="star" fill="#38BDF8" stroke="transparent" strokeWidth={0} x={68.5} y={52.7} w={13} h={22} points={5} rotation={16} radius={16} />
  <Text id="about-tag" x={66} y={79} w={22} h={7} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14} lineHeight={1} textAlign="center">ONE SHARED BASELINE</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#FFFFFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7}>
  <Text id="highlights-title" x={6.6} y={8} w={70} h={13} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">Highlights</Text>
  <Text id="highlights-subtitle" x={6.8} y={23} w={60} h={6} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={18} enter="fadeUp" delay={0.1}>Three moments that defined the season</Text>
  <Shape id="highlight-kickoff-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={6.6} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.18} />
  <Shape id="highlight-kickoff-icon" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={9} y={42} w={4.5} h={8} enter="pop" delay={0.26} radius={16} />
  <Text id="highlight-kickoff-title" x={9} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.24}>Season Kickoff</Text>
  <Text id="highlight-kickoff-copy" x={9} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.3}>New programs launched across every region, right on schedule.</Text>
  <Shape id="highlight-community-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={37} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.28} />
  <Shape id="highlight-community-icon" shape="parallelogram" fill="#4D81D2" stroke="transparent" strokeWidth={0} x={39.4} y={42} w={4.5} h={8} enter="pop" delay={0.36} radius={16} />
  <Text id="highlight-community-title" x={39.4} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.34}>Community Growth</Text>
  <Text id="highlight-community-copy" x={39.4} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.4}>More people joined this summer than in any season before it.</Text>
  <Shape id="highlight-standout-surface" shape="rectangle" fill="#F2FAFF" stroke="#D7E9F2" strokeWidth={1.2} x={67.3} y={37} w={26} h={49} radius={20} enter="fadeUp" delay={0.38} />
  <Shape id="highlight-standout-icon" shape="star" fill="#38BDF8" stroke="transparent" strokeWidth={0} x={69.5} y={41.5} w={5.2} h={9.2} points={5} rotation={12} enter="pop" delay={0.46} radius={16} />
  <Text id="highlight-standout-title" x={69.8} y={54} w={21} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22} lineHeight={1} enter="fadeUp" delay={0.44}>Standout Moments</Text>
  <Text id="highlight-standout-copy" x={69.8} y={65} w={20} h={16} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={15} lineHeight={1.2} enter="fadeUp" delay={0.5}>A handful of projects carried the energy for the whole team.</Text>
  <Shape id="highlights-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={89} y={6.5} w={6.9} h={12.2} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#F2FAFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7}>
  <Text id="numbers-title" x={6.6} y={8} w={72} h={13} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">By the Numbers</Text>
  <Text id="numbers-subtitle" x={6.8} y={23} w={60} h={6} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={18} enter="fadeUp" delay={0.1}>The signals that give this season its shape</Text>
  <Shape id="metric-reach-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={6.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-reach-label" x={9} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>REACH</Text>
  <Text id="metric-reach-value" x={9} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>128K</Text>
  <Text id="metric-reach-caption" x={9} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>People reached across summer channels.</Text>
  <Shape id="metric-engagement-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={27.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-engagement-label" x={30} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>ENGAGEMENT</Text>
  <Text id="metric-engagement-value" x={30} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>42%</Text>
  <Text id="metric-engagement-caption" x={30} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Average engagement, up from spring.</Text>
  <Shape id="metric-completion-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={48.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-completion-label" x={51} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>COMPLETION</Text>
  <Text id="metric-completion-value" x={51} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>91%</Text>
  <Text id="metric-completion-caption" x={51} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Programs that finished on schedule.</Text>
  <Shape id="metric-team-surface" shape="rectangle" fill="#FFFFFF" stroke="#D7E9F2" strokeWidth={1.2} x={69.6} y={36} w={18.5} h={53} radius={16} />
  <Text id="metric-team-label" x={72} y={42} w={13.5} h={5} color="#656565" fontFamily="Arial" fontWeight={700} fontSize={14}>NEW TEAM</Text>
  <Text id="metric-team-value" x={72} y={51} w={13.5} h={9} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={40} lineHeight={1}>+12</Text>
  <Text id="metric-team-caption" x={72} y={64} w={13.5} h={20} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={13} lineHeight={1.15}>Contributors who joined this season.</Text>
  <Shape id="numbers-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={89} y={6.5} w={6.9} h={12.2} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#FFFFFF" accent="#0A84FF" textColor="#223E53" mutedColor="#656565" canvasHeight={1080} canvasWidth={1920} slideTransition="pushLeft" transitionDuration={0.7}>
  <Text id="timeline-title" x={6.6} y={8} w={84} h={12} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={52} lineHeight={1} enter="rise">The Season, Step by Step</Text>
  <Shape id="timeline-line" shape="line" fill="transparent" stroke="#D8DEE3" strokeWidth={2} x={6.6} y={52} w={86.8} h={0.4} enter="reveal" delay={0.12} radius={16} />
  <Text id="timeline-kickoff-title" x={6.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Kickoff</Text>
  <Text id="timeline-kickoff-copy" x={6.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Plans locked, teams assigned, tools ready.</Text>
  <Shape id="timeline-kickoff-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={13.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-build-title" x={28.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Build</Text>
  <Text id="timeline-build-copy" x={28.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Programs launched and the first signals came in.</Text>
  <Shape id="timeline-build-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={35.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-peak-title" x={50.6} y={38} w={18} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Peak</Text>
  <Text id="timeline-peak-copy" x={50.6} y={57} w={18} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Engagement and reach hit their high point.</Text>
  <Shape id="timeline-peak-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={57.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Text id="timeline-wrap-title" x={72.6} y={38} w={20} h={7} color="#223E53" fontFamily="Arial" fontWeight={700} fontSize={22}>Wrap-up</Text>
  <Text id="timeline-wrap-copy" x={72.6} y={57} w={20} h={13} color="#656565" fontFamily="Arial" fontWeight={400} fontSize={16} lineHeight={1.2}>Results reviewed and shared with the team.</Text>
  <Shape id="timeline-wrap-dot" shape="circle" fill="#0A84FF" stroke="transparent" strokeWidth={0} x={79.3} y={50.8} w={1.35} h={2.4} radius={16} />
  <Shape id="timeline-sun" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={92.3} y={6.5} w={5} h={8.9} radius={16} />
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="dark" background="#0A2540" accent="#FFBC90" textColor="#FFFFFF" mutedColor="#B9CAD8" canvasHeight={1080} canvasWidth={1920} slideTransition="rise" transitionDuration={0.7}>
  <Text id="next-title" x={6.6} y={10} w={70} h={13} color="#FFFFFF" fontFamily="Arial" fontWeight={700} fontSize={60} lineHeight={1} enter="rise">What's Next</Text>
  <Shape id="next-rule" shape="line" fill="transparent" stroke="#315570" strokeWidth={1.2} x={6.6} y={33} w={64} h={0.3} radius={16} />
  <Shape id="next-one-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={41.6} w={1.35} h={2.4} radius={16} />
  <Text id="next-one" x={10} y={40.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.16}>Name an owner for every open item</Text>
  <Shape id="next-two-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={54} w={1.35} h={2.4} radius={16} />
  <Text id="next-two" x={10} y={52.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.26}>Lock the plan for next season's kickoff</Text>
  <Shape id="next-three-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={66} w={1.35} h={2.4} radius={16} />
  <Text id="next-three" x={10} y={64.5} w={74} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.36}>Share the recap with the wider team</Text>
  <Shape id="next-four-dot" shape="circle" fill="#FFBC90" stroke="transparent" strokeWidth={0} x={6.6} y={78} w={1.35} h={2.4} radius={16} />
  <Text id="next-four" x={10} y={76.5} w={82} h={7} color="#FFFFFF" fontFamily="Arial" fontWeight={400} fontSize={21} enter="fadeUp" delay={0.46}>Turn this season's wins into next season's baseline</Text>
</Slide>

<Slide duration={5} fontSizeUnit="pt" theme="light" background="#38BDF8" accent="#0A84FF" textColor="#FFFFFF" mutedColor="#DFF6FF" canvasHeight={1080} canvasWidth={1920} slideTransition="fade" transitionDuration={0.7} shader="mesh-gradient" shaderEngine="three" shaderPreset="Beach" shaderFrame={20512} shaderSpeed={0} shaderScale={1} shaderIntensity={0.8} shaderSoftness={0.35} shaderDetail={0} shaderAngle={0} shaderColor1="#BCECF6" shaderColor2="#00AAFF" shaderColor3="#00F7FF" shaderColor4="#FFD447" shaderColor5="#BCECF6" shaderColor6="#FFFFFF">
  <Text id="thanks-kicker" x={7} y={11} w={58} h={6} color="#6366f1" fontFamily="Arial" fontWeight={700} fontSize={15} letterSpacing={0.5} enter="fadeIn">QUESTIONS | FEEDBACK | NEXT SEASON</Text>
  <Text id="thanks-title" x={7} y={54.5} w={56} h={15} fontFamily="Arial" fontWeight={700} fontSize={72} lineHeight={1} enter="rise" delay={0.12} color="#6366f1">Thank You</Text>
  <Text id="thanks-caption" x={7} y={76} w={60.2} h={7} fontFamily="Arial" fontWeight={400} fontSize={18} lineHeight={1.2} enter="fadeUp" delay={0.24} color="#6366f1">Let's carry the strongest signals into the season ahead.</Text>
</Slide>`;
var publicSummerTimeReportSources = {
  en: summerTimeReportSource,
  "zh-TW": summerTimeReportSource
};
var priorMotionTemplateSources = new Map(
  motionTemplates.map((template) => [
    template.id,
    {
      en: localTemplateSource(template.sources.en),
      "zh-TW": localTemplateSource(template.sources["zh-TW"])
    }
  ])
);
function getBundledTemplateLibrarySource(templateId, locale) {
  if (templateId === "summer-time-report") return publicSummerTimeReportSources[locale];
  return priorMotionTemplateSources.get(templateId)?.[locale];
}
function getBundledTemplateLibraryBlankSource(templateId, locale) {
  const source = getBundledTemplateLibrarySource(templateId, locale);
  const firstSlide = source ? motionDocSlideSourceRanges(source)[0] : void 0;
  const tagName = firstSlide?.source.match(/^<(Slide|Scene)\b/)?.[1];
  return firstSlide && tagName ? `# Untitled

${firstSlide.openingTag}
</${tagName}>` : void 0;
}
function localTemplateSource(source) {
  return stripNonLocalMotionDocMedia(materializeFreeformSource(source));
}

// core/motion-doc/presets/officialTemplatePackages.ts
var officialTemplatePackages = officialTemplateDefinitions.map(createPackage);
function getOfficialTemplatePackage(id, version = officialTemplatePackageVersion) {
  return version === officialTemplatePackageVersion ? officialTemplatePackages.find((template) => template.id === id) : void 0;
}
function createPackage(item) {
  const sourceEn = getBundledTemplateLibrarySource(item.id, "en");
  const sourceZhTw = getBundledTemplateLibrarySource(item.id, "zh-TW");
  const starterEn = getBundledTemplateLibraryBlankSource(item.id, "en");
  const starterZhTw = getBundledTemplateLibraryBlankSource(item.id, "zh-TW");
  if (!sourceEn || !sourceZhTw || !starterEn || !starterZhTw) {
    throw new Error(`Public template source is missing: ${item.id}`);
  }
  return {
    assets: [],
    blueprint: item.blueprint,
    catalog: item.catalog,
    compatibility: officialTemplateCompatibility,
    cover: { alt: { en: `${item.locales.en.name} cover`, "zh-TW": `${item.locales["zh-TW"].name}\u5C01\u9762` }, source: item.cover || "about:blank" },
    id: item.id,
    kind: "open-slidex-template",
    locales: item.locales,
    schemaVersion: 1,
    sources: { en: sourceEn, "zh-TW": sourceZhTw },
    starterSources: { en: starterEn, "zh-TW": starterZhTw },
    version: officialTemplatePackageVersion
  };
}

// packages/open-slidex/src/cliOptions.ts
var minimumNodeVersion = "22.12.0";
var packageManagers = ["npm", "pnpm", "bun"];
function parseCreateSlideXArguments(args, environment = process.env) {
  if (args.includes("--help") || args.includes("-h")) {
    return { action: "help" };
  }
  if (args.includes("--version") || args.includes("-v")) {
    return { action: "version" };
  }
  let installDependencies = true;
  let packageManager;
  let target;
  let templateId;
  let templateLocale = "en";
  for (let index2 = 0; index2 < args.length; index2 += 1) {
    const argument = args[index2];
    if (argument === "--no-install") {
      installDependencies = false;
      continue;
    }
    if (argument === "--template") {
      const value = args[index2 + 1];
      if (!value || value.startsWith("-") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new Error("--template requires an official template ID.");
      }
      templateId = value;
      index2 += 1;
      continue;
    }
    if (argument.startsWith("--template=")) {
      const value = argument.slice("--template=".length);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
        throw new Error("--template requires an official template ID.");
      }
      templateId = value;
      continue;
    }
    if (argument === "--locale") {
      const value = args[index2 + 1];
      if (value !== "en" && value !== "zh-TW") {
        throw new Error("--locale requires en or zh-TW.");
      }
      templateLocale = value;
      index2 += 1;
      continue;
    }
    if (argument === "--package-manager") {
      const value = args[index2 + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--package-manager requires npm, pnpm, or bun.");
      }
      packageManager = selectPackageManager(packageManager, value);
      index2 += 1;
      continue;
    }
    if (argument.startsWith("--package-manager=")) {
      packageManager = selectPackageManager(
        packageManager,
        argument.slice("--package-manager=".length)
      );
      continue;
    }
    if (argument === "--npm" || argument === "--pnpm" || argument === "--bun") {
      packageManager = selectPackageManager(
        packageManager,
        argument.slice(2)
      );
      continue;
    }
    if (argument.startsWith("-")) {
      throw new Error(`Unknown option: ${argument}. Run open-slidex init --help.`);
    }
    if (target) {
      throw new Error(`Only one target directory is allowed: ${target} and ${argument}.`);
    }
    target = argument;
  }
  return {
    action: "create",
    installDependencies,
    packageManager: packageManager ?? detectPackageManager(
      environment.npm_config_user_agent,
      environment.npm_execpath,
      process.versions.bun
    ),
    target: target ?? "my-slidex-deck",
    ...templateId ? { template: { id: templateId, locale: templateLocale } } : {}
  };
}
function detectPackageManager(userAgent, executablePath, bunVersion) {
  if (bunVersion || executablePath?.toLowerCase().includes("bun")) {
    return "bun";
  }
  const command = userAgent?.split(/\s+/, 1)[0]?.split("/", 1)[0];
  if (isPackageManager(command)) return command;
  if (executablePath?.toLowerCase().includes("pnpm")) return "pnpm";
  return "npm";
}
function assertSupportedNodeVersion(currentVersion = process.versions.node) {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumNodeVersion);
  const supported = compareVersions(current, minimum) >= 0;
  if (!supported) {
    throw new Error(
      `Node.js ${minimumNodeVersion} or newer is required. Current version: ${currentVersion}.`
    );
  }
}
function installCommand(packageManager) {
  return { args: ["install"], command: packageManager };
}
function runScriptCommand(packageManager, script) {
  if (packageManager === "pnpm") return `pnpm ${script}`;
  return `${packageManager} run ${script}`;
}
function createSlideXHelp() {
  return `Create a private, MDX-first OpenSlideX Local Workbench.

Usage:
  open-slidex init [directory] [options]

Options:
  --template <official-template-id> Create from an official template blueprint
  --locale <en|zh-TW>               Template language (default: en)
  --package-manager <npm|pnpm|bun>  Select the installer
  --npm                             Use npm
  --pnpm                            Use pnpm
  --bun                             Use bun
  --no-install                      Create files without installing dependencies
  -h, --help                        Show this help
  -v, --version                     Show the installed CLI version

Examples:
  npx open-slidex@latest init my-deck
  pnpm dlx open-slidex@latest init my-deck
  bunx open-slidex@latest init my-deck
  open-slidex init my-deck --package-manager pnpm --no-install
  open-slidex init my-deck --template summer-time-report --locale zh-TW
`;
}
function selectPackageManager(current, requested) {
  if (!isPackageManager(requested)) {
    throw new Error(
      `Unsupported package manager: ${requested || "missing"}. Use npm, pnpm, or bun.`
    );
  }
  if (current && current !== requested) {
    throw new Error(
      `Choose only one package manager; received ${current} and ${requested}.`
    );
  }
  return requested;
}
function isPackageManager(value) {
  return packageManagers.includes(value);
}
function parseVersion(value) {
  const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Unable to parse Node.js version: ${value}.`);
  return match.slice(1).map(Number);
}
function compareVersions(left, right) {
  for (let index2 = 0; index2 < Math.max(left.length, right.length); index2 += 1) {
    const difference = (left[index2] ?? 0) - (right[index2] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

// packages/open-slidex/src/cli.ts
void main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown OpenSlideX init failure.";
  process.stderr.write(`open-slidex init: ${message}
`);
  process.exitCode = 1;
});
async function main() {
  const options = parseCreateSlideXArguments(process.argv.slice(2));
  if (options.action === "help") {
    process.stdout.write(createSlideXHelp());
    return;
  }
  if (options.action === "version") {
    process.stdout.write(`${await packageVersion()}
`);
    return;
  }
  assertSupportedNodeVersion();
  const targetDir = path2.resolve(process.cwd(), options.target);
  const templateDir = path2.resolve(
    path2.dirname(fileURLToPath(import.meta.url)),
    "../template"
  );
  await assertTargetIsAvailable(targetDir);
  if (options.installDependencies) {
    await assertPackageManagerAvailable(options.packageManager);
  }
  await mkdir(targetDir, { recursive: true });
  await cp(templateDir, targetDir, { recursive: true });
  await replaceProjectName(targetDir, path2.basename(targetDir));
  if (options.template) {
    await applyOfficialTemplate(targetDir, options.template);
  }
  if (options.installDependencies) {
    const install = installCommand(options.packageManager);
    await run(install.command, install.args, targetDir, "inherit");
  }
  process.stdout.write(
    completionMessage({
      installDependencies: options.installDependencies,
      packageManager: options.packageManager,
      targetDir,
      templateId: options.template?.id
    })
  );
}
function completionMessage({
  installDependencies,
  packageManager,
  targetDir,
  templateId
}) {
  const install = installCommand(packageManager);
  return [
    "",
    `Created OpenSlideX MDX-first Local Workbench in ${targetDir}`,
    `Package manager: ${packageManager}`,
    ...templateId ? [`Official template: ${templateId}`] : [],
    "",
    `  cd ${path2.relative(process.cwd(), targetDir) || "."}`,
    ...installDependencies ? [] : [`  ${install.command} ${install.args.join(" ")}`],
    `  ${runScriptCommand(packageManager, "dev")}`,
    "",
    "CLI checks and exports:",
    `  ${runScriptCommand(packageManager, "validate")}`,
    `  ${runScriptCommand(packageManager, "render")}`,
    "",
    "Project-local OpenSlideX skills are ready in .agents/skills:",
    "  slidex-mdx-authoring",
    "  slidex-deck-design",
    "  slidex-motion-direction",
    "  slidex-deck-qa",
    "",
    "Workspace MCP is configured once from OpenSlideX Workspace Settings.",
    ""
  ].join("\n");
}
async function applyOfficialTemplate(root, reference) {
  const template = getOfficialTemplatePackage(reference.id);
  if (!template) {
    throw new Error(`Unknown official template: ${reference.id}`);
  }
  await writeFile(
    path2.join(root, "presentation.mdx"),
    template.starterSources[reference.locale],
    "utf8"
  );
  const stateRoot = path2.join(root, ".open-slidex");
  await mkdir(stateRoot, { recursive: true });
  await writeFile(
    path2.join(stateRoot, "template-lock.json"),
    `${JSON.stringify({
      id: template.id,
      locale: reference.locale,
      version: template.version
    }, null, 2)}
`,
    "utf8"
  );
}
async function assertTargetIsAvailable(target) {
  const exists = await access(target).then(
    () => true,
    () => false
  );
  if (!exists) return;
  const entries = await readdir(target);
  if (entries.length > 0) {
    throw new Error(`Target directory is not empty: ${target}`);
  }
}
async function assertPackageManagerAvailable(packageManager) {
  try {
    await run(packageManager, ["--version"], process.cwd(), "ignore");
  } catch {
    throw new Error(
      `${packageManager} is not available. Install it, select another package manager, or pass --no-install.`
    );
  }
}
async function replaceProjectName(root, projectName) {
  const packagePath = path2.join(root, "package.json");
  const source = await readFile(packagePath, "utf8");
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "slidex-deck";
  await writeFile(
    packagePath,
    source.replaceAll("__PROJECT_NAME__", safeName),
    "utf8"
  );
}
async function packageVersion() {
  const source = await readFile(
    new URL("../package.json", import.meta.url),
    "utf8"
  );
  const parsed = JSON.parse(source);
  if (typeof parsed.version !== "string") {
    throw new Error("The installed open-slidex package has no version.");
  }
  return parsed.version;
}
function run(command, commandArgs, cwd, stdio) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env: process.env,
      stdio
    });
    child.once("error", reject);
    child.once("exit", (code2) => {
      if (code2 === 0) resolve();
      else reject(new Error(`${command} exited with code ${code2 ?? "unknown"}.`));
    });
  });
}
