import { Router, type IRouter } from "express";

const router: IRouter = Router();
const UPSTREAM = "https://edwai-api-953672603784.asia-south1.run.app";

async function proxyHandler(req: any, res: any) {
  const sub = req.params[0] ?? "";
  const upstreamUrl = `${UPSTREAM}/api/${sub}`;

  const forwardHeaders: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
  };
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
    const text = await upstream.text();

    res.status(upstream.status);
    res.set("content-type", "application/json");
    res.send(text);
  } catch {
    res.status(502).json({ detail: "Proxy error — upstream unreachable" });
  }
}

router.all(/^\/edwai\/(.*)$/, proxyHandler);

export default router;
