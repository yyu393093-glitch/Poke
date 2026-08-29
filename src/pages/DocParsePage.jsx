// 文档解析板块：独立只读查看器。
// 解析结果不回流到主 App（网络图/戳一戳/metrics 不变），也不改 GameContext；
// 「把解析结果导入协作网络图」列为后续任务（follow-up）。
import { useEffect, useState } from 'react';

import DocParsePanel from '../components/DocParsePanel.jsx';
import {
  getDocument,
  getError,
  listDocuments,
  parseDocument,
  uploadDocument,
} from '../api/gameApi.js';

export default function DocParsePage() {
  const [file, setFile] = useState(null);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeId, setActiveId] = useState('');

  async function loadHistory() {
    try {
      const data = await listDocuments();
      setHistory(Array.isArray(data?.documents) ? data.documents : []);
    } catch {
      // 历史加载失败不阻塞主流程
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function applyOutcome(outcome) {
    const err = getError(outcome);
    if (err) {
      setError(err);
      setResult(null);
    } else {
      setError('');
      setResult(outcome);
    }
  }

  async function handleUploadAndParse() {
    if (!file) {
      setError('请先选择文件');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const uploaded = await uploadDocument(file);
      const uploadErr = getError(uploaded);
      if (uploadErr) {
        setError(uploadErr);
        setResult(null);
      } else {
        const outcome = await parseDocument({ documentId: uploaded.documentId });
        applyOutcome(outcome);
        setActiveId('');
        await loadHistory();
      }
    } catch (err) {
      setError(err?.message ?? '上传或解析失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasteParse() {
    if (!pasteText.trim()) {
      setError('请先粘贴文档内容');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const outcome = await parseDocument({ text: pasteText });
      applyOutcome(outcome);
      setActiveId('');
      await loadHistory();
    } catch (err) {
      setError(err?.message ?? '解析失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenHistory(id) {
    setLoading(true);
    setError('');
    try {
      const outcome = await getDocument(id);
      applyOutcome(outcome);
      setActiveId(id);
    } catch (err) {
      setError(err?.message ?? '读取失败');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="m-0 text-2xl font-semibold">文档解析</h1>
          <p className="m-0 mt-1 text-sm text-slate-400">
            上传或粘贴协作文档，解析成结构化架构并生成推荐分工
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-6">
            {/* 输入区 */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
              <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                输入
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".txt,.md,.json"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-100 hover:file:bg-slate-600"
                />
                <button
                  type="button"
                  onClick={handleUploadAndParse}
                  disabled={loading}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  上传并解析
                </button>
              </div>

              <div className="mt-4">
                <textarea
                  value={pasteText}
                  onChange={(event) => setPasteText(event.target.value)}
                  rows={5}
                  placeholder="或直接粘贴文档全文…"
                  className="w-full rounded border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handlePasteParse}
                  disabled={loading}
                  className="mt-2 rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                >
                  粘贴并解析
                </button>
              </div>
            </section>

            {/* 结果区 */}
            <section className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
              <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
                结果
              </h2>
              {loading ? (
                <p className="m-0 text-sm text-slate-400">解析中…</p>
              ) : error ? (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
                  {error}
                </div>
              ) : result ? (
                <DocParsePanel result={result} />
              ) : (
                <p className="m-0 text-sm text-slate-500">
                  暂无结果，请上传或粘贴文档开始解析。
                </p>
              )}
            </section>
          </div>

          {/* 历史区 */}
          <aside className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-5">
            <h2 className="m-0 mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              历史解析
            </h2>
            {history.length === 0 ? (
              <p className="m-0 text-sm text-slate-500">暂无记录</p>
            ) : (
              <ul className="m-0 list-none space-y-2 p-0">
                {history.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenHistory(item.id)}
                      className={`w-full rounded border px-3 py-2 text-left text-sm transition ${
                        activeId === item.id
                          ? 'border-blue-500/60 bg-blue-500/10 text-blue-200'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="block truncate font-medium">
                        {item.source || item.summary || item.id}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {item.status === 'success' ? '成功' : '失败'} ·{' '}
                        {item.created_at
                          ? new Date(item.created_at).toLocaleString()
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
