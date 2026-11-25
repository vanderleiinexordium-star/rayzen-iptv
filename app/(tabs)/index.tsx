import { useMemo, useState, useEffect, useCallback } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IptvPlayer } from "@/components/iptv-player";
import { demoCatalog, fetchM3U, fetchXtreamCatalog, loadFavorites, loadParentalPin, loadSources, MediaItem, saveFavorites, saveParentalPin, saveSources, Source } from "@/lib/iptv";

const C = { bg: "#070B13", panel: "#0F1623", raised: "#172233", line: "#26364B", text: "#F4F7FB", muted: "#9BAEC2", cyan: "#3BE7D4", lime: "#B9F254", purple: "#9B8AFB", danger: "#FF758F" };
type Page = "Início" | "Ao vivo" | "Filmes" | "Séries" | "Favoritos" | "Ajustes";
const PAGES: Page[] = ["Início", "Ao vivo", "Filmes", "Séries", "Favoritos", "Ajustes"];

function FocusButton({ label, onPress, active = false, compact = false }: { label: string; onPress: () => void; active?: boolean; compact?: boolean }) {
  const [focused, setFocused] = useState(false);
  return <Pressable onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={({ pressed }) => ({ paddingVertical: compact ? 10 : 14, paddingHorizontal: compact ? 13 : 18, borderRadius: 13, borderWidth: focused ? 2 : 1, borderColor: focused ? C.cyan : active ? C.cyan : C.line, backgroundColor: focused ? "#17343B" : active ? "#102A30" : C.panel, transform: [{ scale: pressed || focused ? 1.035 : 1 }], marginRight: 8, marginBottom: 8 })}><Text style={{ color: active || focused ? C.cyan : C.text, fontWeight: "700", fontSize: compact ? 13 : 15 }}>{label}</Text></Pressable>;
}

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const tvLayout = width >= 800;
  const [page, setPage] = useState<Page>("Início");
  const [query, setQuery] = useState("");
  const [sourceList, setSourceList] = useState<Source[]>([]);
  const [items, setItems] = useState<MediaItem[]>(demoCatalog);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [kind, setKind] = useState<"m3u" | "xtream">("m3u");
  const [form, setForm] = useState({ name: "Minha fonte autorizada", url: "", username: "", password: "", epgUrl: "" });
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [parentalPin, setParentalPin] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [secureReady] = useState(Platform.OS !== "web");

  useEffect(() => { loadSources().then(setSourceList); loadFavorites().then(setFavorites); loadParentalPin().then(setParentalPin); }, []);
  const visible = useMemo(() => {
    let data = page === "Favoritos" ? items.filter((x) => favorites.includes(x.id)) : items;
    if (page === "Ao vivo") data = data.filter((x) => x.kind === "live");
    if (page === "Filmes") data = data.filter((x) => x.kind === "movie");
    if (page === "Séries") data = data.filter((x) => x.kind === "series");
    const q = query.trim().toLowerCase();
    return q ? data.filter((x) => `${x.title} ${x.category} ${x.description}`.toLowerCase().includes(q)) : data;
  }, [items, page, query, favorites]);
  const refresh = useCallback(async () => {
    setBusy(true); setNotice("");
    try {
      const lists = await Promise.all(sourceList.map((s) => s.kind === "m3u" ? fetchM3U(s) : fetchXtreamCatalog(s)));
      const merged = lists.flat(); setItems(merged.length ? merged : demoCatalog); setNotice(merged.length ? `Carregados ${merged.length} itens da(s) fonte(s).` : "A fonte não retornou itens; mantendo catálogo demonstrativo.");
    } catch (e) { setNotice(String((e as Error)?.message || "Não foi possível atualizar a fonte.")); }
    finally { setBusy(false); }
  }, [sourceList]);
  const toggleFavorite = async (id: string) => { const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id]; setFavorites(next); await saveFavorites(next); };
  const addSource = async () => {
    if (!form.name.trim() || !form.url.trim()) { setNotice("Informe o nome e a URL da fonte autorizada."); return; }
    if (kind === "xtream" && (!form.username.trim() || !form.password)) { setNotice("Preencha usuário e senha da sua fonte Xtream autorizada."); return; }
    const next: Source[] = [...sourceList, { id: `${Date.now()}`, name: form.name.trim(), url: form.url.trim(), kind, username: form.username.trim() || undefined, password: form.password || undefined, epgUrl: form.epgUrl.trim() || undefined }];
    if (Platform.OS === "web") { setNotice("No Preview web, as fontes ficam apenas nesta sessão. Use o build Android para armazenamento seguro no dispositivo."); }
    await saveSources(next); setSourceList(next); setForm({ ...form, name: `Fonte ${next.length + 1}`, url: "", username: "", password: "", epgUrl: "" }); setNotice("Fonte cadastrada localmente. Atualize para carregar o catálogo.");
  };
  const deleteSource = async (id: string) => { const next = sourceList.filter((s) => s.id !== id); setSourceList(next); await saveSources(next); };
  const setParental = async () => { if (newPin.length < 4) { setNotice("O PIN precisa ter ao menos 4 dígitos."); return; } if (!/^\d+$/.test(newPin)) { setNotice("Use somente números no PIN."); return; } await saveParentalPin(newPin); setParentalPin(newPin); setNewPin(""); setNotice("PIN parental salvo neste dispositivo."); };
  const unlockParental = () => { if (!parentalPin || pin === parentalPin) { setLocked(false); setPin(""); setNotice("Acesso liberado nesta sessão."); } else { setNotice("PIN incorreto."); } };
  const playItem = (item: MediaItem) => { if (locked && item.kind !== "live") { setNotice("Acesso protegido pelo controle parental."); return; } setSelected(item); };

  return <ScreenContainer style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ flex: 1, flexDirection: tvLayout ? "row" : "column", backgroundColor: C.bg }}>
      {tvLayout ? <View style={{ width: 205, padding: 22, borderRightWidth: 1, borderRightColor: C.line, backgroundColor: "#0A111B" }}><View style={{ flexDirection: "row", alignItems: "center", marginBottom: 34 }}><View style={{ width: 39, height: 39, backgroundColor: C.cyan, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 11 }}><Text style={{ color: C.bg, fontSize: 23, fontWeight: "900" }}>R</Text></View><Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>RAYZEN</Text></View>{PAGES.map((p) => <FocusButton key={p} label={p} active={page === p} onPress={() => { setPage(p); setQuery(""); }} />)}</View> : null}
      <View style={{ flex: 1, paddingHorizontal: tvLayout ? 34 : 18, paddingTop: tvLayout ? 24 : 14, paddingBottom: 22 }}>
        {!tvLayout ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}><View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 36, height: 36, backgroundColor: C.cyan, borderRadius: 11, alignItems: "center", justifyContent: "center", marginRight: 10 }}><Text style={{ color: C.bg, fontSize: 21, fontWeight: "900" }}>R</Text></View><Text style={{ color: C.text, fontSize: 18, fontWeight: "900" }}>RAYZEN IPTV</Text></View><FocusButton label="⚙" compact onPress={() => setPage("Ajustes")} /></View> : <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 12 }}><FocusButton label={locked ? "Desbloquear conteúdo" : "Bloquear conteúdo"} compact onPress={() => { if (!locked) { setLocked(true); setNotice("Conteúdo adulto protegido nesta sessão."); } else setNotice("Digite o PIN para liberar conteúdo protegido."); }} /></View>}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 12 }}><View><Text style={{ color: C.text, fontSize: tvLayout ? 30 : 27, fontWeight: "900" }}>{page}</Text><Text style={{ color: C.muted, marginTop: 4 }}>{items.some((x) => !x.demo) ? "Sua biblioteca autorizada" : "Modo demonstração · sem canais reais"}</Text></View>{page !== "Ajustes" ? <TextInput value={query} onChangeText={setQuery} placeholder="Buscar título ou categoria" placeholderTextColor="#7D91A6" style={{ color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, minWidth: 210, paddingHorizontal: 14, paddingVertical: 11, marginTop: 8 }} returnKeyType="search" /> : null}</View>
        <View style={{ height: 1, backgroundColor: C.line, marginBottom: 14 }} />
        {notice ? <Pressable onPress={() => setNotice("")} style={{ padding: 11, borderRadius: 10, backgroundColor: "#10282A", marginBottom: 12 }}><Text style={{ color: C.cyan }}>{notice}</Text></Pressable> : null}
        {!tvLayout ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, marginBottom: 10 }}>{PAGES.map((p) => <FocusButton key={p} label={p} active={page === p} compact onPress={() => { setPage(p); setQuery(""); }} />)}</ScrollView> : null}
        {page === "Ajustes" ? <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 5 }}>Fontes autorizadas</Text><Text style={{ color: C.muted, marginBottom: 15 }}>Adicione apenas playlists ou credenciais de provedores que você tem direito de acessar. Dados salvos no dispositivo.</Text><View style={{ flexDirection: "row", marginBottom: 8 }}><FocusButton label="M3U / M3U8" active={kind === "m3u"} compact onPress={() => setKind("m3u")} /><FocusButton label="Xtream Codes" active={kind === "xtream"} compact onPress={() => setKind("xtream")} /></View>
          {[{ key: "name", label: "Nome da fonte", placeholder: "Minha fonte autorizada" }, { key: "url", label: kind === "m3u" ? "URL da playlist" : "URL base do provedor", placeholder: kind === "m3u" ? "https://…/playlist.m3u" : "https://…", secure: false }, ...(kind === "xtream" ? [{ key: "username", label: "Usuário", placeholder: "Usuário do provedor", secure: false }, { key: "password", label: "Senha", placeholder: "Senha do provedor", secure: true }] : []), { key: "epgUrl", label: "URL opcional do EPG / XMLTV", placeholder: "https://…/epg.xml", secure: false }].map((f) => <View key={f.key} style={{ marginBottom: 10 }}><Text style={{ color: C.muted, marginBottom: 5 }}>{f.label}</Text><TextInput value={form[f.key as keyof typeof form]} onChangeText={(v) => setForm({ ...form, [f.key]: v })} placeholder={f.placeholder} placeholderTextColor="#74879C" secureTextEntry={"secure" in f && Boolean(f.secure)} autoCapitalize="none" style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: "#0A111A" }} /></View>)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}><FocusButton label="Salvar fonte" active onPress={addSource} /><FocusButton label={busy ? "Atualizando…" : "Atualizar catálogo"} onPress={refresh} /></View>{busy ? <ActivityIndicator color={C.cyan} style={{ marginTop: 10 }} /> : null}
          {sourceList.map((s) => <View key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.line, paddingTop: 12, marginTop: 12 }}><View style={{ flex: 1 }}><Text style={{ color: C.text, fontWeight: "700" }}>{s.name} · {s.kind.toUpperCase()}</Text><Text style={{ color: C.muted }} numberOfLines={1}>{s.url}</Text><Text style={{ color: C.muted, fontSize: 12 }}>EPG: {s.epgUrl ? "configurado (integração XMLTV pendente)" : "não configurado"}</Text></View><FocusButton label="Remover" compact onPress={() => deleteSource(s.id)} /></View>)}
          </View>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 5 }}>Controle parental</Text><Text style={{ color: C.muted, marginBottom: 12 }}>Defina um PIN local. O bloqueio da sessão precisa ser ativado ao sair ou compartilhar o aparelho.</Text><TextInput value={newPin} onChangeText={setNewPin} placeholder={parentalPin ? "Novo PIN de 4+ dígitos" : "Criar PIN de 4+ dígitos"} placeholderTextColor="#74879C" keyboardType="number-pad" secureTextEntry style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: "#0A111A", marginBottom: 10 }} /><FocusButton label="Salvar PIN" active onPress={setParental} />{parentalPin ? <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}><TextInput value={pin} onChangeText={setPin} placeholder="PIN para desbloquear" placeholderTextColor="#74879C" keyboardType="number-pad" secureTextEntry style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 11, backgroundColor: "#0A111A", flex: 1, marginRight: 8 }} /><FocusButton label="Desbloquear" onPress={unlockParental} /></View> : null}{!secureReady ? <Text style={{ color: C.lime, marginTop: 10 }}>Preview web: armazenamento seguro do PIN não está disponível. Use o build Android.</Text> : null}</View>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Privacidade & EPG</Text><Text style={{ color: C.muted, marginTop: 6 }}>O app não envia fontes a um servidor. URL de EPG fica salva para integração futura; sincronização de guia ainda depende do formato e da origem fornecida pelo provedor.</Text></View>
        </ScrollView> : <FlatList data={visible} keyExtractor={(x) => x.id} numColumns={tvLayout ? 3 : width > 620 ? 2 : 1} key={`${tvLayout ? "tv" : "mobile"}-${width > 620 ? 2 : 1}-${page}`} contentContainerStyle={{ paddingBottom: 30 }} columnWrapperStyle={tvLayout || width > 620 ? { gap: 12 } : undefined} ListEmptyComponent={<View style={{ padding: 20 }}><Text style={{ color: C.muted }}>{page === "Favoritos" ? "Seus favoritos aparecerão aqui." : "Nenhum item corresponde à busca."}</Text></View>} renderItem={({ item }) => <View style={{ flex: 1, maxWidth: tvLayout ? 380 : undefined, minWidth: tvLayout ? 230 : undefined, marginBottom: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 16 }}><View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}><View style={{ flex: 1, marginRight: 10 }}><Text style={{ color: C.cyan, fontSize: 11, letterSpacing: 1, fontWeight: "800" }}>{item.kind.toUpperCase()} · {item.category.toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 19, fontWeight: "800", marginTop: 7 }} numberOfLines={2}>{item.title}</Text></View><FocusButton compact label={favorites.includes(item.id) ? "★" : "☆"} onPress={() => toggleFavorite(item.id)} /></View><Text style={{ color: C.muted, marginTop: 9, lineHeight: 20 }} numberOfLines={3}>{item.description}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}><FocusButton label="▶ Assistir" active onPress={() => playItem(item)} /><FocusButton compact label="Detalhes" onPress={() => setNotice(`${item.title} · ${item.category}${item.demo ? " · Item de demonstração" : ""}`)} /></View></View>} />}
      </View>
    </View>
    <IptvPlayer item={selected} onClose={() => setSelected(null)} />
  </ScreenContainer>;
}
