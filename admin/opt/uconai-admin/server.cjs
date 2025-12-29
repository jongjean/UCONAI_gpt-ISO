const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 5050;
const APPS_ROOT = process.env.APPS_ROOT || '/var/www';

// 보호(삭제/생성 금지) 목록
const PROTECTED = new Set([]);

// 폴더명 유효성 (소문자, 숫자, 하이픈 2~32)
const NAME_RE = /^[a-z0-9-]{2,32}$/;

const app = express();
app.use(express.json());

app.get('/api/apps', async (_req, res) => {
  try {
    const items = await fsp.readdir(APPS_ROOT, { withFileTypes: true });
    const dirs = items.filter(d => d.isDirectory()).map(d => d.name).sort();
    res.json({ root: APPS_ROOT, apps: dirs });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/apps', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid-name' });
    if (PROTECTED.has(name)) return res.status(409).json({ error: 'protected-name' });

    const dir = path.join(APPS_ROOT, name);
    await fsp.mkdir(dir, { recursive: true });

    const idx = path.join(dir, 'index.html');
    if (!fs.existsSync(idx)) {
      const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${name}</title></head>
<body><h1>${name.toUpperCase()} OK</h1></body></html>`;
      await fsp.writeFile(idx, html, 'utf8');
    }

    // 권한: caddy로 소유
    try { await fsp.chown(dir, 33, 33); } catch {}
    try { await fsp.chmod(dir, 0o755); } catch {}
    try { await fsp.chown(path.join(dir,'index.html'), 33, 33); } catch {}
    try { await fsp.chmod(path.join(dir,'index.html'), 0o644); } catch {}

    res.json({ ok: true, name, url: `/${name}/` });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete('/api/apps/:name', async (req, res) => {
  try {
    const name = String(req.params.name || '').trim();
    if (!NAME_RE.test(name)) return res.status(400).json({ error: 'invalid-name' });
    if (PROTECTED.has(name)) return res.status(409).json({ error: 'protected-name' });

    const dir = path.join(APPS_ROOT, name);
    if (!fs.existsSync(dir)) return res.status(404).json({ error: 'not-found' });

    // 하위 전부 삭제
    await fsp.rm(dir, { recursive: true, force: true });
    res.json({ ok: true, deleted: name });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/healthz', (_req, res) => res.status(200).send('OK'));
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Admin API on 127.0.0.1:${PORT} (root=${APPS_ROOT})`);
});
