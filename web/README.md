# Executar o Watchfolio

A interface em português usa Vinext/React, a identidade fornecida pelo Sites e D1. O servidor busca séries e animes episódicos no TVmaze e filmes no Wikidata, sem chave de API. O filtro de animes também inclui filmes que o Wikidata classifica como filmes de anime. Cada ficha referencia a fonte. A cobertura das imagens e dos títulos em português varia. A imagem de capa do projetor foi gerada para o projeto. [API e licença do TVmaze](https://www.tvmaze.com/api#licensing) · [Dados estruturados do Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing)

## Desenvolvimento local

Na pasta `web/`, usar Node.js 22.13 ou superior e npm. Para preparar a primeira prévia em um checkout novo, executar em sequência:

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_personal_library.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_shelf_history_and_lists.sql
npm run dev
```

Abra a URL local que o servidor indicar. Em uma base da versão 1, aplique somente a migração `0001`. No primeiro acesso de cada titular, a aplicação traz suas séries e marcações anteriores para a biblioteca atual em uma única transação. Nas execuções seguintes, basta iniciar com `npm run dev`. Ao alterar o schema, gerar a próxima migração com `npm run db:generate` e aplicar apenas as pendentes. Banco, sessões e artefatos gerados ficam fora do Git.

O botão de login na prévia em loopback usa a identidade de teste do starter. No endereço privado hospedado, o Sites fornece a identidade da conta. As bases de desenvolvimento e hospedagem são independentes.

## Verificar biblioteca e listas

Execute `npm run build` e `npm test` na pasta `web/`. A suíte exercita as rotas do Worker compilado em bases D1 descartáveis, incluindo atualização desde a versão 1, histórico, operações repetidas e listas mistas. A resposta do catálogo e as identidades são controladas para tornar a verificação repetível. O [plano](../docs/PLAN.md) descreve a conferência com o catálogo real e dois aparelhos.

O manifesto em `.openai/hosting.json` identifica a aplicação privada. O fluxo de publicação do projeto está no [plano de desenvolvimento](../docs/PLAN.md#como-alinhar-github-e-sites-quando-houver-publicação).
