import type { ChapterFlowchart } from "@/lib/flowchart-types";

/** Offline / demo bank — detailed enough for full chapter revision */
const BANK: ChapterFlowchart[] = [
  {
    chapter: "Photosynthesis",
    subject: "Biology / Science",
    examBullets: [
      "Overall: 6CO₂ + 12H₂O → C₆H₁₂O₆ + 6O₂ + 6H₂O (in presence of light & chlorophyll).",
      "Light reaction (thylakoid): photolysis of water, O₂ released, ATP + NADPH formed.",
      "Dark reaction / Calvin cycle (stroma): CO₂ fixed into glucose using ATP + NADPH.",
      "Chlorophyll a is the chief pigment; carotenoids are accessory pigments.",
      "Limiting factors (Blackman): light intensity, CO₂ concentration, temperature.",
      "Stomata: CO₂ in, O₂ out; guard cells control opening.",
    ],
    nodes: [
      {
        id: "s",
        label: "What is photosynthesis?",
        kind: "start",
        summary:
          "Process by which green plants make food (glucose) from CO₂ and water using sunlight. Oxygen is released as a by-product. Essential for life on Earth.",
        points: [
          "Autotrophic nutrition in plants",
          "Occurs mainly in leaves (mesophyll cells)",
          "Needs chlorophyll, light, CO₂, H₂O",
        ],
      },
      {
        id: "n1",
        label: "Where it happens",
        kind: "concept",
        summary:
          "Chloroplasts in mesophyll cells. Thylakoid membranes hold chlorophyll; stroma is the fluid where sugar is made.",
        points: [
          "Leaf structure: epidermis, mesophyll, veins",
          "Chloroplast: grana (stacks of thylakoids) + stroma",
          "Stomata exchange gases; water via roots & xylem",
        ],
      },
      {
        id: "n2",
        label: "Raw materials & pigments",
        kind: "concept",
        summary:
          "CO₂ from air, water from soil, light energy, chlorophyll. Without any one of these, rate falls.",
        points: [
          "Chlorophyll a (main), chlorophyll b, carotenoids",
          "Light absorbed mainly in blue & red wavelengths",
          "Green light mostly reflected (why leaves look green)",
        ],
      },
      {
        id: "n3",
        label: "Light reaction",
        kind: "concept",
        summary:
          "Light-dependent stage on thylakoid membrane. Water splits (photolysis), oxygen released, energy stored as ATP and NADPH.",
        points: [
          "Photolysis: 2H₂O → 4H⁺ + 4e⁻ + O₂",
          "Electron transport chain → ATP",
          "NADP⁺ + H⁺ + e⁻ → NADPH",
          "O₂ comes from water, not CO₂",
        ],
      },
      {
        id: "n4",
        label: "Dark reaction (Calvin)",
        kind: "concept",
        summary:
          "Light-independent but needs products of light reaction. In stroma, CO₂ is fixed into carbohydrate (glucose).",
        points: [
          "CO₂ + RuBP → intermediate (via Rubisco idea at school level)",
          "Uses ATP + NADPH from light reaction",
          "Glucose / starch formed and stored or transported",
          "Can continue for a while in dim light if ATP/NADPH available",
        ],
      },
      {
        id: "n5",
        label: "Balanced equation",
        kind: "formula",
        summary:
          "Write and balance carefully in exams. Show light and chlorophyll as conditions, not reactants to ‘consume’.",
        points: [
          "6CO₂ + 12H₂O → C₆H₁₂O₆ + 6O₂ + 6H₂O",
          "Sometimes simplified: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂",
          "Always mention light + chlorophyll",
        ],
      },
      {
        id: "n6",
        label: "Factors & experiments",
        kind: "tip",
        summary:
          "Blackman’s law of limiting factors. Classic demos: starch test, oxygen bubbles from Hydrilla, variegated leaf.",
        points: [
          "Iodine test for starch (blue-black)",
          "Variegated leaf → only green parts make starch",
          "Rate ↑ with light/CO₂ up to a point, then plateaus",
        ],
      },
      {
        id: "n7",
        label: "Exam hotspots",
        kind: "exam",
        summary:
          "Diagram of leaf/chloroplast, difference light vs dark reaction, equation, limiting factors, why plants need both stages.",
        points: [
          "1-mark: site of light / dark reaction",
          "2–3 mark: difference table light vs dark",
          "3–5 mark: explain process + equation + factors",
        ],
      },
      {
        id: "e",
        label: "Self-check done",
        kind: "end",
        summary:
          "Close the book and rewrite equation, sites, and 5 limiting-factor points from memory.",
        points: [
          "Redraw chloroplast labels",
          "List 5 exam bullets aloud",
          "Solve 1 PYQ on photosynthesis",
        ],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "e" },
    ],
  },
  {
    chapter: "Light – Reflection and Refraction",
    subject: "Physics / Science",
    examBullets: [
      "Laws of reflection: (i) ∠i = ∠r (ii) incident ray, reflected ray, normal are coplanar.",
      "Spherical mirror: f = R/2 · Mirror formula: 1/v + 1/u = 1/f.",
      "New Cartesian sign: object distance u is negative; f concave negative, convex positive (as per NCERT).",
      "Refraction: light bends toward normal in denser medium; Snell’s law n = sin i / sin r.",
      "Lens formula: 1/v − 1/u = 1/f · Power P = 1/f (f in metres) in dioptre (D).",
      "Magnification m = h′/h = v/u (mirrors/lenses — check NCERT sign use carefully).",
    ],
    nodes: [
      {
        id: "s",
        label: "Nature of light",
        kind: "start",
        summary:
          "Light travels in straight lines in a uniform medium. Reflection = bounce back; refraction = change of medium and speed/direction.",
        points: [
          "Ray model is enough for this chapter",
          "Speed in vacuum/air ≈ 3 × 10⁸ m/s",
          "Real vs virtual images: screen test",
        ],
      },
      {
        id: "n1",
        label: "Reflection laws",
        kind: "concept",
        summary:
          "At the point of incidence, draw normal perpendicular to surface. Angle of incidence equals angle of reflection.",
        points: [
          "∠i = ∠r always (smooth surface)",
          "All three in one plane",
          "Plane mirror: image virtual, erect, same size, laterally inverted",
        ],
      },
      {
        id: "n2",
        label: "Spherical mirrors",
        kind: "concept",
        summary:
          "Concave (converging) and convex (diverging). Know pole (P), centre of curvature (C), focus (F), aperture, principal axis.",
        points: [
          "f = R/2",
          "Concave: real/inverted (usually) or virtual if object between F and P",
          "Convex: always virtual, erect, diminished",
          "Ray diagrams: parallel → F; through F → parallel; through C → back on itself",
        ],
      },
      {
        id: "n3",
        label: "Mirror formula & m",
        kind: "formula",
        summary:
          "Use sign convention first, then plug into formula. Don’t mix sign rules mid-problem.",
        points: [
          "1/v + 1/u = 1/f",
          "m = h′/h = −v/u (NCERT spherical mirrors)",
          "Practice one numerical each: concave & convex",
        ],
      },
      {
        id: "n4",
        label: "Refraction basics",
        kind: "concept",
        summary:
          "When light enters denser medium it slows and bends toward the normal; rarer → away from normal.",
        points: [
          "Absolute refractive index n = c/v",
          "Snell: n₁ sin i = n₂ sin r",
          "Apparent depth: pool looks shallower",
        ],
      },
      {
        id: "n5",
        label: "Lenses",
        kind: "concept",
        summary:
          "Convex (converging) and concave (diverging). Optical centre, foci on both sides.",
        points: [
          "Convex: can form real or virtual images",
          "Concave: always virtual, erect, diminished",
          "Ray diagrams similar spirit to mirrors",
        ],
      },
      {
        id: "n6",
        label: "Lens formula & power",
        kind: "formula",
        summary:
          "Power measures how strongly a lens converges/diverges. Combination: P = P₁ + P₂ (thin lenses in contact).",
        points: [
          "1/v − 1/u = 1/f",
          "P = 1/f (f in m) · unit dioptre D",
          "Convex power positive; concave negative (usual convention)",
        ],
      },
      {
        id: "n7",
        label: "Exam numericals",
        kind: "exam",
        summary:
          "Always: diagram sketch → sign convention → formula → units. Partial marks for steps.",
        points: [
          "Mirror: find v, m, nature of image",
          "Lens: power, combination, image distance",
          "Label ray diagrams cleanly",
        ],
      },
      {
        id: "e",
        label: "Revision complete",
        kind: "end",
        summary: "Redraw 2 ray diagrams and solve 2 numericals without notes.",
        points: ["Concave mirror object beyond C", "Convex lens object beyond 2F"],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "e" },
    ],
  },
  {
    chapter: "Quadratic Equations",
    subject: "Mathematics",
    examBullets: [
      "Standard form: ax² + bx + c = 0 with a ≠ 0.",
      "Discriminant D = b² − 4ac decides nature of roots.",
      "Quadratic formula: x = (−b ± √D) / (2a).",
      "D > 0: two distinct real roots; D = 0: equal real roots; D < 0: no real roots (class 10).",
      "Sum of roots = −b/a · Product = c/a (for ax²+bx+c=0).",
      "Word problems: define variable, form equation, reject invalid roots (e.g. negative length).",
    ],
    nodes: [
      {
        id: "s",
        label: "What is quadratic?",
        kind: "start",
        summary:
          "A polynomial equation of degree 2. Highest power of variable is 2. Exactly one variable for board problems usually.",
        points: [
          "General: ax² + bx + c = 0, a ≠ 0",
          "Examples: x² − 5x + 6 = 0 · 2x² = 3x",
          "Not quadratic if a = 0 (becomes linear)",
        ],
      },
      {
        id: "n1",
        label: "Write standard form",
        kind: "concept",
        summary:
          "Bring all terms to one side. Identify coefficients a, b, c carefully (including signs).",
        points: [
          "Expand brackets first if needed",
          "Combine like terms",
          "Example: (x+1)(x+2)=0 → x²+3x+2=0",
        ],
      },
      {
        id: "n2",
        label: "Factorisation method",
        kind: "concept",
        summary:
          "Split middle term so factors multiply to a·c and add to b. Then use zero-product rule.",
        points: [
          "Find two numbers: product = ac, sum = b",
          "Factor by grouping",
          "(x − p)(x − q) = 0 ⇒ x = p or x = q",
        ],
      },
      {
        id: "n3",
        label: "Completing the square",
        kind: "tip",
        summary:
          "Useful to derive the quadratic formula and for some word problems. Make LHS a perfect square.",
        points: [
          "Divide by a if a ≠ 1",
          "Add & subtract (b/2a)²",
          "Take square root both sides",
        ],
      },
      {
        id: "n4",
        label: "Quadratic formula",
        kind: "formula",
        summary:
          "Works for every quadratic. Compute D first; if D < 0, stop at ‘no real roots’ (Class 10).",
        points: [
          "D = b² − 4ac",
          "x = (−b ± √D) / (2a)",
          "Keep ± as two separate roots",
          "Simplify radicals when possible",
        ],
      },
      {
        id: "n5",
        label: "Nature of roots",
        kind: "exam",
        summary:
          "Many 1–2 mark questions only ask nature — don’t solve fully unless asked.",
        points: [
          "D > 0 distinct real",
          "D = 0 real and equal",
          "D < 0 no real roots",
          "Relate to graph touching x-axis",
        ],
      },
      {
        id: "n6",
        label: "Sum & product",
        kind: "formula",
        summary:
          "If roots α, β: α+β = −b/a, αβ = c/a. Form equation x² − (sum)x + (product) = 0.",
        points: [
          "Given roots → make equation",
          "Given sum/product → find equation",
          "Useful in word problems",
        ],
      },
      {
        id: "n7",
        label: "Word problems",
        kind: "exam",
        summary:
          "Translate English to maths. Check which root makes sense physically (time, length > 0).",
        points: [
          "Ages, speed-distance, area, numbers",
          "Discard extraneous roots",
          "Write final statement with units",
        ],
      },
      {
        id: "e",
        label: "Practice set",
        kind: "end",
        summary: "Do 2 factorisation + 2 formula + 1 word problem under timer.",
        points: ["One with D=0", "One with D<0", "One application problem"],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n1", to: "n3" },
      { from: "n2", to: "n4" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "e" },
    ],
  },
  {
    chapter: "Electricity",
    subject: "Physics / Science",
    examBullets: [
      "Current I = Q/t (ampere). Potential difference V = W/Q (volt).",
      "Ohm’s law: V = IR (ohmic conductors, constant T).",
      "Resistance R = ρℓ/A · resistivity ρ depends on material & temperature.",
      "Series: R_s = R₁+R₂+… · same I, V splits. Parallel: 1/R_p = 1/R₁+1/R₂+… · same V, I splits.",
      "Electric power P = VI = I²R = V²/R · Energy E = P t (kWh for bills).",
      "Heating effect: H = I²Rt (Joule’s law).",
    ],
    nodes: [
      {
        id: "s",
        label: "Charge & current",
        kind: "start",
        summary:
          "Electric current is flow of charge. In metals, free electrons drift under electric field.",
        points: [
          "I = Q/t · 1 A = 1 C/s",
          "Direction: conventional current + to −",
          "Ammeter in series; ideal ammeter resistance ≈ 0",
        ],
      },
      {
        id: "n1",
        label: "Potential difference",
        kind: "concept",
        summary:
          "Work needed to move unit charge between two points. Battery maintains PD in a circuit.",
        points: [
          "V = W/Q · 1 V = 1 J/C",
          "Voltmeter in parallel; high resistance",
          "Cell emf vs terminal voltage (intro level)",
        ],
      },
      {
        id: "n2",
        label: "Ohm’s law",
        kind: "formula",
        summary:
          "For many metallic conductors at fixed temperature, V ∝ I. Graph V–I is a straight line through origin.",
        points: [
          "V = IR",
          "R = V/I definition also used",
          "Ohmic vs non-ohmic (bulb filament approx)",
        ],
      },
      {
        id: "n3",
        label: "Resistance factors",
        kind: "concept",
        summary:
          "Resistance opposes current. Depends on material, length, area, temperature.",
        points: [
          "R = ρℓ/A",
          "Longer wire → more R; thicker → less R",
          "Resistivity ρ: material property",
          "Alloys often used in heaters (high ρ, high melting point)",
        ],
      },
      {
        id: "n4",
        label: "Series circuits",
        kind: "concept",
        summary:
          "One path for current. If one bulb fuses, all go off in simple series string.",
        points: [
          "I same through each",
          "V = V₁+V₂+…",
          "R_s = R₁+R₂+…",
          "Equivalent resistance increases",
        ],
      },
      {
        id: "n5",
        label: "Parallel circuits",
        kind: "concept",
        summary:
          "Home wiring is parallel so each appliance gets full voltage and can be switched alone.",
        points: [
          "V same across each branch",
          "I = I₁+I₂+…",
          "1/R_p = 1/R₁ + 1/R₂ + …",
          "R_p < smallest branch R",
        ],
      },
      {
        id: "n6",
        label: "Power & heating",
        kind: "formula",
        summary:
          "Power is rate of energy use. Heating devices use Joule heating deliberately.",
        points: [
          "P = VI = I²R = V²/R",
          "H = I²Rt",
          "1 kWh = 3.6 × 10⁶ J",
          "Fuse melts on excess current — safety",
        ],
      },
      {
        id: "n7",
        label: "Exam circuit problems",
        kind: "exam",
        summary:
          "Redraw circuit cleanly. Reduce series/parallel step by step. Find I, V, R, P as asked.",
        points: [
          "Label given values",
          "Find R_eq first",
          "Then I_total = V/R_eq",
          "Split V or I for parts",
        ],
      },
      {
        id: "e",
        label: "Done — check units",
        kind: "end",
        summary: "Memorise units table: A, V, Ω, W, kWh, J.",
        points: ["3 series numericals", "2 parallel", "1 power bill style"],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "e" },
    ],
  },
  {
    chapter: "Chemical Reactions and Equations",
    subject: "Chemistry / Science",
    examBullets: [
      "Chemical equation: reactants → products; must be balanced (same atoms both sides).",
      "Types: combination, decomposition, displacement, double displacement, redox (oxidation–reduction).",
      "Oxidation: gain of oxygen / loss of hydrogen; reduction: opposite (school level).",
      "Exothermic releases heat; endothermic absorbs heat.",
      "Corrosion (rusting) and rancidity are everyday redox examples — prevention methods are exam favourites.",
      "Always write physical states (s), (l), (g), (aq) when asked.",
    ],
    nodes: [
      {
        id: "s",
        label: "Chemical change",
        kind: "start",
        summary:
          "New substances form. Signs: colour change, gas, precipitate, heat/light, irreversible often.",
        points: [
          "Vs physical change (no new substance)",
          "Word equation → symbol equation",
          "Law of conservation of mass → balance",
        ],
      },
      {
        id: "n1",
        label: "Writing equations",
        kind: "concept",
        summary:
          "Use correct formulae. Skeleton equation first, then balance atoms one element at a time.",
        points: [
          "Don’t change subscripts to balance — change coefficients",
          "Balance H/O often last",
          "Include state symbols if required",
        ],
      },
      {
        id: "n2",
        label: "Combination",
        kind: "concept",
        summary: "Two or more substances combine to form one product.",
        points: [
          "C + O₂ → CO₂",
          "CaO + H₂O → Ca(OH)₂",
          "Often exothermic",
        ],
      },
      {
        id: "n3",
        label: "Decomposition",
        kind: "concept",
        summary: "One compound breaks into two or more. Needs heat/light/electricity often.",
        points: [
          "Thermal: CaCO₃ → CaO + CO₂",
          "Electrolytic: water → H₂ + O₂",
          "Photolytic: silver salts in photography",
        ],
      },
      {
        id: "n4",
        label: "Displacement",
        kind: "concept",
        summary:
          "More reactive element displaces less reactive from compound. Use reactivity series.",
        points: [
          "Fe + CuSO₄ → FeSO₄ + Cu",
          "Zn displaces Cu²⁺, H⁺ in acids (with conditions)",
          "No reaction if metal is less reactive",
        ],
      },
      {
        id: "n5",
        label: "Double displacement",
        kind: "concept",
        summary:
          "Exchange of ions between two compounds. Often forms precipitate or water (neutralisation).",
        points: [
          "AgNO₃ + NaCl → AgCl↓ + NaNO₃",
          "Acid + base → salt + water",
          "Precipitate = insoluble solid",
        ],
      },
      {
        id: "n6",
        label: "Redox idea",
        kind: "formula",
        summary:
          "Oxidation and reduction always occur together. Identify what gains/loses O or H.",
        points: [
          "Oxidised substance: oxidation",
          "Reduced substance: reduction",
          "Rusting: Fe → Fe₂O₃·xH₂O",
          "Rancidity: oils oxidise — keep airtight, antioxidants",
        ],
      },
      {
        id: "n7",
        label: "Exam write & balance",
        kind: "exam",
        summary:
          "Name the type, balance, state symbols, one use/example. Partial credit for steps.",
        points: [
          "One equation of each type",
          "Identify redox pair in a reaction",
          "Corrosion prevention: paint, galvanising, alloying",
        ],
      },
      {
        id: "e",
        label: "Flashcard finish",
        kind: "end",
        summary: "Recite 5 types with one example each without notes.",
        points: ["Balance 3 mixed equations", "List corrosion methods"],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "e" },
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
    if (t === q) return structuredClone(f);
    if (t.includes(q) || q.includes(t)) {
      const score = Math.min(t.length, q.length) + 10;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    const qt = new Set(q.split(" "));
    const tt = t.split(" ");
    const hit = tt.filter((w) => w.length > 3 && qt.has(w)).length;
    if (hit >= 2 && hit * 5 > bestScore) {
      bestScore = hit * 5;
      best = f;
    }
  }
  return best ? structuredClone(best) : null;
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
      `Read the full NCERT chapter “${title}” once without underlining.`,
      "List every bold definition and rewrite in your own words.",
      "Write all formulas / reactions / diagrams from memory, then check.",
      "Make a 10-row table: concept | formula/fact | 1 example | exam tip.",
      "Solve 5 short (1–2 mark) and 2 long (3–5 mark) questions from PYQ/NCERT exercises.",
      "Teach the chapter aloud in 5 minutes (Feynman) and note gaps.",
    ],
    nodes: [
      {
        id: "s",
        label: `Overview: ${title}`,
        kind: "start",
        summary: `Big picture of “${title}”: why it matters in the syllabus and what exam expects (definitions, reasoning, numericals/diagrams).`,
        points: [
          "Skim headings and summary first",
          "Note weightage from your sample papers",
          "List prerequisites from earlier chapters",
        ],
      },
      {
        id: "n1",
        label: "Key definitions",
        kind: "concept",
        summary:
          "Collect every NCERT definition. Exams love exact wording for 1-mark questions.",
        points: [
          "Bold terms in NCERT",
          "One-line meaning + one example each",
          "Common confusions / similar terms",
        ],
      },
      {
        id: "n2",
        label: "Core concepts in order",
        kind: "concept",
        summary:
          "Study in cause → mechanism → result order so long answers stay structured.",
        points: [
          "Section-wise main idea",
          "Link each idea to the next",
          "Note exceptions and special cases",
        ],
      },
      {
        id: "n3",
        label: "Laws & principles",
        kind: "concept",
        summary:
          "Write statement, mathematical form (if any), conditions, and one application.",
        points: [
          "Statement (exam wording)",
          "Formula / graph",
          "Limitations",
        ],
      },
      {
        id: "n4",
        label: "Formulas & derivations",
        kind: "formula",
        summary:
          "Memorise final results and practise one short derivation path used in boards.",
        points: [
          "Formula sheet in your own hand",
          "Units and symbols",
          "Sign conventions / assumptions",
        ],
      },
      {
        id: "n5",
        label: "Diagrams & tables",
        kind: "tip",
        summary:
          "Labelled diagrams fetch easy marks. Practise neat arrows and spellings.",
        points: [
          "Redraw from memory twice",
          "Label every part",
          "Table of differences if chapter has compare questions",
        ],
      },
      {
        id: "n6",
        label: "Examples & applications",
        kind: "tip",
        summary:
          "One daily-life example and one numerical/case per major concept.",
        points: [
          "NCERT examples",
          "In-text questions",
          "Real-life link for 2-mark ‘why’ questions",
        ],
      },
      {
        id: "n7",
        label: "NCERT exercises",
        kind: "concept",
        summary:
          "Do in-text and end exercises; many board questions are twisted NCERT lines.",
        points: [
          "All short answers",
          "All numericals",
          "Mark doubtful ones for teacher/AI tutor",
        ],
      },
      {
        id: "n8",
        label: "Exam pattern & PYQs",
        kind: "exam",
        summary:
          "Sort past questions into 1 / 2 / 3 / 5 mark buckets for this chapter.",
        points: [
          "Most repeated topics",
          "Diagram/numerical frequency",
          "Write one full 5-mark answer with headings",
        ],
      },
      {
        id: "n9",
        label: "Common mistakes",
        kind: "exam",
        summary:
          "List traps: wrong units, missing steps, incomplete definitions, unlabelled diagrams.",
        points: [
          "Sign / unit errors",
          "Leaving ‘hence proved’ steps",
          "Mixing similar terms",
        ],
      },
      {
        id: "e",
        label: "Final self-test",
        kind: "end",
        summary:
          "Closed-book: recite map, write formulas, solve 3 mixed questions in 25 minutes.",
        points: [
          "Timer on",
          "Check with NCERT",
          "Revise only weak nodes tomorrow",
        ],
      },
    ],
    edges: [
      { from: "s", to: "n1" },
      { from: "n1", to: "n2" },
      { from: "n2", to: "n3" },
      { from: "n3", to: "n4" },
      { from: "n4", to: "n5" },
      { from: "n5", to: "n6" },
      { from: "n6", to: "n7" },
      { from: "n7", to: "n8" },
      { from: "n8", to: "n9" },
      { from: "n9", to: "e" },
    ],
  };
}
