import { spawn } from "node:child_process";
import path from "node:path";

const rawArgs = process.argv.slice(2);
let port = process.env.PORT || "3000";
let hostname = "0.0.0.0";
const extraArgs = [];

for (let i = 0; i < rawArgs.length; i += 1) {
  const arg = rawArgs[i];

  if (arg === "--host" || arg === "-H" || arg === "--hostname") {
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("-")) {
      hostname = rawArgs[++i];
    }
    continue;
  }
  if (arg.startsWith("--host=")) {
    hostname = arg.slice("--host=".length) || hostname;
    continue;
  }
  if (arg.startsWith("--hostname=")) {
    hostname = arg.slice("--hostname=".length) || hostname;
    continue;
  }
  if (arg === "--port" || arg === "-p") {
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith("-")) {
      port = rawArgs[++i];
    }
    continue;
  }
  if (arg.startsWith("--port=")) {
    port = arg.slice("--port=".length) || port;
    continue;
  }
  if (arg === "--strictPort") {
    continue;
  }

  extraArgs.push(arg);
}

const nextBin = path.resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);

const child = spawn(
  nextBin,
  ["dev", "-p", port, "-H", hostname, ...extraArgs],
  {
    stdio: "inherit",
    env: process.env,
  }
);

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
