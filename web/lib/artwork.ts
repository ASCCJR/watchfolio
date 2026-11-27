export const palettes = {
  dusk: { name: "Luz de cinema", start: "#24392f", end: "#13141a", light: "#eac879" },
  ocean: { name: "Azul profundo", start: "#174e68", end: "#0d1d35", light: "#a4ebea" },
  ember: { name: "Fim de tarde", start: "#843b45", end: "#271a36", light: "#ffc97d" },
} as const;
export const maxPhotoBytes = 96 * 1024;
export type Palette = keyof typeof palettes;
export type MemeRecipe = { caption: string; palette: Palette; photo: string | null };
export type SavedMeme = { id: string; caption: string; revision: string; updatedAt: string };
export type MemeDetail = { id: string; revision: string; recipe: MemeRecipe };
export const emptyMeme: MemeRecipe = { caption: "", palette: "dusk", photo: null };
export const artworkPath = (key: string) => "/api/artwork/" + encodeURIComponent(key);
