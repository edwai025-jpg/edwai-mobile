import { Feather } from "@expo/vector-icons";
import { File as FSFile } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Colors } from "@/constants/colors";
import { clampPhotoOffset, getPhotoCrop } from "@/services/profilePhotoCrop";

type Props = {
  asset: ImagePickerAsset | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (asset: ImagePickerAsset) => Promise<boolean>;
  embedded?: boolean;
  closeRequestRef?: Ref<ProfilePhotoCropHandle>;
};
export type ProfilePhotoCropHandle = { requestClose: () => void };

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const MAX_VIEWPORT = 320;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

function touchDistance(e: GestureResponderEvent): number | null {
  const t = e.nativeEvent.touches;
  if (!t || t.length < 2) return null;
  return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
}

export default function ProfilePhotoCropModal({ asset, busy, onCancel, onSave, embedded = false, closeRequestRef }: Props) {
  const { width: winW } = useWindowDimensions();
  const viewport = Math.max(160, Math.min(MAX_VIEWPORT, winW - 88));

  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [encoding, setEncoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const locked = busy || encoding;

  // Live refs for PanResponder (created once).
  const st = useRef({ dims, zoom, offset, viewport, locked });
  st.current = { dims, zoom, offset, viewport, locked };
  const requestClose = () => {
    if (!st.current.locked && !savingRef.current) onCancel();
  };
  useImperativeHandle(closeRequestRef, () => ({ requestClose }));

  // Reset everything for each new asset.
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
    setEncoding(false);
    savingRef.current = false;
    if (!asset) { setDims(null); return; }
    if (asset.width > 0 && asset.height > 0) { setDims({ w: asset.width, h: asset.height }); return; }
    setDims(null);
    let alive = true;
    Image.getSize(
      asset.uri,
      (w, h) => { if (alive) setDims({ w, h }); },
      () => { if (alive) setError("Could not load this image. Please choose another photo."); },
    );
    return () => { alive = false; };
  }, [asset]);

  const applyZoom = (z: number) => {
    const { dims: d, offset: o, viewport: vp } = st.current;
    const nz = clampZoom(z);
    setZoom(nz);
    if (d) setOffset(clampPhotoOffset(d.w, d.h, vp, nz, o.x, o.y));
  };

  const gesture = useRef({ startX: 0, startY: 0, startDist: 0, startZoom: 1 });
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !st.current.locked && !!st.current.dims,
    onMoveShouldSetPanResponder: () => !st.current.locked && !!st.current.dims,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e) => {
      const g = gesture.current;
      g.startX = st.current.offset.x; g.startY = st.current.offset.y;
      g.startDist = touchDistance(e) ?? 0; g.startZoom = st.current.zoom;
    },
    onPanResponderMove: (e, gs) => {
      const { dims: d, viewport: vp, locked: l } = st.current;
      if (l || !d) return;
      const g = gesture.current;
      const dist = touchDistance(e);
      if (dist) {
        if (!g.startDist) { g.startDist = dist; g.startZoom = st.current.zoom; return; }
        const nz = clampZoom(g.startZoom * (dist / g.startDist));
        setZoom(nz);
        setOffset(clampPhotoOffset(d.w, d.h, vp, nz, st.current.offset.x, st.current.offset.y));
        return;
      }
      if (g.startDist) {
        // Pinch ended mid-gesture; rebase drag.
        g.startDist = 0; g.startX = st.current.offset.x - gs.dx; g.startY = st.current.offset.y - gs.dy;
      }
      setOffset(clampPhotoOffset(d.w, d.h, vp, st.current.zoom, g.startX + gs.dx, g.startY + gs.dy));
    },
  }), []);

  const trackW = viewport - 80;
  const trackPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !st.current.locked,
    onMoveShouldSetPanResponder: () => !st.current.locked,
    onPanResponderGrant: (e) => setFromTrack(e.nativeEvent.locationX),
    onPanResponderMove: (e) => setFromTrack(e.nativeEvent.locationX),
  }), []);
  const trackWRef = useRef(trackW);
  trackWRef.current = trackW;
  function setFromTrack(x: number) {
    if (st.current.locked) return;
    const ratio = Math.min(1, Math.max(0, x / Math.max(1, trackWRef.current)));
    applyZoom(MIN_ZOOM + ratio * (MAX_ZOOM - MIN_ZOOM));
  }

  // Keep offset valid when viewport changes (rotation/resize).
  useEffect(() => {
    if (dims) setOffset((o) => clampPhotoOffset(dims.w, dims.h, viewport, zoom, o.x, o.y));
  }, [viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!asset || !dims || savingRef.current || busy) return;
    savingRef.current = true;
    setEncoding(true);
    setError(null);
    let generatedUri: string | null = null;
    let produced: ImagePickerAsset | null = null;
    try {
      const c = getPhotoCrop(dims.w, dims.h, viewport, zoom, offset.x, offset.y);
      const originX = Math.max(0, Math.min(dims.w - 1, Math.round(c.originX)));
      const originY = Math.max(0, Math.min(dims.h - 1, Math.round(c.originY)));
      const size = Math.max(1, Math.min(Math.round(Math.min(c.width, c.height)), dims.w - originX, dims.h - originY));
      const result = await manipulateAsync(
        asset.uri,
        [{ crop: { originX, originY, width: size, height: size } }],
        { compress: 0.92, format: SaveFormat.JPEG },
      );
      generatedUri = result.uri;
      let fileSize: number | undefined;
      let file: globalThis.File | undefined;
      if (Platform.OS === "web") {
        const blob = await (await fetch(result.uri)).blob();
        file = new globalThis.File([blob], "photo.jpg", { type: "image/jpeg" });
        fileSize = blob.size;
      } else {
        const s = new FSFile(result.uri).size;
        fileSize = typeof s === "number" && s > 0 ? s : undefined;
      }
      if (!fileSize) throw new Error("empty");
      produced = {
        uri: result.uri,
        width: result.width,
        height: result.height,
        type: "image",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize,
        ...(file ? { file } : {}),
      };
    } catch {
      setError("Could not prepare this photo. Try again or choose a different image.");
    }

    try {
      if (produced && !await onSave(produced)) {
        setError("Could not confirm this photo was saved. Check your current photo before trying again.");
      }
    } catch {
      setError("Could not confirm this photo was saved. Check your current photo before trying again.");
    } finally {
      if (generatedUri && generatedUri !== asset.uri) {
        if (Platform.OS === "web") {
          if (generatedUri.startsWith("blob:")) {
            try { URL.revokeObjectURL(generatedUri); } catch { /* ignore */ }
          }
        } else {
          try { const f = new FSFile(generatedUri); if (f.exists) f.delete(); } catch { /* ignore */ }
        }
      }
      savingRef.current = false;
      setEncoding(false);
    }
  };

  const base = dims ? Math.max(viewport / dims.w, viewport / dims.h) : 1;
  const imgW = dims ? dims.w * base * zoom : viewport;
  const imgH = dims ? dims.h * base * zoom : viewport;
  const pct = (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM);

  const content = (
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.titleRow}>
            <Text style={s.title} accessibilityRole="header">Crop Photo</Text>
            <Pressable style={[s.closeBtn, locked && s.disabled]} onPress={onCancel} disabled={locked} hitSlop={10}
              accessibilityRole="button" accessibilityLabel="Cancel" testID="crop-close">
              <Feather name="x" size={18} color={Colors.darkTextMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.body} scrollEnabled showsVerticalScrollIndicator={false} bounces={false}>
            <Text style={s.hint}>Drag to reposition · Pinch to zoom</Text>

            <View style={[s.stage, { width: viewport, height: viewport }]} {...pan.panHandlers}
              accessibilityLabel="Photo crop area" testID="crop-area">
              {asset && dims ? (
                <Image
                  source={{ uri: asset.uri }}
                  style={{
                    position: "absolute",
                    width: imgW,
                    height: imgH,
                    left: (viewport - imgW) / 2,
                    top: (viewport - imgH) / 2,
                    transform: [{ translateX: offset.x }, { translateY: offset.y }],
                  }}
                  resizeMode="stretch"
                  onError={() => setError("Could not load this image. Please choose another photo.")}
                />
              ) : !error ? (
                <ActivityIndicator color={Colors.primaryLight} />
              ) : null}
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.maskWrap]}>
                <View style={{
                  width: viewport * 2, height: viewport * 2, borderRadius: viewport,
                  borderWidth: viewport / 2, borderColor: "rgba(10,8,30,0.62)",
                  position: "absolute", left: -viewport / 2, top: -viewport / 2,
                }} />
                <View style={[s.ring, { width: viewport, height: viewport, borderRadius: viewport / 2 }]} />
              </View>
            </View>

            <View style={[s.zoomRow, { width: viewport }]}>
              <Pressable style={[s.zoomBtn, (locked || zoom <= MIN_ZOOM) && s.disabled]} disabled={locked || zoom <= MIN_ZOOM}
                onPress={() => applyZoom(zoom - ZOOM_STEP)} accessibilityRole="button" accessibilityLabel="Zoom out" testID="crop-zoom-out">
                <Feather name="minus" size={16} color={Colors.darkText} />
              </Pressable>
              <View
                style={[s.track, { width: trackW }]}
                {...trackPan.panHandlers}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Zoom"
                accessibilityValue={{ min: 100, max: 300, now: Math.round(zoom * 100), text: `${zoom.toFixed(2)}x` }}
                accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
                onAccessibilityAction={(e) => {
                  if (locked) return;
                  if (e.nativeEvent.actionName === "increment") applyZoom(zoom + ZOOM_STEP);
                  if (e.nativeEvent.actionName === "decrement") applyZoom(zoom - ZOOM_STEP);
                }}
                testID="crop-zoom-slider"
              >
                <View pointerEvents="none" style={s.trackLine} />
                <View pointerEvents="none" style={[s.trackFill, { width: pct * trackW }]} />
                <View pointerEvents="none" style={[s.thumb, { left: pct * trackW - 9 }]} />
              </View>
              <Pressable style={[s.zoomBtn, (locked || zoom >= MAX_ZOOM) && s.disabled]} disabled={locked || zoom >= MAX_ZOOM}
                onPress={() => applyZoom(zoom + ZOOM_STEP)} accessibilityRole="button" accessibilityLabel="Zoom in" testID="crop-zoom-in">
                <Feather name="plus" size={16} color={Colors.darkText} />
              </Pressable>
            </View>

            {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}

            <View style={s.actions}>
              <Pressable style={[s.cancelBtn, locked && s.disabled]} onPress={onCancel} disabled={locked}
                accessibilityRole="button" testID="crop-cancel">
                <Text style={s.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[s.saveBtn, locked && { opacity: 0.7 }]} onPress={handleSave} disabled={locked}
                accessibilityRole="button" accessibilityState={{ disabled: locked, busy: locked }} testID="crop-save">
                {locked ? (
                  <View style={s.saveInner}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={s.saveText}>Uploading…</Text>
                  </View>
                ) : <Text style={s.saveText}>Save Photo</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
  );
  // Reuse the existing Account modal's native host. A sibling native modal
  // cannot reliably present while that host is already showing on iOS.
  if (embedded) return asset ? content : null;
  return <Modal visible={!!asset} transparent animationType="fade" onRequestClose={requestClose}>{content}</Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { backgroundColor: Colors.darkCard, borderRadius: 20, width: "100%", maxWidth: 440, maxHeight: "92%", borderWidth: 1, borderColor: Colors.darkCardBorder, overflow: "hidden" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Colors.darkDivider },
  title: { fontSize: 16, fontFamily: "Inter_700Bold", color: Colors.darkText },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, gap: 14, alignItems: "center" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.darkTextMuted, textAlign: "center" },
  stage: { backgroundColor: Colors.darkBg1, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  maskWrap: { overflow: "hidden" },
  ring: { position: "absolute", left: 0, top: 0, borderWidth: 2, borderColor: Colors.bannerAvatarBorder },
  zoomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  zoomBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.darkInputBg, borderWidth: 1, borderColor: Colors.darkInputBorder, alignItems: "center", justifyContent: "center" },
  track: { height: 32, justifyContent: "center" },
  trackLine: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: Colors.darkSurface },
  trackFill: { position: "absolute", left: 0, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  thumb: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primaryLight, borderWidth: 2, borderColor: Colors.darkCard },
  error: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.danger, textAlign: "center" },
  actions: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: Colors.darkDivider, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.darkTextSub },
  saveBtn: { flex: 1.4, backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  saveInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  saveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  disabled: { opacity: 0.45 },
});
