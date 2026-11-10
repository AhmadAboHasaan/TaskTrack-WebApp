const form = document.querySelector('#task-form');
const list = document.querySelector('#task-list');
const addButton = document.querySelector('#add-button');
const errorBox = document.querySelector('#error-message');
const retryButton = document.querySelector('#retry-button');
let tasks = [];
let filter = 'all';
let loaded = false;
let busy = false;

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json' } });
  } catch {
    throw new Error('Cannot reach TaskTrack. Check your connection and try again.');
  }
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

function showError(error, canRetry = false) {
  document.querySelector('#error-text').textContent = error.message;
  retryButton.hidden = !canRetry;
  errorBox.hidden = false;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render() {
  list.replaceChildren();
  list.setAttribute('aria-busy', String(busy));
  document.querySelector('#total-count').textContent = loaded ? tasks.length : '—';
  const completed = tasks.filter(task => task.completed).length;
  document.querySelector('#pending-count').textContent = loaded ? tasks.length - completed : '—';
  document.querySelector('#completed-count').textContent = loaded ? completed : '—';
  const visible = tasks.filter(task => filter === 'all' || task.completed === (filter === 'completed'));
  document.querySelector('#visible-count').textContent = loaded ? visible.length : '—';
  if (!visible.length) {
    const empty = element('div', 'empty-state');
    empty.append(element('span', 'empty-icon', loaded ? '✓' : '◷'),
      element('h3', '', loaded ? (filter === 'all' ? 'A fresh start.' : `No ${filter} tasks.`) : 'Tasks unavailable'),
      element('p', '', loaded ? (filter === 'all' ? 'Add your first task and make a little progress today.' : filter === 'pending' ? 'You’re all caught up. Take a moment to enjoy it.' : 'Finish a task and celebrate your progress here.') : 'Use Retry above to load your tasks.'));
    list.append(empty);
  }
  for (const task of visible) {
    const card = element('article', `task-card${task.completed ? ' is-completed' : ''}`);
    const check = element('input', 'task-check');
    check.type = 'checkbox';
    check.checked = task.completed;
    check.disabled = busy;
    check.setAttribute('aria-label', `Mark ${task.title} as ${task.completed ? 'pending' : 'completed'}`);
    check.addEventListener('change', () => updateTask(task));
    const content = element('div', 'task-content');
    content.append(element('h3', 'task-title', task.title));
    if (task.description) content.append(element('p', 'task-description', task.description));
    const meta = element('div', 'task-meta');
    meta.append(element('span', `priority priority-${task.priority}`, `${task.priority} priority`), element('span', '', task.completed ? 'Completed' : 'Pending'));
    content.append(meta);
    const remove = element('button', 'delete-button');
    remove.type = 'button';
    remove.disabled = busy;
    remove.setAttribute('aria-label', `Delete ${task.title}`);
    // This icon is constant markup; all task content is inserted using textContent.
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7"/></svg>';
    remove.addEventListener('click', () => deleteTask(task));
    card.append(check, content, remove);
    list.append(card);
  }
}

async function runAction(action, message) {
  if (busy) return;
  busy = true;
  errorBox.hidden = true;
  addButton.disabled = true;
  list.setAttribute('aria-busy', 'true');
  list.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
  try {
    await action();
    document.querySelector('#feedback').textContent = message;
  } catch (error) {
    showError(error);
  } finally {
    busy = false;
    addButton.disabled = !loaded;
    render();
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) {
    form.elements.title.setCustomValidity('Please enter a task title.');
    form.elements.title.reportValidity();
    return;
  }
  runAction(async () => {
    addButton.textContent = 'Adding…';
    try {
      const data = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ title, description: form.elements.description.value.trim(), priority: form.elements.priority.value }) });
      tasks.unshift(data.task);
      form.reset();
      form.elements.title.focus();
    } finally {
      addButton.textContent = '＋ Add task';
    }
  }, 'Task added.');
});
form.elements.title.addEventListener('input', () => form.elements.title.setCustomValidity(''));

function updateTask(task) {
  return runAction(async () => {
    const data = await request(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ completed: !task.completed }) });
    tasks = tasks.map(item => item.id === task.id ? data.task : item);
  }, `Task marked ${task.completed ? 'pending' : 'completed'}.`);
}

function deleteTask(task) {
  return runAction(async () => {
    await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
    tasks = tasks.filter(item => item.id !== task.id);
  }, 'Task deleted.');
}

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    render();
  });
});

async function loadTasks() {
  retryButton.disabled = true;
  addButton.disabled = true;
  errorBox.hidden = true;
  list.setAttribute('aria-busy', 'true');
  try {
    const data = await request('/api/tasks');
    tasks = data.tasks;
    loaded = true;
  } catch (error) {
    showError(error, true);
  } finally {
    retryButton.disabled = false;
    addButton.disabled = !loaded;
    render();
  }
}
retryButton.addEventListener('click', loadTasks);
loadTasks();
