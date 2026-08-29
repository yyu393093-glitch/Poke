import { handleLocally, hasLocalHandler } from './localMock.js';

const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';

// 单文件离线版：完全不发网络请求，直接走本地假数据
const STANDALONE = import.meta.env.VITE_STANDALONE === '1';

export async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  const body = options.body ? JSON.parse(options.body) : undefined;

  if (STANDALONE) {
    return handleLocally(method, path, body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';

    return contentType.includes('application/json')
      ? response.json()
      : response.text();
  } catch (error) {
    // 后端没起来就退回本地假数据，前端照样能跑通（分工文档「招 2」）
    if (hasLocalHandler(method, path)) {
      console.warn(`[gameApi] ${method} ${path} 走本地兜底数据：${error.message}`);
      return handleLocally(method, path, body);
    }
    throw error;
  }
}

export function feishuAuth() {
  return request('/api/feishu/auth', { method: 'POST', body: JSON.stringify({}) });
}

export function fetchFeishuData(token) {
  return request(`/api/feishu/data?token=${encodeURIComponent(token)}`);
}

export function parseTasks(tasks) {
  return request('/api/ai/parse', {
    method: 'POST',
    body: JSON.stringify({ tasks }),
  });
}

export function approveNetwork(nodes, edges) {
  return request('/api/ai/approve', {
    method: 'POST',
    body: JSON.stringify({ nodes, edges }),
  });
}

export function pokeTask(from, to) {
  return request('/api/poke', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });
}

export function completeNode(nodeId) {
  return request('/api/node/complete', {
    method: 'POST',
    body: JSON.stringify({ nodeId }),
  });
}

export function clockOff() {
  return request('/api/clock/off', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function fetchMetrics() {
  return request('/api/metrics');
}

/** 取 Leader 下发给某个负责人的要求，由后端按规则拆成分点分条 */
export function fetchRequirements(owner) {
  return request('/api/ai/requirements', {
    method: 'POST',
    body: JSON.stringify({ owner }),
  });
}
