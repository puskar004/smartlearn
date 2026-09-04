import { NextRequest, NextResponse } from "next/server";
import { allChapters } from "@/lib/curriculum";

const BLOCK =
  /\b(gameplay|minecraft|fortnite|song|music video|comedy|roast|prank|movie|trailer|shorts dance|asmr eat)\b/i;

const EDU_PREFIX =
  "CBSE NCERT class board exam explanation lecture tutorial";

function isEducational(title: string, query: string) {
  if (BLOCK.test(title)) return false;
  const q = query.toLowerCase();
  const eduHints =
    /ncert|cbse|class\s*(10|11|12)|physics|chemistry|math|biology|science|account|economics|history|geography|english|hindi|computer|derivation|theorem|chapter/i;
  return eduHints.test(title) || eduHints.test(q);
}

/** Curated fallback catalogue (no API key required) */
function curated(query: string) {
  const q = query.toLowerCase();
  const chapters = allChapters()
    .filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.subjectName.toLowerCase().includes(q) ||
        c.topics.some((t) => t.toLowerCase().includes(q)) ||
        q.includes(`class ${c.grade}`)
    )
    .slice(0, 8);

  const base = chapters.length
    ? chapters
    : allChapters()
        .filter((c) => c.grade === "12")
        .slice(0, 6);

  // Well-known educational channel search embeds via YouTube search URL pattern
  // We return search cards that open youtube-nocookie embed search terms
  return base.map((c, i) => {
    const term = `${EDU_PREFIX} ${c.grade} ${c.subjectName} ${c.title}`;
    return {
      id: `curated-${c.id}-${i}`,
      title: `${c.subjectName} · ${c.title} (Class ${c.grade}) — NCERT lecture`,
      channel: "Educational filter · CBSE/NCERT only",
      thumbnail: `https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg`.replace(
        "dQw4w9WgXcQ",
        // placeholder thumbs avoided — use static education icon via ui
        "ScMzIvxBSi4"
      ),
      searchTerm: term,
      watchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(term + " education")}`,
      embedSearch: term,
      grade: c.grade,
      subject: c.subjectName,
      educational: true,
    };
  });
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  if (BLOCK.test(q)) {
    return NextResponse.json({
      results: [],
      blocked: true,
      message:
        "Only educational CBSE/NCERT topics are allowed in SmartLearn Safe Search.",
    });
  }

  const key = process.env.YOUTUBE_API_KEY;
  const eduQuery = `${EDU_PREFIX} ${q}`;

  if (key) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("videoEmbeddable", "true");
      url.searchParams.set("relevanceLanguage", "en");
      url.searchParams.set("q", eduQuery);
      url.searchParams.set("key", key);

      const res = await fetch(url.toString());
      const data = await res.json();
      const items = (data.items || [])
        .map(
          (it: {
            id: { videoId: string };
            snippet: {
              title: string;
              channelTitle: string;
              thumbnails: { medium?: { url: string } };
            };
          }) => ({
            id: it.id.videoId,
            title: it.snippet.title,
            channel: it.snippet.channelTitle,
            thumbnail: it.snippet.thumbnails?.medium?.url,
            watchUrl: `https://www.youtube-nocookie.com/embed/${it.id.videoId}?rel=0`,
            educational: isEducational(it.snippet.title, q),
          })
        )
        .filter((v: { educational: boolean }) => v.educational);

      return NextResponse.json({
        results: items,
        source: "youtube-api",
        query: eduQuery,
      });
    } catch {
      // fall through to curated
    }
  }

  return NextResponse.json({
    results: curated(q),
    source: "curated-edu",
    query: eduQuery,
    note: "Add YOUTUBE_API_KEY for live educational video IDs. Showing curriculum-matched safe search cards.",
  });
}
