import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
const venvPython = process.platform === "win32" ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const python = existsSync(venvPython) ? venvPython : "python";

const server = spawn(python, ["-m", "uvicorn", "app.main:app", "--reload", "--reload-dir", "app", "--port", "8002"], { cwd: root, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
