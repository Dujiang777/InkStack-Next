// 视觉自检工具：playwright-core 直驱本地 Chrome（无需下载浏览器）
// 用法：node scripts/screenshot.mjs <url路径> <输出.png> [--width 1280] [--height 900] [--no-login]
// 登录账号走 .env 本地测试号（默认 test@inkstack.dev），登录后访问目标页并整页截图
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// playwright-core 从托管 Node 工作区解析（ESM 不认 NODE_PATH，用 createRequire 桥接）
const WS_NM = "C:/Users/AMBITIOUS_YUAN/.workbuddy/binaries/node/workspace/node_modules";
const { chromium } = createRequire(path.join(WS_NM, "noop.js"))("playwright-core");

const CHROME_CANDIDATES = [
  path.join(process.env.USERPROFILE ?? "", ".agent-browser", "browsers", "chrome-153.0.8010.36", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

function pickChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && existsSync(p)) return p;
  }
  throw new Error("找不到可用的 Chrome/Edge");
}

function argOf(name, dflt) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : dflt;
}

const route = process.argv[2] ?? "/";
const out = process.argv[3] ?? ".wb-shot.png";
const width = Number(argOf("--width", 1280));
const height = Number(argOf("--height", 900));
const noLogin = process.argv.includes("--no-login");

const base = "http://127.0.0.1:3100";
const browser = await chromium.launch({
  executablePath: pickChrome(),
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--disable-crashpad", "--no-first-run"],
});
const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

if (!noLogin) {
  // 页面上下文内直接调登录 API，会话 Cookie 自动落在浏览器上下文；--user 可切换账号
  const users = {
    test: { email: "test@inkstack.dev", password: "test12345" },
    writer1: { email: "writer1@inkstack.dev", password: "writer123" },
  };
  const who = argOf("--user", "test");
  const resp = await page.request.post(`${base}/api/auth/login`, {
    data: users[who] ?? users.test,
  });
  if (!resp.ok()) console.warn("[shot] 登录失败:", resp.status(), "将以游客视角截图");
}

await page.goto(base + route, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
if (process.argv.includes("--night")) {
  await page.evaluate(() => {
    localStorage.setItem("ink-theme", "night");
    document.body.dataset.theme = "night";
  });
}
await page.waitForTimeout(Number(argOf("--wait", 600))); // 等字体/动效稳定（--wait 可调，入场动画长时加大）
const scrollY = Number(argOf("--scroll", 0));
if (scrollY > 0) {
  await page.evaluate((y) => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(400);
}
await page.screenshot({ path: out, fullPage: process.argv.includes("--full") });
console.log("[shot] 已保存:", out);
await browser.close();
