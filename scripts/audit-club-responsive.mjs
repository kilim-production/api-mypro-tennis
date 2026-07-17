import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath =
  process.env.CHROME_PATH ??
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const baseUrl = process.env.CLUB_AUDIT_URL ?? "http://localhost:5173";
const apiUrl = process.env.CLUB_AUDIT_API_URL ?? "http://localhost:4000/api";
const outputDirectory = join(process.cwd(), "artifacts", "club-responsive");
const debuggingPort = Number(process.env.CLUB_AUDIT_DEBUG_PORT ?? 9335);

const viewports = [
  { name: "mobile-915x412", width: 915, height: 412, mobile: true },
  { name: "mobile-1080x480", width: 1080, height: 480, mobile: true },
  { name: "pc-1280x720", width: 1280, height: 720, mobile: false },
  { name: "pc-1920x1080", width: 1920, height: 1080, mobile: false }
];

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

async function waitForJson(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      // Chrome may need a short moment to expose its debugging endpoint.
    }
    await wait(200);
  }
  throw new Error(`Délai dépassé pour ${url}`);
}

async function login() {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.CLUB_AUDIT_EMAIL ?? "demo@mypro-tennis.local",
      password: process.env.CLUB_AUDIT_PASSWORD ?? "demo1234"
    })
  });
  if (!response.ok) {
    throw new Error(`Connexion de démonstration impossible (${response.status}).`);
  }
  const payload = await response.json();
  return payload.token;
}

function createCdpClient(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const pending = new Map();
  let nextId = 1;

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  return {
    ready,
    close: () => socket.close(),
    async send(method, params = {}) {
      await ready;
      const id = nextId;
      nextId += 1;
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    }
  };
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? "Évaluation navigateur impossible.");
  }
  return response.result.value;
}

async function waitForClub(client) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const state = await evaluate(
      client,
      `({
        ready: Boolean(document.querySelector('.club-main-layout')),
        error: document.body.innerText.includes('Action impossible')
      })`
    );
    if (state.ready) return;
    if (state.error) throw new Error("La page Club a renvoyé une erreur fonctionnelle.");
    await wait(250);
  }
  throw new Error("La page Club ne s’est pas chargée dans le délai prévu.");
}

const auditExpression = `(() => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const root = document.documentElement;
  const content = document.querySelector('.club-content-scroll');
  const stage = document.querySelector('.club-stage');
  const visibleOverflows = Array.from(document.querySelectorAll('.club-stage *'))
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rectangle = element.getBoundingClientRect();
      if (rectangle.width < 1 || rectangle.height < 1) return false;
      return rectangle.left < -1 || rectangle.right > viewportWidth + 1;
    })
    .slice(0, 12)
    .map((element) => ({
      className: String(element.className).slice(0, 100),
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right)
    }));
  const activeTab = document.querySelector('.club-navigation button.is-active strong')?.textContent?.trim() ?? 'inconnu';
  const unnamedButtons = Array.from(document.querySelectorAll('button')).filter((button) => {
    const accessibleName = button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent;
    return !accessibleName?.trim();
  }).length;
  return {
    activeTab,
    viewport: { width: viewportWidth, height: viewportHeight },
    documentOverflowX: Math.max(0, root.scrollWidth - root.clientWidth),
    contentOverflowX: content ? Math.max(0, content.scrollWidth - content.clientWidth) : null,
    unnamedButtons,
    stage: stage ? {
      width: Math.round(stage.getBoundingClientRect().width),
      height: Math.round(stage.getBoundingClientRect().height)
    } : null,
    visibleOverflows
  };
})()`;

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const token = await login();
  const userDataDirectory = await mkdtemp(join(tmpdir(), "mypro-club-audit-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debuggingPort}`,
      `--user-data-dir=${userDataDirectory}`,
      "--disable-gpu",
      "--disable-extensions",
      "--hide-scrollbars",
      "--no-first-run",
      "about:blank"
    ],
    { stdio: "ignore", windowsHide: true }
  );

  let client;
  try {
    await waitForJson(`http://127.0.0.1:${debuggingPort}/json/version`);
    const targetResponse = await fetch(
      `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" }
    );
    const target = await targetResponse.json();
    client = createCdpClient(target.webSocketDebuggerUrl);
    await client.ready;
    await Promise.all([
      client.send("Page.enable"),
      client.send("Runtime.enable"),
      client.send("Network.enable")
    ]);
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem('mypro-token', ${JSON.stringify(token)}); localStorage.setItem('mypro-tutorial-done', '1');`
    });

    const report = [];
    for (const viewport of viewports) {
      const viewportReportStart = report.length;
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.mobile,
        screenWidth: viewport.width,
        screenHeight: viewport.height
      });
      await client.send("Emulation.setTouchEmulationEnabled", {
        enabled: viewport.mobile,
        maxTouchPoints: viewport.mobile ? 5 : 1
      });
      await client.send("Page.navigate", { url: `${baseUrl}/club` });
      await waitForClub(client);
      await wait(500);

      const tabCount = await evaluate(
        client,
        "document.querySelectorAll('.club-navigation button').length"
      );
      for (let tabIndex = 0; tabIndex < tabCount; tabIndex += 1) {
        await evaluate(
          client,
          `document.querySelectorAll('.club-navigation button')[${tabIndex}]?.click()`
        );
        await wait(350);
        await evaluate(
          client,
          "document.querySelector('.club-content-scroll')?.scrollTo({ top: 0, left: 0 })"
        );
        const audit = await evaluate(client, auditExpression);
        const filename = `${viewport.name}-tab-${tabIndex + 1}.png`;
        const screenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true
        });
        await writeFile(join(outputDirectory, filename), Buffer.from(screenshot.data, "base64"));
        report.push({ ...viewport, tabIndex, screenshot: filename, ...audit });
      }
      await evaluate(
        client,
        "document.querySelectorAll('.club-navigation button')[0]?.click()"
      );
      await wait(350);
      const requestCounts = await evaluate(
        client,
        `(() => {
          const paths = performance.getEntriesByType('resource').map((entry) => {
            try { return new URL(entry.name).pathname; } catch { return ''; }
          });
          return {
            clubDirectory: paths.filter((path) => path === '/api/clubs').length,
            myClub: paths.filter((path) => path === '/api/clubs/me').length,
            teamChampionship: paths.filter((path) => path === '/api/clubs/team-championship').length
          };
        })()`
      );
      for (let index = viewportReportStart; index < report.length; index += 1) {
        report[index].requestCounts = requestCounts;
      }
    }

    await writeFile(
      join(outputDirectory, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8"
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client?.close();
    chrome.kill();
    await Promise.race([
      new Promise((resolve) => chrome.once("exit", resolve)),
      wait(1500)
    ]);
    await rm(userDataDirectory, {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 200
    }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
