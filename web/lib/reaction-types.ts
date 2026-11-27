export const emotions = ["Alegria", "Tristeza", "Surpresa", "Medo", "Raiva", "Tédio"] as const;
export type Emotion = (typeof emotions)[number];
export type Character = { id: string; name: string };
export type Cast = { characters: Character[]; warning?: string };
export type Reaction = {
  revision: number;
  rating: number | null;
  emotion: Emotion | null;
  character: Character | null;
};
