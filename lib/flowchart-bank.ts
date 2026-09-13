import type { ChapterFlowchart } from "@/lib/flowchart-types";

/** Offline / demo bank for common NCERT-style chapters */
const BANK: ChapterFlowchart[] = [
  {
    chapter: "Photosynthesis",
    subject: "Biology / Science",
    examBullets: [
      "6CO₂ + 12H₂O → C₆H₁₂O₆ + 6O₂ + 6H₂O (light)",
      "Light reaction: thylakoid · Dark reaction: stroma",
      "Chlorophyll a is the main pigment",
    ],
    nodes: [
      { id: "s", label: "Start: Green plants", kind: "start" },
      { id: "n1", label: "Raw materials", kind: "concept", summary: "CO₂, H₂O, sunlight, chlorophyll" },
      { id: "n2", label: "Light reaction", kind: "concept", summary: "Thylakoid membrane · ATP + NADPH + O₂" },
      { id: "n3", label: "Dark reaction (Calvin)", kind: "concept", summary: "Stroma · CO₂ → glucose" },
      { id: "n4", label: "Equation", kind: "formula", summary: "6CO₂ + 12H₂O → C₆H₁₂O₆ + 6O₂ + 6H₂O" },
      { id: "n5", label: "Exam focus", kind: "exam", summary: "Site of reactions · factors affecting rate" },
      { id: "e", label: "Revise & practice PYQ", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "e" },
    ],
  },
  {
    chapter: "Light – Reflection and Refraction",
    subject: "Physics / Science",
    examBullets: [
      "Mirror formula: 1/v + 1/u = 1/f",
      "Lens formula: 1/v − 1/u = 1/f",
      "Power P = 1/f (f in metres, P in dioptre)",
    ],
    nodes: [
      { id: "s", label: "Start: Light basics", kind: "start" },
      { id: "n1", label: "Reflection laws", kind: "concept", summary: "i = r · incident, reflected, normal coplanar" },
      { id: "n2", label: "Spherical mirrors", kind: "concept", summary: "Concave / convex · f = R/2" },
      { id: "n3", label: "Mirror formula", kind: "formula", summary: "1/v + 1/u = 1/f · sign convention" },
      { id: "n4", label: "Refraction & lenses", kind: "concept", summary: "Snell · convex/concave lens" },
      { id: "n5", label: "Lens formula + power", kind: "formula", summary: "1/v − 1/u = 1/f · P = 1/f" },
      { id: "n6", label: "Exam numericals", kind: "exam", summary: "Ray diagrams + one numerical each" },
      { id: "e", label: "Done — practice diagrams", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "e" },
    ],
  },
  {
    chapter: "Quadratic Equations",
    subject: "Mathematics",
    examBullets: [
      "Standard form: ax² + bx + c = 0 (a ≠ 0)",
      "Discriminant D = b² − 4ac",
      "Roots: x = (−b ± √D) / 2a",
    ],
    nodes: [
      { id: "s", label: "Start: Quadratic", kind: "start" },
      { id: "n1", label: "Identify a, b, c", kind: "concept", summary: "Write in ax²+bx+c=0" },
      { id: "n2", label: "Factorisation", kind: "concept", summary: "Split middle term if easy" },
      { id: "n3", label: "Completing square", kind: "tip", summary: "Useful for derivation" },
      { id: "n4", label: "Quadratic formula", kind: "formula", summary: "x = (−b ± √(b²−4ac)) / 2a" },
      { id: "n5", label: "Nature of roots (D)", kind: "exam", summary: "D>0 two real · D=0 equal · D<0 none real" },
      { id: "e", label: "Solve 5 mixed problems", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n2", to: "n4" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "e" },
    ],
  },
  {
    chapter: "Electricity",
    subject: "Physics / Science",
    examBullets: [
      "Ohm: V = IR",
      "Series: R = R₁+R₂ · Parallel: 1/R = 1/R₁+1/R₂",
      "Power P = VI = I²R = V²/R",
    ],
    nodes: [
      { id: "s", label: "Start: Electric current", kind: "start" },
      { id: "n1", label: "Charge & current", kind: "concept", summary: "I = Q/t · ampere" },
      { id: "n2", label: "Potential difference", kind: "concept", summary: "V = W/Q · volt" },
      { id: "n3", label: "Ohm's law", kind: "formula", summary: "V = IR · resistance" },
      { id: "n4", label: "Series & parallel", kind: "concept", summary: "Combine resistors" },
      { id: "n5", label: "Heating & power", kind: "formula", summary: "H = I²Rt · P = VI" },
      { id: "n6", label: "Exam circuit", kind: "exam", summary: "Find I, V, R, P in mixed circuit" },
      { id: "e", label: "Revise units table", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "e" },
    ],
  },
  {
    chapter: "Chemical Reactions and Equations",
    subject: "Chemistry / Science",
    examBullets: [
      "Balance atoms on both sides",
      "Types: combination, decomposition, displacement, double displacement, redox",
      "Oxidation = loss of H / gain of O (school level)",
    ],
    nodes: [
      { id: "s", label: "Start: Chemical change", kind: "start" },
      { id: "n1", label: "Word → symbol equation", kind: "concept" },
      { id: "n2", label: "Balancing", kind: "concept", summary: "Same atoms left & right" },
      { id: "n3", label: "Types of reactions", kind: "concept", summary: "5 main types + examples" },
      { id: "n4", label: "Redox idea", kind: "tip", summary: "Oxidation / reduction pair" },
      { id: "n5", label: "Exam write & balance", kind: "exam", summary: "One of each type + balance" },
      { id: "e", label: "Flashcard formulas", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "e" },
    ],
  },
];

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBankFlowchart(chapter: string): ChapterFlowchart | null {
  const q = norm(chapter);
  if (!q) return null;
  let best: ChapterFlowchart | null = null;
  let bestScore = 0;
  for (const f of BANK) {
    const t = norm(f.chapter);
    if (t === q) return { ...f, chapter: f.chapter };
    if (t.includes(q) || q.includes(t)) {
      const score = Math.min(t.length, q.length);
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    // token overlap
    const qt = new Set(q.split(" "));
    const tt = t.split(" ");
    const hit = tt.filter((w) => w.length > 3 && qt.has(w)).length;
    if (hit >= 2 && hit > bestScore) {
      bestScore = hit;
      best = f;
    }
  }
  return best ? { ...best } : null;
}

export function genericFlowchart(
  chapter: string,
  subject?: string
): ChapterFlowchart {
  const title = chapter.trim() || "Chapter";
  return {
    chapter: title,
    subject: subject || "General",
    examBullets: [
      `Revise NCERT definitions for “${title}”`,
      "Write 3 key formulas / diagrams from memory",
      "Solve 5 short + 2 long exam-style questions",
    ],
    nodes: [
      { id: "s", label: `Start: ${title}`, kind: "start" },
      {
        id: "n1",
        label: "Core definitions",
        kind: "concept",
        summary: "NCERT bold terms & meaning",
      },
      {
        id: "n2",
        label: "Main concepts order",
        kind: "concept",
        summary: "Cause → process → result",
      },
      {
        id: "n3",
        label: "Formulas / diagrams",
        kind: "formula",
        summary: "Write without looking",
      },
      {
        id: "n4",
        label: "Applications / examples",
        kind: "tip",
        summary: "1 daily-life + 1 numerical/case",
      },
      {
        id: "n5",
        label: "Exam hotspots",
        kind: "exam",
        summary: "PYQ patterns · 1-mark traps",
      },
      { id: "e", label: "Quick self-test", kind: "end" },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "e" },
    ],
  };
}
