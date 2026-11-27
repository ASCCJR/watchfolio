import type { Episode } from "./catalog";

export function nextEpisode(episodes: Episode[], watched: number[]): Episode | undefined {
  const seen = new Set(watched);
  let next: Episode | undefined;
  for (const episode of episodes) {
    if (episode.special || !episode.available || episode.season < 1 || episode.number < 1 || seen.has(episode.id)) continue;
    if (!next || episode.season < next.season ||
      (episode.season === next.season && episode.number < next.number)) next = episode;
  }
  return next;
}
