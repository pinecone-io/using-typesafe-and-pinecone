import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { EXAMPLE_ROOT } from "../lib/env";

declare global {
  interface Window {
    __moveCursor: (x: number, y: number) => void;
    __pressCursor: () => void;
  }
}

const URL = process.env.DEMO_URL ?? "http://localhost:3000";
const PRESET = process.env.DEMO_PRESET ?? "Midwest and very colorful";
const STOP = process.env.DEMO_STOP === "claude" ? "claude" : "typesafe";
const BASENAME = STOP === "claude" ? "demo-full" : "demo";
const OUT = path.join(EXAMPLE_ROOT, "docs", `${BASENAME}.gif`);
const OUT_MP4 = path.join(EXAMPLE_ROOT, "docs", `${BASENAME}.mp4`);
const WORK = path.join(EXAMPLE_ROOT, ".demo-frames");

const WIDTH = 1180;
const HEIGHT = 940;
const OUT_WIDTH = 860;
const FPS = 14;

/** Playwright clicks leave no visual trace, so the GIF needs a cursor drawn into the page. */
const CURSOR = `
  (() => {
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed", width: "20px", height: "20px", borderRadius: "50%",
      background: "rgba(26,107,84,0.30)", border: "2px solid #1a6b54",
      left: "-60px", top: "-60px", zIndex: "99999", pointerEvents: "none",
      transition: "left 0.22s ease-out, top 0.22s ease-out, transform 0.12s ease-out",
    });
    document.body.appendChild(dot);
    window.__moveCursor = (x, y) => { dot.style.left = (x - 10) + "px"; dot.style.top = (y - 10) + "px"; };
    window.__pressCursor = () => {
      dot.style.transform = "scale(0.55)";
      setTimeout(() => { dot.style.transform = "scale(1)"; }, 160);
    };
  })();
`;

async function moveTo(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.evaluate(([x, y]) => window.__moveCursor(x!, y!), [point.x, point.y]);
  return point;
}

async function click(page: Page, point: { x: number; y: number }): Promise<void> {
  await page.evaluate(() => window.__pressCursor());
  await page.mouse.click(point.x, point.y);
}

async function main(): Promise<void> {
  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    colorScheme: "light",
    recordVideo: { dir: WORK, size: { width: WIDTH, height: HEIGHT } },
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(CURSOR);
  await page.addStyleTag({ content: "* { caret-color: transparent !important; }" });
  await page.waitForTimeout(600);

  const chip = await moveTo(page, `button.chip:has-text("${PRESET}")`);
  await page.waitForTimeout(650);
  await click(page, chip);
  await page.waitForTimeout(1500);

  const runButton = await moveTo(page, "button.run");
  await page.waitForTimeout(550);

  const started = Date.now();
  await click(page, runButton);

  await page.locator(".cols").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.evaluate(() => window.scrollBy({ top: 430, behavior: "smooth" }));

  const column = STOP === "claude" ? "Claude rerank" : "TypeSafe rerank";
  await page
    .locator(".col", { hasText: column })
    .locator(".badge-pending")
    .waitFor({ state: "detached", timeout: 60_000 });
  console.log(`${column} settled in ${Date.now() - started} ms`);

  await page.waitForTimeout(1400);

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) throw new Error("No video captured");
  const webm = await video.path();

  const palette = path.join(WORK, "palette.png");
  const filters = `fps=${FPS},scale=${OUT_WIDTH}:-1:flags=lanczos`;
  ffmpeg([
    "-y",
    "-i",
    webm,
    "-vf",
    `${filters},palettegen=max_colors=128:stats_mode=diff`,
    palette,
  ]);
  ffmpeg([
    "-y",
    "-i",
    webm,
    "-i",
    palette,
    "-lavfi",
    `${filters}[x];[x][1:v]paletteuse=dither=none`,
    "-loop",
    "0",
    OUT,
  ]);

  /**
   * H.264 needs even dimensions, hence scale=-2, and social platforms will not inline a video
   * without yuv420p. Both fail silently: the file encodes but will not play.
   */
  ffmpeg([
    "-y",
    "-i",
    webm,
    "-vf",
    `fps=30,scale=${OUT_WIDTH}:-2:flags=lanczos`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    OUT_MP4,
  ]);

  fs.rmSync(WORK, { recursive: true, force: true });
  for (const file of [OUT, OUT_MP4]) {
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`${path.relative(EXAMPLE_ROOT, file)} — ${duration(file)}s, ${kb} KB`);
  }
}

function ffmpeg(args: string[]): void {
  const res = spawnSync("ffmpeg", ["-loglevel", "error", ...args], { stdio: "inherit" });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

function duration(file: string): string {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  return Number(res.stdout.trim()).toFixed(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
