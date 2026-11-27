"use client";

import { useState } from "react";
import { Check, ChevronDown, History, Plus, RotateCcw } from "lucide-react";
import type { Episode } from "../lib/titles";
import { countLabel } from "./collection";

export const episodeCode = (episode: Episode) => episode.special
  ? (episode.number ? "Especial " + episode.number : "Especial")
  : "T" + episode.season + " · E" + String(episode.number).padStart(2, "0");

export function formatDate(date: string | null): string {
  const parts = date?.split("-");
  return parts?.length === 3 ? parts.reverse().join("/") : "Data a confirmar";
}

type Props = {
  episodes: Episode[];
  next: Episode | undefined;
  sessions: Map<number, string[]>;
  disabled: boolean;
  mark: (ids: number[], rewatch?: boolean, bulk?: boolean) => Promise<boolean>;
  remove: (sessionId: string) => Promise<boolean>;
  showHistory: (id: number) => void;
};

export function EpisodeList({ episodes, next, sessions, disabled, mark, remove, showHistory }: Props) {
  const [picked, setPicked] = useState<string | null>(null);
  const [batch, setBatch] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const regular = episodes.filter(item => !item.special);
  const special = episodes.filter(item => item.special);
  const seasons = Array.from(new Set(regular.map(item => item.season))).sort((a, b) => a - b);
  const season = picked ?? String(next?.season ?? seasons[0] ?? "special");
  const shown = season === "special" ? special : regular.filter(item => String(item.season) === season);
  const eligible = shown.filter(item => item.available && !sessions.has(item.id)).map(item => item.id);
  const selection = selected.filter(id => eligible.includes(id));
  const watched = episodes.filter(item => sessions.has(item.id)).length;

  async function saveBatch(ids: number[]) {
    if (ids.length && await mark(ids, false, true)) {
      setBatch(false);
      setSelected([]);
    }
  }

  function chooseSeason(value: string) {
    setPicked(value);
    setSelected([]);
    setBatch(false);
  }

  return <section className="episode-section" aria-labelledby="episodes-heading">
    <div className="section-heading"><h2 id="episodes-heading">Episódios</h2>
      {episodes.length > 0 && <span>{watched} de {episodes.length} vistos</span>}</div>
    {!episodes.length ? <p className="muted">O catálogo ainda não tem episódios para este título.</p> : <>
      <div className="episode-tools">
        <label className="season-select"><span className="sr-only">Temporada</span>
          <select value={season} onChange={event => chooseSeason(event.target.value)}>
            {seasons.map(value => <option key={value} value={value}>Temporada {value}</option>)}
            {special.length > 0 && <option value="special">Especiais</option>}
          </select><ChevronDown size={16} aria-hidden="true" /></label>
        <button type="button" className="text-action" disabled={disabled || (!eligible.length && !batch)} onClick={() => { setBatch(!batch); setSelected([]); }}>
          {batch ? "Sair da seleção" : "Marcar em lote"}
        </button>
      </div>
      {batch && <div className="batch-tools"><label>
        <input type="checkbox" disabled={disabled || !eligible.length} checked={eligible.length > 0 && selection.length === eligible.length}
          onChange={event => setSelected(event.target.checked ? eligible : [])} /> Selecionar todos os disponíveis
      </label><button type="button" className="button dark" disabled={disabled || !selection.length} onClick={() => saveBatch(selection)}>
        Marcar {countLabel(selection.length, "selecionado", "selecionados")}</button></div>}
      <ul className="episode-list">{shown.map(item => {
        const sessionIds = sessions.get(item.id) ?? [];
        const seen = sessionIds.length > 0;
        const code = episodeCode(item);
        function toggle() {
          if (!seen) void mark([item.id]);
          else if (sessionIds.length === 1) void remove(sessionIds[0]);
          else showHistory(item.id);
        }
        return <li key={item.id}>
          {batch ? <label className="batch-check"><input type="checkbox" disabled={!eligible.includes(item.id) || disabled}
            checked={selection.includes(item.id)} aria-label={"Selecionar " + code + " " + item.name}
            onChange={event => setSelected(event.target.checked ? [...selection, item.id] : selection.filter(id => id !== item.id))} /><span className="episode-code">{code}</span></label>
            : <span className="episode-code">{code}</span>}
          <div className="episode-name"><h3>{item.name}</h3>
            {!item.available && <small>{item.airdate ? "Previsto em " + formatDate(item.airdate) : "Data a confirmar"}</small>}
            {seen && <small>{countLabel(sessionIds.length, "sessão", "sessões")}</small>}</div>
          {!batch && <div className="episode-actions">
            {seen && <button type="button" className="episode-toggle" disabled={disabled || !item.available}
              aria-label={"Registrar reassistida de " + code + " " + item.name} title="Registrar reassistida" onClick={() => mark([item.id], true)}>
              <RotateCcw size={16} aria-hidden="true" /><span>Reassistir</span></button>}
            <button className={"episode-toggle" + (seen ? " seen" : "")} type="button" aria-pressed={seen}
              aria-label={(sessionIds.length > 1 ? "Ver sessões de " : seen ? "Desmarcar " : "Marcar como visto ") + code + " " + item.name}
              title={sessionIds.length > 1 ? "Ver sessões" : seen ? "Desmarcar" : "Marcar como visto"}
              disabled={disabled || (!item.available && !seen)} onClick={toggle}>
              {sessionIds.length > 1 ? <History size={17} aria-hidden="true" /> : seen ? <Check size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
              <span>{sessionIds.length > 1 ? "Ver sessões" : seen ? "Visto" : "Marcar"}</span></button>
          </div>}
        </li>;
      })}</ul>
    </>}
  </section>;
}
