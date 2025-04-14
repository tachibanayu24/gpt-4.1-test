const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// SQLite DB初期化
const db = new sqlite3.Database(path.join(__dirname, 'travel_items.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    packed INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS template_items (
    template_id INTEGER,
    name TEXT NOT NULL,
    packed INTEGER NOT NULL,
    FOREIGN KEY(template_id) REFERENCES templates(id)
  )`);
});

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.get('/', (req, res) => {
  res.send('Travel Items API is running');
});

// 持ち物リスト取得
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(row => ({ id: row.id, name: row.name, packed: !!row.packed })));
  });
});

// 持ち物追加
app.post('/api/items', (req, res) => {
  const { name, packed } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  db.run('INSERT INTO items (name, packed) VALUES (?, ?)', [name, packed ? 1 : 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, packed: !!packed });
  });
});

// 持ち物編集
app.put('/api/items/:id', (req, res) => {
  const { name, packed } = req.body;
  const { id } = req.params;
  db.run('UPDATE items SET name = ?, packed = ? WHERE id = ?', [name, packed ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ id: Number(id), name, packed: !!packed });
  });
});

// 持ち物削除
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Item not found' });
    res.json({ success: true });
  });
});

// テンプレート一覧取得
app.get('/api/templates', (req, res) => {
  db.all('SELECT * FROM templates', (err, templates) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT * FROM template_items', (err2, items) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const result = templates.map(t => ({
        id: t.id,
        name: t.name,
        items: items.filter(i => i.template_id === t.id).map(i => ({ name: i.name, packed: !!i.packed }))
      }));
      res.json(result);
    });
  });
});

// テンプレート新規作成
app.post('/api/templates', (req, res) => {
  const { name, items } = req.body;
  if (!name || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'name and items are required' });
  }
  db.run('INSERT INTO templates (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const templateId = this.lastID;
    const stmt = db.prepare('INSERT INTO template_items (template_id, name, packed) VALUES (?, ?, ?)');
    for (const item of items) {
      stmt.run(templateId, item.name, item.packed ? 1 : 0);
    }
    stmt.finalize();
    res.json({ id: templateId, name, items });
  });
});

// テンプレート削除
app.delete('/api/templates/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM templates WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM template_items WHERE template_id = ?', [id], function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

// Gemini APIで持ち物リスト提案
app.post('/api/suggest', async (req, res) => {
  const { destination, nights } = req.body;
  console.log('[AI提案] リクエスト:', { destination, nights });
  if (!destination || !nights) {
    return res.status(400).json({ error: 'destination and nights are required' });
  }
  try {
    const prompt = `あなたは旅行の持ち物リストを提案するアシスタントです。\n行き先は「${destination}」、泊数は${nights}泊です。\n日本語で、必要な持ち物を10〜20個程度、1行に1つずつ、持ち物名だけを出力してください。\nリスト以外の説明や前置き、まとめの文章は一切不要です。`;
    console.log('[AI提案] prompt:', prompt);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    console.log('[AI提案] SDK response:', text);
    const items = text
      .split('\n')
      .map(line => line.replace(/^[-*0-9.\s]+/, '').trim())
      .filter(Boolean);
    res.json({ items });
  } catch (e) {
    console.error('[AI提案] エラー:', e);
    res.status(500).json({ error: 'Gemini API error', detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
