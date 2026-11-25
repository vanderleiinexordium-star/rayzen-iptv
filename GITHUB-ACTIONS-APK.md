# Gerar APK do Rayzen IPTV pelo GitHub Actions

O repositório atual do Rayzen IPTV está conectado ao armazenamento Git gerenciado pelo Manus, não a um repositório GitHub. O workflow em `.github/workflows/eas-build.yml` já está preparado no código, mas o GitHub só poderá executá-lo depois que os arquivos do projeto, incluindo o workflow, estiverem num repositório GitHub.

## Preparação inicial

1. Tenha uma conta Expo e crie um **Personal access token** na página [expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens). Trate o token como senha: não o publique, não o coloque no YAML e não o envie por mensagem.
2. Coloque o código-fonte completo do Rayzen IPTV num repositório GitHub. No estado atual, o `origin` do projeto é o repositório gerenciado pelo Manus. Conecte/importe o projeto ao GitHub, ou crie um repositório privado e envie para lá a fonte; inclua a pasta `.github/workflows/`.
3. No GitHub, abra **Settings → Secrets and variables → Actions → New repository secret**. Use o nome `EXPO_TOKEN` e cole nele o token Expo.
4. Vincule o app a um projeto Expo/EAS. O primeiro build EAS deve inicializar o projeto e criar as credenciais Android. O `eas.json` deste app já contém perfis APK `preview-phone` e `preview-android-tv`; o `android.package` já está definido em `app.config.ts`.
5. Se for necessário vincular EAS manualmente, execute a inicialização autenticada uma vez a partir do código configurado. A documentação Expo também aceita `EXPO_TOKEN` para comandos não interativos; o app precisa ter um `extra.eas.projectId` válido antes de builds subsequentes.

## Executar o build

No repositório GitHub, abra **Actions → Rayzen IPTV Android APK → Run workflow**. Escolha `preview-phone` para celular ou `preview-android-tv` para Android TV e inicie. O workflow instala dependências com pnpm e solicita ao EAS Build uma compilação Android sem manter um runner GitHub esperando.

O log da etapa “Trigger EAS Android APK build” mostrará um link do build EAS. Abra-o para acompanhar a compilação e, quando terminar, baixe o APK na página de detalhes do build. Para nova tentativa, execute novamente pelo Actions.

## Limites

O GitHub Actions apenas aciona o serviço remoto do Expo: não contém nem pede o APK de antemão. Um token com acesso insuficiente, ausência do projeto EAS vinculado, rejeição das credenciais Android ou falha de compilação impedem o build. O workflow não é executável pelo projeto até sua cópia para o GitHub. Os perfis configuram uma variante para Android TV; teste de controle remoto e reprodução ainda deve ser realizado nos dispositivos-alvo.
