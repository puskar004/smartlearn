/**
 * Board-style CBSE MCQs (valid concepts, not fluff).
 * Keyed loosely by subject; matched to chapter title/topics.
 */

export type BankQ = {
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  tags: string[]; // match chapter title/topics/subject
};

export const BOARD_BANK: BankQ[] = [
  // Physics / Science — electricity
  {
    tags: ["electricity", "ohm", "current", "resistance"],
    prompt: "According to Ohm’s law, the current through a conductor is directly proportional to:",
    options: [
      "Potential difference across its ends (temperature constant)",
      "Only the length of the conductor",
      "Atmospheric pressure",
      "Frequency of AC supply only",
    ],
    correctIndex: 0,
    explanation: "V ∝ I at constant temperature; V = IR.",
  },
  {
    tags: ["electricity", "ohm", "series", "parallel", "resistor"],
    prompt: "Three resistors of 2 Ω, 3 Ω and 6 Ω are connected in parallel. Equivalent resistance is:",
    options: ["1 Ω", "11 Ω", "0.5 Ω", "6 Ω"],
    correctIndex: 0,
    explanation: "1/R = 1/2 + 1/3 + 1/6 = 1 ⇒ R = 1 Ω.",
  },
  {
    tags: ["electricity", "power", "joule", "heating"],
    prompt: "SI unit of electric power is:",
    options: ["Watt", "Joule", "Coulomb", "Ohm"],
    correctIndex: 0,
    explanation: "Power P = VI; unit is watt (J/s).",
  },
  {
    tags: ["magnetic", "motor", "fleming", "current"],
    prompt: "Fleming’s left-hand rule is used to find the direction of:",
    options: [
      "Force on a current-carrying conductor in a magnetic field",
      "Induced emf only",
      "Electric field in a capacitor",
      "Gravitational force",
    ],
    correctIndex: 0,
    explanation: "FBI rule: force, field, current directions.",
  },
  // Light / optics
  {
    tags: ["light", "reflection", "mirror", "ray optics", "optics"],
    prompt: "For a concave mirror, a real, inverted and magnified image is formed when object is:",
    options: [
      "Between F and C",
      "At infinity",
      "Between pole and F",
      "At the pole",
    ],
    correctIndex: 0,
    explanation: "Object between F and C → real inverted magnified beyond C.",
  },
  {
    tags: ["light", "refraction", "lens", "ray optics", "optics"],
    prompt: "Power of a lens of focal length 50 cm is:",
    options: ["+2 D", "+0.5 D", "−2 D", "+50 D"],
    correctIndex: 0,
    explanation: "P = 1/f(m) = 1/0.5 = +2 D (convex assumed positive).",
  },
  {
    tags: ["light", "human eye", "defect", "myopia", "colour"],
    prompt: "Myopia (short-sightedness) is corrected by using a:",
    options: ["Concave lens", "Convex lens", "Cylindrical lens only", "Plane mirror"],
    correctIndex: 0,
    explanation: "Diverging (concave) lens shifts image onto retina.",
  },
  // Waves / modern
  {
    tags: ["wave optics", "interference", "diffraction", "young"],
    prompt: "In Young’s double-slit experiment, fringe width is proportional to:",
    options: [
      "Wavelength λ",
      "Inverse of λ",
      "Square of slit separation",
      "Amplitude only",
    ],
    correctIndex: 0,
    explanation: "β = λD/d ∝ λ.",
  },
  {
    tags: ["photoelectric", "dual nature", "einstein", "photon"],
    prompt: "Photoelectric effect supports the:",
    options: [
      "Particle nature of light",
      "Only wave nature of light",
      "Newtonian corpuscles of mass only",
      "Sound wave model",
    ],
    correctIndex: 0,
    explanation: "Photon energy hf explains threshold frequency and KE_max.",
  },
  {
    tags: ["semiconductor", "diode", "electronics", "transistor"],
    prompt: "In a forward-biased p–n junction diode, the barrier potential:",
    options: [
      "Decreases",
      "Increases largely",
      "Becomes infinite",
      "Is unaffected",
    ],
    correctIndex: 0,
    explanation: "Forward bias reduces the depletion barrier.",
  },
  // Chemistry
  {
    tags: ["acid", "base", "salt", "ph", "indicator"],
    prompt: "A solution with pH = 3 is:",
    options: ["Acidic", "Basic", "Neutral", "Cannot say"],
    correctIndex: 0,
    explanation: "pH < 7 → acidic.",
  },
  {
    tags: ["metal", "reactivity", "non-metal", "corrosion"],
    prompt: "Which metal is most reactive among Na, Cu, Au, Fe?",
    options: ["Na", "Cu", "Au", "Fe"],
    correctIndex: 0,
    explanation: "Sodium is highly reactive alkali metal.",
  },
  {
    tags: ["carbon", "organic", "homologous", "covalent"],
    prompt: "Carbon forms large number of compounds mainly due to:",
    options: [
      "Catenation and tetravalency",
      "High atomic mass only",
      "Being a metal",
      "Radioactivity",
    ],
    correctIndex: 0,
    explanation: "C–C bonds + 4 valence electrons enable chains/rings.",
  },
  {
    tags: ["solution", "raoult", "colligative", "mole"],
    prompt: "Colligative properties depend on:",
    options: [
      "Number of solute particles",
      "Nature of solute only",
      "Colour of solution",
      "Density of solvent only",
    ],
    correctIndex: 0,
    explanation: "ΔT_b, ΔT_f, π depend on particle count (i factor).",
  },
  {
    tags: ["electrochemistry", "nernst", "cell", "electrode"],
    prompt: "In a galvanic cell, oxidation occurs at the:",
    options: ["Anode", "Cathode", "Salt bridge only", "Voltmeter"],
    correctIndex: 0,
    explanation: "Anode is oxidation electrode in galvanic cells.",
  },
  {
    tags: ["kinetics", "rate", "order", "arrhenius"],
    prompt: "Unit of rate constant for a first-order reaction is:",
    options: ["s⁻¹", "mol L⁻¹ s⁻¹", "L mol⁻¹ s⁻¹", "mol s⁻¹"],
    correctIndex: 0,
    explanation: "For first order, k has dimension of frequency (time⁻¹).",
  },
  {
    tags: ["haloalkane", "sn1", "sn2", "organic"],
    prompt: "SN2 reaction is favoured by:",
    options: [
      "Primary alkyl halide + strong nucleophile",
      "Tertiary halide in polar protic solvent only",
      "No nucleophile",
      "Only heat without reagent",
    ],
    correctIndex: 0,
    explanation: "Less hindered substrate + strong Nu → bimolecular SN2.",
  },
  // Maths
  {
    tags: ["quadratic", "roots", "polynomial", "equation"],
    prompt: "For ax² + bx + c = 0 (a ≠ 0), sum of roots is:",
    options: ["−b/a", "c/a", "b/a", "−c/a"],
    correctIndex: 0,
    explanation: "Vieta: α+β = −b/a, αβ = c/a.",
  },
  {
    tags: ["arithmetic", "progression", "ap", "sequence"],
    prompt: "nth term of an AP with first term a and common difference d is:",
    options: ["a + (n−1)d", "a + nd", "a − (n−1)d", "n(a+d)"],
    correctIndex: 0,
    explanation: "Standard AP formula a_n = a+(n−1)d.",
  },
  {
    tags: ["trigonometry", "sin", "cos", "identity"],
    prompt: "sin²θ + cos²θ equals:",
    options: ["1", "0", "2", "tanθ"],
    correctIndex: 0,
    explanation: "Fundamental trigonometric identity.",
  },
  {
    tags: ["probability", "event", "random"],
    prompt: "Probability of an impossible event is:",
    options: ["0", "1", "1/2", "−1"],
    correctIndex: 0,
    explanation: "Impossible event has probability 0.",
  },
  {
    tags: ["matrix", "determinant", "inverse", "linear"],
    prompt: "A square matrix A is invertible if and only if:",
    options: [
      "det(A) ≠ 0",
      "det(A) = 0",
      "A is zero matrix",
      "All elements are 1",
    ],
    correctIndex: 0,
    explanation: "Non-singular matrices (det ≠ 0) have inverse.",
  },
  {
    tags: ["derivative", "continuity", "differentiability", "limit"],
    prompt: "Derivative of sin x w.r.t. x is:",
    options: ["cos x", "−cos x", "sin x", "−sin x"],
    correctIndex: 0,
    explanation: "d/dx(sin x) = cos x.",
  },
  {
    tags: ["integral", "integration", "antiderivative"],
    prompt: "∫ cos x dx equals:",
    options: ["sin x + C", "−sin x + C", "cos x + C", "sec x + C"],
    correctIndex: 0,
    explanation: "Antiderivative of cos x is sin x.",
  },
  {
    tags: ["vector", "dot", "cross", "3d"],
    prompt: "If a · b = 0 and a, b ≠ 0, then a and b are:",
    options: [
      "Perpendicular",
      "Parallel",
      "Equal vectors",
      "Opposite vectors only",
    ],
    correctIndex: 0,
    explanation: "Dot product zero ⇒ angle 90°.",
  },
  // Biology / life
  {
    tags: ["life processes", "nutrition", "respiration", "transport"],
    prompt: "In humans, oxygenated blood is pumped by the:",
    options: [
      "Left ventricle",
      "Right atrium",
      "Right ventricle only",
      "Pulmonary vein into lungs",
    ],
    correctIndex: 0,
    explanation: "Left ventricle pumps oxygenated blood to body.",
  },
  {
    tags: ["heredity", "mendel", "gene", "variation"],
    prompt: "Mendel’s law of segregation states that alleles:",
    options: [
      "Separate during gamete formation",
      "Blend permanently",
      "Never exist in pairs",
      "Are only on Y chromosome",
    ],
    correctIndex: 0,
    explanation: "Allele pairs segregate into different gametes.",
  },
  {
    tags: ["reproduction", "asexual", "sexual", "organism"],
    prompt: "Binary fission is common in:",
    options: ["Amoeba", "Human", "Mustard plant only", "Birds"],
    correctIndex: 0,
    explanation: "Unicellular organisms like Amoeba reproduce by fission.",
  },
  {
    tags: ["photosynthesis", "plant", "chlorophyll", "respiration"],
    prompt: "Site of light reaction in photosynthesis is:",
    options: ["Thylakoid membrane", "Cytoplasm only", "Mitochondrial matrix", "Ribosome"],
    correctIndex: 0,
    explanation: "Light reactions occur in thylakoids of chloroplast.",
  },
  {
    tags: ["molecular", "dna", "inheritance", "replication"],
    prompt: "DNA replication is:",
    options: [
      "Semi-conservative",
      "Fully conservative only",
      "Dispersive only in humans",
      "Non-existent in eukaryotes",
    ],
    correctIndex: 0,
    explanation: "Each new DNA has one old and one new strand.",
  },
  // SST / others generic board
  {
    tags: ["nationalism", "india", "history", "gandhi"],
    prompt: "The Non-Cooperation Movement was launched in:",
    options: ["1920", "1857", "1942 only", "1991"],
    correctIndex: 0,
    explanation: "Non-Cooperation began in 1920 under Gandhi’s leadership.",
  },
  {
    tags: ["federalism", "power", "democracy", "political"],
    prompt: "In a federal system, powers are divided between:",
    options: [
      "Central and state governments",
      "Only the judiciary",
      "Only local clubs",
      "Army and police only",
    ],
    correctIndex: 0,
    explanation: "Federalism = constitutional division of powers.",
  },
  {
    tags: ["development", "economy", "gdp", "sector"],
    prompt: "Which sector includes banking and transport?",
    options: ["Tertiary", "Primary", "Secondary only", "None"],
    correctIndex: 0,
    explanation: "Services form the tertiary sector.",
  },
  // Computer science
  {
    tags: ["python", "stack", "queue", "file", "sql", "network"],
    prompt: "Stack follows:",
    options: ["LIFO", "FIFO only", "Random access only", "Priority of CPU only"],
    correctIndex: 0,
    explanation: "Last In First Out is stack discipline.",
  },
  {
    tags: ["sql", "database", "select", "join"],
    prompt: "SQL command to retrieve rows is:",
    options: ["SELECT", "INSERT only", "DROP", "GRANT only"],
    correctIndex: 0,
    explanation: "SELECT queries data from tables.",
  },
  // Accountancy / BST / Eco
  {
    tags: ["partnership", "goodwill", "share", "accounting"],
    prompt: "In partnership, profits are shared:",
    options: [
      "As per partnership deed (or equally if silent)",
      "Only by senior partner",
      "Never shared",
      "Only in cash sales",
    ],
    correctIndex: 0,
    explanation: "Deed governs ratio; silence ⇒ equal share (Partnership Act).",
  },
  {
    tags: ["management", "planning", "organising", "business"],
    prompt: "First function of management is generally:",
    options: ["Planning", "Controlling only", "Directing only", "Staffing only"],
    correctIndex: 0,
    explanation: "Planning sets objectives before other functions.",
  },
  {
    tags: ["national income", "gdp", "macro", "money", "banking"],
    prompt: "GDP at market price includes:",
    options: [
      "Value of final goods and services produced domestically in a year",
      "Only intermediate goods",
      "Only imports",
      "Black money exclusively",
    ],
    correctIndex: 0,
    explanation: "GDP measures domestic final output in a period.",
  },
  // English skill-style
  {
    tags: ["english", "letter", "diary", "prose", "poem"],
    prompt: "A formal letter to the Editor is usually meant to:",
    options: [
      "Express a public concern for publication",
      "Order food online",
      "Write a private diary only",
      "Solve a maths equation",
    ],
    correctIndex: 0,
    explanation: "Editor letters raise issues for newspaper readers.",
  },
];

export function questionsForChapter(input: {
  title: string;
  topics: string[];
  subjectName?: string;
  subjectId?: string;
}): BankQ[] {
  const hay = [
    input.title,
    input.subjectName || "",
    input.subjectId || "",
    ...input.topics,
  ]
    .join(" ")
    .toLowerCase();

  const scored = BOARD_BANK.map((q) => {
    let s = 0;
    for (const t of q.tags) {
      if (hay.includes(t.toLowerCase())) s += 2;
    }
    // light subject boost
    if (input.subjectName && q.tags.some((t) => input.subjectName!.toLowerCase().includes(t))) {
      s += 1;
    }
    return { q, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.q);

  if (scored.length >= 4) return scored;

  // Fallback: general board aptitude mixed with chapter name (still valid style)
  const fallback: BankQ[] = [
    {
      tags: ["general"],
      prompt: `While studying “${input.title}”, the most board-relevant practice is:`,
      options: [
        "NCERT text + in-text/exemplar + previous year questions",
        "Only social media one-liners",
        "Skipping diagrams and definitions",
        "Memorizing unrelated current affairs only",
      ],
      correctIndex: 0,
      explanation: "CBSE rewards NCERT language, examples and PYQ patterns.",
    },
    {
      tags: ["general"],
      prompt: `Key terms in “${input.title}” should be revised by:`,
      options: [
        "Writing definitions with one example each",
        "Ignoring NCERT glossary",
        "Reading only the chapter name",
        "Avoiding any self-test",
      ],
      correctIndex: 0,
      explanation: "Definition + example builds both short and long answers.",
    },
    ...BOARD_BANK.slice(0, 8),
  ];
  return [...scored, ...fallback];
}
