/**
 * Boot the app for a script, and stop it afterwards.
 *
 * Both the snapshot comparator and the design gate need a real server on a real
 * port. Booting it here means neither can accidentally measure a process someone
 * left running with different data or a live model key.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

export function repoRoot() {
  return ROOT;
}

export async function startServer({ port, env = {}, timeoutMs = 30_000 } = {}) {
  const chosen = Number(port ?? process.env.GATE_PORT ?? 3197);
  const base = `http://127.0.0.1:${chosen}`;

  if (!existsSync(path.join(ROOT, "data", "econpulse.db"))) {
    throw new Error("data/econpulse.db is missing. See AGENTS.md for where it comes from.");
  }

  const child = spawn("npx", ["tsx", "server/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(chosen),
      HOST: "127.0.0.1",
      // Deterministic output: no model in the loop.
      OPENROUTER_API_KEY: "",
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
    if (process.env.GATE_VERBOSE) process.stderr.write(chunk);
  });

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/healthz`, { redirect: "manual" });
      if (response.ok) {
        return {
          base,
          stop() {
            child.kill("SIGTERM");
          },
        };
      }
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  child.kill("SIGKILL");
  throw new Error(`the server did not answer ${base}/healthz within ${timeoutMs}ms\n${stderr}`);
}
