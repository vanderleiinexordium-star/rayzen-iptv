# Compatibilidade Android TV — evidências

A Expo confirma que apps Expo podem visar Android TV ao usar o fork `react-native-tvos` como dependência `react-native` e adicionar o plugin `@react-native-tvos/config-tv`. A documentação chama atenção para bibliotecas Expo que podem não estar disponíveis em TV. O plugin acrescenta o intent de TV no Manifest e adapta orientação; a variável `EXPO_TV=1` habilita a configuração TV. Fonte: [Expo: Build Expo apps for TV](https://docs.expo.dev/guides/building-for-tv/).

O README do React Native TV descreve suporte a foco por D-pad, eventos `onFocus`, `onBlur`, `onPress`, teclado e menu/back do controle Android TV; explica que Android builds do fork rodam em celular e TV e recomendam Pressable/Touchable com foco. Fonte: [React Native TV](https://github.com/react-native-tvos/react-native-tvos).

A documentação geral React Native redireciona o suporte TV para o projeto React Native for TV. Fonte: [React Native: Building for TV](https://reactnative.dev/docs/building-for-tv).

Neste starter, Expo SDK 57 traz React Native 0.86.3; o fork instalado é `react-native-tvos@0.86.3-0`, alinhado à linha 0.86. APK/AAB deve ser criado pelo fluxo de build do Dashboard/EAS conforme configuração. A existência da configuração/prebuild não equivale a teste em Android TV real. O módulo de EPG aceita URL XMLTV, mas o parser/sincronizador de EPG ainda não está implementado.
