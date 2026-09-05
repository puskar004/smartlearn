/**
 * CBSE previous year papers — public official / academic PDF links (last ~10 years).
 * Opened in-app via pdf-proxy when host is allowed.
 */

export type PyqPaper = {
  year: number;
  label: string;
  /** Direct PDF when available */
  pdfUrl?: string;
  /** Fallback portal page */
  portalUrl?: string;
};

type SubjectKey = string; // curriculum subject id

/** Map grade+subject → papers 2016–2025 */
const CBSE_MAIN =
  "https://www.cbse.gov.in/cbsenew/question-paper.html";

/** Well-known CBSE academic sample / compartment archives patterns */
function paper(
  year: number,
  subject: string,
  pdf?: string
): PyqPaper {
  return {
    year,
    label: `CBSE ${year} · ${subject}`,
    pdfUrl: pdf,
    portalUrl: CBSE_MAIN,
  };
}

/** Official-ish public PDFs + portal fallbacks for PCM/PCB streams */
export function getPyqPapers(
  grade: string,
  subjectId: string,
  subjectName: string
): PyqPaper[] {
  const years = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016];
  // CBSE hosts vary; we provide direct PDFs where stable public mirrors exist
  // plus always a portal link. Students open via our PDF modal / proxy.
  const key = `${grade}-${subjectId}`;

  const special: Record<string, Partial<Record<number, string>>> = {
    // Class 12 Physics — sample public PDFs (CBSE academic)
    "12-physics": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2023_24/Physics-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2022_23/Physics-SQP.pdf",
      2022: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2021_22/Physics_SQP.pdf",
    },
    "12-chemistry": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2023_24/Chemistry-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2022_23/Chemistry-SQP.pdf",
    },
    "12-maths": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2023_24/Mathematics-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2022_23/Mathematics-SQP.pdf",
    },
    "12-biology": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2023_24/Biology-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2022_23/Biology-SQP.pdf",
    },
    "12-english": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXII_2023_24/EnglishCore-SQP.pdf",
    },
    "11-physics": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXI_2023_24/Physics-SQP.pdf",
    },
    "11-chemistry": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXI_2023_24/Chemistry-SQP.pdf",
    },
    "11-maths": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXI_2023_24/Mathematics-SQP.pdf",
    },
    "11-biology": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassXI_2023_24/Biology-SQP.pdf",
    },
    "10-science": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2023_24/Science-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2022_23/Science-SQP.pdf",
    },
    "10-maths": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2023_24/Mathematics-SQP.pdf",
      2023: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2022_23/Mathematics-SQP.pdf",
    },
    "10-english": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2023_24/English_LN-SQP.pdf",
    },
    "10-social": {
      2024: "https://cbseacademic.nic.in/web_material/SQP/ClassX_2023_24/Social_Science-SQP.pdf",
    },
  };

  const map = special[key] || {};

  return years.map((year) =>
    paper(year, subjectName, map[year])
  );
}
