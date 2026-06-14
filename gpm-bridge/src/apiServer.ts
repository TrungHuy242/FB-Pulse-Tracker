/**
 * Local HTTP proxy for GPM Login.
 *
 * The React app talks to this bridge at http://localhost:3001. The bridge then
 * calls the GPM Login local API, which is normally http://127.0.0.1:9495.
 */
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import fetch, { RequestInit } from "node-fetch";
import { scrapeFacebookInfo } from "./facebookScraper.js";

function appendQuery(qs: URLSearchParams, key: string, value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0];
    if (first !== undefined && first !== null && first !== "") {
      qs.set(key, String(first));
    }
    return;
  }
  if (typeof value === "string") {
    if (value.trim() !== "") qs.set(key, value);
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    qs.set(key, String(value));
  }
}

function buildListQuery(req: Request): string {
  const qs = new URLSearchParams();
  appendQuery(qs, "page", req.query.page);
  appendQuery(qs, "page_size", req.query.page_size ?? req.query.limit);
  appendQuery(qs, "search", req.query.search);
  appendQuery(qs, "sort", req.query.sort);
  appendQuery(qs, "group_id", req.query.group_id);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

async function readResponseBody(resp: Awaited<ReturnType<typeof fetch>>): Promise<unknown> {
  const text = await resp.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { success: resp.ok, message: text };
  }
}

function withTimeout(ms: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

export function createApiServer(gpmApiUrl: string, port = 3001) {
  const app = express();

  app.use(cors({ origin: process.env.BRIDGE_CORS_ORIGIN || "*" }));
  app.use(express.json({ limit: "2mb" }));

  async function proxy(
    method: "GET" | "POST",
    paths: string[],
    res: Response,
    body?: unknown
  ) {
    let lastStatus = 502;
    let lastBody: unknown = {
      success: false,
      message: "GPM API khong phan hoi",
    };

    for (const path of paths) {
      const url = `${gpmApiUrl}${path}`;
      try {
        const opts: RequestInit = { method };
        if (method === "POST") {
          opts.headers = { "Content-Type": "application/json" };
          opts.body = JSON.stringify(body ?? {});
        }

        const resp = await fetch(url, opts);
        const respBody = await readResponseBody(resp);
        lastStatus = resp.status;
        lastBody = respBody;

        if (resp.ok || paths.length === 1) {
          res.status(resp.status).json(respBody);
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastBody = {
          success: false,
          message: `GPM API khong phan hoi: ${message}`,
        };
      }
    }

    res.status(lastStatus).json(lastBody);
  }

  async function proxyGet(path: string | string[], res: Response) {
    await proxy("GET", Array.isArray(path) ? path : [path], res);
  }

  async function proxyPost(path: string, body: unknown, res: Response) {
    await proxy("POST", [path], res, body);
  }

  app.get("/health", async (_req: Request, res: Response) => {
    const timeout = withTimeout(2500);
    try {
      const resp = await fetch(`${gpmApiUrl}/api/v1/profiles?page=1&page_size=1`, {
        signal: timeout.signal,
      });
      res.json({
        status: "ok",
        bridge: true,
        gpmApiUrl,
        gpm: { ok: resp.ok, status: resp.status },
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      res.json({
        status: "ok",
        bridge: true,
        gpmApiUrl,
        gpm: { ok: false, message },
        timestamp: new Date().toISOString(),
      });
    } finally {
      timeout.cleanup();
    }
  });

  app.get("/gpm/groups", async (_req: Request, res: Response) => {
    await proxyGet("/api/v1/groups", res);
  });

  app.get("/gpm/groups/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/groups/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.post("/gpm/groups/create", async (req: Request, res: Response) => {
    await proxyPost("/api/v1/groups/create", req.body, res);
  });

  app.post("/gpm/groups/update/:id", async (req: Request, res: Response) => {
    await proxyPost(`/api/v1/groups/update/${encodeURIComponent(String(req.params.id))}`, req.body, res);
  });

  app.get("/gpm/groups/delete/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/groups/delete/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.get("/gpm/profiles", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/profiles${buildListQuery(req)}`, res);
  });

  app.get("/gpm/profiles/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/profiles/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.post("/gpm/profiles/create", async (req: Request, res: Response) => {
    await proxyPost("/api/v1/profiles/create", req.body, res);
  });

  app.post("/gpm/profiles/update/:id", async (req: Request, res: Response) => {
    await proxyPost(`/api/v1/profiles/update/${encodeURIComponent(String(req.params.id))}`, req.body, res);
  });

  app.get("/gpm/profiles/delete/:id", async (req: Request, res: Response) => {
    const qs = new URLSearchParams();
    appendQuery(qs, "mode", req.query.mode);
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(`/api/v1/profiles/delete/${encodeURIComponent(String(req.params.id))}${suffix}`, res);
  });

  app.get("/gpm/profiles/start/:id", async (req: Request, res: Response) => {
    const qs = new URLSearchParams();
    appendQuery(qs, "remote_debugging_port", req.query.remote_debugging_port);
    appendQuery(qs, "window_size", req.query.window_size);
    appendQuery(qs, "window_pos", req.query.window_pos);
    appendQuery(qs, "window_scale", req.query.window_scale);
    appendQuery(qs, "addition_args", req.query.addition_args);
    const suffix = qs.toString() ? `?${qs}` : "";
    
    try {
      const url = `${gpmApiUrl}/api/v1/profiles/start/${encodeURIComponent(String(req.params.id))}${suffix}`;
      const resp = await fetch(url);
      const body = await readResponseBody(resp) as any;
      
      if (resp.ok && body && (body.success || body.remote_debugging_port || body.data?.remote_debugging_port)) {
        let debugPort = body.remote_debugging_port || body.data?.remote_debugging_port;
        if (!debugPort && body.data?.selenium_remote_debug_address) {
          const address = body.data.selenium_remote_debug_address;
          const parts = address.split(":");
          const parsedPort = parseInt(parts[parts.length - 1]);
          if (!isNaN(parsedPort)) debugPort = parsedPort;
        }
        
        if (debugPort) {
          console.log(`[API Server] Profile ${req.params.id} đã mở ở debug port ${debugPort}. Đang cào thông tin Facebook...`);
          const fbInfo = await scrapeFacebookInfo(debugPort);
          if (fbInfo) {
            body.fbInfo = fbInfo;
            console.log(`[API Server] Cào Facebook thành công cho Profile ${req.params.id}:`, fbInfo.fbName);
          }
        }
      }
      res.status(resp.status).json(body);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[API Server] Mở profile ${req.params.id} lỗi:`, msg);
      res.status(502).json({ success: false, message: `GPM API khong phan hoi: ${msg}` });
    }
  });

  app.get("/gpm/profiles/stop/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/profiles/stop/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.get("/gpm/proxies", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/proxies${buildListQuery(req)}`, res);
  });

  app.get("/gpm/proxies/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/proxies/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.post("/gpm/proxies/create", async (req: Request, res: Response) => {
    await proxyPost("/api/v1/proxies/create", req.body, res);
  });

  app.post("/gpm/proxies/update/:id", async (req: Request, res: Response) => {
    await proxyPost(`/api/v1/proxies/update/${encodeURIComponent(String(req.params.id))}`, req.body, res);
  });

  app.get("/gpm/proxies/delete/:id", async (req: Request, res: Response) => {
    await proxyGet(`/api/v1/proxies/delete/${encodeURIComponent(String(req.params.id))}`, res);
  });

  app.get("/gpm/proxies/check", async (req: Request, res: Response) => {
    const rawProxy = req.query.raw_proxy;
    if (typeof rawProxy !== "string" || rawProxy.trim() === "") {
      res.status(400).json({ success: false, message: "Thieu param raw_proxy" });
      return;
    }
    const qs = new URLSearchParams({ raw_proxy: rawProxy });
    await proxyGet(`/api/v1/proxies/check?${qs}`, res);
  });

  app.get("/gpm/browsers/versions", async (_req: Request, res: Response) => {
    await proxyGet(["/api/v1/browsers/versions", "/api/v1//browsers/versions"], res);
  });

  app.get("/gpm/extensions", async (_req: Request, res: Response) => {
    await proxyGet("/api/v1/extensions", res);
  });

  app.get("/gpm/extensions/update-state/:id", async (req: Request, res: Response) => {
    const qs = new URLSearchParams();
    appendQuery(qs, "active", req.query.active);
    appendQuery(qs, "applied_group_ids", req.query.applied_group_ids);
    const suffix = qs.toString() ? `?${qs}` : "";
    await proxyGet(`/api/v1/extensions/update-state/${encodeURIComponent(String(req.params.id))}${suffix}`, res);
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: "Endpoint khong ton tai" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    console.error("[API Server] Unhandled error:", err);
    res.status(500).json({ success: false, message: err.message });
  });

  const server = app.listen(port, () => {
    console.log(`[API Server] GPM Bridge HTTP API: http://localhost:${port}`);
    console.log(`[API Server] Proxy target: ${gpmApiUrl}`);
  });

  return server;
}
