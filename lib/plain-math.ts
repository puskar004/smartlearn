/**
 * Convert LaTeX / $...$ math into readable plain text (Unicode) for UI.
 */

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Match balanced {...} starting at open brace index */
function readBrace(s: string, openIdx: number): { inner: string; end: number } | null {
  if (s[openIdx] !== "{") return null;
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return { inner: s.slice(openIdx + 1, i), end: i };
    }
  }
  return null;
}

function takeCmdArg(s: string, from: number): { arg: string; end: number } | null {
  let i = from;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (i >= s.length) return null;
  if (s[i] === "{") {
    const b = readBrace(s, i);
    if (!b) return null;
    return { arg: b.inner, end: b.end + 1 };
  }
  // single token
  return { arg: s[i], end: i + 1 };
}

function replaceFracSqrt(s: string): string {
  let out = s;
  let guard = 0;
  while (guard++ < 40) {
    const fracAt = out.search(/\\frac\b/);
    const sqrtAt = out.search(/\\sqrt\b/);
    let at = -1;
    let kind: "frac" | "sqrt" | null = null;
    if (fracAt >= 0 && (sqrtAt < 0 || fracAt <= sqrtAt)) {
      at = fracAt;
      kind = "frac";
    } else if (sqrtAt >= 0) {
      at = sqrtAt;
      kind = "sqrt";
    }
    if (at < 0 || !kind) break;

    if (kind === "frac") {
      const a1 = takeCmdArg(out, at + 5);
      if (!a1) {
        out = out.slice(0, at) + "frac" + out.slice(at + 5);
        continue;
      }
      const a2 = takeCmdArg(out, a1.end);
      if (!a2) {
        out = out.slice(0, at) + "frac" + out.slice(at + 5);
        continue;
      }
      const num = replaceFracSqrt(a1.arg).trim();
      const den = replaceFracSqrt(a2.arg).trim();
      const rep =
        num.length <= 3 && den.length <= 6 && !/[+\- ]/.test(num + den)
          ? `${num}/${den}`
          : `(${num})/(${den})`;
      out = out.slice(0, at) + rep + out.slice(a2.end);
    } else {
      const a1 = takeCmdArg(out, at + 5);
      if (!a1) {
        out = out.slice(0, at) + "sqrt" + out.slice(at + 5);
        continue;
      }
      const inner = replaceFracSqrt(a1.arg).trim();
      const rep = inner.length <= 8 ? `√${inner}` : `√(${inner})`;
      out = out.slice(0, at) + rep + out.slice(a1.end);
    }
  }
  return out;
}

const SUB: Record<string, string> = {
  "0": "₀",
  "1": "₁",
  "2": "₂",
  "3": "₃",
  "4": "₄",
  "5": "₅",
  "6": "₆",
  "7": "₇",
  "8": "₈",
  "9": "₉",
  "+": "₊",
  "-": "₋",
  a: "ₐ",
  e: "ₑ",
  i: "ᵢ",
  o: "ₒ",
  r: "ᵣ",
  u: "ᵤ",
  v: "ᵥ",
  x: "ₓ",
  n: "ₙ",
  m: "ₘ",
  t: "ₜ",
  s: "ₛ",
  p: "ₚ",
  k: "ₖ",
};

const SUP: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "+": "⁺",
  "-": "⁻",
  n: "ⁿ",
};

function toSub(str: string): string {
  return [...str].map((c) => SUB[c] || c).join("");
}
function toSup(str: string): string {
  return [...str].map((c) => SUP[c] || c).join("");
}

function replaceLatexCommands(tex: string): string {
  let s = tex.trim();

  // \text{...} etc first
  for (let i = 0; i < 8; i++) {
    const next = s.replace(
      /\\(?:text|mathrm|mathbf|operatorname|textrm|textit)\s*\{([^{}]*)\}/g,
      "$1"
    );
    if (next === s) break;
    s = next;
  }

  s = replaceFracSqrt(s);

  s = s.replace(/\\vec\s*\{([^{}]*)\}/g, "$1→");
  s = s.replace(/\\overrightarrow\s*\{([^{}]*)\}/g, "$1→");
  s = s.replace(/\\hat\s*\{([^{}]*)\}/g, "$1̂");
  s = s.replace(/\\bar\s*\{([^{}]*)\}/g, "$1̄");

  // sub/sup with braces
  s = s.replace(/_\{([^{}]+)\}/g, (_, x) => toSub(String(x)));
  s = s.replace(/\^\{([^{}]+)\}/g, (_, x) => toSup(String(x)));
  s = s.replace(/_([A-Za-z0-9])/g, (_, x) => toSub(String(x)));
  s = s.replace(/\^([A-Za-z0-9+-])/g, (_, x) => toSup(String(x)));

  const cmds: [RegExp, string][] = [
    [/\\varepsilon/g, "ε"],
    [/\\epsilon/g, "ε"],
    [/\\vartheta/g, "ϑ"],
    [/\\mu/g, "μ"],
    [/\\phi/g, "φ"],
    [/\\varphi/g, "φ"],
    [/\\Phi/g, "Φ"],
    [/\\pi/g, "π"],
    [/\\theta/g, "θ"],
    [/\\omega/g, "ω"],
    [/\\Omega/g, "Ω"],
    [/\\alpha/g, "α"],
    [/\\beta/g, "β"],
    [/\\gamma/g, "γ"],
    [/\\delta/g, "δ"],
    [/\\Delta/g, "Δ"],
    [/\\lambda/g, "λ"],
    [/\\rho/g, "ρ"],
    [/\\sigma/g, "σ"],
    [/\\tau/g, "τ"],
    [/\\nu/g, "ν"],
    [/\\eta/g, "η"],
    [/\\chi/g, "χ"],
    [/\\psi/g, "ψ"],
    [/\\Psi/g, "Ψ"],
    [/\\infty/g, "∞"],
    [/\\pm/g, "±"],
    [/\\mp/g, "∓"],
    [/\\times/g, "×"],
    [/\\cdot/g, "·"],
    [/\\div/g, "÷"],
    [/\\leq|\\le/g, "≤"],
    [/\\geq|\\ge/g, "≥"],
    [/\\neq|\\ne/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\propto/g, "∝"],
    [/\\rightarrow|\\to/g, "→"],
    [/\\leftarrow/g, "←"],
    [/\\Rightarrow/g, "⇒"],
    [/\\partial/g, "∂"],
    [/\\nabla/g, "∇"],
    [/\\sum/g, "Σ"],
    [/\\int/g, "∫"],
    [/\\hbar/g, "ℏ"],
    [/\\degree/g, "°"],
    [/\\%/g, "%"],
    [/\\,|\\;|\\!/g, ""],
    [/\\quad|\\qquad/g, " "],
    [/\\left|\\right/g, ""],
    [/\\big|\\Big|\\bigg|\\Bigg/g, ""],
    [/\\langle/g, "⟨"],
    [/\\rangle/g, "⟩"],
  ];
  for (const [re, rep] of cmds) s = s.replace(re, rep);

  // stray \I or \command → drop backslash
  s = s.replace(/\\([A-Za-z]+)/g, "$1");
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\s*([=+\-×·÷])\s*/g, " $1 ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

function convertMathIsland(inner: string): string {
  return replaceLatexCommands(inner);
}

export function toPlainMath(input: string): string {
  if (!input) return "";
  let s = decodeEntities(String(input));

  // normalize double backslashes sometimes stored in JSON
  if (s.includes("\\\\")) {
    s = s.replace(/\\\\/g, "\\");
  }

  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => convertMathIsland(m));
  s = s.replace(/\$([^$]+?)\$/g, (_, m) => convertMathIsland(m));
  s = s.replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => convertMathIsland(m));
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => convertMathIsland(m));

  if (/\\[a-zA-Z]+|\\frac|\\sqrt|\\vec/.test(s)) {
    s = replaceLatexCommands(s);
  }

  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

export function plainFlowchartText<T extends string | undefined>(v: T): T {
  if (v == null || v === "") return v;
  return toPlainMath(v) as T;
}
