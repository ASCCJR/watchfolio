"use client";

import { useRef, useState } from "react";
import { Award, CalendarDays, Clock3, Film, Star } from "lucide-react";
import { historyPageSize, medalRules, type Activity } from "../../lib/activity-types";
import { countLabel, Feedback } from "../collection";
import { formatDate } from "../series-detail";
import { request, useResource } from "../use-resource";

const titleUrl = (key: string) => "/?titulo=" + encodeURIComponent(key);
const stars = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = seconds % 60;
  return [hours ? hours + " h" : "", minutes ? minutes + " min" : "", rest ? rest + " s" : ""].filter(Boolean).join(" ") || "0 min";
}

function DurationLookup({ titles, refresh }: { titles: Activity["missingTitles"]; refresh: () => Promise<void> }) {
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const selected = titles.find(row => row.key === choice) ?? titles[0];
  async function lookup() {
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      const { updated } = await request<{ updated: number }>("/api/activity/durations/" + encodeURIComponent(selected.key), { method: "POST" });
      setNotice(updated ? selected.name + " · " + countLabel(updated, "sessão atualizada", "sessões atualizadas") + "."
        : "Nenhuma nova duração disponível para " + selected.name + ".");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível consultar a duração."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div>{selected && <details className="activity-lookup"><summary>Consultar durações que faltam</summary>
    <p>A consulta atualiza as sessões desse título para as quais o catálogo informa a duração.</p>
    <div><label className="filter-field"><span>Título para consultar</span>
      <select disabled={busy} value={selected.key} onChange={e => { setChoice(e.target.value); setNotice(""); }}>
        {titles.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}</select></label>
      <button className="button plain" type="button" disabled={busy} onClick={lookup}>{busy ? "Consultando…" : "Consultar duração"}</button></div>
  </details>}<p role="status" className="activity-notice">{notice}</p></div>;
}

function Ranking({ title, rows, unit, plural, empty }: {
  title: string; rows: { name: string; key?: string; href?: string; count: number }[]; unit: string; plural: string; empty: string;
}) {
  return <section className="activity-ranking"><h3>{title}</h3>{rows.length
    ? <ol>{rows.map(row => <li key={row.key ?? row.name}>
      <span>{row.href ? <a href={row.href}>{row.name}</a> : row.name}</span>
      <small>{countLabel(row.count, unit, plural)}</small></li>)}</ol> : <p>{empty}</p>}</section>;
}

export function ActivityView({ initialYear }: { initialYear: string }) {
  const [year, setYear] = useState(initialYear);
  const [page, setPage] = useState(0);
  const [day, setDay] = useState("");
  const resource = useResource<Activity>("/api/activity?page=" + page + (year ? "&year=" + year : "") + (day ? "&day=" + day : ""), true);
  const [customYear, setCustomYear] = useState(false);
  const data = resource.data;
  const currentYear = new Date().getFullYear();
  const years = [...new Set([currentYear, currentYear - 1, ...(year ? [Number(year)] : []), ...(data?.years ?? [])])].sort((a, b) => b - a);
  function selectYear(value: string) {
    if (value === "other") { setCustomYear(true); return; }
    setCustomYear(false);
    setYear(value);
    setDay("");
    setPage(0);
  }
  const totals = data?.totals;
  const hasPreferences = data && (data.characters.length + data.emotions.length + data.totals.ratings > 0);
  return <div className="activity-page">
    <header className="activity-intro"><div><h1>Minha atividade</h1><p>Seu histórico, suas preferências e conquistas.</p></div>
      <div className="activity-period"><label className="filter-field"><span>Período</span>
        <select value={customYear ? "other" : year} onChange={event => selectYear(event.target.value)}>
          <option value="">Todo o histórico</option>{years.map(n => <option key={n} value={String(n).padStart(4, "0")}>{n}</option>)}
          <option value="other">Escolher outro ano…</option></select></label>
        {customYear && <form onSubmit={e => { e.preventDefault(); selectYear(String(new FormData(e.currentTarget).get("ano"))); }}>
          <label className="filter-field"><span>Ano</span><input name="ano" type="text" inputMode="numeric" required pattern="[0-9]{4}" maxLength={4} placeholder="2024" /></label>
          <button className="button plain">Ver ano</button></form>}</div></header>
    {resource.error && <Feedback error={resource.error} retry={resource.refresh} />}
    {!data && !resource.error && <p role="status">Carregando atividade…</p>}
    {data && totals && <>
      <section aria-label={year ? "Retrospectiva de " + year : "Estatísticas"}>
        <h2>{year ? "Retrospectiva de " + year : "Estatísticas"}</h2>
        {!totals.sessions && !hasPreferences && <p className="activity-empty">{year ? "Nenhuma sessão ou reação registrada neste ano." : "Seu histórico começa quando você registra uma sessão ou reage a um título."}</p>}
        <dl className="activity-totals">
          <div><dt><CalendarDays size={18} />Sessões</dt><dd>{totals.sessions}</dd>
            <dd className="activity-sub">{countLabel(totals.rewatches, "reassistida", "reassistidas")}</dd></div>
          <div><dt><Film size={18} />Títulos vistos</dt><dd>{totals.titles}</dd>
            <dd className="activity-sub">{countLabel(totals.movies, "filme", "filmes")} · {countLabel(totals.episodes, "episódio", "episódios")}</dd></div>
          <div><dt><Clock3 size={18} />Tempo assistido</dt><dd>{totals.sessions && totals.sessions === totals.missingRuntime ? "A apurar" : duration(totals.seconds)}</dd>
            <dd className="activity-sub">{totals.missingRuntime ? countLabel(totals.missingRuntime, "sessão sem duração", "sessões sem duração") : "Inclui reassistidas"}</dd></div>
          <div><dt><Star size={18} />Nota média</dt><dd>{totals.meanRating === null ? "—" : stars.format(totals.meanRating) + " / 5"}</dd>
            <dd className="activity-sub">{countLabel(totals.ratings, "avaliação", "avaliações")}</dd></div>
        </dl>
        <DurationLookup key={year} titles={data.missingTitles} refresh={resource.refresh} />
        {(totals.sessions > 0 || hasPreferences) && <div className="activity-rankings">
          <Ranking title="Títulos mais vistos" rows={data.titles.map(t => ({ ...t, href: titleUrl(t.key) }))} unit="sessão" plural="sessões" empty="Nenhum título visto no período." />
          <Ranking title="Gêneros mais vistos" rows={data.genres} unit="sessão" plural="sessões" empty="Nenhum gênero informado." />
          <Ranking title="Personagens favoritos" rows={data.characters} unit="voto" plural="votos" empty="Nenhum personagem escolhido no período." />
          <Ranking title="Emoções" rows={data.emotions} unit="reação" plural="reações" empty="Nenhuma emoção registrada no período." />
        </div>}
      </section>
      <section className="activity-history"><div className="activity-history-head"><h2>Histórico de sessões</h2>
        <form key={year + day} onSubmit={e => {
          e.preventDefault();
          setDay(String(new FormData(e.currentTarget).get("dia") ?? "")); setPage(0);
        }}>
          <label className="filter-field"><span>Dia da sessão</span>
            <input type="date" name="dia" defaultValue={day} min={year ? year + "-01-01" : undefined} max={year ? year + "-12-31" : undefined} required /></label>
          <button className="button plain">Filtrar</button>
          {day && <button className="text-action" type="button" onClick={() => { setDay(""); setPage(0); }}>Limpar dia</button>}
        </form></div>
        {data.history.length ? <ol>{data.history.map(row => <li key={row.titleKey + "/" + row.id}>
          <time dateTime={row.date}>{formatDate(row.date)}</time><div><a href={titleUrl(row.titleKey)}>{row.titleName}</a>
            <small>{row.episodeId === null ? "Filme" : row.episodeLabel ?? ("Episódio · ID " + row.episodeId)}{row.rewatch ? " · Reassistida" : ""}</small></div>
          <span>{row.seconds === null ? "Duração desconhecida" : duration(row.seconds)}</span></li>)}</ol> : <p>{day ? "Nenhuma sessão neste dia." : "Nenhuma sessão no período."}</p>}
        {(page > 0 || data.historyCount > historyPageSize) && <div className="activity-pages">
          <button className="button plain" disabled={!page} onClick={() => setPage(p => p - 1)}>Anterior</button>
          <span>Página {page + 1} de {Math.max(1, Math.ceil(data.historyCount / historyPageSize))}</span>
          <button className="button plain" disabled={(page + 1) * historyPageSize >= data.historyCount} onClick={() => setPage(p => p + 1)}>Próxima</button></div>}
      </section>
      <section className="activity-medals"><h2>Conquistas pessoais</h2><p>As medalhas acompanham os registros atuais de todo o histórico.</p>
        <ul>{medalRules.map(rule => { const value = Math.min(rule.target, data.medals[rule.key]); const earned = value === rule.target;
          return <li key={rule.key} data-earned={earned}><Award aria-hidden="true" /><div><h3>{rule.name}</h3>
            <p>{rule.criterion}</p><strong>{earned ? "Conquistada" : value + " de " + rule.target}</strong></div></li>;
        })}</ul></section>
    </>}
  </div>;
}
