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

type FeedCat = EduNewsItem["category"];

const FEEDS: { url: string; prefer: FeedCat }[] = [
  {
    url: "https://news.google.com/rss/search?q=CBSE+board+exam+OR+CBSE+circular+OR+CBSE+result&hl=en-IN&gl=IN&ceid=IN:en",
    prefer: "CBSE",
  },
  {
    url: "https://news.google.com/rss/search?q=%22National+Testing+Agency%22+OR+NTA+admit+card+OR+NTA+notification+-JEE+-NEET&hl=en-IN&gl=IN&ceid=IN:en",
    prefer: "NTA",
  },
  {
    url: "https://news.google.com/rss/search?q=%22JEE+Main%22+OR+%22JEE+Advanced%22+OR+jeemain&hl=en-IN&gl=IN&ceid=IN:en",
    prefer: "JEE",
  },
  {
    url: "https://news.google.com/rss/search?q=%22NEET+UG%22+OR+NEET+exam+OR+neet.nta&hl=en-IN&gl=IN&ceid=IN:en",
    prefer: "NEET",
  },
  {
    url: "https://news.google.com/rss/search?q=CUET+registration+OR+exam+application+last+date+OR+form+fill+students+India&hl=en-IN&gl=IN&ceid=IN:en",
    prefer: "Form",
  },
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

/** Strong keyword classify; feed prefer is fallback only when weak match */
export function classifyTitle(
  title: string,
  feedPrefer?: FeedCat
): EduNewsItem["category"] {
  const t = title.toLowerCase();

  // Order: most specific first
  if (
    /\bneet\b/.test(t) ||
    t.includes("national eligibility cum entrance") ||
    t.includes("medical entrance") ||
    t.includes("neet ug")
  ) {
    return "NEET";
  }
  if (
    /\bjee\b/.test(t) ||
    t.includes("joint entrance examination") ||
    t.includes("jeemain") ||
    t.includes("jee main") ||
    t.includes("jee advanced") ||
    t.includes("iit advanced")
  ) {
    return "JEE";
  }
  if (
    /\bcuet\b/.test(t) ||
    ((t.includes("last date") ||
      t.includes("registration") ||
      t.includes("application form") ||
      t.includes("apply online") ||
      t.includes("form fill") ||
      t.includes("deadline")) &&
      !/\bcbse\b/.test(t))
  ) {
    return "Form";
  }
  if (
    /\bcbse\b/.test(t) ||
    t.includes("central board of secondary") ||
    (t.includes("class 10") && t.includes("board")) ||
    (t.includes("class 12") && t.includes("board")) ||
    t.includes("cbse result") ||
    t.includes("cbse circular")
  ) {
    return "CBSE";
  }
  if (
    (t.includes("board exam") ||
      t.includes("board result") ||
      t.includes("board syllabus") ||
      t.includes("practical exam") ||
      t.includes("compartment")) &&
    !/\bjee\b|\bneet\b|\bnta\b/.test(t)
  ) {
    return "Board";
  }
  if (
    /\bnta\b/.test(t) ||
    t.includes("national testing agency") ||
    t.includes("city intimation")
  ) {
    // NTA often hosts JEE/NEET — only pure NTA if not already caught
    if (/\bjee\b/.test(t)) return "JEE";
    if (/\bneet\b/.test(t)) return "NEET";
    return "NTA";
  }

  // Weak titles: stick to feed preference so filters don't mix
  if (feedPrefer && feedPrefer !== "Other") return feedPrefer;
  return "Other";
}

function parseRss(xml: string, feedPrefer: FeedCat): EduNewsItem[] {
  const items: EduNewsItem[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  for (const b of blocks.slice(0, 12)) {
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

    const category = classifyTitle(title, feedPrefer);
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
  },
  {
    id: "fb-board-1",
    title: "CBSE board notices & results — official site",
    link: "https://www.cbse.gov.in/",
    source: "CBSE",
    published: new Date().toUTCString(),
    category: "Board",
  },
  {
    id: "fb-nta-1",
    title: "NTA official portal — exam notifications",
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
    title: "JEE Advanced — official IIT site",
    link: "https://jeeadv.ac.in/",
    source: "JEE Advanced",
    published: new Date().toUTCString(),
    category: "JEE",
  },
  {
    id: "fb-neet-1",
    title: "NEET UG — application, schedule & results",
    link: "https://neet.nta.nic.in/",
    source: "NEET NTA",
    published: new Date().toUTCString(),
    category: "NEET",
  },
  {
    id: "fb-form-1",
    title: "CUET UG — form fill & exam dates",
    link: "https://exams.nta.ac.in/",
    source: "CUET / NTA",
    published: new Date().toUTCString(),
    category: "Form",
  },
];

export async function GET() {
  const all: EduNewsItem[] = [];
  const seen = new Set<string>();

  await Promise.all(
    FEEDS.map(async ({ url, prefer }) => {
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
        for (const item of parseRss(xml, prefer)) {
          const k = item.title.toLowerCase().replace(/\s+/g, " ").slice(0, 90);
          if (seen.has(k)) continue;
          seen.add(k);
          all.push(item);
        }
      } catch {
        // skip
      }
    })
  );

  all.sort(
    (a, b) =>
      new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  const byCat = new Map<string, number>();
  for (const i of all) byCat.set(i.category, (byCat.get(i.category) || 0) + 1);
  for (const fb of FALLBACK) {
    if ((byCat.get(fb.category) || 0) < 1) {
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
    items: all.slice(0, 80),
    note: "Strict category filter: keyword match + feed preference.",
  });
}
