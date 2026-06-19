import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import fetch from "node-fetch";

export interface GpmEnsureResult {
  ok: boolean;
  apiUrl: string;
  autoStart: boolean;
  started?: boolean;
  executablePath?: string;
  message?: string;
}

export interface GpmRuntime {
  getApiUrl(): string;
  ensureReady(reason?: string): Promise<GpmEnsureResult>;
}

interface GpmProcessManagerOptions {
  apiUrl: string;
  autoStart: boolean;
  executablePath?: string;
  startupArgs?: string[];
  startupTimeoutMs: number;
  pollIntervalMs: number;
  httpPortFile?: string;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

export function envBoolean(name: string, defaultValue: boolean): boolean {
  return parseBoolean(process.env[name], defaultValue);
}

export function envInteger(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function parseStartupArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return (
    raw
      .match(/"[^"]*"|'[^']*'|\S+/g)
      ?.map((arg) => arg.replace(/^["']|["']$/g, ""))
      .filter(Boolean) ?? []
  );
}

function expandEnv(input: string): string {
  return input.replace(/%([^%]+)%/g, (_match, name: string) => process.env[name] ?? "");
}

function existingFile(filePath: string | undefined): string | null {
  if (!filePath) return null;
  const expanded = expandEnv(filePath);
  return fs.existsSync(expanded) ? expanded : null;
}

function existingExecutable(filePath: string | undefined): string | null {
  const resolved = existingFile(filePath);
  if (!resolved) return null;

  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size < 1024) return null;

  const handle = fs.openSync(resolved, "r");
  try {
    const header = Buffer.alloc(2);
    fs.readSync(handle, header, 0, 2, 0);
    return header.toString("ascii") === "MZ" ? resolved : null;
  } finally {
    fs.closeSync(handle);
  }
}

function unique(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function getDefaultExecutableCandidates(): string[] {
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;
  const programFiles = process.env.ProgramFiles;
  const programFilesX86 = process.env["ProgramFiles(x86)"];

  return unique([
    localAppData && path.join(localAppData, "Programs", "GPMLoginGlobal", "GPMLoginGlobal.exe"),
    localAppData && path.join(localAppData, "Programs", "GPMLogin", "GPMLogin.exe"),
    appData && path.join(appData, "GPMLoginGlobal", "GPMLoginGlobal.exe"),
    appData && path.join(appData, "GPMLogin", "GPMLogin.exe"),
    localAppData && path.join(localAppData, "GPMLoginGlobal", "GPMLoginGlobal.exe"),
    localAppData && path.join(localAppData, "GPMLogin", "GPMLogin.exe"),
    programFiles && path.join(programFiles, "GPMLoginGlobal", "GPMLoginGlobal.exe"),
    programFiles && path.join(programFiles, "GPMLogin", "GPMLogin.exe"),
    programFilesX86 && path.join(programFilesX86, "GPMLoginGlobal", "GPMLoginGlobal.exe"),
    programFilesX86 && path.join(programFilesX86, "GPMLogin", "GPMLogin.exe"),
  ]);
}

function getDefaultPortFileCandidates(executablePath?: string): string[] {
  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;
  const dirs = unique([
    executablePath && path.dirname(executablePath),
    appData && path.join(appData, "GPMLoginGlobal"),
    appData && path.join(appData, "GPMLogin"),
    localAppData && path.join(localAppData, "GPMLoginGlobal"),
    localAppData && path.join(localAppData, "GPMLogin"),
  ]);

  return dirs.flatMap((dir) => [
    path.join(dir, "http.port"),
    path.join(dir, "Data", "http.port"),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(ms: number): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

export class GpmProcessManager implements GpmRuntime {
  private apiUrl: string;
  private startingPromise: Promise<GpmEnsureResult> | null = null;

  constructor(private readonly options: GpmProcessManagerOptions) {
    this.apiUrl = options.apiUrl;
  }

  getApiUrl(): string {
    this.refreshApiUrlFromPortFile();
    return this.apiUrl;
  }

  async ensureReady(reason = "request"): Promise<GpmEnsureResult> {
    this.refreshApiUrlFromPortFile();

    const readyBeforeStart = await this.isApiReady();
    if (readyBeforeStart.ok) {
      return {
        ok: true,
        apiUrl: this.apiUrl,
        autoStart: this.options.autoStart,
      };
    }

    if (!this.options.autoStart) {
      return {
        ok: false,
        apiUrl: this.apiUrl,
        autoStart: false,
        message: readyBeforeStart.message ?? "GPM Login API is not ready",
      };
    }

    if (this.startingPromise) return this.startingPromise;

    this.startingPromise = this.startAndWait(reason);
    try {
      return await this.startingPromise;
    } finally {
      this.startingPromise = null;
    }
  }

  private resolveExecutablePath(): string | null {
    const configuredPath = existingExecutable(this.options.executablePath);
    if (configuredPath) return configuredPath;

    for (const candidate of getDefaultExecutableCandidates()) {
      const resolved = existingExecutable(candidate);
      if (resolved) return resolved;
    }

    return null;
  }

  private refreshApiUrlFromPortFile(): void {
    const configuredPortFile = existingFile(this.options.httpPortFile);
    const executablePath = this.resolveExecutablePath() ?? undefined;
    const candidates = unique([
      configuredPortFile ?? undefined,
      ...getDefaultPortFileCandidates(executablePath),
    ]);

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) continue;
      const port = fs.readFileSync(candidate, "utf8").trim();
      if (!/^\d{2,5}$/.test(port)) continue;
      const parsed = Number.parseInt(port, 10);
      if (parsed <= 0 || parsed > 65535) continue;

      try {
        const next = new URL(this.apiUrl);
        next.port = String(parsed);
        this.apiUrl = next.toString().replace(/\/$/, "");
        return;
      } catch {
        this.apiUrl = `http://127.0.0.1:${parsed}`;
        return;
      }
    }
  }

  private async isApiReady(): Promise<{ ok: boolean; status?: number; message?: string }> {
    this.refreshApiUrlFromPortFile();
    const timeout = withTimeout(2500);
    try {
      const resp = await fetch(`${this.apiUrl}/api/v1/profiles?page=1&page_size=1`, {
        signal: timeout.signal,
      });
      return { ok: resp.ok, status: resp.status };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message };
    } finally {
      timeout.cleanup();
    }
  }

  private async startAndWait(reason: string): Promise<GpmEnsureResult> {
    const executablePath = this.resolveExecutablePath();
    if (!executablePath) {
      return {
        ok: false,
        apiUrl: this.apiUrl,
        autoStart: true,
        message:
          "Khong tim thay GPM Login executable. Dat GPM_EXECUTABLE_PATH trong gpm-bridge/.env.",
      };
    }

    console.log(`[GPM Process] Local API not ready (${reason}). Starting GPM Login: ${executablePath}`);

    try {
      const child = spawn(executablePath, this.options.startupArgs ?? [], {
        cwd: path.dirname(executablePath),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        apiUrl: this.apiUrl,
        autoStart: true,
        executablePath,
        message: `Khong the khoi dong GPM Login: ${message}`,
      };
    }

    const startedAt = Date.now();
    let lastMessage = "Dang cho GPM Login Local API san sang";

    while (Date.now() - startedAt < this.options.startupTimeoutMs) {
      const ready = await this.isApiReady();
      if (ready.ok) {
        return {
          ok: true,
          apiUrl: this.apiUrl,
          autoStart: true,
          started: true,
          executablePath,
          message: "GPM Login da san sang",
        };
      }
      lastMessage = ready.message ?? `HTTP ${ready.status ?? "unknown"}`;
      await sleep(this.options.pollIntervalMs);
    }

    return {
      ok: false,
      apiUrl: this.apiUrl,
      autoStart: true,
      started: true,
      executablePath,
      message: `Da mo GPM Login nhung Local API chua san sang sau ${Math.round(
        this.options.startupTimeoutMs / 1000
      )}s. Loi cuoi: ${lastMessage}. May: ${os.hostname()}`,
    };
  }
}
