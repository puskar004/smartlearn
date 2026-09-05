/** Study playlists — official Spotify embed IDs (play in-app, no new tab). */

export type SpotifyMood = {
  id: string;
  label: string;
  blurb: string;
  /** Spotify playlist / album / track URI id */
  spotifyType: "playlist" | "album" | "track" | "episode";
  spotifyId: string;
};

export const SPOTIFY_MOODS: SpotifyMood[] = [
  {
    id: "focus",
    label: "Deep Focus",
    blurb: "Instrumental concentration",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DWZeKCadgRdKQ",
  },
  {
    id: "lofi",
    label: "Lofi Study",
    blurb: "Beats to revise to",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DWWQRwui0ExPn",
  },
  {
    id: "piano",
    label: "Peaceful Piano",
    blurb: "Soft keys for theory",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DX4sWSpwq3LiO",
  },
  {
    id: "intense",
    label: "Intense Study",
    blurb: "Long session fuel",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DX8NTLI2TtA7w",
  },
  {
    id: "brain",
    label: "Brain Food",
    blurb: "Electronic focus",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DWXLeA8OmhnBP",
  },
  {
    id: "jazz",
    label: "Jazz Vibes",
    blurb: "Calm jazz desk",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DXbITWG1lLOT8",
  },
  {
    id: "nature",
    label: "Nature Sounds",
    blurb: "Rain & ambient",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DX4PP3DA4J0N8",
  },
  {
    id: "soft",
    label: "Soft Pop Study",
    blurb: "Gentle background",
    spotifyType: "playlist",
    spotifyId: "37i9dQZF1DX9sIqqvkbymr",
  },
];

/** In-app Spotify embed — login happens inside iframe, no tab switch. */
export function spotifyEmbed(
  type: SpotifyMood["spotifyType"],
  id: string,
  opts?: { compact?: boolean }
) {
  const theme = "0";
  const h = opts?.compact ? "152" : "352";
  return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=${theme}`;
}

export function getMood(id: string) {
  return SPOTIFY_MOODS.find((m) => m.id === id) || SPOTIFY_MOODS[0];
}
