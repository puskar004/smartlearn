import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type EduNewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  published: string;
  category: "CBSE" | "NTA" | "JEE" | "NEET" | "Board" | "Form" | "Other";
  summary?: string;
};

const FEEDS: { url: string; category: EduNewsItem["category"] }[] = [
  {
    url: "https://news.google.com/rss/search?q=CBSE+syllabus+OR+CBSE+board+exam+OR+CBSE+circular&hl=en-IN&gl=IN&ceid=IN:en",
    category: "CBSE",
  },
  {
    url: "https://news.google.com/rss/search?q=NTA+exam+OR+NTA+notification+OR+NTA+admit+card&hl=en-IN&gl=IN&ceid=IN:en",
    category: "NTA",
  },
  {
    url: "https://news.google.com/rss/search?q=JEE+Main+OR+JEE+Advanced+registration+OR+JEE+deadline&hl=en-IN&gl=IN&ceid=IN:en",
    category: "JEE",
  },
  {
    url: "https://news.google.com/rss/search?q=NEET+UG+OR+NEET+registration+OR+NEET+deadline&hl=en-IN&gl=IN&ceid=IN:en",
    category: "NEET",
  },
  {
    url: "https://news.google.com/rss/search?q=CUET+OR+competitive+exam+form+last+date+India+students&hl=en-IN&gl=IN&ceid=IN:en",
    category: "Form",
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
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseRss(
  xml: string,
  category: EduNewsItem["category"]
): EduNewsItem[] {
  const items: EduNewsItem[] = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const b of blocks.slice(0, 12)) {
    const title = decodeXml(
      (b.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""
    );
    const link = decodeXml(
      (b.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1] ||
        (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1] ||
        ""
    );
    const pub =
      decodeXml(
        (b.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1] || ""
      ) || new Date().toUTCString();
    const source =
      decodeXml(
        (b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1] || ""
      ) || category;
    if (!title || title.length < 8) continue;
    items.push({
      id: `${category}-${Buffer.from(title).toString("base64").slice(0, 24)}`,
      title,
      link: link.startsWith("http") ? link : `https://news.google.com${link}`,
      source,
      published: pub,
      category,
    });
  }
  return items;
}

const FALLBACK: EduNewsItem[] = [
  {
    id: "fb1",
    title: "Check CBSE academic website for latest circulars & syllabus updates",
    link: "https://cbseacademic.nic.in/",
    source: "CBSE Academic",
    published: new Date().toUTCString(),
    category: "CBSE",
    summary: "Official CBSE academic portal for syllabus, SQPs, and circulars.",
  },
  {
    id: "fb2",
    title: "NTA official site — JEE Main, NEET, CUET notifications",
    link: "https://nta.ac.in/",
    source: "NTA",
    published: new Date().toUTCString(),
    category: "NTA",
    summary: "National Testing Agency portal for competitive exam schedules.",
  },
  {
    id: "fb3",
    title: "JEE Main — visit jeemain.nta.nic.in for registration & deadlines",
    link: "https://jeemain.nta.nic.in/",
    source: "JEE Main",
    published: new Date().toUTCString(),
    category: "JEE",
  },
  {
    id: "fb4",
    title: "NEET UG — neet.nta.nic.in for application windows",
    link: "https://neet.nta.nic.in/",
    source: "NEET",
    published: new Date().toUTCString(),
    category: "NEET",
  },
  {
    id: "fb5",
    title: "CUET UG — exams.nta.ac.in for form fill deadlines",
    link: "https://exams.nta.ac.in/",
    source: "CUET",
    published: new Date().toUTCString(),
    category: "Form",
  },
  {
    id: "fb6",
    title: "CBSE results & board exam notices — cbse.gov.in",
    link: "https://www.cbse.gov.in/",
    source: "CBSE",
    published: new Date().toUTCString(),
    category: "Board",
  },
];

export async function GET() {
  const all: EduNewsItem[] = [];
  const seen = new Set<string>();

  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; SmartLearn/1.0; +https://smartlearn-xi.vercel.app)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          next: { revalidate: 1800 },
        });
        if (!res.ok) return;
        const xml = await res.text();
        for (const item of parseRss(xml, f.category)) {
          const k = item.title.toLowerCase().slice(0, 80);
          if (seen.has(k)) continue;
          seen.add(k);
          all.push(item);
        }
      } catch {
        // feed fail
      }
    })
  );

  // sort newest first
  all.sort(
    (a, b) =>
      new Date(b.published).getTime() - new Date(a.published).getTime()
  );

  const items = all.length >= 6 ? all.slice(0, 40) : [...all, ...FALLBACK];

  return NextResponse.json({
    ok: true,
    updatedAt: new Date().toISOString(),
    count: items.length,
    items,
    note:
      all.length >= 6
        ? "Live headlines from Google News RSS (CBSE · NTA · JEE · NEET · forms)."
        : "Showing official portals + any live headlines we could reach.",
  });
}
