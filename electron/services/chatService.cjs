async function sendChat(payload, request = global.fetch) { const response = await request('http://localhost:3001/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Chat failed: ${response.status}`); return response.json(); }
module.exports = { sendChat };
