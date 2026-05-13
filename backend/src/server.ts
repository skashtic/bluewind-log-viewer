import app from './app';

const PORT = process.env.PORT ?? 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('  POST /api/logs/reset — clear in-memory entries + parse errors');
});
