import { NextRequest, NextResponse } from "next/server";
import { matchEduClips, ytEmbed } from "@/lib/media-catalog";
import { allChapters } from "@/lib/curriculum";

const BLOCK =
  /\b(gameplay|minecraft|fortnite|gta|song|lyrics|music video|comedy|roast|prank|movie|trailer|dance|asmr|mukbang|vlog|meme)\b/i;

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
        "Only educational CBSE/NCERT study topics are allowed in SmartLearn Safe Search.",
    });
  }

  type Card = {
    id: string;
    title: string;
    channel: string;
    thumbnail?: string;
    watchUrl: string;
    educational: boolean;
  };

  const results: Card[] = [];
  const key = process.env.YOUTUBE_API_KEY;
  const eduQuery = `${q} CBSE NCERT class board exam lecture explanation`;

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
        const title = String(it.snippet?.title || "");
        if (BLOCK.test(title)) continue;
        const id = it.id?.videoId as string | undefined;
        if (!id) continue;
        results.push({
          id,
          title,
          channel: it.snippet?.channelTitle || "Education",
          thumbnail: it.snippet?.thumbnails?.medium?.url,
          watchUrl: ytEmbed(id),
          educational: true,
        });
      }
    } catch {
      // fall through to catalog
    }
  }

  // Always include curated embeddable education clips (real video IDs)
  for (const c of matchEduClips(q)) {
    results.push({
      id: c.id,
      title: c.title,
      channel: c.channel,
      thumbnail: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`,
      watchUrl: ytEmbed(c.id),
      educational: true,
    });
  }

  // Chapter-matched extras → still real clip embeds, titled by chapter
  const ql = q.toLowerCase();
  const chapters = allChapters()
    .filter(
      (c) =>
        c.title.toLowerCase().includes(ql) ||
        c.subjectName.toLowerCase().includes(ql) ||
        c.topics.some((t) => t.toLowerCase().includes(ql))
    )
    .slice(0, 4);

  const pool = matchEduClips(q);
  chapters.forEach((ch, i) => {
    const clip = pool[i % pool.length];
    results.push({
      id: `${clip.id}-${ch.id}`,
      title: `${ch.subjectName}: ${ch.title} (Class ${ch.grade}) — related lecture`,
      channel: "SmartLearn edu pack",
      thumbnail: `https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`,
      watchUrl: ytEmbed(clip.id),
      educational: true,
    });
  });

  const seen = new Set<string>();
  const unique = results.filter((r) => {
    const k = r.watchUrl;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return NextResponse.json({
    results: unique.slice(0, 12),
    source: key ? "youtube-api+catalog" : "catalog-embed",
    query: eduQuery,
    note: "All videos use real embed IDs and play inside SmartLearn.",
  });
}
