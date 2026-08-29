// 用 CDP 驱动无头 Chrome，对 /network 做真实点击验证。
// 用法: node scripts/uitest.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://127.0.0.1:5173/network';
const OUT = path.join(os.tmpdir(), 'pk-ui');
const PORT = 9222;

fs.mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--no-proxy-server',
  `--user-data-dir=${path.join(os.tmpdir(), 'pk-cdp-profile')}`,
  `--remote-debugging-port=${PORT}`,
  '--window-size=1536,1024', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let nextId = 1;

async function main() {
  let wsUrl;
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
      if (wsUrl) break;
    } catch { /* 等 chrome 起来 */ }
    await sleep(250);
  }

  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result ?? msg.error);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(String(msg.params.exceptionDetails.text));
    }
  });

  const send = (method, params = {}) => new Promise((res) => {
    const id = nextId++;
    pending.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  // 锁定视口，让舞台缩放为 1:1
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536, height: 1024, deviceScaleFactor: 1, mobile: false,
  });

  await send('Page.navigate', { url: URL });
  await sleep(3600);

  const evalJs = async (expression) => {
    const { result } = await send('Runtime.evaluate', { expression, returnByValue: true });
    return result?.value;
  };

  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  };

  /** 按 aria-label 或文字找到元素，点它的中心（用真实 DOM 位置，不写死坐标） */
  async function clickBy(finder, label) {
    const pos = await evalJs(`(() => { const el = ${finder}; if (!el) return null;
      const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
    if (!pos) { console.log(`  MISS: ${label} (找不到元素)`); return false; }
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos[0], y: pos[1] });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos[0], y: pos[1], button: 'left', clickCount: 1 });
    await sleep(80);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos[0], y: pos[1], button: 'left', clickCount: 1 });
    await sleep(1000);
    console.log(`  ok: ${label}  @(${Math.round(pos[0])},${Math.round(pos[1])})`);
    return true;
  }

  const byLabel = (text) => `document.querySelector('[aria-label*=${JSON.stringify(text)}]')`;
  const byBtnText = (text) => `[...document.querySelectorAll('.pk-popover .pk-btn')].find(e => e.textContent.includes(${JSON.stringify(text)}))`;
  const count = (sel) => evalJs(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
  const text = (sel) => evalJs(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`);

  const r = {};

  console.log('\n[1] 点击节点 03 首页设计稿');
  await clickBy(byLabel('03 首页设计稿'), '节点 03');
  r['详情浮层出现'] = await count('.pk-popover');
  r['瓶颈呼吸环出现'] = await count('.pk-bottleneck');
  r['浮层含下游影响'] = (await text('.pk-popover')).includes('前端开发');
  await shot('01-node-popover');

  console.log('[2] 详情内「戳一戳催进度」');
  await clickBy(byBtnText('戳一戳'), '戳一戳催进度');
  await sleep(600);
  r['戳后出现公开记录'] = await count('.pk-newlog');
  r['戳后 toast 文案'] = (await text('.pk-toast')).slice(0, 40);
  await shot('02-after-poke');

  console.log('[3] Leader 行「催 陈总 的进度」');
  await clickBy(byLabel('催 陈总 的进度'), 'Leader 催进度');
  await sleep(600);
  r['Leader 催后记录条数'] = await count('.pk-newlog');
  r['Leader 催后 toast'] = (await text('.pk-toast')).slice(0, 46);
  await shot('03-leader-poke');

  console.log('[4] 打开 05 前端开发 → 标记完成');
  await clickBy(byLabel('05 前端开发'), '节点 05');
  await clickBy(byBtnText('标记完成'), '标记完成');
  await sleep(900);
  r['完成后药丸覆盖'] = await count('.pk-pill');
  r['完成后指标覆盖'] = await count('.pk-cover--stat');
  r['完成后 DOM 通知条'] = await count('.pk-notice');
  r['完成后通知文案'] = (await text('.pk-notice')).slice(0, 40);
  await shot('04-after-complete');

  console.log('[5] 关闭通知条');
  await clickBy(`document.querySelector('.pk-notice__close')`, '通知条关闭按钮');
  await sleep(600);
  r['关闭后补位图'] = await count('.pk-notice-patch');
  r['关闭后通知条'] = await count('.pk-notice');
  await shot('05-notice-closed');

  console.log('[6] 收工关灯');
  await clickBy(byLabel('收工关灯'), '收工关灯');
  await sleep(900);
  r['关灯遮罩'] = await count('.pk-lightsoff');
  await shot('06-lights-off');

  console.log('[7] 关灯后再戳，应提示已下班');
  await clickBy(byLabel('催 老李 的进度'), '关灯后催进度');
  await sleep(500);
  r['关灯后 toast'] = (await text('.pk-toast')).slice(0, 46);
  await shot('07-poke-after-off');

  r['控制台错误'] = errors;

  console.log('\n=== REPORT ===');
  console.log(JSON.stringify(r, null, 2));
  console.log(`\nscreenshots -> ${OUT}`);

  ws.close();
  chrome.kill();
}

main().catch((error) => { console.error(error); chrome.kill(); process.exit(1); });
