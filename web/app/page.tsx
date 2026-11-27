import { Watchfolio } from "./watchfolio";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const showId = typeof params.serie === "string" && /^[1-9]\d*$/.test(params.serie)
    ? params.serie
    : null;

  return <Watchfolio query={query} showId={showId} catalog={params.buscar === "1" || Boolean(query)} />;
}
