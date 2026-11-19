import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { WebView } from "react-native-webview";
import type { TypographySettings } from "@/services/api";
import { formatStem, stemStyles } from "@/services/stemFormatting";
import { stemDocument } from "@/services/stemDocument";

type Props = { content: string; isDark: boolean; typography?: TypographySettings | null; streaming?: boolean; compact?: boolean };
export default function StemAnswerBody({ content, isDark, typography, streaming, compact }: Props) {
  const id = useId(), { fontScale } = useWindowDimensions();
  const [height, setHeight] = useState(40), [bridgeFailed, setBridgeFailed] = useState(false);
  const [displayContent, setDisplayContent] = useState(content);
  const pendingContent = useRef(content); pendingContent.current = content;
  const native = useRef<WebView>(null), frame = useRef<HTMLIFrameElement>(null);
  const revision = useRef(0), lastContent = useRef(content);
  // Coalesce fast token updates, but commit a completed answer immediately.
  useEffect(() => {
    if (!streaming) setDisplayContent(content);
  }, [content, streaming]);
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => setDisplayContent(pendingContent.current), 100);
    return () => clearInterval(timer);
  }, [streaming]);
  const formatted = useMemo(() => {
    try { return { ...formatStem(displayContent), failed: false }; }
    catch { return { html: "", incomplete: false, failed: true }; }
  }, [displayContent]);
  const css = useMemo(() => stemStyles(isDark, typography, fontScale) + (compact
    ? `#answer{font-size:${14 * Math.max(1, fontScale)}px;padding:0;color:${isDark ? "#c7d2fe" : "#3730a3"}}p{margin:0 0 2px}.katex-display{margin:2px 0}h1,h2,h3{font-size:1em;margin:2px 0}`
    : ""), [isDark, typography, fontScale, compact]);
  if (lastContent.current !== displayContent + css) { revision.current++; lastContent.current = displayContent + css; }
  const payload = { html: formatted.html, css, revision: revision.current, id };
  const latest = useRef(payload); latest.current = payload;
  const [source] = useState(() => ({ html: stemDocument(id, { html: "", css, revision: 0 }) }));
  const update = useCallback(() => {
    if (Platform.OS === "web") frame.current?.contentWindow?.postMessage({ type: "eduwai-answer-update", payload: latest.current }, "*");
    else native.current?.injectJavaScript(`window.renderAnswer&&window.renderAnswer(${JSON.stringify(latest.current).replace(/</g, "\\u003c")});true;`);
  }, []);
  useEffect(update, [formatted.html, css, update]);
  /* Width of this view in app units (dp); used to convert the web page's CSS px height. */
  const layoutWidth = useRef(0);
  const lastCss = useRef<{ height: number; width: number } | null>(null);
  const applySize = useCallback(() => {
    const css = lastCss.current;
    if (!css) return;
    // Old: setHeight(message.height) — assumed 1 CSS px == 1 dp, which cut long answers short on
    // phones with a screen-resolution override (the page couldn't scroll to the end).
    const ratio = css.width > 0 && layoutWidth.current > 0 ? layoutWidth.current / css.width : 1;
    const safeRatio = ratio > 0.5 && ratio < 3 ? ratio : 1;
    setHeight(Math.ceil(css.height * safeRatio) + 8); // small buffer for the last line's margin
  }, []);
  const acceptSize = useCallback((message: { type?: string; id?: string; revision?: number; height?: number; width?: number }) => {
    if (message.type === "eduwai-answer-size" && message.id === id && message.revision === latest.current.revision
      && typeof message.height === "number" && Number.isFinite(message.height) && message.height >= 24 && message.height < 100_000) {
      lastCss.current = { height: message.height, width: typeof message.width === "number" && Number.isFinite(message.width) ? message.width : 0 };
      applySize();
    }
  }, [id, applySize]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const listener = (event: MessageEvent) => { if (event.source === frame.current?.contentWindow) acceptSize(event.data ?? {}); };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [acceptSize]);
  useEffect(() => { setBridgeFailed(false); }, [content]);
  if (!content.trim()) return null;
  if (formatted.failed || bridgeFailed) return <View style={styles.fallback}>
    <Text style={{ color: isDark ? "#fbbf24" : "#b45309" }}>Some notation could not be formatted. The original answer is shown below.</Text>
    <Text selectable style={{ color: isDark ? "#e5e7eb" : "#1f2937", fontSize: 16 }}>{content}</Text>
  </View>;
  return <View style={styles.container} onLayout={event => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - layoutWidth.current) > 0.5) { layoutWidth.current = width; applySize(); }
  }}>
    {formatted.incomplete && <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={{ color: isDark ? "#fbbf24" : "#b45309", fontSize: 12, marginBottom: 6 }}>
      Notation looks incomplete, so the source is shown as typed.
    </Text>}
    {Platform.OS === "web"
      ? <iframe ref={frame} title="Formatted answer" data-testid="stem-answer-frame" srcDoc={source.html}
          sandbox="allow-scripts" onLoad={update} style={{ width: "100%", height, border: 0, display: "block", background: "transparent" }} />
      : <WebView ref={native} testID="stem-answer-webview" source={source}
          style={{ height, backgroundColor: "transparent" }} containerStyle={{ height }} onLoadEnd={update}
          onMessage={event => { try { acceptSize(JSON.parse(event.nativeEvent.data)); } catch {} }}
          onError={() => setBridgeFailed(true)} onContentProcessDidTerminate={() => setBridgeFailed(true)}
          onShouldStartLoadWithRequest={request => request.url === "about:blank" || request.url.startsWith("about:blank#")}
          originWhitelist={["about:blank"]} javaScriptEnabled javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false} allowFileAccess={false} mixedContentMode="never"
          nestedScrollEnabled bounces={false} overScrollMode="never" showsVerticalScrollIndicator={false} />}
  </View>;
}
const styles = StyleSheet.create({
  container: { width: "100%", minWidth: 0 },
  fallback: { borderLeftWidth: 3, borderLeftColor: "#d97706", paddingLeft: 10, gap: 6 },
});
