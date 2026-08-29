import { useEffect, useState } from 'react';
import { getFloatingWindowOffset } from './pokeModel.js';

const FLOATING_WINDOW_OFFSET = getFloatingWindowOffset();

// 【仅演示组件，禁止生产环境启用】
export default function FakeIMWindow({ messages }) {
  const [readId, setReadId] = useState(null);
  useEffect(() => { const latest = messages.at(-1); if (!latest) return undefined; setReadId(latest.id); const timer = setTimeout(() => setReadId(null), 1000); return () => clearTimeout(timer); }, [messages]);
  return <aside className="fixed z-30 flex h-72 w-80 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/95 shadow-2xl" style={FLOATING_WINDOW_OFFSET} aria-label="演示 IM 悬浮窗"><header className="flex h-12 items-center justify-between border-b border-slate-700 px-4"><div><b className="text-sm">💬 飞书模拟 · 陈总</b><small className="block text-[10px] text-amber-400">演示窗口，不会真实发送</small></div><span className="h-2 w-2 rounded-full bg-emerald-400" /></header><div className="flex-1 space-y-3 overflow-auto p-4 text-xs"><div className="max-w-[85%] rounded-xl bg-slate-800 p-3 text-slate-400">首页视觉这边等品牌素材定稿。</div>{messages.map((message) => <div className="relative ml-auto max-w-[88%] rounded-xl bg-blue-600 p-3 text-white" key={message.id}>{message.message}{readId === message.id && <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px]">已读</span>}</div>)}</div><footer className="flex gap-2 border-t border-slate-700 px-3 py-2 text-[10px] text-slate-500"><span className="text-blue-300">飞书 · 激活</span><span>企业微信</span><span>钉钉</span></footer></aside>;
}
