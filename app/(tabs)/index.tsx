import { useMemo, useState, useEffect, useCallback } from "react";
import { ActivityIndicator, FlatList, SectionList, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Ionicons } from "@expo/vector-icons";
import { IptvPlayer } from "@/components/iptv-player";
import { demoCatalog, fetchM3U, fetchSeriesEpisodes, fetchXtreamCatalog, loadFavorites, loadParentalPin, loadSources, MediaItem, saveFavorites, saveParentalPin, saveSources, Source } from "@/lib/iptv";

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
  const [seriesSelected, setSeriesSelected] = useState<MediaItem | null>(null);
  const [episodes, setEpisodes] = useState<MediaItem[]>([]);
  const [episodesBusy, setEpisodesBusy] = useState(false);
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
  const groupedVisible = useMemo(() => {
    const groups = new Map<string, MediaItem[]>();
    for (const item of visible) {
      const category = item.category?.trim() || "Outros";
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(item);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([title, data]) => ({ title, data }));
  }, [visible]);
  const refresh = useCallback(async () => {
    if (busy) return;
    setBusy(true); setNotice("Atualizando fontes uma por vez…");
    try {
      const buckets: Record<MediaItem["kind"], MediaItem[]> = { live: [], movie: [], series: [] };
      const errors: string[] = [];
      for (const source of sourceList) {
        try {
          const result = source.kind === "m3u" ? await fetchM3U(source) : await fetchXtreamCatalog(source);
          for (const item of result) {
            const bucket = buckets[item.kind];
            if (bucket.length < 20000) bucket.push(item);
          }
        } catch (e) {
          errors.push(`${source.name}: ${String((e as Error)?.message || "falha ao atualizar")}`);
        }
      }
      // Distribui o limite entre os tipos para que um catálogo grande de filmes
      // não ocupe os 20 mil lugares e esconda todas as séries.
      const merged: MediaItem[] = [];
      const positions = { live: 0, movie: 0, series: 0 };
      const kinds: MediaItem["kind"][] = ["live", "movie", "series"];
      while (merged.length < 20000) {
        let added = false;
        for (const mediaKind of kinds) {
          const next = buckets[mediaKind][positions[mediaKind]];
          if (next && merged.length < 20000) {
            merged.push(next);
            positions[mediaKind] += 1;
            added = true;
          }
        }
        if (!added) break;
      }
      if (merged.length) {
        setItems(merged);
        setNotice(`Carregados ${merged.length} itens · ${buckets.live.length} canais · ${buckets.movie.length} filmes · ${buckets.series.length} séries.${errors.length ? " Algumas fontes falharam: " + errors.join(" | ") : ""}`);
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
  const playItem = async (item: MediaItem) => {
    if (locked && item.kind !== "live") { setNotice("Acesso protegido pelo controle parental."); return; }
    if (item.kind === "series" && item.seriesInfoUrl) {
      setSeriesSelected(item); setEpisodes([]); setEpisodesBusy(true);
      try {
        const found = await fetchSeriesEpisodes(item);
        setEpisodes(found);
        if (!found.length) setNotice("O provedor não retornou episódios para esta série.");
      } catch (e) {
        setNotice(`Não foi possível carregar os episódios: ${String((e as Error)?.message || "erro desconhecido")}`);
      } finally { setEpisodesBusy(false); }
      return;
    }
    setSelected(item);
  };

  return <ScreenContainer style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={{ flex: 1, flexDirection: tvLayout ? "row" : "column", backgroundColor: C.bg }}>
      
      <View style={{ flex: 1, paddingHorizontal: tvLayout ? 24 : 18, paddingTop: tvLayout ? 6 : 14, paddingBottom: 12 }}>
        {!tvLayout ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: page === "Início" ? 12 : 20 }}><Pressable onPress={() => { setPage("Início"); setQuery(""); setCategoryFilter(""); setShowCategories(false); }} style={{ flexDirection: "row", alignItems: "center" }}><View style={{ width: 42, height: 42, backgroundColor: "#102F32", borderRadius: 14, borderWidth: 1.5, borderColor: C.cyan, alignItems: "center", justifyContent: "center", marginRight: 10 }}><Text style={{ color: C.lime, fontSize: 22, fontWeight: "900" }}>▶</Text></View><View><Text style={{ color: C.text, fontSize: 19, fontWeight: "900", letterSpacing: 1 }}>RAYZEN IPTV</Text><Text style={{ color: C.muted, fontSize: 10, letterSpacing: 1.5 }}>ENTRETENIMENTO</Text></View></Pressable><FocusButton label="⚙" compact onPress={() => setPage("Ajustes")} /></View> : <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", flexWrap: "nowrap", marginBottom: 0 }}><FocusButton label={showMenu ? "✕ Fechar menu" : "☰ Menu"} compact active={showMenu} onPress={() => setShowMenu((v) => !v)} /><FocusButton label="＋ Adicionar lista" compact active onPress={() => { setPage("Ajustes"); setQuery(""); setCategoryFilter(""); setShowCategories(false); setShowMenu(false); }} /><FocusButton label={locked ? "Desbloquear" : "Bloquear"} compact onPress={() => { if (!locked) { setLocked(true); setNotice("Conteúdo adulto protegido nesta sessão."); } else setNotice("Digite o PIN para liberar conteúdo protegido."); }} /></View>}
        {tvLayout && showMenu ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 10, marginBottom: 8 }} contentContainerStyle={{ alignItems: "center", paddingRight: 8 }}>{PAGES.map((p) => <FocusButton key={p} label={p} active={page === p} compact onPress={() => { setPage(p); setQuery(""); setCategoryFilter(""); setShowCategories(false); setShowMenu(false); }} />)}</ScrollView> : null}
        {page !== "Início" ? <><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: tvLayout ? 3 : 6 }}><View><Text style={{ color: C.text, fontSize: tvLayout ? 22 : 27, fontWeight: "900" }}>{page}</Text><Text style={{ color: C.muted, marginTop: 2 }}>{items.some((x) => !x.demo) ? "Sua biblioteca autorizada" : "Modo demonstração · sem canais reais"}</Text></View>{page !== "Ajustes" ? <TextInput value={query} onChangeText={setQuery} placeholder="Buscar título ou categoria" placeholderTextColor="#7D91A6" style={{ color: C.text, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1, borderRadius: 10, minWidth: 210, paddingHorizontal: 12, paddingVertical: tvLayout ? 4 : 7, marginTop: 2 }} returnKeyType="search" /> : null}</View><View style={{ height: 1, backgroundColor: C.line, marginBottom: tvLayout ? 4 : 7 }} /></> : null}
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
            ].map((tile) => <Pressable key={tile.title} onPress={() => { setPage(tile.page); setQuery(""); setCategoryFilter(""); setShowCategories(false); }} style={({ pressed }) => ({ width: tvLayout ? "31.8%" : width > 560 ? "48.5%" : "48%", height: tvLayout ? 88 : 82, minHeight: tvLayout ? 88 : 82, flexGrow: 0, borderRadius: 14, padding: tvLayout ? 10 : 9, backgroundColor: tile.color, justifyContent: "space-between", opacity: pressed ? 0.82 : 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" })}>
              <View style={{ width: 30, height: 30, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}><Ionicons name={tile.icon} size={18} color="#FFFFFF" /></View>
              <View><Text style={{ color: "#FFFFFF", fontSize: tvLayout ? 12 : 11, fontWeight: "900", letterSpacing: 0.5 }}>{tile.title}</Text><Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 9, marginTop: 2 }}>{tile.subtitle}</Text></View>
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
        {["Ao vivo", "Filmes", "Séries"].includes(page) ? <View style={{ marginBottom: tvLayout ? 4 : 8 }}>
          <Pressable onPress={() => setShowCategories((v) => !v)} style={{ minHeight: tvLayout ? 36 : 42, borderRadius: 11, borderWidth: 1.5, borderColor: showCategories || categoryFilter ? C.cyan : C.line, backgroundColor: C.panel, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: C.text, fontSize: tvLayout ? 12 : 14, fontWeight: "800" }}>☷  CATEGORIAS · {categoryFilter || "TODAS"}</Text>
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
        </ScrollView> : page !== "Início" ? <SectionList style={{ flex: 1, minHeight: 0 }} nestedScrollEnabled showsVerticalScrollIndicator sections={groupedVisible} keyExtractor={(x) => x.id} stickySectionHeadersEnabled={false} contentContainerStyle={{ paddingBottom: 30 }} ListEmptyComponent={<View style={{ padding: 20 }}><Text style={{ color: C.muted }}>{page === "Favoritos" ? "Seus favoritos aparecerão aqui." : "Nenhum item corresponde à busca."}</Text></View>} renderSectionHeader={({ section }) => <View style={{ paddingVertical: 9, paddingHorizontal: 12, marginTop: 7, marginBottom: 8, borderRadius: 10, backgroundColor: "#102A30", borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: C.cyan, fontSize: 13, fontWeight: "900" }}>{section.title.toUpperCase()}</Text><Text style={{ color: C.muted, fontSize: 11, fontWeight: "700" }}>{section.data.length} itens</Text></View>} renderItem={({ item }) => <View style={{ flex: 1, maxWidth: tvLayout ? 220 : width > 620 ? 300 : undefined, minWidth: 0, marginBottom: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: tvLayout ? 8 : 12 }}>{(item.kind === "movie" || item.kind === "series") && item.poster && item.poster !== "linear-gradient" ? <Image source={{ uri: item.poster }} resizeMode="cover" style={{ width: "100%", height: tvLayout ? 105 : width > 620 ? 125 : 150, borderRadius: 10, backgroundColor: C.raised, marginBottom: tvLayout ? 7 : 12 }} /> : null}<View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}><View style={{ flex: 1, marginRight: 10 }}><Text style={{ color: C.cyan, fontSize: tvLayout ? 9 : 11, letterSpacing: 0.7, fontWeight: "800" }}>{item.kind.toUpperCase()} · {item.category.toUpperCase()}</Text><Text style={{ color: C.text, fontSize: tvLayout ? 14 : 19, fontWeight: "800", marginTop: tvLayout ? 3 : 7 }} numberOfLines={2}>{item.title}</Text></View><FocusButton compact label={favorites.includes(item.id) ? "★" : "☆"} onPress={() => toggleFavorite(item.id)} /></View><Text style={{ color: C.muted, marginTop: tvLayout ? 4 : 9, lineHeight: tvLayout ? 15 : 20 }} numberOfLines={tvLayout ? 2 : 3}>{item.description}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: tvLayout ? 5 : 12 }}><FocusButton label="▶ Assistir" active onPress={() => playItem(item)} /><FocusButton compact label="Detalhes" onPress={() => setNotice(`${item.title} · ${item.category}${item.demo ? " · Item de demonstração" : ""}`)} /></View></View>} /> : null}
      </View>
    </View>
    <Modal visible={!!seriesSelected} animationType="slide" supportedOrientations={["portrait", "landscape"]} onRequestClose={() => setSeriesSelected(null)}>
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 22, paddingTop: 30 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{seriesSelected?.title || "Episódios"}</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>{episodes.length} episódios disponíveis</Text>
          </View>
          <FocusButton label="Fechar" compact onPress={() => setSeriesSelected(null)} />
        </View>
        {episodesBusy ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator size="large" color={C.cyan} /><Text style={{ color: C.muted, marginTop: 12 }}>Carregando temporadas e episódios…</Text></View> : episodes.length ? <FlatList data={episodes} keyExtractor={(ep) => ep.id} contentContainerStyle={{ paddingBottom: 24 }} renderItem={({ item: ep }) => <Pressable onPress={() => { setSeriesSelected(null); setSelected(ep); }} style={{ padding: 16, marginBottom: 9, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel }}><Text style={{ color: C.cyan, fontWeight: "800", fontSize: 12 }}>{ep.category.toUpperCase()}</Text><Text style={{ color: C.text, fontSize: 16, fontWeight: "700", marginTop: 5 }}>{ep.title}</Text>{ep.description ? <Text numberOfLines={2} style={{ color: C.muted, marginTop: 5 }}>{ep.description}</Text> : null}<Text style={{ color: C.lime, marginTop: 8, fontWeight: "800" }}>▶ Reproduzir episódio</Text></Pressable>} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: C.muted, textAlign: "center" }}>Não foi possível encontrar episódios. Verifique se sua fonte Xtream fornece os detalhes desta série.</Text></View>}
      </View>
    </Modal>
    <IptvPlayer item={selected} onClose={() => setSelected(null)} />
  </ScreenContainer>;
}
