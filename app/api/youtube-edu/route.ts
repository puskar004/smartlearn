import { NextRequest, NextResponse } from "next/server";
import { matchEduClips, ytEmbed } from "@/lib/media-catalog";
import { allChapters } from "@/lib/curriculum";

const BLOCK =
  /\b(gameplay|minecraft|fortnite|gta|song|lyrics|music video|comedy|roast|prank|movie|trailer|dance|asmr|mukbang|vlog|meme)\b/i;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const relatedTo = (req.nextUrl.searchParams.get("related") || "").trim();

  if (!q && !relatedTo) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  if (q && BLOCK.test(q)) {
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
  const searchQ = relatedTo
    ? `${q || "CBSE NCERT"} related lecture explanation`
    : `${q} CBSE NCERT class board exam lecture explanation`;

  if (key) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("safeSearch", "strict");
      url.searchParams.set("videoEmbeddable", "true");
      url.searchParams.set("relevanceLanguage", "en");
      url.searchParams.set("q", searchQ);
      if (relatedTo) url.searchParams.set("relatedToVideoId", relatedTo);
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
      // catalog fallback
    }
  }

  // Curated real embeds always available
  const pool = matchEduClips(q || "study ncert physics maths");
  for (const c of pool) {
    if (relatedTo && c.id === relatedTo) continue;
    results.push({
      id: c.id,
      title: c.title,
      channel: c.channel,
      thumbnail: `https://i.ytimg.com/vi/${c.id}/hqdefault.jpg`,
      watchUrl: ytEmbed(c.id),
      educational: true,
    });
  }

  // Chapter-matched related suggestions (unique real video IDs)
  const ql = (q || "").toLowerCase();
  const chapters = allChapters()
    .filter(
      (c) =>
        !ql ||
        c.title.toLowerCase().includes(ql) ||
        c.subjectName.toLowerCase().includes(ql) ||
        c.topics.some((t) => t.toLowerCase().includes(ql))
    )
    .slice(0, 6);

  chapters.forEach((ch, i) => {
    const clip = pool[i % pool.length];
    if (!clip) return;
    results.push({
      id: clip.id,
      title: `${ch.subjectName}: ${ch.title} (Class ${ch.grade})`,
      channel: "SmartLearn related",
      thumbnail: `https://i.ytimg.com/vi/${clip.id}/hqdefault.jpg`,
      watchUrl: ytEmbed(clip.id),
      educational: true,
    });
  });

  // Deduplicate by real video id, keep first title
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (!r.id || r.id.length < 6) return false;
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({
    results: unique.slice(0, 14),
    source: key ? "youtube-api+catalog" : "catalog-embed",
    query: searchQ,
    note: key
      ? "Live YouTube educational results + related lectures."
      : "Curated educational embeds. Add YOUTUBE_API_KEY on Vercel for full search + related.",
  });
}
