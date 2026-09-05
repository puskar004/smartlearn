import { resolveNcertUrl, resolveSubjectBookUrl } from "./ncert-books";

export type Grade = "10" | "11" | "12";

export type Chapter = {
  id: string;
  number: number;
  title: string;
  ncertPdf?: string;
  topics: string[];
};

export type Subject = {
  id: string;
  name: string;
  icon: string;
  chapters: Chapter[];
  pyqYears: number[];
  /** Full NCERT book portal for this subject */
  bookUrl?: string;
};

export type GradePack = {
  grade: Grade;
  label: string;
  board: string;
  subjects: Subject[];
};

const ncert = (code: string) =>
  `https://ncert.nic.in/textbook.php?${code}`;

function ch(
  grade: string,
  subject: string,
  number: number,
  title: string,
  topics: string[],
  pdf?: string
): Chapter {
  return {
    id: `${grade}-${subject}-ch${number}`,
    number,
    title,
    topics,
    ncertPdf: pdf,
  };
}

const _RAW_CURRICULUM: GradePack[] = [
  {
    grade: "10",
    label: "Class 10",
    board: "CBSE",
    subjects: [
      {
        id: "science",
        name: "Science",
        icon: "🔬",
        pyqYears: [2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("10", "science", 1, "Chemical Reactions and Equations", ["types of reactions", "balancing", "oxidation"], ncert("jesc1=1-16")),
          ch("10", "science", 2, "Acids, Bases and Salts", ["pH", "indicators", "salts"], ncert("jesc1=2-16")),
          ch("10", "science", 3, "Metals and Non-metals", ["reactivity series", "ionic bonds"], ncert("jesc1=3-16")),
          ch("10", "science", 4, "Carbon and its Compounds", ["covalent bonding", "homologous series"], ncert("jesc1=4-16")),
          ch("10", "science", 5, "Life Processes", ["nutrition", "respiration", "transport"], ncert("jesc1=5-16")),
          ch("10", "science", 6, "Control and Coordination", ["nervous system", "hormones"], ncert("jesc1=6-16")),
          ch("10", "science", 7, "How do Organisms Reproduce?", ["asexual", "sexual reproduction"], ncert("jesc1=7-16")),
          ch("10", "science", 8, "Heredity", ["Mendel", "sex determination"], ncert("jesc1=8-16")),
          ch("10", "science", 9, "Light – Reflection and Refraction", ["mirrors", "lenses", "power"], ncert("jesc1=9-16")),
          ch("10", "science", 10, "The Human Eye and the Colourful World", ["defects of vision", "dispersion"], ncert("jesc1=10-16")),
          ch("10", "science", 11, "Electricity", ["Ohm's law", "resistors", "power"], ncert("jesc1=11-16")),
          ch("10", "science", 12, "Magnetic Effects of Electric Current", ["Fleming", "domestic circuit"], ncert("jesc1=12-16")),
          ch("10", "science", 13, "Our Environment", ["ecosystem", "ozone"], ncert("jesc1=13-16")),
        ],
      },
      {
        id: "maths",
        name: "Mathematics",
        icon: "📐",
        pyqYears: [2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("10", "maths", 1, "Real Numbers", ["Euclid", "fundamental theorem"], ncert("jemh1=1-15")),
          ch("10", "maths", 2, "Polynomials", ["zeros", "division algorithm"], ncert("jemh1=2-15")),
          ch("10", "maths", 3, "Pair of Linear Equations in Two Variables", ["graphical", "algebraic"], ncert("jemh1=3-15")),
          ch("10", "maths", 4, "Quadratic Equations", ["nature of roots", "applications"], ncert("jemh1=4-15")),
          ch("10", "maths", 5, "Arithmetic Progressions", ["nth term", "sum"], ncert("jemh1=5-15")),
          ch("10", "maths", 6, "Triangles", ["similarity", "Pythagoras"], ncert("jemh1=6-15")),
          ch("10", "maths", 7, "Coordinate Geometry", ["distance", "section formula"], ncert("jemh1=7-15")),
          ch("10", "maths", 8, "Introduction to Trigonometry", ["ratios", "identities"], ncert("jemh1=8-15")),
          ch("10", "maths", 9, "Some Applications of Trigonometry", ["heights and distances"], ncert("jemh1=9-15")),
          ch("10", "maths", 10, "Circles", ["tangents"], ncert("jemh1=10-15")),
          ch("10", "maths", 11, "Areas Related to Circles", ["sectors", "segments"], ncert("jemh1=11-15")),
          ch("10", "maths", 12, "Surface Areas and Volumes", ["combination of solids"], ncert("jemh1=12-15")),
          ch("10", "maths", 13, "Statistics", ["mean", "median", "mode"], ncert("jemh1=13-15")),
          ch("10", "maths", 14, "Probability", ["classical probability"], ncert("jemh1=14-15")),
        ],
      },
      {
        id: "sst",
        name: "Social Science",
        icon: "🌍",
        pyqYears: [2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("10", "sst", 1, "The Rise of Nationalism in Europe", ["French Revolution", "unification"]),
          ch("10", "sst", 2, "Nationalism in India", ["Non-Cooperation", "Civil Disobedience"]),
          ch("10", "sst", 3, "The Making of a Global World", ["trade", "colonialism"]),
          ch("10", "sst", 4, "The Age of Industrialisation", ["factories", "workers"]),
          ch("10", "sst", 5, "Print Culture and the Modern World", ["print revolution"]),
          ch("10", "sst", 6, "Resources and Development", ["resource planning", "soil"]),
          ch("10", "sst", 7, "Forest and Wildlife Resources", ["conservation"]),
          ch("10", "sst", 8, "Water Resources", ["multipurpose projects"]),
          ch("10", "sst", 9, "Agriculture", ["cropping patterns"]),
          ch("10", "sst", 10, "Minerals and Energy Resources", ["conventional energy"]),
          ch("10", "sst", 11, "Manufacturing Industries", ["industrial location"]),
          ch("10", "sst", 12, "Lifelines of National Economy", ["transport", "communication"]),
          ch("10", "sst", 13, "Power-sharing", ["Belgium", "Sri Lanka"]),
          ch("10", "sst", 14, "Federalism", ["India federal structure"]),
          ch("10", "sst", 15, "Gender, Religion and Caste", ["social divisions"]),
          ch("10", "sst", 16, "Political Parties", ["national parties"]),
          ch("10", "sst", 17, "Outcomes of Democracy", ["accountability"]),
          ch("10", "sst", 18, "Development", ["HDI", "sustainability"]),
          ch("10", "sst", 19, "Sectors of the Indian Economy", ["primary secondary tertiary"]),
          ch("10", "sst", 20, "Money and Credit", ["formal informal credit"]),
          ch("10", "sst", 21, "Globalisation and the Indian Economy", ["MNCs", "WTO"]),
          ch("10", "sst", 22, "Consumer Rights", ["COPRA"]),
        ],
      },
      {
        id: "english",
        name: "English",
        icon: "📚",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("10", "english", 1, "A Letter to God", ["faith", "irony"]),
          ch("10", "english", 2, "Nelson Mandela: Long Walk to Freedom", ["apartheid", "freedom"]),
          ch("10", "english", 3, "Two Stories about Flying", ["fear", "courage"]),
          ch("10", "english", 4, "From the Diary of Anne Frank", ["war", "diary"]),
          ch("10", "english", 5, "Glimpses of India", ["Coorg", "tea", "Goa"]),
          ch("10", "english", 6, "Mijbil the Otter", ["pet", "adaptation"]),
          ch("10", "english", 7, "Madam Rides the Bus", ["curiosity", "independence"]),
          ch("10", "english", 8, "The Sermon at Benares", ["Buddha", "sorrow"]),
          ch("10", "english", 9, "The Proposal", ["comedy", "marriage"]),
        ],
      },
      {
        id: "hindi",
        name: "Hindi",
        icon: "📝",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("10", "hindi", 1, "सूरदास के पद", ["भक्ति", "वात्सल्य"]),
          ch("10", "hindi", 2, "राम-लक्ष्मण-परशुराम संवाद", ["रामचरितमानस"]),
          ch("10", "hindi", 3, "सवैया और कवित्त", ["रीति काल"]),
          ch("10", "hindi", 4, "आत्मत्राण", ["कविता भाव"]),
          ch("10", "hindi", 5, "माता का आँचल", ["संस्मरण"]),
          ch("10", "hindi", 6, "गिरगिट", ["व्यंग्य"]),
          ch("10", "hindi", 7, "अब कहाँ दूसरे के दुख से दुखी होने वाले", ["निबंध"]),
          ch("10", "hindi", 8, "पतझर में टूटी पत्तियाँ", ["यात्रा वृत्तांत"]),
          ch("10", "hindi", 9, "कारतूस", ["नाटक"]),
        ],
      },
      {
        id: "it",
        name: "Information Technology",
        icon: "💻",
        pyqYears: [2023, 2024, 2025],
        chapters: [
          ch("10", "it", 1, "Digital Documentation (Advanced)", ["styles", "templates"]),
          ch("10", "it", 2, "Electronic Spreadsheet (Advanced)", ["scenarios", "macros"]),
          ch("10", "it", 3, "Database Management System", ["tables", "queries"]),
          ch("10", "it", 4, "Web Applications and Security", ["cyber safety"]),
        ],
      },
    ],
  },
  {
    grade: "11",
    label: "Class 11",
    board: "CBSE",
    subjects: [
      {
        id: "physics",
        name: "Physics",
        icon: "⚛️",
        pyqYears: [2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("11", "physics", 1, "Units and Measurements", ["SI", "errors", "dimensions"]),
          ch("11", "physics", 2, "Motion in a Straight Line", ["velocity", "acceleration"]),
          ch("11", "physics", 3, "Motion in a Plane", ["projectile", "circular"]),
          ch("11", "physics", 4, "Laws of Motion", ["Newton", "friction"]),
          ch("11", "physics", 5, "Work, Energy and Power", ["conservation", "collisions"]),
          ch("11", "physics", 6, "System of Particles and Rotational Motion", ["COM", "torque"]),
          ch("11", "physics", 7, "Gravitation", ["Kepler", "satellites"]),
          ch("11", "physics", 8, "Mechanical Properties of Solids", ["stress", "strain"]),
          ch("11", "physics", 9, "Mechanical Properties of Fluids", ["Bernoulli", "viscosity"]),
          ch("11", "physics", 10, "Thermal Properties of Matter", ["expansion", "calorimetry"]),
          ch("11", "physics", 11, "Thermodynamics", ["laws", "heat engines"]),
          ch("11", "physics", 12, "Kinetic Theory", ["ideal gas", "rms"]),
          ch("11", "physics", 13, "Oscillations", ["SHM", "energy"]),
          ch("11", "physics", 14, "Waves", ["superposition", "Doppler"]),
        ],
      },
      {
        id: "chemistry",
        name: "Chemistry",
        icon: "🧪",
        pyqYears: [2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("11", "chemistry", 1, "Some Basic Concepts of Chemistry", ["mole", "stoichiometry"]),
          ch("11", "chemistry", 2, "Structure of Atom", ["Bohr", "quantum numbers"]),
          ch("11", "chemistry", 3, "Classification of Elements and Periodicity", ["periodic trends"]),
          ch("11", "chemistry", 4, "Chemical Bonding and Molecular Structure", ["VSEPR", "hybridization"]),
          ch("11", "chemistry", 5, "Thermodynamics", ["enthalpy", "entropy"]),
          ch("11", "chemistry", 6, "Equilibrium", ["Kc", "pH", "buffer"]),
          ch("11", "chemistry", 7, "Redox Reactions", ["oxidation number"]),
          ch("11", "chemistry", 8, "Organic Chemistry – Basic Principles", ["IUPAC", "isomerism"]),
          ch("11", "chemistry", 9, "Hydrocarbons", ["alkanes", "alkenes", "alkynes"]),
        ],
      },
      {
        id: "maths",
        name: "Mathematics",
        icon: "📐",
        pyqYears: [2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("11", "maths", 1, "Sets", ["operations", "Venn"]),
          ch("11", "maths", 2, "Relations and Functions", ["domain", "range"]),
          ch("11", "maths", 3, "Trigonometric Functions", ["identities", "equations"]),
          ch("11", "maths", 4, "Complex Numbers and Quadratic Equations", ["Argand"]),
          ch("11", "maths", 5, "Linear Inequalities", ["graphical solution"]),
          ch("11", "maths", 6, "Permutations and Combinations", ["nPr", "nCr"]),
          ch("11", "maths", 7, "Binomial Theorem", ["general term"]),
          ch("11", "maths", 8, "Sequences and Series", ["AP", "GP"]),
          ch("11", "maths", 9, "Straight Lines", ["slope", "forms"]),
          ch("11", "maths", 10, "Conic Sections", ["parabola", "ellipse", "hyperbola"]),
          ch("11", "maths", 11, "Introduction to Three Dimensional Geometry", ["distance", "section"]),
          ch("11", "maths", 12, "Limits and Derivatives", ["first principle"]),
          ch("11", "maths", 13, "Statistics", ["dispersion"]),
          ch("11", "maths", 14, "Probability", ["random experiments"]),
        ],
      },
      {
        id: "biology",
        name: "Biology",
        icon: "🧬",
        pyqYears: [2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("11", "biology", 1, "The Living World", ["taxonomy"]),
          ch("11", "biology", 2, "Biological Classification", ["five kingdom"]),
          ch("11", "biology", 3, "Plant Kingdom", ["algae", "bryophytes"]),
          ch("11", "biology", 4, "Animal Kingdom", ["phyla"]),
          ch("11", "biology", 5, "Morphology of Flowering Plants", ["root stem leaf"]),
          ch("11", "biology", 6, "Anatomy of Flowering Plants", ["tissues"]),
          ch("11", "biology", 7, "Structural Organisation in Animals", ["tissues", "cockroach"]),
          ch("11", "biology", 8, "Cell: The Unit of Life", ["organelles"]),
          ch("11", "biology", 9, "Biomolecules", ["enzymes", "proteins"]),
          ch("11", "biology", 10, "Cell Cycle and Cell Division", ["mitosis", "meiosis"]),
          ch("11", "biology", 11, "Photosynthesis in Higher Plants", ["light reaction"]),
          ch("11", "biology", 12, "Respiration in Plants", ["glycolysis", "ETC"]),
          ch("11", "biology", 13, "Plant Growth and Development", ["hormones"]),
          ch("11", "biology", 14, "Breathing and Exchange of Gases", ["respiration human"]),
          ch("11", "biology", 15, "Body Fluids and Circulation", ["heart", "ECG"]),
          ch("11", "biology", 16, "Excretory Products and their Elimination", ["nephron"]),
          ch("11", "biology", 17, "Locomotion and Movement", ["muscles", "joints"]),
          ch("11", "biology", 18, "Neural Control and Coordination", ["neuron", "brain"]),
          ch("11", "biology", 19, "Chemical Coordination and Integration", ["endocrine"]),
        ],
      },
      {
        id: "english",
        name: "English",
        icon: "📚",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("11", "english", 1, "The Portrait of a Lady", ["grandmother"]),
          ch("11", "english", 2, "We're Not Afraid to Die...", ["courage"]),
          ch("11", "english", 3, "Discovering Tut: the Saga Continues", ["archaeology"]),
          ch("11", "english", 4, "The Adventure", ["alternate history"]),
          ch("11", "english", 5, "Silk Road", ["travelogue"]),
          ch("11", "english", 6, "The Summer of the Beautiful White Horse", ["Aram"]),
          ch("11", "english", 7, "The Address", ["war memory"]),
          ch("11", "english", 8, "Mother's Day", ["drama"]),
          ch("11", "english", 9, "Birth", ["medical"]),
          ch("11", "english", 10, "The Tale of Melon City", ["satire"]),
        ],
      },
      {
        id: "cs",
        name: "Computer Science",
        icon: "💻",
        pyqYears: [2023, 2024, 2025],
        chapters: [
          ch("11", "cs", 1, "Computer System Overview", ["hardware software"]),
          ch("11", "cs", 2, "Encoding Schemes and Number System", ["binary"]),
          ch("11", "cs", 3, "Emerging Trends", ["AI", "IoT", "cloud"]),
          ch("11", "cs", 4, "Introduction to Problem Solving", ["algorithms"]),
          ch("11", "cs", 5, "Getting Started with Python", ["syntax"]),
          ch("11", "cs", 6, "Flow of Control", ["if", "loops"]),
          ch("11", "cs", 7, "Functions", ["parameters", "scope"]),
          ch("11", "cs", 8, "Strings", ["slicing", "methods"]),
          ch("11", "cs", 9, "Lists", ["operations"]),
          ch("11", "cs", 10, "Tuples and Dictionaries", ["immutable", "keys"]),
          ch("11", "cs", 11, "Societal Impact", ["cyber ethics"]),
        ],
      },
    ],
  },
  {
    grade: "12",
    label: "Class 12",
    board: "CBSE",
    subjects: [
      {
        id: "physics",
        name: "Physics",
        icon: "⚛️",
        pyqYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "physics", 1, "Electric Charges and Fields", ["Coulomb", "Gauss"], ncert("leph1=1-14")),
          ch("12", "physics", 2, "Electrostatic Potential and Capacitance", ["potential", "dielectrics"], ncert("leph1=2-14")),
          ch("12", "physics", 3, "Current Electricity", ["Ohm", "Kirchhoff"], ncert("leph1=3-14")),
          ch("12", "physics", 4, "Moving Charges and Magnetism", ["Biot-Savart", "Ampere"], ncert("leph1=4-14")),
          ch("12", "physics", 5, "Magnetism and Matter", ["Earth magnetism"], ncert("leph1=5-14")),
          ch("12", "physics", 6, "Electromagnetic Induction", ["Faraday", "Lenz"], ncert("leph1=6-14")),
          ch("12", "physics", 7, "Alternating Current", ["LCR", "power"], ncert("leph1=7-14")),
          ch("12", "physics", 8, "Electromagnetic Waves", ["spectrum"], ncert("leph1=8-14")),
          ch("12", "physics", 9, "Ray Optics and Optical Instruments", ["mirrors", "lenses", "microscope"], ncert("leph2=1-14")),
          ch("12", "physics", 10, "Wave Optics", ["interference", "diffraction"], ncert("leph2=2-14")),
          ch("12", "physics", 11, "Dual Nature of Radiation and Matter", ["photoelectric"], ncert("leph2=3-14")),
          ch("12", "physics", 12, "Atoms", ["Bohr model"], ncert("leph2=4-14")),
          ch("12", "physics", 13, "Nuclei", ["binding energy", "radioactivity"], ncert("leph2=5-14")),
          ch("12", "physics", 14, "Semiconductor Electronics", ["diode", "transistor"], ncert("leph2=6-14")),
        ],
      },
      {
        id: "chemistry",
        name: "Chemistry",
        icon: "🧪",
        pyqYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "chemistry", 1, "Solutions", ["colligative", "Raoult"]),
          ch("12", "chemistry", 2, "Electrochemistry", ["Nernst", "cells"]),
          ch("12", "chemistry", 3, "Chemical Kinetics", ["order", "Arrhenius"]),
          ch("12", "chemistry", 4, "The d- and f-Block Elements", ["transition", "lanthanoids"]),
          ch("12", "chemistry", 5, "Coordination Compounds", ["Werner", "CFT"]),
          ch("12", "chemistry", 6, "Haloalkanes and Haloarenes", ["SN1 SN2"]),
          ch("12", "chemistry", 7, "Alcohols, Phenols and Ethers", ["preparation", "properties"]),
          ch("12", "chemistry", 8, "Aldehydes, Ketones and Carboxylic Acids", ["nucleophilic addition"]),
          ch("12", "chemistry", 9, "Amines", ["basicity", "diazonium"]),
          ch("12", "chemistry", 10, "Biomolecules", ["carbs", "proteins", "DNA"]),
        ],
      },
      {
        id: "maths",
        name: "Mathematics",
        icon: "📐",
        pyqYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "maths", 1, "Relations and Functions", ["types", "invertible"]),
          ch("12", "maths", 2, "Inverse Trigonometric Functions", ["principal values"]),
          ch("12", "maths", 3, "Matrices", ["operations", "inverse"]),
          ch("12", "maths", 4, "Determinants", ["properties", "area"]),
          ch("12", "maths", 5, "Continuity and Differentiability", ["chain rule"]),
          ch("12", "maths", 6, "Application of Derivatives", ["maxima minima", "tangents"]),
          ch("12", "maths", 7, "Integrals", ["methods", "definite"]),
          ch("12", "maths", 8, "Application of Integrals", ["area under curves"]),
          ch("12", "maths", 9, "Differential Equations", ["order degree", "formation"]),
          ch("12", "maths", 10, "Vector Algebra", ["dot cross"]),
          ch("12", "maths", 11, "Three Dimensional Geometry", ["lines", "planes"]),
          ch("12", "maths", 12, "Linear Programming", ["graphical"]),
          ch("12", "maths", 13, "Probability", ["Bayes", "distributions"]),
        ],
      },
      {
        id: "biology",
        name: "Biology",
        icon: "🧬",
        pyqYears: [2019, 2020, 2021, 2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "biology", 1, "Sexual Reproduction in Flowering Plants", ["pollination"]),
          ch("12", "biology", 2, "Human Reproduction", ["gametogenesis"]),
          ch("12", "biology", 3, "Reproductive Health", ["contraception", "STIs"]),
          ch("12", "biology", 4, "Principles of Inheritance and Variation", ["Mendel", "linkage"]),
          ch("12", "biology", 5, "Molecular Basis of Inheritance", ["DNA", "replication"]),
          ch("12", "biology", 6, "Evolution", ["Darwin", "Hardy-Weinberg"]),
          ch("12", "biology", 7, "Human Health and Disease", ["immunity", "pathogens"]),
          ch("12", "biology", 8, "Microbes in Human Welfare", ["antibiotics", "biogas"]),
          ch("12", "biology", 9, "Biotechnology: Principles and Processes", ["recombinant DNA"]),
          ch("12", "biology", 10, "Biotechnology and its Applications", ["GM crops", "gene therapy"]),
          ch("12", "biology", 11, "Organisms and Populations", ["adaptations"]),
          ch("12", "biology", 12, "Ecosystem", ["productivity", "pyramids"]),
          ch("12", "biology", 13, "Biodiversity and Conservation", ["hotspots"]),
        ],
      },
      {
        id: "english",
        name: "English",
        icon: "📚",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "english", 1, "The Last Lesson", ["linguistic chauvinism"]),
          ch("12", "english", 2, "Lost Spring", ["poverty", "child labour"]),
          ch("12", "english", 3, "Deep Water", ["fear", "Douglas"]),
          ch("12", "english", 4, "The Rattrap", ["human goodness"]),
          ch("12", "english", 5, "Indigo", ["Gandhi", "Champaran"]),
          ch("12", "english", 6, "Poets and Pancakes", ["Gemini Studios"]),
          ch("12", "english", 7, "The Interview", ["celebrity culture"]),
          ch("12", "english", 8, "Going Places", ["adolescence"]),
          ch("12", "english", 9, "My Mother at Sixty-Six", ["aging"]),
          ch("12", "english", 10, "Keeping Quiet", ["introspection"]),
          ch("12", "english", 11, "A Thing of Beauty", ["Keats"]),
          ch("12", "english", 12, "A Roadside Stand", ["rural America"]),
          ch("12", "english", 13, "Aunt Jennifer's Tigers", ["feminism"]),
          ch("12", "english", 14, "The Third Level", ["escape"]),
          ch("12", "english", 15, "The Tiger King", ["satire"]),
          ch("12", "english", 16, "Journey to the End of the Earth", ["Antarctica"]),
          ch("12", "english", 17, "The Enemy", ["humanism"]),
          ch("12", "english", 18, "On the Face of It", ["disability"]),
          ch("12", "english", 19, "Memories of Childhood", ["discrimination"]),
        ],
      },
      {
        id: "cs",
        name: "Computer Science",
        icon: "💻",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "cs", 1, "Exception Handling in Python", ["try except"]),
          ch("12", "cs", 2, "File Handling", ["text binary"]),
          ch("12", "cs", 3, "Stack", ["LIFO", "applications"]),
          ch("12", "cs", 4, "Queue", ["FIFO"]),
          ch("12", "cs", 5, "Sorting", ["bubble", "insertion", "selection"]),
          ch("12", "cs", 6, "Searching", ["linear", "binary"]),
          ch("12", "cs", 7, "Database Concepts", ["relational model"]),
          ch("12", "cs", 8, "Structured Query Language", ["SELECT JOIN"]),
          ch("12", "cs", 9, "Computer Networks", ["protocols", "devices"]),
        ],
      },
      {
        id: "accountancy",
        name: "Accountancy",
        icon: "📒",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "accountancy", 1, "Accounting for Partnership Firms – Fundamentals", ["profit sharing"]),
          ch("12", "accountancy", 2, "Goodwill", ["valuation methods"]),
          ch("12", "accountancy", 3, "Change in Profit Sharing Ratio", ["revaluation"]),
          ch("12", "accountancy", 4, "Admission of a Partner", ["sacrificing ratio"]),
          ch("12", "accountancy", 5, "Retirement of a Partner", ["gaining ratio"]),
          ch("12", "accountancy", 6, "Dissolution of Partnership Firm", ["Realisation"]),
          ch("12", "accountancy", 7, "Accounting for Share Capital", ["issue of shares"]),
          ch("12", "accountancy", 8, "Issue of Debentures", ["types"]),
          ch("12", "accountancy", 9, "Financial Statements of a Company", ["analysis"]),
          ch("12", "accountancy", 10, "Accounting Ratios", ["liquidity", "solvency"]),
          ch("12", "accountancy", 11, "Cash Flow Statement", ["AS-3"]),
        ],
      },
      {
        id: "business",
        name: "Business Studies",
        icon: "💼",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "business", 1, "Nature and Significance of Management", ["functions"]),
          ch("12", "business", 2, "Principles of Management", ["Fayol", "Taylor"]),
          ch("12", "business", 3, "Business Environment", ["dimensions"]),
          ch("12", "business", 4, "Planning", ["types", "process"]),
          ch("12", "business", 5, "Organising", ["structure", "delegation"]),
          ch("12", "business", 6, "Staffing", ["recruitment", "training"]),
          ch("12", "business", 7, "Directing", ["motivation", "leadership"]),
          ch("12", "business", 8, "Controlling", ["techniques"]),
          ch("12", "business", 9, "Financial Management", ["capital structure"]),
          ch("12", "business", 10, "Financial Markets", ["money capital market"]),
          ch("12", "business", 11, "Marketing Management", ["mix", "branding"]),
          ch("12", "business", 12, "Consumer Protection", ["rights", "redressal"]),
        ],
      },
      {
        id: "economics",
        name: "Economics",
        icon: "📊",
        pyqYears: [2022, 2023, 2024, 2025],
        chapters: [
          ch("12", "economics", 1, "National Income and Related Aggregates", ["GDP", "methods"]),
          ch("12", "economics", 2, "Money and Banking", ["RBI", "credit creation"]),
          ch("12", "economics", 3, "Determination of Income and Employment", ["AD AS"]),
          ch("12", "economics", 4, "Government Budget and the Economy", ["deficit"]),
          ch("12", "economics", 5, "Balance of Payments", ["exchange rate"]),
          ch("12", "economics", 6, "Indian Economy on the Eve of Independence", ["colonial"]),
          ch("12", "economics", 7, "Indian Economy 1950–1990", ["planning"]),
          ch("12", "economics", 8, "Liberalisation, Privatisation and Globalisation", ["LPG"]),
          ch("12", "economics", 9, "Human Capital Formation", ["education health"]),
          ch("12", "economics", 10, "Rural Development", ["credit", "organic"]),
          ch("12", "economics", 11, "Employment", ["formal informal"]),
          ch("12", "economics", 12, "Environment and Sustainable Development", ["global warming"]),
          ch("12", "economics", 13, "Comparative Development Experiences", ["India China Pakistan"]),
        ],
      },
    ],
  },
];

/** Attach NCERT PDF/portal links for every chapter + subject book hub */
function withNcertLinks(packs: GradePack[]): GradePack[] {
  return packs.map((g) => ({
    ...g,
    subjects: g.subjects.map((s) => ({
      ...s,
      bookUrl: resolveSubjectBookUrl(g.grade, s.id),
      chapters: s.chapters.map((c) => ({
        ...c,
        ncertPdf:
          c.ncertPdf || resolveNcertUrl(g.grade, s.id, c.number) || undefined,
      })),
    })),
  }));
}

export type SubjectWithBook = Subject & { bookUrl?: string };

export const CURRICULUM: GradePack[] = withNcertLinks(_RAW_CURRICULUM);

export function getGrade(grade: Grade) {
  return CURRICULUM.find((g) => g.grade === grade)!;
}

export function getSubject(grade: Grade, subjectId: string) {
  return getGrade(grade).subjects.find((s) => s.id === subjectId);
}

export function getChapter(grade: Grade, subjectId: string, chapterId: string) {
  return getSubject(grade, subjectId)?.chapters.find((c) => c.id === chapterId);
}

export function allChapters() {
  return CURRICULUM.flatMap((g) =>
    g.subjects.flatMap((s) =>
      s.chapters.map((c) => ({
        ...c,
        grade: g.grade,
        subjectId: s.id,
        subjectName: s.name,
      }))
    )
  );
}
