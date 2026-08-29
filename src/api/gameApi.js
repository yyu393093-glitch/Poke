const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function request(path, options = {}) {
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
