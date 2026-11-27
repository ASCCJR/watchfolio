export const historyPageSize = 20;

export const medalRules = [
  { key: "first", name: "Primeira sessão", criterion: "Registre uma sessão de filme ou episódio.", target: 1 },
  { key: "episodes", name: "Maratona de episódios", criterion: "Assista a dez episódios diferentes.", target: 10 },
  { key: "characters", name: "Olhar de fã", criterion: "Escolha o personagem favorito em três filmes ou episódios diferentes.", target: 3 },
] as const;

export type Activity = {
  totals: { sessions: number; titles: number; movies: number; episodes: number; rewatches: number;
    seconds: number; missingRuntime: number; ratings: number; meanRating: number | null };
  years: number[];
  missingTitles: { key: string; name: string }[];
  titles: { key: string; name: string; count: number }[];
  genres: { name: string; count: number }[];
  characters: { key: string; name: string; count: number }[];
  emotions: { name: string; count: number }[];
  historyCount: number;
  history: { titleKey: string; titleName: string; id: string; episodeId: number | null; episodeLabel: string | null;
    date: string; seconds: number | null; rewatch: boolean }[];
  medals: Record<(typeof medalRules)[number]["key"], number>;
};
