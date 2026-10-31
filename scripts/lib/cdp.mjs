/**
 * A tiny Chrome DevTools Protocol client, and a PNG decoder.
 *
 * The design gate has to look at a rendered page, not at a stylesheet, because a
 * rule checked by reading CSS is a hope. That means a real browser and real
 * pixels. Neither needs an npm dependency: Node 22 ships a WebSocket client and
 * zlib, and Chrome ships a debugger.
 *
 * Scope is deliberately narrow — one page target, evaluate, screenshot — so the
 * whole thing stays readable in one sitting.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { tmpdir } from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome() {
  for (const candidate of CANDIDATES) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

/** Launch headless Chrome and return the browser WebSocket URL. */
export async function launchChrome(chrome) {
  const profile = await mkdtemp(path.join(tmpdir(), "econpulse-gate-"));
  // Chrome's own sandbox cannot initialise under a stricter parent sandbox: the
  // GPU process dies, then the browser exits with "Goodbye" and every later CDP
  // command closes the socket. --no-sandbox is what makes headless work here.
  const child = spawn(
    chrome,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      "--disable-crash-reporter",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      // Software WebGL, so the map renders in the gate exactly as it renders in
      // CI. Without it the gate measured a page with no map on one machine and a
      // page with one on another, and the colour budget disagreed with itself.
      // Text antialiasing is not design. Linux Chrome renders LCD subpixel text,
      // which puts a coloured fringe on every glyph and made a phone-width page
      // measure 9% colour where macOS measured 1%. The budget is about the
      // palette, so the fringes are turned off and the colour profile pinned.
      "--disable-lcd-text",
      "--force-color-profile=srgb",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  const url = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not open a debugging port")), 20_000);
    child.stderr.on("data", (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited with ${code} before it was ready`));
    });
  });

  return {
    url,
    async close() {
      child.kill("SIGKILL");
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/**
 * Attach to the browser's first page target.
 *
 * This talks to the page's own WebSocket rather than the browser socket with a
 * flattened session. Flattened sessions answer `Browser.*` and then drop the
 * connection on the first page-domain command, which is a hard bug to read from
 * a hung promise.
 */
export async function openPage(browserWs, timeoutMs = 15_000) {
  const { host } = new URL(browserWs);
  const started = Date.now();
  let target = null;
  while (Date.now() - started < timeoutMs) {
    const targets = await fetch(`http://${host}/json/list`).then((r) => r.json()).catch(() => []);
    target = targets.find((candidate) => candidate.type === "page");
    if (target) break;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!target) throw new Error("Chrome opened no page target");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(typeof event.data === "string" ? event.data : "{}");
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  await send("Page.enable");
  await send("Runtime.enable");

  function once(method) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method) {
          listeners.delete(listener);
          resolve(message.params);
        }
      };
      listeners.add(listener);
    });
  }

  async function goto(url) {
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url });
    await Promise.race([loaded, new Promise((resolve) => setTimeout(resolve, 15_000))]);
  }

  async function evaluate(expression) {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        `page error: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
      );
    }
    return result.result.value;
  }

  /** Run a script before any document script, on every navigation. */
  async function evaluateOnNewDocument(expression) {
    await send("Page.addScriptToEvaluateOnNewDocument", { source: expression });
  }

  /**
   * Block every request to a third party.
   *
   * The design gate must measure the same page on every machine. Tiles are a
   * network dependency: with them the map draws a basemap, without them it draws
   * the outline alone, and the colour budget measures two different pages. The
   * gate takes the blocked case because it is the one the page is designed to
   * survive.
   */
  async function blockThirdParty() {
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["*openfreemap*", "*openstreetmap*"] });
  }

  async function setViewport(width, height) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 430 });
  }

  /** Switch the media type, so the print rules can be measured without printing. */
  async function setMedia(media) {
    await send("Emulation.setEmulatedMedia", { media });
  }

  /** A real PDF, which is the only way to know the page count. */
  async function pdf() {
    const { data } = await send("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(data, "base64");
  }

  async function screenshot() {
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    return Buffer.from(data, "base64");
  }

  return {
    goto,
    evaluate,
    evaluateOnNewDocument,
    blockThirdParty,
    setViewport,
    setMedia,
    pdf,
    screenshot,
    close() {
      socket.close();
    },
  };
}

/**
 * Decode a non-interlaced 8-bit PNG to RGBA.
 *
 * Chrome emits colour type 2 (RGB) or 6 (RGBA). Anything else is refused rather
 * than guessed at, because a gate that misreads a screenshot is worse than one
 * that stops.
 */
export function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG: depth ${bitDepth}, colour type ${colorType}, interlace ${interlace}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      const value = line[x];
      if (filter === 1) line[x] = (value + a) & 0xff;
      else if (filter === 2) line[x] = (value + b) & 0xff;
      else if (filter === 3) line[x] = (value + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        line[x] = (value + predictor) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`unknown PNG filter ${filter}`);
      }
    }
    for (let x = 0; x < width; x += 1) {
      const from = x * channels;
      const to = (y * width + x) * 4;
      out[to] = line[from];
      out[to + 1] = line[from + 1];
      out[to + 2] = line[from + 2];
      out[to + 3] = channels === 4 ? line[from + 3] : 255;
    }
    previous = line;
  }

  return { width, height, rgba: out };
}

/**
 * Share of pixels that carry a hue.
 *
 * Neutrals in this palette sit under chroma 20 (#566669 reaches 19) and the data
 * colour sits far above it (#009689 reaches 150), so a threshold of 24 separates
 * them without arguing about antialiasing.
 */
export function colouredShare({ width, height, rgba }, threshold = 24) {
  let coloured = 0;
  const total = width * height;
  for (let i = 0; i < total; i += 1) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    if (chroma >= threshold) coloured += 1;
  }
  return { coloured, total, share: total ? coloured / total : 0 };
}
