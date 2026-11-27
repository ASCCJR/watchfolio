import { Watchfolio } from "./watchfolio";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const legacy = typeof params.serie === "string" && /^[1-9]\d*$/.test(params.serie) ? "tvmaze-" + params.serie : null;
  const key = typeof params.titulo === "string" ? params.titulo : legacy;
  const type = params.type === "movie" || params.type === "series" || params.type === "anime" ? params.type : "all";

  return <Watchfolio query={query} titleKey={key} catalog={params.buscar === "1" || Boolean(query)} type={type} />;
}
