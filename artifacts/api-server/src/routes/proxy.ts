import { Router, type IRouter } from "express";

const router: IRouter = Router();
const UPSTREAM = "https://edwai-api-953672603784.asia-south1.run.app";

async function proxyHandler(req: any, res: any) {
  const sub = req.params[0] ?? "";
  const upstreamUrl = `${UPSTREAM}/api/${sub}`;

  const forwardHeaders: Record<string, string> = {
    "content-type": "application/json",
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
      init.body = JSON.stringify(req.body);
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

    const text = await upstream.text();
    res.set("content-type", contentType);
    res.send(text);
  } catch {
    res.status(502).json({ detail: "Proxy error — upstream unreachable" });
  }
}

router.all(/^\/edwai\/(.*)$/, proxyHandler);

export default router;
