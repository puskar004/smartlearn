/** Strict subject family for quiz isolation — never mix across subjects */

export type QuizSubject =
  | "physics"
  | "chemistry"
  | "biology"
  | "maths"
  | "history"
  | "civics"
  | "geography"
  | "economics"
  | "english"
  | "cs"
  | "accountancy"
  | "business"
  | "general";

/** Stem match: acid→acids, metal→metals; avoid mole→molecular, sin→single */
function hasStem(blob: string, stems: string[]): boolean {
  const b = ` ${blob.toLowerCase().replace(/[^a-z0-9+]+/g, " ")} `;
  return stems.some((s) => {
    const st = s.toLowerCase().trim();
    if (!st) return false;
    // multi-word: exact phrase
    if (st.includes(" ")) {
      return b.includes(` ${st} `) || b.includes(st);
    }
    // short stems (≤4): whole word only (mole, sin, cos, dna, gene)
    if (st.length <= 4) {
      return new RegExp(`\\b${st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(b);
    }
    // longer stems: allow plural/suffix (acids, metals, electric…)
    return new RegExp(
      `\\b${st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[a-z0-9]{0,3}\\b`,
      "i"
    ).test(b);
  });
}

const SUBJECT_STEMS: Record<Exclude<QuizSubject, "general">, string[]> = {
  physics: [
    "electric", "ohm", "magnet", "light", "optic", "mirror", "lens", "motion",
    "force", "energy", "work", "power", "sound", "wave", "gravitation", "newton",
    "kinetic", "potential", "current", "resistor", "resistance", "semiconductor",
    "photoelectric", "optics", "eye", "reflection", "refraction", "diode",
    "transistor", "interference", "diffraction", "young", "fleming", "joule",
    "heating", "volt", "ampere", "coulomb", "watt", "human eye", "colourful",
  ],
  chemistry: [
    "acid", "base", "salt", "chemical", "reaction", "metal", "carbon", "organic",
    "mole concept", "molar", "periodic", "bond", "solution", "electrochem", "kinetics", "haloalkane",
    "compound", "oxidation", "reduction", "atom", "molecule", "indicator", "ph",
    "reactivity", "corrosion", "covalent", "homologous", "raoult", "colligative",
    "nernst", "electrode", "galvanic", "arrhenius", "sn1", "sn2", "non-metal",
    "nonmetal", "chemical equation", "chemical reaction",
  ],
  biology: [
    "life process", "nutrition", "respiration", "excretion", "coordination",
    "reproduction", "heredity", "evolution", "cell", "tissue", "photosynthesis",
    "ecology", "organism", "gene", "dna", "plant", "animal", "hormone", "nervous",
    "mitosis", "meiosis", "amoeba", "mendel", "variation", "chlorophyll",
    "thylakoid", "binary fission", "asexual", "environment", "ecosystem",
    "control and coordination", "how do organisms",
  ],
  maths: [
    "real number", "polynomial", "quadratic", "arithmetic progression", "coordinate",
    "trigonometr", "triangle", "circle", "construction", "surface area", "volume",
    "statistics", "probability", "relation", "function", "matrix", "determinant",
    "continuity", "differenti", "derivative", "integral", "vector", "geometry",
    "permutation", "combination", "binomial", "sequence", "series", "limit",
    "algebra", "calculus", "sin²", "cos²", "tanθ", "sine", "cosine", "linear equation", "pair of linear",
  ],
  history: [
    "nationalism", "history", "gandhi", "revolution", "empire", "war", "colonial",
    "freedom", "civilisation", "civilization", "ancient", "medieval", "nazism",
    "industrialisation", "print", "novel", "non-cooperation", "satyagraha",
  ],
  civics: [
    "federal", "democracy", "power sharing", "political", "constitution",
    "electoral", "parliament", "judiciary", "rights", "gender", "civics",
    "outcome of democracy",
  ],
  geography: [
    "resource", "agriculture", "mineral", "manufacturing", "lifeline", "forest",
    "wildlife", "geography", "climate", "soil", "population", "map", "water resource",
  ],
  economics: [
    "development", "sector", "money", "credit", "globalisation", "consumer",
    "national income", "gdp", "economy", "economics", "poverty", "employment",
    "banking", "tertiary", "primary sector",
  ],
  english: [
    "english", "prose", "poem", "letter", "diary", "grammar", "literature",
    "flamingo", "vistas", "footprints",
  ],
  cs: [
    "python", "stack", "queue", "sql", "database", "network", "computer",
    "programming", "boolean", "file",
  ],
  accountancy: [
    "partnership", "goodwill", "share", "accounting", "accountancy", "journal",
    "ledger", "balance sheet",
  ],
  business: [
    "management", "planning", "organising", "staffing", "directing", "controlling",
    "marketing", "business", "bst",
  ],
};

/**
 * Map curriculum subject + chapter title → one quiz family.
 * Class 10 "Science" is split by chapter (chem/phy/bio).
 */
export function resolveQuizSubject(
  subjectName?: string,
  title?: string,
  topics: string[] = []
): QuizSubject {
  const subj = (subjectName || "").toLowerCase().trim();
  const blob = [subjectName || "", title || "", ...topics].join(" ");

  // Pure named subjects
  if (/math/.test(subj)) return "maths";
  if (/chem/.test(subj)) return "chemistry";
  if (/^physics|physics\b/.test(subj)) return "physics";
  if (/bio|life sc/.test(subj)) return "biology";
  if (/history/.test(subj)) return "history";
  if (/political|civics|pol\.?\s*sci/.test(subj)) return "civics";
  if (/geography|\bgeo\b/.test(subj)) return "geography";
  if (/econom/.test(subj)) return "economics";
  if (/english|lang lit/.test(subj)) return "english";
  if (/computer|informatics|\bip\b|\bcs\b/.test(subj)) return "cs";
  if (/account/.test(subj)) return "accountancy";
  if (/business|\bbst\b/.test(subj)) return "business";

  // Title/topic driven (Science, SST, etc.)
  // Prefer more specific chapter signals — order matters
  const order: Exclude<QuizSubject, "general">[] = [
    "chemistry",
    "biology",
    "physics",
    "maths",
    "history",
    "civics",
    "geography",
    "economics",
    "english",
    "cs",
    "accountancy",
    "business",
  ];

  // Score each subject by stem hits in title+topics (not whole subject name "Science")
  const titleBlob = [title || "", ...topics].join(" ");
  let best: QuizSubject = "general";
  let bestScore = 0;
  for (const sub of order) {
    const stems = SUBJECT_STEMS[sub];
    let score = 0;
    for (const st of stems) {
      if (hasStem(titleBlob, [st])) score += st.length > 5 ? 3 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sub;
    }
  }
  if (bestScore > 0) return best;

  // Social science bag without clear chapter
  if (/social|sst/.test(subj)) return "history";
  if (/science/.test(subj)) return "general";

  return "general";
}

/** Classify bank question by tags + prompt */
export function subjectOfBankQ(tags: string[], prompt: string): QuizSubject {
  const blob = [...tags, prompt].join(" ");
  const order: Exclude<QuizSubject, "general">[] = [
    "chemistry",
    "biology",
    "physics",
    "maths",
    "history",
    "civics",
    "geography",
    "economics",
    "english",
    "cs",
    "accountancy",
    "business",
  ];
  let best: QuizSubject = "general";
  let bestScore = 0;
  for (const sub of order) {
    let score = 0;
    for (const st of SUBJECT_STEMS[sub]) {
      if (hasStem(blob, [st])) score += st.length > 5 ? 3 : 2;
    }
    // strong tag name boosts
    if (tags.some((t) => hasStem(t, SUBJECT_STEMS[sub]))) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = sub;
    }
  }
  return bestScore > 0 ? best : "general";
}

export function subjectLabel(s: QuizSubject): string {
  const map: Record<QuizSubject, string> = {
    physics: "Physics",
    chemistry: "Chemistry",
    biology: "Biology",
    maths: "Mathematics",
    history: "History",
    civics: "Political Science",
    geography: "Geography",
    economics: "Economics",
    english: "English",
    cs: "Computer Science",
    accountancy: "Accountancy",
    business: "Business Studies",
    general: "General",
  };
  return map[s];
}
