import { useState } from 'react';
import { request } from '../api/gameApi.js';
import { FEATURE_POKE_DEMO_MODE } from '../config/features.js';
import { useGame } from '../context/GameContext.jsx';
import { buildPokeEvent, getPokeFallback } from './pokeModel.js';

export default function PokeAction({ node, onDelivered }) {
  const { state, dispatch } = useGame();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  if (!node || node.owner === state.currentUser || node.status === 'done') return null;

  async function sendPoke() {
    if (busy) return;
    setBusy(true); setError('');
    let response;
    try {
      response = await request('/api/poke', { method: 'POST', body: JSON.stringify({ from: state.currentUser, to: node.id }) });
    } catch {
      response = getPokeFallback(FEATURE_POKE_DEMO_MODE, node, state.currentUser);
      if (!response) {
        setError('催办发送失败，请检查网络后重试');
        setBusy(false);
        return;
      }
    }
    const poke = buildPokeEvent(response, { from: state.currentUser, to: node.id, receiver: node.owner, time: new Date().toLocaleTimeString('zh-CN', { hour12: false }) });
    dispatch({ type: 'ADD_POKE', payload: poke }); setMessage(poke.message);
    if (poke.pushStatus === 'fail') setError('催办发送失败，请稍后重试');
    onDelivered?.(poke, node.id); setBusy(false);
  }

  return <section className="mt-4 border-t border-slate-800 pt-4"><button type="button" disabled={busy} onClick={sendPoke} className="w-full rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50">{busy ? '正在生成催办消息…' : `戳一戳 ${node.owner}`}</button>{message && <div className="mt-3 rounded-xl bg-slate-800 p-3 text-xs leading-5 text-slate-300"><b className="mb-1 block text-blue-300">自动生成 · 不可编辑</b>{message}</div>}{error && <p className="mt-2 text-xs text-red-400">{error}</p>}</section>;
}
