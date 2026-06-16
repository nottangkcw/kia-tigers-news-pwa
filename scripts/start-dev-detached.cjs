/* eslint-disable @typescript-eslint/no-require-imports */
const { openSync } = require("node:fs");
const { join } = require("node:path");
const { spawn } = require("node:child_process");

const cwd = process.cwd();
const out = openSync(join(cwd, "dev-server.log"), "a");
const err = openSync(join(cwd, "dev-server.err.log"), "a");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev"], {
  cwd,
  detached: true,
  shell: false,
  stdio: ["ignore", out, err],
  windowsHide: true,
});

child.unref();
console.log(`started ${child.pid}`);
