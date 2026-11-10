const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');

test('task lifecycle, persistence, validation, and concurrent writes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'tasktrack-test-'));
  const dataDir = path.join(directory, 'nested', 'data');
  const port = await new Promise(resolve => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  let server;
  let output = '';
  async function start() {
    server = spawn(process.execPath, ['src/server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    server.stdout.on('data', data => { output += data; });
    server.stderr.on('data', data => { output += data; });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(output);
      try {
        if ((await fetch(`${base}/health`)).ok) return;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Server did not start: ${output}`);
  }
  async function stop() {
    if (!server || server.exitCode !== null) return;
    await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
  }
  const api = (route, method = 'GET', body) => fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  try {
    await start();
    const health = await api('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'tasks.json'), 'utf8')), []);
    for (const asset of ['/', '/app.js', '/styles.css']) assert.equal((await api(asset)).status, 200);
    assert.deepEqual(await (await api('/api/tasks')).json(), { tasks: [] });
    for (const body of [{ title: ' ' }, { title: 42 }, { title: 'x'.repeat(121) },
      { title: 'test', description: 4 }, { title: 'test', description: 'x'.repeat(1001) },
      { title: 'test', priority: 'urgent' }, []]) {
      assert.equal((await api('/api/tasks', 'POST', body)).status, 400);
    }
    const malformed = await fetch(`${base}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error, 'Invalid JSON body.');
    const oversized = await api('/api/tasks', 'POST', { title: 'x'.repeat(20000) });
    assert.equal(oversized.status, 413);
    const created = await api('/api/tasks', 'POST', { title: '  OS lab  ', description: '  Test persistence  ', priority: 'high' });
    assert.equal(created.status, 201);
    const { task } = await created.json();
    assert.equal(task.title, 'OS lab');
    assert.equal(task.description, 'Test persistence');
    assert.equal(task.priority, 'high');
    assert.equal(task.completed, false);
    assert.equal((await api(`/api/tasks/${task.id}`, 'PATCH', { completed: 'yes' })).status, 400);
    const complete = await api(`/api/tasks/${task.id}`, 'PATCH', { completed: true });
    assert.equal(complete.status, 200);
    assert.equal((await complete.json()).task.completed, true);
    await stop();
    await start();
    assert.deepEqual((await (await api('/api/tasks')).json()).tasks, [{ ...task, completed: true }]);
    const pending = await api(`/api/tasks/${task.id}`, 'PATCH', { completed: false });
    assert.equal((await pending.json()).task.completed, false);
    const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => api('/api/tasks', 'POST', { title: `Concurrent ${index}` })));
    assert.ok(responses.every(response => response.status === 201));
    assert.equal((await (await api('/api/tasks')).json()).tasks.length, 13);
    assert.equal((await api(`/api/tasks/${task.id}`, 'DELETE')).status, 204);
    assert.equal((await api(`/api/tasks/${task.id}`, 'DELETE')).status, 404);
    assert.equal((await api('/api/tasks/missing', 'PATCH', { completed: true })).status, 404);
    assert.equal((await api('/api/unknown')).status, 404);
    await stop();
    await start();
    const persisted = (await (await api('/api/tasks')).json()).tasks;
    assert.equal(persisted.length, 12);
    assert.ok(persisted.every(item => item.id !== task.id));
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'tasks.json'), 'utf8')), persisted);
    // Force a real disk write failure without changing system permissions.
    const blockedWritePath = path.join(dataDir, 'tasks.json.tmp');
    await fs.mkdir(blockedWritePath);
    const failedWrite = await api('/api/tasks', 'POST', { title: 'Must not appear' });
    assert.equal(failedWrite.status, 500);
    assert.equal((await failedWrite.json()).error, 'Unable to save tasks. Please try again.');
    assert.deepEqual((await (await api('/api/tasks')).json()).tasks, persisted);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(dataDir, 'tasks.json'), 'utf8')), persisted);
    await fs.rmdir(blockedWritePath);
    assert.equal((await api('/api/tasks', 'POST', { title: 'Queue recovered' })).status, 201);
  } finally {
    await stop();
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('tasktrack-test-'));
    await fs.rm(directory, { recursive: true, force: true });
  }
});
