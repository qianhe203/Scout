#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const webPort = process.env.PORT ?? "3000";
const apiPort = process.env.INTERNAL_API_PORT ?? "3001";

function start(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.error(`[scout] ${name} exited via ${signal}`);
      shutdown(1);
      return;
    }
    if (code !== 0 && code !== null) {
      console.error(`[scout] ${name} exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

let shuttingDown = false;
let apiProc;
let webProc;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  apiProc?.kill("SIGTERM");
  webProc?.kill("SIGTERM");
  setTimeout(() => process.exit(code), 250);
}

console.log(
  `[scout] Starting API on 127.0.0.1:${apiPort} and web on 0.0.0.0:${webPort}`,
);

apiProc = start(
  "api",
  "node",
  [join(rootDir, "apps/api/dist/index.js")],
  { PORT: apiPort },
);

webProc = start("web", "pnpm", ["--filter", "web", "start"], {
  PORT: webPort,
  HOSTNAME: "0.0.0.0",
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
