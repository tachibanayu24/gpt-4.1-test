import React, { useState, useEffect } from 'react';
import {
  Container, Typography, TextField, Button, List, ListItem, ListItemText, Checkbox, IconButton, Box, Paper, Divider, Stack, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { ThemeProvider, createTheme } from '@mui/material/styles';

interface Item {
  id: number;
  name: string;
  packed: boolean;
}

interface Template {
  id: number;
  name: string;
  items: Omit<Item, 'id'>[];
}

const API_URL = 'http://localhost:3001/api';
const theme = createTheme({ palette: { mode: 'light' } });

function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [nights, setNights] = useState(1);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/items`).then(res => res.json()).then(setItems);
    fetch(`${API_URL}/templates`).then(res => res.json()).then(setTemplates);
  }, []);

  const handleAdd = async () => {
    if (input.trim() === '') return;
    const res = await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input, packed: false })
    });
    const newItem = await res.json();
    setItems([...items, newItem]);
    setInput('');
  };

  const handleDelete = async (id: number) => {
    await fetch(`${API_URL}/items/${id}`, { method: 'DELETE' });
    setItems(items.filter(item => item.id !== id));
  };

  const handleToggle = async (id: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const res = await fetch(`${API_URL}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: item.name, packed: !item.packed })
    });
    const updated = await res.json();
    setItems(items.map(i => i.id === id ? updated : i));
  };

  const handleEditStart = (id: number, name: string) => {
    setEditingId(id);
    setEditingValue(name);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleEditSave = async (id: number) => {
    if (!editingValue.trim()) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    const res = await fetch(`${API_URL}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingValue, packed: item.packed })
    });
    const updated = await res.json();
    setItems(items.map(i => i.id === id ? updated : i));
    setEditingId(null);
    setEditingValue('');
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || items.length === 0) return;
    const res = await fetch(`${API_URL}/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: templateName, items: items.map(({ name, packed }) => ({ name, packed })) })
    });
    const newTemplate = await res.json();
    setTemplates([...templates, newTemplate]);
    setTemplateName('');
  };

  const handleDeleteTemplate = async (id: number) => {
    await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE' });
    setTemplates(templates.filter(t => t.id !== id));
  };

  const handleApplyTemplate = async (template: Template) => {
    const existingNames = new Set(items.map(i => i.name));
    const newItems = template.items.filter(i => !existingNames.has(i.name));
    for (const item of newItems) {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, packed: item.packed })
      });
      const added = await res.json();
      setItems(prev => [...prev, added]);
    }
  };

  const handleSuggest = async () => {
    setSuggestLoading(true);
    setSuggestError('');
    setSuggested([]);
    try {
      const res = await fetch(`${API_URL}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, nights })
      });
      const data = await res.json();
      if (data.items) {
        setSuggested(data.items);
      } else {
        setSuggestError('AIから提案を取得できませんでした');
      }
    } catch {
      setSuggestError('AIから提案を取得できませんでした');
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSuggestEdit = (idx: number, value: string) => {
    setSuggested(suggested.map((item, i) => i === idx ? value : item));
  };

  const handleSuggestDelete = (idx: number) => {
    setSuggested(suggested.filter((_, i) => i !== idx));
  };

  const handleSuggestAdd = () => {
    setSuggested([...suggested, '']);
  };

  const handleApplySuggested = async () => {
    for (const name of suggested.filter(Boolean)) {
      const exists = items.some(i => i.name === name);
      if (!exists) {
        const res = await fetch(`${API_URL}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, packed: false })
        });
        const newItem = await res.json();
        setItems(prev => [...prev, newItem]);
      }
    }
    setSuggestOpen(false);
    setDestination('');
    setNights(1);
    setSuggested([]);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', py: 6 }}>
        <Container maxWidth="sm">
          <Paper elevation={4} sx={{ borderRadius: 4, p: { xs: 2, sm: 4 }, boxShadow: 6 }}>
            <Box textAlign="center" mb={2}>
              <Typography variant="h3" fontWeight={700} color="primary" gutterBottom letterSpacing={2}>
                TRIP PACKER
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                旅の持ち物をスマートに管理。テンプレートで準備もラクラク！
              </Typography>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<AddIcon />}
                sx={{ mt: 2, fontWeight: 600, borderRadius: 3 }}
                onClick={() => setSuggestOpen(true)}
              >
                AIに持ち物を提案してもらう
              </Button>
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
              <TextField
                label="持ち物を追加"
                variant="outlined"
                value={input}
                onChange={e => setInput(e.target.value)}
                fullWidth
                size="medium"
              />
              <Button variant="contained" color="primary" onClick={handleAdd} sx={{ minWidth: 120, fontWeight: 600 }}>
                追加
              </Button>
            </Stack>
            <Card variant="outlined" sx={{ mb: 4, borderRadius: 3, boxShadow: 0 }}>
              <CardContent sx={{ p: 0 }}>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1, mt: 2, ml: 2 }}>
                  持ち物リスト
                </Typography>
                <Divider />
                <List>
                  {items.length === 0 && (
                    <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                      まだ持ち物がありません
                    </Typography>
                  )}
                  {items.map(item => (
                    <ListItem key={item.id} divider secondaryAction={
                      editingId === item.id ? (
                        <>
                          <Button size="small" variant="contained" color="success" onClick={() => handleEditSave(item.id)} sx={{ mr: 1 }}>保存</Button>
                          <Button size="small" variant="outlined" onClick={handleEditCancel}>キャンセル</Button>
                        </>
                      ) : (
                        <>
                          <IconButton edge="end" aria-label="edit" onClick={() => handleEditStart(item.id, item.name)} sx={{ mr: 1 }}>
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(item.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </>
                      )
                    }>
                      <Checkbox
                        checked={item.packed}
                        onChange={() => handleToggle(item.id)}
                        disabled={editingId === item.id}
                        sx={{ mr: 2 }}
                      />
                      {editingId === item.id ? (
                        <TextField
                          value={editingValue}
                          onChange={e => setEditingValue(e.target.value)}
                          size="small"
                          autoFocus
                          sx={{ ml: 1, flex: 1 }}
                        />
                      ) : (
                        <ListItemText primary={item.name} sx={{ textDecoration: item.packed ? 'line-through' : 'none', fontSize: 18 }} />
                      )}
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderRadius: 3, boxShadow: 0 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 1 }}>
                  テンプレート管理
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                  <TextField
                    label="テンプレート名"
                    variant="outlined"
                    value={templateName}
                    onChange={e => setTemplateName(e.target.value)}
                    size="small"
                    fullWidth
                  />
                  <Button variant="outlined" onClick={handleSaveTemplate} disabled={!templateName.trim() || items.length === 0} sx={{ minWidth: 120, fontWeight: 600 }}>
                    現在のリストを保存
                  </Button>
                </Stack>
                <List>
                  {templates.length === 0 && (
                    <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                      テンプレートはまだありません
                    </Typography>
                  )}
                  {templates.map(t => (
                    <ListItem key={t.id} divider secondaryAction={
                      <>
                        <Button size="small" variant="contained" color="primary" onClick={() => handleApplyTemplate(t)} sx={{ mr: 1 }}>追加</Button>
                        <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteTemplate(t.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </>
                    }>
                      <ListItemText primary={t.name} secondary={t.items.map(i => i.name).join(', ')} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Paper>
        </Container>
        <Dialog open={suggestOpen} onClose={() => setSuggestOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>AIに持ち物を提案してもらう</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="行き先"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                fullWidth
                autoFocus
              />
              <TextField
                label="泊数"
                type="number"
                value={nights}
                onChange={e => setNights(Number(e.target.value))}
                fullWidth
                inputProps={{ min: 1 }}
              />
              <Button variant="contained" onClick={handleSuggest} disabled={suggestLoading || !destination || !nights}>
                {suggestLoading ? <CircularProgress size={24} /> : 'AIに提案してもらう'}
              </Button>
              {suggestError && <Typography color="error">{suggestError}</Typography>}
              {suggested.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" color="text.secondary">提案された持ち物リスト（編集可）</Typography>
                  <List>
                    {suggested.map((item, idx) => (
                      <ListItem key={idx} secondaryAction={
                        <IconButton edge="end" aria-label="delete" onClick={() => handleSuggestDelete(idx)}>
                          <DeleteIcon />
                        </IconButton>
                      }>
                        <TextField
                          value={item}
                          onChange={e => handleSuggestEdit(idx, e.target.value)}
                          size="small"
                          fullWidth
                        />
                      </ListItem>
                    ))}
                  </List>
                  <Button startIcon={<AddIcon />} onClick={handleSuggestAdd} sx={{ mb: 1 }}>
                    行を追加
                  </Button>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSuggestOpen(false)}>閉じる</Button>
            <Button onClick={handleApplySuggested} variant="contained" disabled={suggested.length === 0}>適用</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;
