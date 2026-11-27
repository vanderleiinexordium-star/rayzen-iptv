import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type MediaKind = "live" | "movie" | "series";
export type MediaItem = { id: string; title: string; kind: MediaKind; category: string; description: string; streamUrl: string; poster: string; demo: boolean };
export type Source = { id: string; name: string; kind: "m3u" | "xtream"; url: string; username?: string; password?: string; epgUrl?: string };
const DEMO_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
export const demoCatalog: MediaItem[] = [
  { id: "demo-live-1", title: "Canal de demonstração", kind: "live", category: "Demonstração", description: "Fluxo HLS público de teste; não é um canal de TV.", streamUrl: DEMO_HLS, poster: "linear-gradient", demo: true },
  { id: "demo-movie-1", title: "Cinema de demonstração", kind: "movie", category: "Demonstração", description: "Item ilustrativo. Conecte uma fonte autorizada para ver seu catálogo.", streamUrl: DEMO_HLS, poster: "linear-gradient", demo: true },
  { id: "demo-series-1", title: "Série de demonstração", kind: "series", category: "Demonstração", description: "Item ilustrativo. Não contém conteúdo comercial.", streamUrl: DEMO_HLS, poster: "linear-gradient", demo: true },
];

export function parseM3U(text: string): Array<Pick<MediaItem, "id" | "title" | "kind" | "category" | "streamUrl" | "description" | "poster" | "demo">> {
  // Percorre o texto linha a linha sem split/map, que duplicavam milhares de strings
  // e elevavam bastante o pico de memória em celulares com pouca RAM.
  const result: Array<Pick<MediaItem, "id" | "title" | "kind" | "category" | "streamUrl" | "description" | "poster" | "demo">> = [];
  let meta = "";
  let offset = 0;
  const maxItems = 12000;

  while (offset < text.length && result.length < maxItems) {
    const newline = text.indexOf("\n", offset);
    const end = newline === -1 ? text.length : newline;
    const line = text.slice(offset, end).trim().replace(/\r$/, "");
    offset = newline === -1 ? text.length : newline + 1;

    if (line.startsWith("#EXTINF:")) {
      meta = line;
      continue;
    }
    if (!line || line.startsWith("#") || !meta) continue;

    const comma = meta.indexOf(",");
    const title = (comma >= 0 ? meta.slice(comma + 1) : "").trim() || "Sem título";
    const group = meta.match(/group-title="([^"]*)"/i)?.[1] || "Outros";
    const tvgType = meta.match(/(?:tvg-)?type="(movie|series)"/i)?.[1]?.toLowerCase();
    const streamPath = line.toLowerCase();
    const normalizedGroup = group.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const normalizedTitle = title.toLowerCase();
    const looksLikeSeries = /\b(s\d{1,2}\s*e\d{1,2}|temporada\s*\d+|season\s*\d+|episodio\s*\d+)\b/i.test(normalizedTitle)
      || /\/series\//.test(streamPath)
      || /serie|seriado|series|tv show|episodios/.test(normalizedGroup);
    const looksLikeMovie = /\/movie\//.test(streamPath)
      || /filme|filmes|movie|movies|cinema|vod/.test(normalizedGroup);
    const kind: MediaKind = tvgType === "movie" ? "movie"
      : tvgType === "series" ? "series"
      : looksLikeSeries ? "series"
      : looksLikeMovie ? "movie"
      : "live";
    result.push({
      id: `m3u-${result.length}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title,
      kind,
      category: group,
      description: `Fonte M3U · ${group}`,
      streamUrl: line,
      poster: "linear-gradient",
      demo: false,
    });
    meta = "";
  }
  return result;
}

export async function saveSources(sources: Source[]) { const data = JSON.stringify(sources); if (Platform.OS === "web") await AsyncStorage.setItem("rayzen.sources.v1", data); else await SecureStore.setItemAsync("rayzen.sources.v1", data); }
export async function loadSources(): Promise<Source[]> { try { const data = Platform.OS === "web" ? await AsyncStorage.getItem("rayzen.sources.v1") : await SecureStore.getItemAsync("rayzen.sources.v1"); return JSON.parse(data || "[]") as Source[]; } catch { return []; } }
export async function loadFavorites(): Promise<string[]> { try { return JSON.parse((await AsyncStorage.getItem("rayzen.favorites.v1")) || "[]") as string[]; } catch { return []; } }
export async function saveFavorites(ids: string[]) { await AsyncStorage.setItem("rayzen.favorites.v1", JSON.stringify(ids)); }
export async function loadParentalPin(): Promise<string | null> { return Platform.OS === "web" ? AsyncStorage.getItem("rayzen.parental.pin.v1") : SecureStore.getItemAsync("rayzen.parental.pin.v1"); }
export async function saveParentalPin(pin: string) { if (Platform.OS === "web") await AsyncStorage.setItem("rayzen.parental.pin.v1", pin); else await SecureStore.setItemAsync("rayzen.parental.pin.v1", pin); }

export async function fetchXtreamCatalog(source: Source): Promise<MediaItem[]> {
  if (!source.username || !source.password) throw new Error("Informe usuário e senha do provedor autorizado.");
  const base = source.url.replace(/\/$/, "");
  const auth = `username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}`;
  const endpoints: Array<{ action: string; categoriesAction: string; kind: MediaKind }> = [
    { action: "get_live_streams", categoriesAction: "get_live_categories", kind: "live" },
    { action: "get_vod_streams", categoriesAction: "get_vod_categories", kind: "movie" },
    { action: "get_series", categoriesAction: "get_series_categories", kind: "series" },
  ];
  const all = await Promise.all(endpoints.map(async ({ action, categoriesAction, kind }) => {
    const [response, categoriesResponse] = await Promise.all([
      fetch(`${base}/player_api.php?${auth}&action=${action}`),
      fetch(`${base}/player_api.php?${auth}&action=${categoriesAction}`).catch(() => null),
    ]);
    if (!response.ok) throw new Error(`Provedor respondeu HTTP ${response.status}`);
    const json = await response.json() as Array<Record<string, unknown>>;
    const categoriesJson = categoriesResponse?.ok
      ? await categoriesResponse.json() as Array<Record<string, unknown>>
      : [];
    const categoryNames = new Map<string, string>();
    for (const categoryRow of categoriesJson) {
      const categoryId = String(categoryRow.category_id ?? "");
      const categoryName = String(categoryRow.category_name ?? "").trim();
      if (categoryId && categoryName) categoryNames.set(categoryId, categoryName);
    }
    return json.map((row, i): MediaItem => {
      const title = String(row.name || row.title || "Sem título");
      const id = String(row.stream_id || row.series_id || `${action}-${i}`);
      const categoryId = String(row.category_id ?? "");
      const category = String(row.category_name || categoryNames.get(categoryId) || "Outros");
      const synopsis = String(row.plot || row.overview || row.description || `Fonte Xtream · ${category}`);
      const ext = String(row.container_extension || "m3u8");
      const streamUrl = kind === "series" ? `${base}/series/${encodeURIComponent(source.username!)}/${encodeURIComponent(source.password!)}/${id}.${ext}` : `${base}/${kind === "live" ? "live" : "movie"}/${encodeURIComponent(source.username!)}/${encodeURIComponent(source.password!)}/${id}.${ext}`;
      return { id: `xt-${kind}-${id}`, title, kind, category, description: synopsis, streamUrl, poster: String(row.stream_icon || row.cover_big || row.movie_image || row.cover || "linear-gradient"), demo: false };
    });
  }));
  return all.flat();
}

export async function fetchM3U(source: Source): Promise<MediaItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(source.url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Playlist respondeu HTTP ${response.status}`);
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > 12 * 1024 * 1024) throw new Error("Playlist muito grande (limite de 12 MB). Peça ao provedor uma lista reduzida.");
    const body = await response.text();
    if (body.length > 12 * 1024 * 1024) throw new Error("Playlist muito grande (limite de 12 MB). Peça ao provedor uma lista reduzida.");
    return parseM3U(body) as MediaItem[];
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw new Error("Tempo esgotado ao baixar a playlist. Tente novamente.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
