import cors from 'cors';
import express from 'express';

const PORT = 3001;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Poke server listening on http://localhost:${PORT}`);
});
