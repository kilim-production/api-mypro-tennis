import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} a echoue avec le code ${code}.`));
    });
  });
}

await run(npmCommand, ["run", "db:deploy"]);
await run(npmCommand, ["exec", "tsx", "apps/mypro-tennis-server/src/server.ts"]);
