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

// ---- 文档解析板块接口 ----

// 文件上传不能用 request()：它会强制 Content-Type: application/json，
// 与 multipart/form-data 冲突。这里单独用 fetch + FormData，
// 且不手动设置 Content-Type（让浏览器自动带 boundary）。
export async function uploadDocument(file) {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch(`${API_BASE_URL}/api/doc/upload`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export function parseDocument(payload) {
  return request('/api/doc/parse', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listDocuments() {
  return request('/api/doc/list');
}

export function getDocument(id) {
  return request(`/api/doc/${encodeURIComponent(id)}`);
}

export function importOrg(text) {
  return request('/api/org/import', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function recommendAssignments(payload) {
  return request('/api/assignment/recommend', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
