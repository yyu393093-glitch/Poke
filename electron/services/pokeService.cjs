async function sendPoke(payload, request = global.fetch) { const response = await request('http://localhost:3001/api/poke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`Poke failed: ${response.status}`); return response.json(); }
module.exports = { sendPoke };
