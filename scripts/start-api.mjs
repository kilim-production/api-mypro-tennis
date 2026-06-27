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

if (process.env.DATABASE_URL?.startsWith("postgres")) {
  await run(npmCommand, ["run", "db:generate:postgres"]);
  await run(npmCommand, ["run", "db:push:postgres"]);
} else {
  await run(npmCommand, ["run", "db:deploy"]);
}
await run(npmCommand, ["exec", "tsx", "apps/mypro-tennis-server/src/server.ts"]);
