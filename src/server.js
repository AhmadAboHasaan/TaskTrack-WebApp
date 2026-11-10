const express = require('express');
const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

const app = express();
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../data'));
const dataFile = path.join(dataDir, 'tasks.json');
let tasks = [];
let writeQueue = Promise.resolve();

// Serialize read-modify-write operations so simultaneous requests cannot lose tasks.
function mutate(change) {
  const operation = writeQueue.then(async () => {
    const next = tasks.map(task => ({ ...task }));
    const result = change(next);
    const temporaryFile = `${dataFile}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(next, null, 2) + '\n', 'utf8');
    await fs.rename(temporaryFile, dataFile);
    tasks = next;
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function validateTask(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Send a JSON object.');
  }
  const { title, description = '', priority = 'medium' } = body;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
    throw badRequest('Title must contain 1–120 characters.');
  }
  if (typeof description !== 'string' || description.trim().length > 1000) {
    throw badRequest('Description must be text with at most 1,000 characters.');
  }
  if (!['low', 'medium', 'high'].includes(priority)) {
    throw badRequest('Priority must be low, medium, or high.');
  }
  return { title: title.trim(), description: description.trim(), priority };
}

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.get('/api/tasks', (req, res) => res.json({ tasks }));
app.post('/api/tasks', async (req, res) => {
  const input = validateTask(req.body);
  const task = { id: randomUUID(), ...input, completed: false, createdAt: new Date().toISOString() };
  await mutate(next => next.unshift(task));
  res.status(201).json({ task });
});
app.patch('/api/tasks/:id', async (req, res) => {
  if (!req.body || typeof req.body.completed !== 'boolean') {
    throw badRequest('Completed must be true or false.');
  }
  const task = await mutate(next => {
    const task = next.find(task => task.id === req.params.id);
    if (!task) throw Object.assign(new Error('Task not found.'), { status: 404 });
    task.completed = req.body.completed;
    return task;
  });
  res.json({ task });
});
app.delete('/api/tasks/:id', async (req, res) => {
  await mutate(next => {
    const index = next.findIndex(task => task.id === req.params.id);
    if (index === -1) throw Object.assign(new Error('Task not found.'), { status: 404 });
    next.splice(index, 1);
  });
  res.status(204).end();
});
app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) console.error('Request failed:', error);
  const message = error.type === 'entity.parse.failed' ? 'Invalid JSON body.'
    : status === 413 ? 'Request body is too large.'
    : status >= 500 ? 'Unable to save tasks. Please try again.' : error.message;
  res.status(status).json({ error: message });
});

async function start() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.writeFile(dataFile, '[]\n', { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  tasks = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  if (!Array.isArray(tasks) || tasks.some(task => !task || typeof task.id !== 'string'
      || typeof task.completed !== 'boolean' || typeof task.createdAt !== 'string')) {
    throw new Error('The task file contains invalid task records.');
  }
  tasks.forEach(validateTask);
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => console.log(`TaskTrack listening on http://localhost:${port}`))
    .on('error', error => { console.error('Server failed:', error.message); process.exitCode = 1; });
}

start().catch(error => {
  console.error('TaskTrack could not start:', error.message);
  process.exitCode = 1;
});
