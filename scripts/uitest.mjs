// 用 CDP 驱动无头 Chrome，对 /network 做真实点击验证。
// 用法: node scripts/uitest.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
// 默认测 dev server；传参可改成别的，例如单文件版的 file:// 地址
const URL = process.argv[2] || 'http://127.0.0.1:5173/network';
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

  console.log('[6] 打开小陈的要求 → 我收工了');
  await clickBy(byLabel('查看 小陈 的项目要求'), '小陈 头像');
  await sleep(1200);
  r['小陈要求条目数'] = await count('.pk-req__list li');
  await clickBy(`[...document.querySelectorAll('.pk-req__foot .pk-btn')][0]`, '我收工了');
  await sleep(900);
  r['关灯遮罩'] = await count('.pk-lightsoff');
  await shot('06-lights-off');

  console.log('[7] 关灯后再戳，应提示已下班');
  await clickBy(byLabel('催 老李 的进度'), '关灯后催进度');
  await sleep(500);
  r['关灯后 toast'] = (await text('.pk-toast')).slice(0, 46);
  await shot('07-poke-after-off');

  console.log('[8] 影响涟漪已移除、要求面板占位');
  r['影响涟漪面板已移除'] = (await text('.pk-world')).includes('影响涟漪') === false;
  r['要求面板占位存在'] = await count('.pk-req');

  console.log('[9] 点头像 → Leader 要求 AI 分点');
  await clickBy(byLabel('查看 阿May 的项目要求'), '阿May 头像');
  await sleep(1200);
  r['要求条目数'] = await count('.pk-req__list li');
  r['要求来源'] = (await text('.pk-req__from')).slice(0, 24);
  r['优先级标签'] = await evalJs(
    `[...document.querySelectorAll('.pk-req__pri')].map(e => e.textContent).join(',')`,
  );
  await shot('08-requirements');

  console.log('[10] 缩放：放大 → 世界层出现 transform + 缩略图视口框');
  await clickBy(byLabel('放大地图'), '放大');
  await sleep(700);
  r['放大后 transform'] = await evalJs(
    `document.querySelector('.pk-world').style.transform || '(none)'`,
  );
  r['缩略图视口框'] = await count('.pk-minimap-view');
  await shot('09-zoomed-in');

  // 放大后底图上的控件会移出视野，这里用固定的悬浮控制条
  console.log('[11] 悬浮控制条应可达（放大后底图控件已移出视野）');
  r['悬浮控制条出现'] = await count('.pk-viewctl');
  r['缩放读数'] = await text('.pk-viewctl span');
  await shot('10-zoom-controls');

  console.log('[12] 悬浮条重置视图 → 回到无 transform');
  await clickBy(`[...document.querySelectorAll('.pk-viewctl button')].find(b => b.textContent.includes('重置'))`, '重置视图');
  await sleep(900);
  r['重置后 transform'] = await evalJs(
    `document.querySelector('.pk-world').style.transform || '(none)'`,
  );
  r['重置后视口框'] = await count('.pk-minimap-view');
  r['重置后悬浮条'] = await count('.pk-viewctl');
  await shot('11-view-reset');

  console.log('[13] 缩略地图定位（视图已重置，控件回到原位）');
  await clickBy(byLabel('缩略地图'), '缩略地图');
  await sleep(900);
  r['缩略图定位后 transform'] = await evalJs(
    `document.querySelector('.pk-world').style.transform || '(none)'`,
  );
  await shot('12-minimap-jump');

  r['控制台错误'] = errors;

  console.log('\n=== REPORT ===');
  console.log(JSON.stringify(r, null, 2));
  console.log(`\nscreenshots -> ${OUT}`);

  ws.close();
  chrome.kill();
}

main().catch((error) => { console.error(error); chrome.kill(); process.exit(1); });
