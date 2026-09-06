import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type EduNewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string;
  category: "CBSE" | "NTA" | "JEE" | "NEET" | "Board" | "Form" | "Other";
  summary?: string;
};

const FEEDS = [
  "https://news.google.com/rss/search?q=CBSE+board+OR+CBSE+syllabus+OR+CBSE+circular&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=NTA+India+exam+notification&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=JEE+Main+OR+JEE+Advanced&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=NEET+UG+OR+NEET+exam&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=CUET+OR+exam+registration+last+date+OR+application+deadline+students+India&hl=en-IN&gl=IN&ceid=IN:en",
];

function decodeXml(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/** Classify by title keywords — strict so filters actually separate */
export function classifyTitle(title: string): EduNewsItem["category"] {
  const t = title.toLowerCase();

  if (
    /\bneet\b/.test(t) ||
    t.includes("national eligibility cum entrance") ||
    t.includes("medical entrance")
  ) {
    return "NEET";
  }
  if (
    /\bjee\b/.test(t) ||
    t.includes("joint entrance") ||
    t.includes("iit advanced") ||
    t.includes("jeemain")
  ) {
    return "JEE";
  }
  if (
    /\bcuet\b/.test(t) ||
    t.includes("last date") ||
    t.includes("last-date") ||
    t.includes("registration open") ||
    t.includes("application form") ||
    t.includes("apply online") ||
    t.includes("form fill") ||
    t.includes("deadline") ||
    t.includes("extend.*date") ||
    (t.includes("registration") && t.includes("exam"))
  ) {
    // if clearly JEE/NEET already returned; else form deadline
    if (/\bcuet\b|form|deadline|last date|registration|apply/i.test(t))
      return "Form";
  }
  if (
    /\bcbse\b/.test(t) ||
    t.includes("central board of secondary") ||
    t.includes("class 10") ||
    t.includes("class 12") ||
    t.includes("class x") ||
    t.includes("class xii") ||
    t.includes("board exam") ||
    t.includes("board result") ||
    t.includes("practical exam") ||
    t.includes("compartment")
  ) {
    if (t.includes("board") && !/\bjee\b|\bneet\b/.test(t)) return "Board";
    return "CBSE";
  }
  if (
    /\bnta\b/.test(t) ||
    t.includes("national testing agency") ||
    t.includes("admit card") ||
    t.includes("city intimation")
  ) {
    return "NTA";
  }
  if (t.includes("board") || t.includes("syllabus")) return "Board";
  return "Other";
}

function parseRss(xml: string): EduNewsItem[] {
  const items: EduNewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, 15)) {
    const title = decodeXml(
      (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""
    );
    let link = decodeXml(
      (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] || ""
    );
    if (!link) {
      link = decodeXml(
        (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] || ""
      );
    }
    // Google news sometimes uses <link href="..."/>
    if (!link.startsWith("http")) {
      const href = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) link = href[1];
    }
    const pub =
      decodeXml(
        (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || ""
      ) || new Date().toUTCString();
    const source =
      decodeXml(
        (b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || ""
      ) || "News";
    if (!title || title.length < 10) continue;

    const category = classifyTitle(title);
    const id = `n-${category}-${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40)}`;

    items.push({
      id,
      title,
      link: link.startsWith("http") ? link : `https://news.google.com/`,
      source,
      published: pub,
      category,
    });
  }
  return items;
}

const FALLBACK: EduNewsItem[] = [
  {
    id: "fb-cbse-1",
    title: "CBSE Academic — latest syllabus, sample papers & circulars",
    link: "https://cbseacademic.nic.in/",
    source: "CBSE Academic",
    published: new Date().toUTCString(),
    category: "CBSE",
    summary: "Official CBSE academic portal.",
  },
  {
    id: "fb-cbse-2",
    title: "CBSE main website — board exam notices & results",
    link: "https://www.cbse.gov.in/",
    source: "CBSE",
    published: new Date().toUTCString(),
    category: "Board",
  },
  {
    id: "fb-nta-1",
    title: "NTA official portal — all exam notifications",
    link: "https://nta.ac.in/",
    source: "NTA",
    published: new Date().toUTCString(),
    category: "NTA",
  },
  {
    id: "fb-jee-1",
    title: "JEE Main — registration, admit card & deadlines",
    link: "https://jeemain.nta.nic.in/",
    source: "JEE Main NTA",
    published: new Date().toUTCString(),
    category: "JEE",
  },
  {
    id: "fb-jee-2",
    title: "JEE Advanced — official IIT JEE Advanced site",
    link: "https://jeeadv.ac.in/",
    source: "JEE Advanced",
    published: new Date().toUTCString(),
    category: "JEE",
  },
  {
    id: "fb-neet-1",
    title: "NEET UG — application form, schedule & results",
    link: "https://neet.nta.nic.in/",
    source: "NEET NTA",
    published: new Date().toUTCString(),
    category: "NEET",
  },
  {
    id: "fb-form-1",
    title: "CUET UG — form fill & exam dates on NTA exams portal",
    link: "https://exams.nta.ac.in/",
    source: "CUET / NTA",
    published: new Date().toUTCString(),
    category: "Form",
  },
  {
    id: "fb-form-2",
    title: "Competitive exam calendars — always verify last dates on official sites",
    link: "https://nta.ac.in/",
    source: "NTA",
    published: new Date().toUTCString(),
    category: "Form",
  },
];

export async function GET() {
  const all: EduNewsItem[] = [];
  const seen = new Set<string>();

  await Promise.all(
    FEEDS.map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          cache: "no-store",
        });
        if (!res.ok) return;
        const xml = await res.text();
        for (const item of parseRss(xml)) {
          const k = item.title.toLowerCase().replace(/\s+/g, " ").slice(0, 90);
          if (seen.has(k)) continue;
          seen.add(k);
          all.push(item);
        }
      } catch {
        // skip feed
      }
    })
  );

  all.sort(
    (a, b) =>
      new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  // Always ensure every category has at least official links
  const byCat = new Map<string, number>();
  for (const i of all) byCat.set(i.category, (byCat.get(i.category) || 0) + 1);
  for (const fb of FALLBACK) {
    if ((byCat.get(fb.category) || 0) < 2) {
      all.push(fb);
      byCat.set(fb.category, (byCat.get(fb.category) || 0) + 1);
    }
  }

  const counts: Record<string, number> = { All: all.length };
  for (const i of all) {
    counts[i.category] = (counts[i.category] || 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    count: all.length,
    counts,
    items: all.slice(0, 60),
    note: "Filtered by exam type using headline keywords (CBSE / NTA / JEE / NEET / Form).",
  });
}
