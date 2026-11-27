import { useMemo, useState, useEffect, useCallback } from "react";
import { ActivityIndicator, FlatList, Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Ionicons } from "@expo/vector-icons";
import { IptvPlayer } from "@/components/iptv-player";
import { demoCatalog, fetchM3U, fetchXtreamCatalog, loadFavorites, loadParentalPin, loadSources, MediaItem, saveFavorites, saveParentalPin, saveSources, Source } from "@/lib/iptv";

const C = { bg: "#050A12", panel: "#0D1724", raised: "#142437", line: "#24384D", text: "#F5F8FC", muted: "#9AADC2", cyan: "#35E5C8", lime: "#62F36B", purple: "#9B83FF", danger: "#FF758F" };
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
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [showCategories, setShowCategories] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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
    if (["Ao vivo", "Filmes", "Séries"].includes(page) && categoryFilter) data = data.filter((x) => x.category === categoryFilter);
    const q = query.trim().toLowerCase();
    return q ? data.filter((x) => `${x.title} ${x.category} ${x.description}`.toLowerCase().includes(q)) : data;
  }, [items, page, query, favorites, categoryFilter]);
  const categoryKind = page === "Filmes" ? "movie" : page === "Séries" ? "series" : "live";
  const pageCategories = useMemo(() => Array.from(new Set(items.filter((x) => x.kind === categoryKind).map((x) => x.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [items, categoryKind]);
  const categoryItems = useMemo(() => items.filter((x) => x.kind === categoryKind), [items, categoryKind]);
  const dashboardCounts = useMemo(() => ({ live: items.filter((x) => x.kind === "live").length, movies: items.filter((x) => x.kind === "movie").length, series: items.filter((x) => x.kind === "series").length }), [items]);
  const refresh = useCallback(async () => {
    if (busy) return;
    setBusy(true); setNotice("Atualizando fontes uma por vez…");
    try {
      const merged: MediaItem[] = [];
      const errors: string[] = [];
      for (const source of sourceList) {
        try {
          const result = source.kind === "m3u" ? await fetchM3U(source) : await fetchXtreamCatalog(source);
          merged.push(...result.slice(0, Math.max(0, 20000 - merged.length)));
        } catch (e) {
          errors.push(`${source.name}: ${String((e as Error)?.message || "falha ao atualizar")}`);
        }
        if (merged.length >= 20000) break;
      }
      if (merged.length) {
        setItems(merged);
        setNotice(`Carregados ${merged.length} itens.${errors.length ? " Algumas fontes falharam: " + errors.join(" | ") : ""}`);
      } else if (errors.length) {
        setNotice(errors.join(" | "));
      } else {
        setItems(demoCatalog);
        setNotice("Nenhuma fonte cadastrada; mantendo catálogo demonstrativo.");
      }
    } finally { setBusy(false); }
  }, [sourceList, busy]);
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
      
      <View style={{ flex: 1, paddingHorizontal: tvLayout ? 34 : 18, paddingTop: tvLayout ? 12 : 14, paddingBottom: 12 }}>
        {!tvLayout ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: page === "Início" ? 12 : 20 }}><Pressable onPress={() => { setPage("Início"); setQuery(""); setCategoryFilter(""); setShowCategories(false); }} style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 42, height: 42, backgroundColor: "#102F32", borderRadius: 14, borderWidth: 1.5, borderColor: C.cyan, alignItems: "center", justifyContent: "center", marginRight: 10 }}><Text style={{ color: C.lime, fontSize: 22, fontWeight: "900" }}>▶</Text></View><View><Text style={{ color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 1 }}>RAYZEN IPTV</Text><Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1.5 }}>ENTRETENIMENTO</Text></View></Pressable><FocusButton label="⚙" compact onPress={() => setPage("Ajustes")} /></View> : <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flexWrap: "nowrap", marginBottom: 0 }}><FocusButton label={showMenu ? "✕ Fechar menu" : "☰ Menu"} compact active={showMenu} onPress={() => setShowMenu((v) => !v)} /><FocusButton label="＋ Adicionar lista" compact active onPress={() => { setPage("Ajustes"); setQuery(""); setCategoryFilter(""); setShowCategories(false); setShowMenu(false); }} /><FocusButton label={locked ? "Desbloquear" : "Bloquear"} compact onPress={() => { if (!locked) { setLocked(true); setNotice("Conteúdo adulto protegido nesta sessão."); } else setNotice("Digite o PIN para liberar conteúdo protegido."); }} /></View>}
        {tvLayout && showMenu ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 10, marginBottom: 8 }} contentContainerStyle={{ alignItems: "center", paddingRight: 8 }}>{PAGES.map((p) => <FocusButton key={p} label={p} active={page === p} compact onPress={() => { setPage(p); setQuery(""); setCategoryFilter(""); setShowCategories(false); setShowMenu(false); }} />)}</ScrollView> : null}
        {page !== "Início" ? <><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 6 }}><View><Text style={{ color: C.text, fontSize: tvLayout ? 25 : 27, fontWeight: "900" }}>{page}</Text><Text style={{ color: C.muted, marginTop: 2 }}>{items.some((x) => !x.demo) ? "Sua biblioteca autorizada" : "Modo demonstração · sem canais reais"}</Text></View>{page !== "Ajustes" ? <TextInput value={query} onChangeText={setQuery} placeholder="Buscar título ou categoria" placeholderTextColor="#7D91A6" style={{ color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 12, minWidth: 210, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 }} returnKeyType="search" /> : null}</View><View style={{ height: 1, backgroundColor: C.line, marginBottom: 7 }} /></> : null}
        {notice ? <Pressable onPress={() => setNotice("")} style={{ padding: 6, borderRadius: 10, backgroundColor: "#10282A", marginBottom: 7 }}><Text style={{ color: C.cyan }}>{notice}</Text></Pressable> : null}
        {!tvLayout && page !== "Início" ? <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          {([{ label: "CANAIS", page: "Ao vivo" as Page, icon: "▣", tint: C.lime }, { label: "FILMES", page: "Filmes" as Page, icon: "◉", tint: "#54B8FF" }, { label: "SÉRIES", page: "Séries" as Page, icon: "▤", tint: C.purple }]).map((tab) => <Pressable key={tab.page} onPress={() => { setPage(tab.page); setQuery(""); setCategoryFilter(""); setShowCategories(false); }} style={{ flex: 1, minHeight: 68, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: page === tab.page ? "#12302F" : C.panel, borderWidth: page === tab.page ? 1.5 : 1, borderColor: page === tab.page ? tab.tint : C.line }}><Text style={{ color: tab.tint, fontSize: 19, fontWeight: "900", marginBottom: 3 }}>{tab.icon}</Text><Text numberOfLines={1} style={{ color: page === tab.page ? C.text : C.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>{tab.label}</Text></Pressable>)}
        </View> : null}

        {page === "Início" ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <View><Text style={{ color: C.text, fontSize: tvLayout ? 27 : 23, fontWeight: "900" }}>Bem-vindo ao Rayzen</Text><Text style={{ color: C.muted, marginTop: 3 }}>Seu entretenimento em um só lugar</Text></View>
            <View style={{ paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, backgroundColor: "#102A30", borderWidth: 1, borderColor: C.cyan }}><Text style={{ color: C.cyan, fontSize: 11, fontWeight: "800" }}>● {items.some((x) => !x.demo) ? "CONECTADO" : "DEMO"}</Text></View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              { title: "TV AO VIVO", subtitle: dashboardCounts.live + " canais", icon: "tv-outline" as const, color: "#1749E8", page: "Ao vivo" as Page },
              { title: "FILMES", subtitle: dashboardCounts.movies + " títulos", icon: "play-circle-outline" as const, color: "#D92332", page: "Filmes" as Page },
              { title: "SÉRIES", subtitle: dashboardCounts.series + " títulos", icon: "film-outline" as const, color: "#16A83B", page: "Séries" as Page },
              { title: "FAVORITOS", subtitle: favorites.length + " salvos", icon: "heart-outline" as const, color: "#7629D9", page: "Favoritos" as Page },
              { title: "ADICIONAR LISTA", subtitle: "Configure sua fonte", icon: "add-circle-outline" as const, color: "#1878D5", page: "Ajustes" as Page },
              { title: "CONFIGURAÇÕES", subtitle: "Fontes e controle parental", icon: "settings-outline" as const, color: "#D98213", page: "Ajustes" as Page },
            ].map((tile) => <Pressable key={tile.title} onPress={() => { setPage(tile.page); setQuery(""); setCategoryFilter(""); setShowCategories(false); }} style={({ pressed }) => ({ width: tvLayout ? "31.8%" : width > 560 ? "48.5%" : "48%", minHeight: tvLayout ? 126 : 112, flexGrow: 1, borderRadius: 17, padding: tvLayout ? 16 : 12, backgroundColor: tile.color, justifyContent: "space-between", opacity: pressed ? 0.82 : 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" })}>
              <View style={{ width: 42, height: 42, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Ionicons name={tile.icon} size={24} color="#FFFFFF" /></View>
              <View><Text style={{ color: "#FFFFFF", fontSize: tvLayout ? 15 : 12, fontWeight: "900", letterSpacing: 0.5 }}>{tile.title}</Text><Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 11, marginTop: 3 }}>{tile.subtitle}</Text></View>
            </Pressable>)}
          </View>
          <View style={{ marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, padding: 14 }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: "900", marginBottom: 11 }}>RESUMO DA BIBLIOTECA</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[{ label: "CANAIS", value: dashboardCounts.live, tint: C.lime }, { label: "FILMES", value: dashboardCounts.movies, tint: "#FF6578" }, { label: "SÉRIES", value: dashboardCounts.series, tint: C.cyan }, { label: "FAVORITOS", value: favorites.length, tint: "#B18BFF" }].map((stat) => <View key={stat.label} style={{ flex: 1, minWidth: 95, padding: 10, borderRadius: 11, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line }}><Text style={{ color: stat.tint, fontSize: 10, fontWeight: "800" }}>{stat.label}</Text><Text style={{ color: C.text, fontSize: 20, fontWeight: "900", marginTop: 3 }}>{stat.value.toLocaleString("pt-BR")}</Text></View>)}
            </View>
          </View>
          <Pressable onPress={() => { if (sourceList.length) void refresh(); else setPage("Ajustes"); }} style={{ marginTop: 12, borderRadius: 14, padding: 13, backgroundColor: "#252B78", borderWidth: 1, borderColor: "#7777FF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}><Ionicons name="refresh-circle-outline" size={24} color="#FFFFFF" /><View style={{ marginLeft: 9 }}><Text style={{ color: "#FFFFFF", fontWeight: "900" }}>ATUALIZAR BIBLIOTECA</Text><Text style={{ color: "#D6D9FF", fontSize: 11, marginTop: 2 }}>{busy ? "Atualizando fontes…" : "Sincronize seus canais e conteúdos"}</Text></View></View><Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </ScrollView> : null}
        {["Ao vivo", "Filmes", "Séries"].includes(page) ? <View style={{ marginBottom: 8 }}>
          <Pressable onPress={() => setShowCategories((v) => !v)} style={{ minHeight: 42, borderRadius: 13, borderWidth: 1.5, borderColor: showCategories || categoryFilter ? C.cyan : C.line, backgroundColor: C.panel, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontSize: 14, fontWeight: "800" }}>☷  CATEGORIAS · {categoryFilter || "TODAS"}</Text>
            <Text style={{ color: C.cyan, fontSize: 18, fontWeight: "900" }}>{showCategories ? "⌃" : "⌄"}</Text>
          </Pressable>
          {showCategories ? <ScrollView style={{ marginTop: 8, height: tvLayout ? 210 : 190, flexGrow: 0, flexShrink: 0, borderRadius: 13, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }} contentContainerStyle={{ padding: 10, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" }} nestedScrollEnabled scrollEnabled={true} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator persistentScrollbar>
            <FocusButton label={"Todas (" + categoryItems.length + ")"} compact active={!categoryFilter} onPress={() => { setCategoryFilter(""); setShowCategories(false); }} />
            {pageCategories.map((category) => <FocusButton key={category} label={category + " (" + categoryItems.filter((x) => x.category === category).length + ")"} compact active={categoryFilter === category} onPress={() => { setCategoryFilter(category); setShowCategories(false); }} />)}
          </ScrollView> : null}
        </View> : null}
        {page === "Ajustes" ? <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 56 }} showsVerticalScrollIndicator>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 5 }}>Fontes autorizadas</Text><Text style={{ color: C.muted, marginBottom: 15 }}>Adicione apenas playlists ou credenciais de provedores que você tem direito de acessar. Dados salvos no dispositivo.</Text><View style={{ flexDirection: "row", marginBottom: 8 }}><FocusButton label="M3U / M3U8" active={kind === "m3u"} compact onPress={() => setKind("m3u")} /><FocusButton label="Xtream Codes" active={kind === "xtream"} compact onPress={() => setKind("xtream")} /></View>
          {[{ key: "name", label: "Nome da fonte", placeholder: "Minha fonte autorizada" }, { key: "url", label: kind === "m3u" ? "URL da playlist" : "URL base do provedor", placeholder: kind === "m3u" ? "https://…/playlist.m3u" : "https://…", secure: false }, ...(kind === "xtream" ? [{ key: "username", label: "Usuário", placeholder: "Usuário do provedor", secure: false }, { key: "password", label: "Senha", placeholder: "Senha do provedor", secure: true }] : []), { key: "epgUrl", label: "URL opcional do EPG / XMLTV", placeholder: "https://…/epg.xml", secure: false }].map((f) => <View key={f.key} style={{ marginBottom: 10 }}><Text style={{ color: C.muted, marginBottom: 5 }}>{f.label}</Text><TextInput value={form[f.key as keyof typeof form]} onChangeText={(v) => setForm({ ...form, [f.key]: v })} placeholder={f.placeholder} placeholderTextColor="#74879C" secureTextEntry={"secure" in f && Boolean(f.secure)} autoCapitalize="none" style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: "#0A111A" }} /></View>)}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}><FocusButton label="Salvar fonte" active onPress={addSource} /><FocusButton label={busy ? "Atualizando…" : "Atualizar catálogo"} active={busy} onPress={() => { if (!busy) void refresh(); }} /></View>{busy ? <ActivityIndicator color={C.cyan} style={{ marginTop: 10 }} /> : null}
          {sourceList.map((s) => <View key={s.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderColor: C.line, paddingTop: 12, marginTop: 12 }}><View style={{ flex: 1 }}><Text style={{ color: C.text, fontWeight: "700" }}>{s.name} · {s.kind.toUpperCase()}</Text><Text style={{ color: C.muted }} numberOfLines={1}>{s.url}</Text><Text style={{ color: C.muted, fontSize: 12 }}>EPG: {s.epgUrl ? "configurado (integração XMLTV pendente)" : "não configurado"}</Text></View><FocusButton label="Remover" compact onPress={() => deleteSource(s.id)} /></View>)}
          </View>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16, marginBottom: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 5 }}>Controle parental</Text><Text style={{ color: C.muted, marginBottom: 12 }}>Defina um PIN local. O bloqueio da sessão precisa ser ativado ao sair ou compartilhar o aparelho.</Text><TextInput value={newPin} onChangeText={setNewPin} placeholder={parentalPin ? "Novo PIN de 4+ dígitos" : "Criar PIN de 4+ dígitos"} placeholderTextColor="#74879C" keyboardType="number-pad" secureTextEntry style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 12, backgroundColor: "#0A111A", marginBottom: 10 }} /><FocusButton label="Salvar PIN" active onPress={setParental} />{parentalPin ? <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center" }}><TextInput value={pin} onChangeText={setPin} placeholder="PIN para desbloquear" placeholderTextColor="#74879C" keyboardType="number-pad" secureTextEntry style={{ color: C.text, borderColor: C.line, borderWidth: 1, borderRadius: 10, padding: 11, backgroundColor: "#0A111A", flex: 1, marginRight: 8 }} /><FocusButton label="Desbloquear" onPress={unlockParental} /></View> : null}{!secureReady ? <Text style={{ color: C.lime, marginTop: 10 }}>Preview web: armazenamento seguro do PIN não está disponível. Use o build Android.</Text> : null}</View>
          <View style={{ padding: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 16 }}><Text style={{ color: C.text, fontSize: 18, fontWeight: "800" }}>Privacidade & EPG</Text><Text style={{ color: C.muted, marginTop: 6 }}>O app não envia fontes a um servidor. URL de EPG fica salva para integração futura; sincronização de guia ainda depende do formato e da origem fornecida pelo provedor.</Text></View>
        </ScrollView> : page !== "Início" ? <FlatList style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled showsVerticalScrollIndicator data={visible} keyExtractor={(x) => x.id} numColumns={tvLayout ? 3 : width > 620 ? 2 : 1} key={`${tvLayout ? "tv" : "mobile"}-${width > 620 ? 2 : 1}-${page}`} contentContainerStyle={{ paddingBottom: 30 }} columnWrapperStyle={tvLayout || width > 620 ? { gap: 12 } : undefined} ListEmptyComponent={<View style={{ padding: 20 }}><Text style={{ color: C.muted }}>{page === "Favoritos" ? "Seus favoritos aparecerão aqui." : "Nenhum item corresponde à busca."}</Text></View>} renderItem={({ item }) => <View style={{ flex: 1, maxWidth: tvLayout ? 380 : undefined, minWidth: tvLayout ? 230 : undefined, marginBottom: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 16 }}>{(item.kind === "movie" || item.kind === "series") && item.poster && item.poster !== "linear-gradient" ? <Image source={{ uri: item.poster }} resizeMode="cover" style={{ width: "100%", height: tvLayout ? 210 : 190, borderRadius: 12, backgroundColor: C.raised, marginBottom: 12 }} /> : null}<View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}><View style={{ flex: 1, marginRight: 10 }}><Text style={{ color: C.cyan, fontSize: 11, letterSpacing: 1, fontWeight: "800" }}>{item.kind.toUpperCase()} · {item.category.toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 19, fontWeight: "800", marginTop: 7 }} numberOfLines={2}>{item.title}</Text></View><FocusButton compact label={favorites.includes(item.id) ? "★" : "☆"} onPress={() => toggleFavorite(item.id)} /></View><Text style={{ color: C.muted, marginTop: 9, lineHeight: 20 }} numberOfLines={3}>{item.description}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}><FocusButton label="▶ Assistir" active onPress={() => playItem(item)} /><FocusButton compact label="Detalhes" onPress={() => setNotice(`${item.title} · ${item.category}${item.demo ? " · Item de demonstração" : ""}`)} /></View></View>} /> : null}
      </View>
    </View>
    <IptvPlayer item={selected} onClose={() => setSelected(null)} />
  </ScreenContainer>;
}
