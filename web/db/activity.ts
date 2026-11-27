import { historyPageSize, type Activity } from "@/lib/activity-types";
import { genreNames } from "@/lib/genres";
import { openShelf } from "./shelf";

const rankedSessions = `WITH sessions AS (
  SELECT *, row_number() OVER (PARTITION BY title_key, episode_id ORDER BY watched_on, id) AS viewing
  FROM watch_sessions WHERE owner_id = ?1)`;

// A later edit changes the current vote. An annual retrospective only looks at
// edits within that calendar year, so a new year's vote does not erase last year's.
const rankedReactions = (period: string) => `WITH choices AS (
  SELECT *, row_number() OVER (PARTITION BY title_key, episode_id, field ORDER BY id DESC) AS position
  FROM reaction_events WHERE owner_id = ?1 ${period})`;

type TitleRow = { key: string; name: string; genres: string; count: number; movies: number; episodes: number;
  rewatches: number; seconds: number; missing: number };
type ChoiceRow = { field: string; value: string; label: string | null; count: number };
type SessionRow = Omit<Activity["history"][number], "rewatch"> & { viewing: number };

export async function readActivity(owner: string, year: string | null, page: number, day: string | null): Promise<Activity> {
  const db = await openShelf(owner);
  const bounds = year ? [owner, year + "-01-01", year + "-12-31"] : [owner];
  const watchPeriod = year ? "WHERE s.watched_on BETWEEN ?2 AND ?3" : "";
  const historyPeriod = day ? "WHERE s.watched_on = ?2" : watchPeriod;
  const historyBounds = day ? [owner, day] : bounds;
  const votePeriod = year ? "AND reacted_on BETWEEN ?2 AND ?3" : "";
  const titles = "JOIN shelf_entries t ON t.owner_id = s.owner_id AND t.title_key = s.title_key";
  const [byTitle, votes, sessions, years, medals, dayCount] = await db.batch([
    db.prepare(`${rankedSessions}
      SELECT s.title_key AS key, t.details ->> 'name' AS name, t.details -> 'genres' AS genres,
        count(*) AS count, max(s.episode_id IS NULL) AS movies, count(DISTINCT s.episode_id) AS episodes,
        sum(s.viewing > 1) AS rewatches, coalesce(sum(s.duration_seconds), 0) AS seconds,
        sum(s.duration_seconds IS NULL) AS missing
      FROM sessions s ${titles} ${watchPeriod} GROUP BY s.title_key ORDER BY count DESC, name, key`).bind(...bounds),
    db.prepare(`${rankedReactions(votePeriod)}
      SELECT field, value, max(label) AS label, count(*) AS count FROM choices
      WHERE position = 1 AND value IS NOT NULL GROUP BY field, value ORDER BY count DESC, label, value`).bind(...bounds),
    db.prepare(`${rankedSessions}
      SELECT s.title_key AS titleKey, t.details ->> 'name' AS titleName, s.id, s.episode_id AS episodeId,
        s.episode_label AS episodeLabel, s.watched_on AS date, s.duration_seconds AS seconds, s.viewing
      FROM sessions s ${titles} ${historyPeriod}
      ORDER BY s.watched_on DESC, s.title_key, s.id LIMIT ${historyPageSize} OFFSET ?`).bind(...historyBounds, page * historyPageSize),
    db.prepare(`SELECT substr(watched_on, 1, 4) AS year FROM watch_sessions WHERE owner_id = ?1
      UNION SELECT substr(reacted_on, 1, 4) AS year FROM reaction_events WHERE owner_id = ?1 ORDER BY year DESC`).bind(owner),
    db.prepare(`${rankedReactions("")}
      SELECT (SELECT count(*) FROM watch_sessions WHERE owner_id = ?1) AS first,
        (SELECT count(*) FROM (SELECT title_key, episode_id FROM watch_sessions
          WHERE owner_id = ?1 AND episode_id IS NOT NULL GROUP BY title_key, episode_id)) AS episodes,
        (SELECT count(*) FROM choices WHERE field = 'character' AND position = 1 AND value IS NOT NULL) AS characters`).bind(owner),
    ...(day ? [db.prepare("SELECT count(*) AS count FROM watch_sessions WHERE owner_id = ? AND watched_on = ?").bind(owner, day)] : []),
  ]);

  const totals: Activity["totals"] = { sessions: 0, titles: byTitle.results.length, movies: 0,
    episodes: 0, rewatches: 0, seconds: 0, missingRuntime: 0, ratings: 0, meanRating: null };
  const genres = new Map<string, number>();
  const titleRows = byTitle.results as TitleRow[];
  for (const row of titleRows) {
    totals.sessions += row.count;
    totals.movies += row.movies;
    totals.episodes += row.episodes;
    totals.rewatches += row.rewatches;
    totals.seconds += row.seconds;
    totals.missingRuntime += row.missing;
    for (const genre of genreNames({ genres: JSON.parse(row.genres ?? "[]") })) {
      genres.set(genre, (genres.get(genre) ?? 0) + row.count);
    }
  }
  let ratingSum = 0;
  const characters: Activity["characters"] = [];
  const emotions: Activity["emotions"] = [];
  for (const row of votes.results as ChoiceRow[]) {
    if (row.field === "rating") { ratingSum += Number(row.value) * row.count; totals.ratings += row.count; }
    if (row.field === "character") characters.push({ key: row.value, name: row.label ?? row.value, count: row.count });
    if (row.field === "emotion") emotions.push({ name: row.value, count: row.count });
  }
  if (totals.ratings) totals.meanRating = ratingSum / totals.ratings;

  return {
    totals, years: (years.results as { year: string }[]).map(row => Number(row.year)),
    missingTitles: titleRows.filter(row => row.missing > 0).map(({ key, name }) => ({ key, name })),
    titles: titleRows.slice(0, 5).map(({ key, name, count }) => ({ key, name, count })),
    genres: [...genres].map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR")).slice(0, 5),
    characters: characters.slice(0, 5), emotions: emotions.slice(0, 5),
    historyCount: dayCount ? (dayCount.results[0] as { count: number }).count : totals.sessions,
    history: (sessions.results as SessionRow[]).map(({ viewing, ...session }) => ({ ...session, rewatch: viewing > 1 })),
    medals: medals.results[0] as Activity["medals"],
  };
}
