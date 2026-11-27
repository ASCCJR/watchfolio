# Contexto do Watchfolio

## Decisões confirmadas

O usuário escolheu o repositório [ASCCJR/watchfolio](https://github.com/ASCCJR/watchfolio) para construir com Codex um substituto pessoal completo do **TV Time original, publicado pela Whip Networks**. Quer abrir a mesma biblioteca pelo navegador do celular e do computador e manter os dados pessoais entre sessões e aparelhos. Um marco inicial pode entregar apenas parte da experiência. O restante continua no escopo até que o usuário decida alterá-lo.

O usuário perdeu o acesso ao TV Time. Recuperar a conta ou exportar e importar seu histórico antigo está fora do projeto. O primeiro uso começa vazio. Uma eventual cópia de segurança abrangeria exclusivamente os dados criados no Watchfolio.

Sites é a base pretendida de publicação e precisa ser avaliado para o aplicativo completo. A transferência inicial abrangeu pesquisa, documentação e planejamento. Em 27 de novembro de 2026, o usuário autorizou avançar com a primeira etapa e publicar a versão de teste no Sites com acesso restrito a ele. O aparelho-alvo usa Android com Chrome. A [matriz](FEATURE_MATRIX.md) concentra os requisitos e critérios de conclusão. O [plano](PLAN.md) concentra as escolhas técnicas, seus testes e a ordem das entregas.

## Ponto de partida verificado em 26 de novembro de 2026

A pasta de trabalho continha um checkout na subpasta `watchfolio/`. Antes da documentação, havia apenas `.git` nessa raiz, sem instruções locais, arquivos de aplicação, commits ou alterações para integrar. O branch local era `main`, com `origin` configurado para o GitHub indicado. A consulta ao remoto com `git ls-remote --symref origin` terminou com sucesso e retornou zero referências.

A transferência não trouxe credenciais, identificador de Site, banco, chave de catálogo nem integrações configuradas. No checkout, não havia manifesto de hospedagem ou configuração correspondente. Havia orientação técnica do Sites disponível no ambiente. Não houve provisionamento, chamadas autenticadas aos provedores ou testes no aparelho. A existência de serviços particulares fora deste checkout permanece desconhecida.

## O que sabemos sobre o original

A identificação de referência é o pacote Android `com.tozelabs.tvshowtime`, com Whip Networks como publicadora. Sua descrição documenta uma experiência que começa em “o que quero ver?”, passa por “onde parei?” e continua depois da sessão, com reações, comentários, estatísticas e comparação com outros fãs. A ficha também documenta widgets para a fila e os próximos lançamentos. Consultamos o texto da publicadora, sem usar avaliações de usuários para deduzir regras. [Ficha original no Google Play](https://play.google.com/store/apps/details?id=com.tozelabs.tvshowtime)

O levantamento ampliou o inventário inicial. O Rewind de 2022 reunia dados pessoais do ano, inclusive títulos, gêneros e personagens. A Whip também anunciou descoberta personalizada no feed. Uma reportagem de 2020 republicada pela empresa descreve enquetes, curtidas e mídia nas conversas por episódio. São evidências históricas de recursos concretos. A continuidade em todas as versões e as regras de ordenação permanecem abertas. [Rewind 2022](https://whipmedia.com/news/tv-time-unveils-tv-time-rewind-2022/) · [Anúncio do feed pela Whip](https://www.linkedin.com/posts/whipmediagroup_tvtime-contentdiscovery-entertainmentindustry-activity-7237226288510345216-Mnko) · [Discussões por episódio](https://whipmedia.com/news/whip-media-group-parent-to-tv-show-tracking-app-tv-time-raises-50m/)

O Watchfolio pode registrar votos do usuário, calcular estatísticas e aplicar suas próprias regras de recomendação. Comentários, amostras de votos e atividades de terceiros exigem contribuições reais ou uma fonte que autorize o uso. A proposta inicial é preservar as reações pessoais em modo privado e identificar a origem e o tamanho de cada comparação. A participação de convidados depende de uma decisão sobre audiência. O algoritmo proprietário, a comunidade e os dados históricos do TV Time não fazem parte dos recursos disponíveis.

## Decisões em aberto

| Tema | Questão a resolver e efeito sobre o projeto |
| --- | --- |
| Progresso e avaliações | O usuário confirmou em 27 de novembro de 2026 que os especiais ficam à parte e que o próximo episódio percorre os regulares. As regras adotadas na etapa 2 para estados, lotes e reassistidas estão no [plano](PLAN.md#biblioteca-de-filmes-séries-e-animes). Ainda é preciso decidir a escala de notas e a contabilização do tempo assistido. Meia estrela é uma sugestão. |
| Calendário e conquistas | Distinguir estreia original, estreia no Brasil e chegada a um serviço. Definir fuso, alertas e antecedência. Investigar regras históricas de medalhas e adotar regras próprias identificadas onde faltar evidência. |
| Catálogo e orçamento | Validar cobertura em português, episódios de anime e provedores no Brasil. Confirmar licença, credencial, custos do Sites no plano do usuário e eventual custo de um serviço auxiliar antes de escolher a arquitetura. |
| Audiência | Decidir entre uso exclusivamente individual com compartilhamento de um arquivo e acesso seletivo a listas e discussões por convidados. A segunda opção exige autorização por recurso e define quem pode contribuir nas comparações. |
| Aparelhos | Identificar sistemas e navegadores usados. Se um widget exigir extensão nativa, decidir para quais plataformas vale manter e distribuir esse componente. Instalação e alertas também terão testes próprios. |
| Cópias futuras | Decidir se haverá exportação manual ou backup recorrente, o conteúdo incluído e como restaurá-lo. Uma versão salva do código e uma cópia dos registros pessoais têm ciclos de vida distintos. |
| Aparência e IA | Tema escuro e demais escolhas visuais podem esperar a primeira interface. Para IA dentro do app, exigir um caso de uso, identificar os dados enviados e considerar custo e privacidade. A personalização pode começar com regras sobre o histórico. |

## Fontes consultadas

Consulta documental em **26 de novembro de 2026**. As siglas abaixo aparecem na matriz. **Pedido** designa o contexto transferido pelo usuário. Quando a fonte confirma apenas a existência de um recurso, o critério proposto na matriz descreve o que testar no Watchfolio.

| Ref. | Evidência e alcance |
| --- | --- |
| TV1 | Inventário anunciado pela Whip Networks para o pacote original. [Google Play](https://play.google.com/store/apps/details?id=com.tozelabs.tvshowtime) |
| TV2 | Exemplo histórico de retrospectiva individual e tendências calculadas sobre uma comunidade identificada. [Whip Media, Rewind 2022](https://whipmedia.com/news/tv-time-unveils-tv-time-rewind-2022/) |
| TV3 | Registro histórico de marcações de episódios, enquetes, fotos e curtidas, em reportagem republicada pela Whip. [Whip Media, janeiro de 2020](https://whipmedia.com/news/whip-media-group-parent-to-tv-show-tracking-app-tv-time-raises-50m/) |
| TV4 | A própria Whip anunciou uma aba de descoberta ampliada e feed personalizado. [Anúncio da Whip Media](https://www.linkedin.com/posts/whipmediagroup_tvtime-contentdiscovery-entertainmentindustry-activity-7237226288510345216-Mnko) |
| S1 | Sites admite aplicações web com registros persistentes, arquivos e identidade de visitantes. [Sites](https://learn.chatgpt.com/docs/sites) · [Dados e conexões](https://learn.chatgpt.com/docs/sites/data-and-connections) |
| S2 | Audiência, versões, segredos de execução e custos precisam ser conferidos no plano de publicação. [Publicação](https://learn.chatgpt.com/docs/sites/publishing-and-sharing) · [Gestão do Site](https://learn.chatgpt.com/docs/sites/managing-a-site) · [Uso e custos](https://learn.chatgpt.com/docs/sites/usage-and-cost) · [Dados salvos e restauração](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites) |
| M1 | TMDB documenta credencial, uso não comercial com atribuição, créditos para dados e imagens e ausência de SLA. [FAQ](https://developer.themoviedb.org/docs/faq) · [Autenticação da aplicação](https://developer.themoviedb.org/docs/authentication-application) |
| M2 | Metadados para temporadas e episódios e datas de lançamentos de filmes. A cobertura de títulos, traduções e especiais no Brasil requer amostragem. [Temporadas](https://developer.themoviedb.org/reference/tv-season-details) · [Episódios](https://developer.themoviedb.org/reference/tv-episode-details) · [Datas de lançamento de filmes](https://developer.themoviedb.org/reference/movie-release-dates) |
| M3 | A disponibilidade é regional, com dados da JustWatch e crédito obrigatório. O retorno pode fornecer uma página TMDB para consultar os serviços. [Provedores de séries](https://developer.themoviedb.org/reference/tv-series-watch-providers) · [Provedores de filmes](https://developer.themoviedb.org/reference/movie-watch-providers) |
| M4 | Recomendações da API partem de um título. Tendências têm janelas temporais e origem próprias. [Recomendações de séries](https://developer.themoviedb.org/reference/tv-series-recommendations) · [Popularidade e tendências](https://developer.themoviedb.org/docs/popularity-and-trending) |
| C1 | Fonte usada no Watchfolio para séries, gêneros e episódios, inclusive especiais. [Documentação e licença do TVmaze](https://www.tvmaze.com/api) |
| C2 | Fonte usada para filmes e identificação de longas de anime. Cobertura, idioma e disponibilidade da imagem dependem do item. [Acesso aos dados do Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) · [Licenciamento](https://www.wikidata.org/wiki/Wikidata:Licensing) |
| W1 | Condições de instalação e entrega de notificações na web. Em iOS/iPadOS, o WebKit documenta a solicitação de permissão após ação do usuário em um web app adicionado à tela inicial. [Instalação de PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) · [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) · [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| W2 | Interfaces de widgets e dependência do sistema, superfície e aparelho. [Apple WidgetKit](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension) · [Android App Widgets](https://developer.android.com/develop/ui/views/appwidgets) · [Android na tela de bloqueio](https://android-developers.googleblog.com/2025/03/widgets-on-lock-screen-faq.html) |

O artigo da antiga central de ajuda da Whip estava inacessível nesta consulta. A documentação acessível deixa lacunas sobre regras de reassistidas, estados pessoais, escala de notas, medalhas, spoilers, calendário e diferenças entre aparelhos. Registrar uma descoberta futura com sua data, versão e fonte, ou documentar a decisão de produto correspondente. [Central de ajuda histórica](https://whipmedia.freshdesk.com/support/solutions/articles/68000029988-tv-time-is-shutting-down)
