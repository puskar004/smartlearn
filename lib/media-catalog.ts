/** Embeddable YouTube video IDs used inside SmartLearn. */

export type MediaClip = {
  id: string;
  title: string;
  channel: string;
};

/** Reliable in-app embed URL (nocookie + related + jsapi). */
export function ytEmbed(id: string, opts?: { autoplay?: boolean }) {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
  const params = new URLSearchParams({
    rel: "1",
    modestbranding: "1",
    playsinline: "1",
    enablejsapi: "1",
    // related from same channel when possible still shows related rails in player
    iv_load_policy: "3",
  });
  if (opts?.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${clean}?${params.toString()}`;
}

export const MOOD_PLAYLISTS: Record<
  string,
  { label: string; blurb: string; clips: MediaClip[] }
> = {
  focus: {
    label: "Deep Focus",
    blurb: "Lofi / concentration beats",
    clips: [
      {
        id: "jfKfPfyJRdk",
        title: "Lofi hip hop radio — beats to study",
        channel: "Lofi Girl",
      },
      {
        id: "lTRiuFIWV54",
        title: "1 hour lofi study beats",
        channel: "Study",
      },
      {
        id: "7NOSDKbWMlQ",
        title: "Calm piano for focus",
        channel: "Focus",
      },
    ],
  },
  calm: {
    label: "Calm Revise",
    blurb: "Soft ambient for theory",
    clips: [
      {
        id: "7NOSDKbWMlQ",
        title: "Beautiful piano for studying",
        channel: "Calm",
      },
      {
        id: "1ZYbU82GVz4",
        title: "Relaxing music for deep work",
        channel: "Ambient",
      },
      {
        id: "jfKfPfyJRdk",
        title: "Soft lofi revise",
        channel: "Lofi Girl",
      },
    ],
  },
  rain: {
    label: "Rainy Desk",
    blurb: "Rain ambience",
    clips: [
      {
        id: "mPZkdNFkNps",
        title: "Rain sounds for sleep/study",
        channel: "Nature",
      },
      {
        id: "q76bMs-NwRk",
        title: "Heavy rain sounds",
        channel: "Rain",
      },
      {
        id: "jfKfPfyJRdk",
        title: "Lofi + chill (backup)",
        channel: "Lofi Girl",
      },
    ],
  },
  energy: {
    label: "Energy Boost",
    blurb: "Upbeat instrumental",
    clips: [
      {
        id: "4xDzrJKXOOY",
        title: "Synthwave radio",
        channel: "Energy",
      },
      {
        id: "lTRiuFIWV54",
        title: "Upbeat study beats",
        channel: "Focus",
      },
      {
        id: "jfKfPfyJRdk",
        title: "Lofi energy mix",
        channel: "Lofi Girl",
      },
    ],
  },
  soft: {
    label: "Soft Heart",
    blurb: "Gentle acoustic focus",
    clips: [
      {
        id: "7NOSDKbWMlQ",
        title: "Soft piano study",
        channel: "Soft",
      },
      {
        id: "1ZYbU82GVz4",
        title: "Soft ambient",
        channel: "Ambient",
      },
      {
        id: "lTRiuFIWV54",
        title: "Gentle keys",
        channel: "Calm",
      },
    ],
  },
};

/** Curated CBSE/NCERT-friendly lecture embeds (real video IDs). */
export const EDU_CLIPS: (MediaClip & { tags: string })[] = [
  {
    id: "w4pXtm5JPhQ",
    title: "Electricity basics — current & resistance",
    channel: "Education",
    tags: "class 10 electricity ohm physics current resistance",
  },
  {
    id: "1xSQlwWGT8M",
    title: "Light — reflection and refraction",
    channel: "Education",
    tags: "class 10 light reflection refraction optics",
  },
  {
    id: "8m6hHMuKOVY",
    title: "Quadratic equations explained",
    channel: "Education",
    tags: "class 10 maths quadratic equations algebra",
  },
  {
    id: "bVqgWpxvA_4",
    title: "Photosynthesis / life processes",
    channel: "Education",
    tags: "class 10 life processes biology photosynthesis nutrition",
  },
  {
    id: "fAtUN3nO9dU",
    title: "Current electricity (Class 12)",
    channel: "Education",
    tags: "class 12 physics current kirchhoff electricity",
  },
  {
    id: "bHIhgxav9LY",
    title: "Ray optics overview",
    channel: "Education",
    tags: "class 12 physics ray optics mirror lens",
  },
  {
    id: "jGwO_UgTS7I",
    title: "Matrices introduction",
    channel: "Education",
    tags: "class 12 maths matrices determinants",
  },
  {
    id: "8V0F1D_5iYs",
    title: "Electrochemistry basics",
    channel: "Education",
    tags: "class 12 chemistry electrochemistry nernst",
  },
  {
    id: "Ok8rMT2KcyA",
    title: "Human eye and colourful world",
    channel: "Education",
    tags: "class 10 human eye light physics",
  },
  {
    id: "ilw-qmqZ3Q4",
    title: "Carbon and its compounds",
    channel: "Education",
    tags: "class 10 chemistry carbon compounds organic",
  },
  {
    id: "jfKfPfyJRdk",
    title: "Focus music while you revise NCERT",
    channel: "Study focus",
    tags: "study focus revision background",
  },
  {
    id: "lTRiuFIWV54",
    title: "Quiet study session audio",
    channel: "Study focus",
    tags: "study quiet concentration",
  },
];

export function matchEduClips(query: string): (MediaClip & { tags: string })[] {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const scored = EDU_CLIPS.map((c) => {
    let s = 0;
    for (const w of words) {
      if (c.tags.includes(w) || c.title.toLowerCase().includes(w)) s += 1;
    }
    return { c, s };
  })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c);

  if (scored.length >= 4) return scored;
  return [...scored, ...EDU_CLIPS.filter((c) => !scored.includes(c))].slice(
    0,
    8
  );
}
