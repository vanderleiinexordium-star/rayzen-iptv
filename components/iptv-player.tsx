import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import type { MediaItem } from "@/lib/iptv";

const palette = { bg: "#070B13", text: "#F4F7FB", muted: "#9BAEC2", cyan: "#3BE7D4", danger: "#FF758F" };

/** Player boundary: replace this adapter when another media engine is selected. */
export function IptvPlayer({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const player = useVideoPlayer(null, (p) => { p.loop = false; });
  const [error, setError] = useState("");
  const [closeFocused, setCloseFocused] = useState(false);
  useEffect(() => {
    if (!item) return;
    player.replaceAsync(item.streamUrl).then(() => { setError(""); player.play(); }).catch((e) => setError(String(e?.message || "Não foi possível abrir este fluxo.")));
  }, [item, player]);
  useEffect(() => () => { player.pause(); }, [player]);
  if (!item) return null;
  return <Modal visible animationType="fade" supportedOrientations={["portrait", "landscape"]} onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", padding: 18 }}>
      <VideoView player={player} style={{ width: "100%", maxWidth: 1200, aspectRatio: 16 / 9, alignSelf: "center", backgroundColor: "#101722" }} nativeControls contentFit="contain" />
      <View style={{ maxWidth: 1200, width: "100%", alignSelf: "center", marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontSize: 19, fontWeight: "800" }}>{item.title}</Text><Text style={{ color: palette.muted, marginTop: 4 }}>{item.demo ? "Demonstração de HLS — sem conteúdo de TV" : item.category}</Text>{error ? <Text style={{ color: palette.danger, marginTop: 8 }}>{error}</Text> : null}</View>
        <Pressable onPress={onClose} onFocus={() => setCloseFocused(true)} onBlur={() => setCloseFocused(false)} style={{ paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12, borderWidth: closeFocused ? 2 : 1, borderColor: closeFocused ? palette.cyan : "#26364B", backgroundColor: palette.bg }}><Text style={{ color: closeFocused ? palette.cyan : palette.text, fontWeight: "700" }}>Fechar</Text></Pressable>
      </View>
    </View>
  </Modal>;
}
