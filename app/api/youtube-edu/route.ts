import { NextRequest, NextResponse } from "next/server";
import { allChapters } from "@/lib/curriculum";

const BLOCK =
  /\b(gameplay|minecraft|fortnite|gta|song|lyrics|music video|comedy|roast|prank|movie|trailer|dance|asmr|mukbang|vlog|shorts funny|meme)\b/i;

const EDU =
  /\b(ncert|cbse|class\s*(10|11|12)|physics|chemistry|math|biology|science|account|economics|history|geography|english|hindi|computer|organic|calculus|derivation|theorem|chapter|lecture|explanation|tutorial|board\s*exam|pyq)\b/i;

function eduEmbed(query: string) {
  const q = `${query} CBSE NCERT board exam lecture explanation`.trim();
  // In-app YouTube search embed (stays on SmartLearn page)
  return `https://www.youtube-nocookie.com/embed?rel=0&modestbranding=1&listType=search&list=${encodeURIComponent(q)}`;
}

function thumbFor(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** High-quality public educational videos (fallbacks when API key missing) */
const CATALOG: { id: string; title: string; channel: string; tags: string }[] = [
  { id: "w4pXtm5JPhQ", title: "Ohm's Law explained (Physics basics)", channel: "Education", tags: "class 10 electricity ohm" },
  { id: "1xSQlwWGT8M", title: "Light reflection & refraction intro", channel: "Education", tags: "class 10 light mirror" },
  { id: "bVqgWpxvA_4", title: "Photosynthesis simplified", channel: "Education", tags: "class 10 life processes" },
  { id: "8m6hHMuKOVY", title: "Quadratic equations basics", channel: "Education", tags: "class 10 maths quadratic" },
  { id: "fAtUN3nO9dU", title: "Current electricity Kirchhoff ideas", channel: "Education", tags: "class 12 physics current" },
  { id: "bHIhgxav9LY", title: "Ray optics overview", channel: "Education", tags: "class 12 physics ray optics" },
  { id: "8V0F1D_5iYs", title: "Electrochemistry introduction", channel: "Education", tags: "class 12 chemistry electrochemistry" },
  { id: "jGwO_UgTS7I", title: "Matrices introduction", channel: "Education", tags: "class 12 maths matrices" },
  { id: "8m6hHMuKOVY", title: "Algebra foundations", channel: "Education", tags: "class 11 maths" },
  { id: "bVqgWpxvA_4", title: "Plant physiology basics", channel: "Education", tags: "class 11 biology" },
];

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  if (BLOCK.test(q) || (!EDU.test(q) && q.split(/\s+/).length < 2)) {
    // force education: still allow if looks like a subject topic via curriculum match
    const hit = allChapters().some(
      (c) =>
        c.title.toLowerCase().includes(q.toLowerCase()) ||
        c.subjectName.toLowerCase().includes(q.toLowerCase()) ||
        c.topics.some((t) => t.toLowerCase().includes(q.toLowerCase()))
    );
    if (!hit && BLOCK.test(q)) {
      return NextResponse.json({
        results: [],
        blocked: true,
        message:
          "Only educational CBSE/NCERT study topics are allowed in SmartLearn Safe Search.",
      });
    }
  }

  const key = process.env.YOUTUBE_API_KEY;
  const eduQuery = `${q} CBSE NCERT class board exam lecture`;

  type Card = {
    id: string;
    title: string;
    channel: string;
    thumbnail?: string;
    watchUrl: string;
    educational: boolean;
  };

  const results: Card[] = [];

  // Always offer primary in-app search player first
  results.push({
    id: "search-player",
    title: `Study playlist: ${q}`,
    channel: "SmartLearn Safe Player · stays inside site",
    watchUrl: eduEmbed(q),
    educational: true,
    thumbnail: undefined,
  });

  if (key) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "10");
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("videoEmbeddable", "true");
      url.searchParams.set("relevanceLanguage", "en");
      url.searchParams.set("q", eduQuery);
      url.searchParams.set("key", key);

      const res = await fetch(url.toString());
      const data = await res.json();
      for (const it of data.items || []) {
        const title = it.snippet?.title || "";
        if (BLOCK.test(title)) continue;
        if (!EDU.test(title) && !EDU.test(q)) continue;
        const id = it.id?.videoId;
        if (!id) continue;
        results.push({
          id,
          title,
          channel: it.snippet?.channelTitle || "Education",
          thumbnail: it.snippet?.thumbnails?.medium?.url,
          watchUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`,
          educational: true,
        });
      }
    } catch {
      // fall through
    }
  }

  // Curated educational matches
  const ql = q.toLowerCase();
  for (const c of CATALOG) {
    if (
      c.tags.split(" ").some((t) => ql.includes(t)) ||
      ql.split(/\s+/).some((w) => w.length > 3 && c.tags.includes(w))
    ) {
      results.push({
        id: c.id,
        title: c.title,
        channel: c.channel,
        thumbnail: thumbFor(c.id),
        watchUrl: `https://www.youtube-nocookie.com/embed/${c.id}?rel=0&modestbranding=1`,
        educational: true,
      });
    }
  }

  // Curriculum-based extra search embeds
  const chapters = allChapters()
    .filter(
      (c) =>
        c.title.toLowerCase().includes(ql) ||
        c.subjectName.toLowerCase().includes(ql) ||
        c.topics.some((t) => t.toLowerCase().includes(ql))
    )
    .slice(0, 6);

  for (const c of chapters) {
    const term = `Class ${c.grade} ${c.subjectName} ${c.title} NCERT`;
    results.push({
      id: `ch-${c.id}`,
      title: `${c.subjectName}: ${c.title} (Class ${c.grade})`,
      channel: "NCERT-aligned search · in-app only",
      watchUrl: eduEmbed(term),
      educational: true,
    });
  }

  // de-dupe by id
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({
    results: unique.slice(0, 16),
    source: key ? "youtube-api+embed" : "in-app-embed+catalog",
    query: eduQuery,
    note: "All videos play inside SmartLearn. Non-study queries are filtered.",
  });
}
