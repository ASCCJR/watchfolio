import type { ReactNode } from "react";
import { Library, List, Search } from "lucide-react";

type Section = "library" | "catalog" | "lists" | null;

function Brand() {
  return <a className="brand" href="/" aria-label="Watchfolio, início"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Watchfolio</a>;
}

export function SiteFrame({ section, children }: { section: Section; children: ReactNode }) {
  return <div className="site">
    <a className="skip-link" href="#conteudo">Pular para o conteúdo</a>
    <header className="masthead"><div className="masthead-inner"><Brand />
      <nav aria-label="Principal">
        <a href="/" aria-current={section === "library" ? "page" : undefined}><Library size={17} aria-hidden="true" />Biblioteca</a>
        <a href="/?buscar=1" aria-current={section === "catalog" ? "page" : undefined}><Search size={17} aria-hidden="true" />Catálogo</a>
        <a href="/listas" aria-current={section === "lists" ? "page" : undefined}><List size={17} aria-hidden="true" />Listas</a>
      </nav>
    </div></header>
    <main className="container" id="conteudo">{children}</main>
    <footer className="footer"><div className="footer-inner"><Brand />
      <p>Dados de <a href="https://www.tvmaze.com/">TVmaze</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) e <a href="https://www.wikidata.org/">Wikidata</a> (<a href="https://www.wikidata.org/wiki/Wikidata:Licensing">CC0</a>).</p>
    </div></footer>
  </div>;
}
