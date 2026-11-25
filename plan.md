# Plano — Rayzen IPTV

## Produto e limites
App Expo/React Native para celular Android e Android TV, com conteúdo demonstrativo até que o usuário forneça fontes autorizadas. Inclui navegação por foco/controle remoto, player isolado atrás de uma interface baseada em `expo-video`, telas de Ao Vivo, Filmes, Séries e Favoritos, busca, fontes M3U/Xtream configuráveis, EPG/XMLTV e controle parental por PIN local. Não reutiliza código/ativos proprietários do Green TV, não inclui canais reais e não guarda credenciais de provedor em servidor.

## Implementação
Usar starter Expo Router/React Native/TypeScript existente. Para TV, seguir guia Expo usando `react-native-tvos` compatível com a versão React Native do starter e o plugin `@react-native-tvos/config-tv`; fornecer configuração de build Android-TV com `EXPO_TV=1` e build de telefone sem essa flag. Usar `Pressable` acessíveis com estilo `focused`, navegação D-pad por foco, back nativo e telas responsivas. Criar camada `PlayerAdapter` que usa `expo-video` agora e permite substituir motor depois. Guardar fontes, favoritos e PIN localmente, sem enviar dados à API. Criar parsers M3U e adaptadores de API como módulo substituível, com entrada de fonte desabilitada/claramente configurável até URL e credenciais autorizadas serem fornecidas. Implementar player HLS com clipes demonstrativos licenciados para demonstração, nunca canais de TV.

## Estrutura
- `app/(tabs)/`: Home, Ao Vivo, Filmes, Séries, Favoritos, Ajustes.
- `components/`: cartões, controles focalizáveis, player modal.
- `lib/iptv/`: tipos, catálogo demonstrativo, parsing M3U, conectores Xtream/EPG, armazenamento local.
- `lib/player/`: interface de player e adaptador `expo-video`.
- `assets/images/`: identidade visual Rayzen IPTV e ícones Expo.

## Design
Estilos considerados: **cinema escuro neon** (0,08), **minimalismo editorial claro** (0,05), **arcade retrô** (0,04). Selecionado cinema escuro neon.
- Movimento: interface de cinema contemporânea, sem imitar a identidade de terceiros.
- Princípios: foco remoto sempre visível; hierarquia simples; demonstração honestamente identificada; contraste AA aproximado.
- Cores: carvão e azul-noite como base, ciano/verde-lima para estado ativo, violeta em detalhes; a cor ativa evidencia foco/seleção.
- Layout: trilhos horizontais de conteúdo em TV e listas compactas no celular; topo com ações, barra de abas inferior no telefone e menu lateral em telas amplas.
- Motivos: marca R geométrica; contorno luminoso de foco; cartões de mídia com gradientes escuros.
- Interação/animação: estados foco/pressionado com escala e borda sutis; sem animações longas; D-pad usa foco nativo e confirma com Select.
- Tipografia: sans-serif nativa/Expo, títulos semibold e metadados menores com contraste suficiente.
- Essência/voz: player IPTV pessoal configurável, direto, confiável e ágil. CTA “Adicionar fonte autorizada”; microcopy “Modo demonstração — conteúdo de exemplo”.
- Marca: símbolo R abstrato em ciano sobre fundo azul-noite, com brilho leve; cor proprietária ciano elétrico.
