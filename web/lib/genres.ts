// Both sources may supply the same genre in different languages or letter case.
const names: Record<string, string> = {
  action: "Ação", adventure: "Aventura", anime: "Anime", children: "Infantil", comedy: "Comédia",
  crime: "Crime", diy: "Faça você mesmo", drama: "Drama", espionage: "Espionagem", family: "Família",
  fantasy: "Fantasia", food: "Culinária", history: "História", horror: "Terror", legal: "Jurídico",
  medical: "Medicina", music: "Música", mystery: "Mistério", nature: "Natureza", romance: "Romance",
  "science-fiction": "Ficção científica", sports: "Esportes", supernatural: "Sobrenatural", thriller: "Suspense",
  travel: "Viagem", war: "Guerra", western: "Faroeste",
  "filme de drama": "Drama", "filme de ação": "Ação", "filme sobre crimes": "Crime", "filme de terror": "Terror",
  "filme de ficção científica": "Ficção científica", "filme de aventura": "Aventura", "filme de comédia": "Comédia",
  "filme de fantasia": "Fantasia", "documentary film": "Documentário",
};

export function genreNames(title: { genres: string[] }) {
  const labels = title.genres.map(raw => {
    const key = raw.trim().normalize("NFC").toLocaleLowerCase("pt-BR");
    return names[key] ?? (key.charAt(0).toLocaleUpperCase("pt-BR") + key.slice(1));
  });
  return Array.from(new Set(labels.filter(Boolean)));
}
