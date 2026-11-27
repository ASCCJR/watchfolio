# Executar o Watchfolio

A interface em português usa Vinext/React, a identidade fornecida pelo Sites e D1. O catálogo desta versão consulta o TVmaze pelo servidor. A API pública de séries dispensa credenciais. Os dados de catálogo são usados sob CC BY-SA e cada ficha referencia a sua fonte. A imagem de capa do projetor foi gerada para o projeto. [API e licença do TVmaze](https://www.tvmaze.com/api#licensing)

## Desenvolvimento local

Na pasta `web/`, usar Node.js 22.13 ou superior e npm. Para preparar a primeira prévia em um checkout novo, executar em sequência:

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_personal_library.sql
npm run dev
```

Abra a URL local que o servidor indicar. A primeira migração cria as tabelas em um banco de desenvolvimento vazio. Nas execuções seguintes, basta iniciar com `npm run dev`. Ao alterar o schema, gerar a próxima migração com `npm run db:generate` e aplicar apenas as pendentes. Banco, sessões e artefatos gerados ficam fora do Git.

O botão de login na prévia em loopback usa a identidade de teste do starter. No endereço privado hospedado, o Sites fornece a identidade da conta. As bases de desenvolvimento e hospedagem são independentes.

## Verificar o primeiro percurso

Execute `npm run build` e `npm test` na pasta `web/`. O teste exercita as rotas do Worker compilado em uma base D1 descartável. A resposta do catálogo e as identidades são controladas para tornar a verificação repetível. O [plano](../docs/PLAN.md#prova-de-séries-no-chrome-do-android) descreve a conferência com o catálogo real e dois aparelhos.

O manifesto em `.openai/hosting.json` identifica a aplicação privada. O fluxo de publicação do projeto está no [plano de desenvolvimento](../docs/PLAN.md#como-alinhar-github-e-sites-quando-houver-publicação).
