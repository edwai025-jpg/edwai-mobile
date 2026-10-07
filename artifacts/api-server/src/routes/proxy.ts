import express, { Router, type IRouter } from "express";

const router: IRouter = Router();
const UPSTREAM = "https://edwai-api-953672603784.asia-south1.run.app";

async function proxyHandler(req: any, res: any) {
  const sub = req.params[0] ?? "";
  const query = req.originalUrl.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
  const upstreamUrl = `${UPSTREAM}/api/${sub}${query}`;
  const multipart = req.headers["content-type"]?.startsWith("multipart/form-data");

  const forwardHeaders: Record<string, string> = {
    "content-type": multipart ? req.headers["content-type"] : "application/json",
  };

  if (req.headers.accept) {
    forwardHeaders["accept"] = req.headers.accept as string;
  }
  if (req.headers.authorization) {
    forwardHeaders["authorization"] = req.headers.authorization as string;
  }

  try {
    const init: RequestInit = {
      method: req.method,
      headers: forwardHeaders,
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = multipart ? req.body : req.body === undefined ? undefined : JSON.stringify(req.body);
    }

    const upstream = await fetch(upstreamUrl, init);
    const contentType = upstream.headers.get("content-type") ?? "application/json";

    res.status(upstream.status);

    if (contentType.includes("text/event-stream")) {
      res.set({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
        "x-accel-buffering": "no",
      });

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();

      req.on("close", () => {
        reader.cancel().catch(() => {});
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
        if (typeof (res as any).flush === "function") (res as any).flush();
      }
      res.end();
      return;
    }

    // Authenticated profile images must stay binary and must not be shared-cached.
    if (contentType.startsWith("image/")) {
      res.set("content-type", contentType);
      res.set("cache-control", "private, no-store");
      res.send(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const text = await upstream.text();
    res.set("content-type", contentType);
    res.send(text);
  } catch {
    res.status(502).json({ detail: "Proxy error — upstream unreachable" });
  }
}

// Preserve the multipart boundary and bytes; JSON middleware intentionally skips it.
router.all(/^\/edwai\/(.*)$/, express.raw({ type: "multipart/form-data", limit: "6mb" }), proxyHandler);

export default router;
