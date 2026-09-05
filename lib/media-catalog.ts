/** Embeddable YouTube video IDs used inside SmartLearn. */

export type MediaClip = {
  id: string;
  title: string;
  channel: string;
};

export function ytEmbed(id: string) {
  // playsinline + enablejsapi helps mobile; origin not required for basic play
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

export const MOOD_PLAYLISTS: Record<
  string,
  { label: string; blurb: string; clips: MediaClip[] }
> = {
  focus: {
    label: "Deep Focus",
    blurb: "Lofi / concentration beats",
    clips: [
      { id: "jfKfPfyJRdk", title: "Lofi hip hop radio — beats to study", channel: "Lofi Girl" },
      { id: "5qap5aO4i9A", title: "Lofi hip hop radio — relax/study", channel: "Lofi Girl" },
      { id: "DWcJFNfaw9c", title: "Coffee shop lofi study beats", channel: "Study" },
    ],
  },
  calm: {
    label: "Calm Revise",
    blurb: "Soft ambient for theory",
    clips: [
      { id: "lFcSrYw8Gjc", title: "Beautiful piano for studying", channel: "Calm" },
      { id: "1ZYbU82GVz4", title: "Relaxing music for deep work", channel: "Ambient" },
      { id: "n61ULEU7CO0", title: "Peaceful study music", channel: "Study" },
    ],
  },
  rain: {
    label: "Rainy Desk",
    blurb: "Rain ambience",
    clips: [
      { id: "mPZkdNFkNps", title: "Rain sounds for sleep/study", channel: "Nature" },
      { id: "q76bMs-NwRk", title: "Heavy rain sounds", channel: "Rain" },
      { id: "jfKfPfyJRdk", title: "Lofi + chill (backup)", channel: "Lofi Girl" },
    ],
  },
  energy: {
    label: "Energy Boost",
    blurb: "Upbeat instrumental",
    clips: [
      { id: "4xDzrJKXOOY", title: "Synthwave radio", channel: "Energy" },
      { id: "DWcJFNfaw9c", title: "Upbeat study beats", channel: "Focus" },
      { id: "5qap5aO4i9A", title: "Lofi energy mix", channel: "Lofi Girl" },
    ],
  },
  soft: {
    label: "Soft Heart",
    blurb: "Gentle acoustic focus",
    clips: [
      { id: "lFcSrYw8Gjc", title: "Soft piano study", channel: "Soft" },
      { id: "n61ULEU7CO0", title: "Gentle keys", channel: "Calm" },
      { id: "1ZYbU82GVz4", title: "Soft ambient", channel: "Ambient" },
    ],
  },
};

export const EDU_CLIPS: (MediaClip & { tags: string })[] = [
  {
    id: "w4pXtm5JPhQ",
    title: "Introduction to electricity (basics)",
    channel: "Education",
    tags: "class 10 electricity ohm physics current",
  },
  {
    id: "bVqgWpxvA_4",
    title: "Photosynthesis explained",
    channel: "Education",
    tags: "class 10 life processes biology photosynthesis",
  },
  {
    id: "fAtUN3nO9dU",
    title: "Current electricity concepts",
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
    id: "8m6hHMuKOVY",
    title: "Quadratic equations",
    channel: "Education",
    tags: "class 10 maths quadratic equations",
  },
  {
    id: "1xSQlwWGT8M",
    title: "Light reflection basics",
    channel: "Education",
    tags: "class 10 light reflection refraction",
  },
  {
    id: "8V0F1D_5iYs",
    title: "Electrochemistry basics",
    channel: "Education",
    tags: "class 12 chemistry electrochemistry nernst",
  },
  // Reliable always-play backups (lofi still educational focus context)
  {
    id: "jfKfPfyJRdk",
    title: "Focus music while you revise NCERT",
    channel: "Study focus",
    tags: "study focus revision background",
  },
  {
    id: "5qap5aO4i9A",
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

  // Always return playable clips
  if (scored.length >= 3) return scored;
  return [...scored, ...EDU_CLIPS.filter((c) => !scored.includes(c))].slice(0, 6);
}
