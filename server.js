const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const codexFile = path.join(__dirname, 'codex.json');

// Middleware
app.use(bodyParser.json());

// Initialize codex file if it doesn't exist
if (!fs.existsSync(codexFile)) {
  fs.writeFileSync(codexFile, JSON.stringify({ entries: [] }, null, 2));
}

// Helper function to read codex
const readCodex = () => {
  const data = fs.readFileSync(codexFile, 'utf8');
  return JSON.parse(data);
};

// Helper function to write codex
const writeCodex = (data) => {
  fs.writeFileSync(codexFile, JSON.stringify(data, null, 2));
};

// GET /codex - Read all entries
app.get('/codex', (req, res) => {
  try {
    const data = readCodex();
    res.json(data.entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read codex' });
  }
});

// GET /codex/:id - Read a specific entry
app.get('/codex/:id', (req, res) => {
  try {
    const data = readCodex();
    const entry = data.entries.find(e => e.id === req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    res.json(entry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read codex' });
  }
});

// POST /codex - Create new entry
app.post('/codex', (req, res) => {
  try {
    const { title, content, category } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const data = readCodex();
    const newEntry = {
      id: Date.now().toString(),
      title,
      content,
      category: category || 'general',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.entries.push(newEntry);
    writeCodex(data);
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// PUT /codex/:id - Update entry
app.put('/codex/:id', (req, res) => {
  try {
    const { title, content, category } = req.body;
    const data = readCodex();
    const entryIndex = data.entries.findIndex(e => e.id === req.params.id);

    if (entryIndex === -1) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (title) data.entries[entryIndex].title = title;
    if (content) data.entries[entryIndex].content = content;
    if (category) data.entries[entryIndex].category = category;
    data.entries[entryIndex].updatedAt = new Date().toISOString();

    writeCodex(data);
    res.json(data.entries[entryIndex]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /codex/:id - Delete entry
app.delete('/codex/:id', (req, res) => {
  try {
    const data = readCodex();
    const entryIndex = data.entries.findIndex(e => e.id === req.params.id);

    if (entryIndex === -1) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    const deletedEntry = data.entries.splice(entryIndex, 1);
    writeCodex(data);
    res.json({ message: 'Entry deleted', entry: deletedEntry[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Codex API running on http://localhost:${PORT}`);
});
