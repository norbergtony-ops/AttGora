(() => {
  'use strict';

  const STORAGE_KEY = 'klart-pwa-data-v1';
  const LOCALE = 'sv-SE';
  const ACCENTS = ['#d7f36b', '#f1715d', '#8fc6c1', '#f1bf63', '#baafd8'];

  const els = {
    taskForm: document.querySelector('#taskForm'),
    taskTitle: document.querySelector('#taskTitle'),
    taskList: document.querySelector('#taskList'),
    historyList: document.querySelector('#historyList'),
    activeView: document.querySelector('#activeView'),
    historyView: document.querySelector('#historyView'),
    viewTitle: document.querySelector('#viewTitle'),
    viewEyebrow: document.querySelector('#viewEyebrow'),
    todayLabel: document.querySelector('#todayLabel'),
    activeCount: document.querySelector('#activeCount'),
    historyCount: document.querySelector('#historyCount'),
    taskListMeta: document.querySelector('#taskListMeta'),
    summaryPrimary: document.querySelector('#summaryPrimary'),
    summarySecondary: document.querySelector('#summarySecondary'),
    overallRing: document.querySelector('#overallRing'),
    overallPercent: document.querySelector('#overallPercent'),
    navItems: [...document.querySelectorAll('.nav-item')],
    taskDialog: document.querySelector('#taskDialog'),
    dialogTitle: document.querySelector('#dialogTitle'),
    closeDialog: document.querySelector('#closeDialog'),
    createdLabel: document.querySelector('#createdLabel'),
    actionProgressText: document.querySelector('#actionProgressText'),
    detailProgressFill: document.querySelector('#detailProgressFill'),
    actionsCount: document.querySelector('#actionsCount'),
    actionForm: document.querySelector('#actionForm'),
    actionTitle: document.querySelector('#actionTitle'),
    actionDate: document.querySelector('#actionDate'),
    actionList: document.querySelector('#actionList'),
    completionHint: document.querySelector('#completionHint'),
    completeTask: document.querySelector('#completeTask'),
    deleteTask: document.querySelector('#deleteTask'),
    historyDialog: document.querySelector('#historyDialog'),
    historyDialogTitle: document.querySelector('#historyDialogTitle'),
    historyCompletedLabel: document.querySelector('#historyCompletedLabel'),
    historyActionList: document.querySelector('#historyActionList'),
    closeHistoryDialog: document.querySelector('#closeHistoryDialog'),
    restoreTask: document.querySelector('#restoreTask'),
    deleteHistoryTask: document.querySelector('#deleteHistoryTask'),
    toast: document.querySelector('#toast'),
    connectionStatus: document.querySelector('#connectionStatus'),
    installButton: document.querySelector('#installButton')
  };

  let state = loadState();
  let selectedTaskId = null;
  let selectedHistoryTaskId = null;
  let deferredInstallPrompt = null;
  let toastTimer = null;

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (parsed && Array.isArray(parsed.tasks)) return parsed;
    } catch (error) {
      console.warn('Kunde inte läsa sparad data.', error);
    }
    return { tasks: [] };
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function nowIso() { return new Date().toISOString(); }
  function todayIso() {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
  }

  function escapeHtml(value = '') {
    return value.replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
  }

  function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!value) return 'Datum saknas';
    const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
    return new Intl.DateTimeFormat(LOCALE, options).format(date);
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
  }

  function plural(count, one, many) { return count === 1 ? one : many; }
  function activeTasks() { return state.tasks.filter((task) => !task.completedAt); }
  function completedTasks() { return state.tasks.filter((task) => task.completedAt).sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)); }
  function getTask(id) { return state.tasks.find((task) => task.id === id); }
  function actionStats(task) {
    const total = task.actions.length;
    const done = task.actions.filter((action) => action.completed).length;
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add('show');
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2300);
  }

  function render() {
    const active = activeTasks();
    const history = completedTasks();
    els.activeCount.textContent = active.length;
    els.historyCount.textContent = history.length;
    renderActive(active);
    renderHistory(history);
  }

  function renderActive(tasks) {
    const allActions = tasks.flatMap((task) => task.actions);
    const doneActions = allActions.filter((action) => action.completed).length;
    const overall = allActions.length ? Math.round((doneActions / allActions.length) * 100) : 0;

    els.taskListMeta.textContent = `${tasks.length} ${plural(tasks.length, 'sak', 'saker')}`;
    els.overallPercent.textContent = `${overall}%`;
    els.overallRing.style.setProperty('--progress', `${overall * 3.6}deg`);
    els.overallRing.setAttribute('aria-label', `${overall} procent av alla actions klara`);

    if (!tasks.length) {
      els.summaryPrimary.textContent = 'Inget på listan';
      els.summarySecondary.textContent = 'Lägg till din första sak ovan.';
      els.taskList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-mark" aria-hidden="true">✓</div>
          <strong>Här är det luftigt.</strong>
          <p>Skriv in något du vill få ur huvudet och in i mål.</p>
        </div>`;
      return;
    }

    const untouched = tasks.filter((task) => task.actions.length === 0).length;
    els.summaryPrimary.textContent = `${tasks.length} ${plural(tasks.length, 'sak', 'saker')} på gång`;
    els.summarySecondary.textContent = allActions.length
      ? `${doneActions} av ${allActions.length} actions är färdiga${untouched ? ` · ${untouched} väntar på nästa steg` : ''}.`
      : 'Öppna en sak och lägg till dess första action.';

    els.taskList.innerHTML = tasks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((task, index) => {
        const stats = actionStats(task);
        const actionText = stats.total ? `${stats.done} av ${stats.total} actions` : 'Inga actions ännu';
        return `
          <button class="task-card" type="button" data-task-id="${task.id}" style="--card-accent:${ACCENTS[index % ACCENTS.length]}">
            <div>
              <h3 class="task-title">${escapeHtml(task.title)}</h3>
              <div class="task-meta">
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${actionText}</span>
                <span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>Skapad ${formatDate(task.createdAt, { day: 'numeric', month: 'short' })}</span>
              </div>
            </div>
            <div class="mini-progress" aria-label="${stats.percent} procent klart">
              <div class="mini-progress-label"><span>FRAMSTEG</span><span>${stats.percent}%</span></div>
              <div class="mini-progress-track"><div class="mini-progress-fill" style="width:${stats.percent}%"></div></div>
            </div>
          </button>`;
      }).join('');
  }

  function groupLabel(dateIso) {
    const date = new Date(dateIso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'I dag';
    if (date.toDateString() === yesterday.toDateString()) return 'I går';
    return new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }).format(date);
  }

  function renderHistory(tasks) {
    if (!tasks.length) {
      els.historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-mark" aria-hidden="true">↗</div>
          <strong>Historiken väntar.</strong>
          <p>När du markerar en sak som färdig hamnar den här.</p>
        </div>`;
      return;
    }

    const groups = new Map();
    tasks.forEach((task) => {
      const label = groupLabel(task.completedAt);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(task);
    });

    els.historyList.innerHTML = [...groups.entries()].map(([label, group]) => `
      <section class="history-group">
        <h3>${escapeHtml(label)}</h3>
        ${group.map((task) => `
          <button class="history-card" type="button" data-history-id="${task.id}">
            <span class="history-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
            <span class="history-card-copy">
              <span class="history-card-title">${escapeHtml(task.title)}</span>
              <span class="history-card-meta">Klar ${formatDateTime(task.completedAt)} · ${task.actions.length} ${plural(task.actions.length, 'action', 'actions')}</span>
            </span>
            <svg class="history-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>`).join('')}
      </section>`).join('');
  }

  function openTask(id) {
    selectedTaskId = id;
    renderTaskDialog();
    els.taskDialog.showModal();
  }

  function renderTaskDialog() {
    const task = getTask(selectedTaskId);
    if (!task) return;
    const stats = actionStats(task);
    els.dialogTitle.textContent = task.title;
    els.createdLabel.textContent = `Skapad ${formatDateTime(task.createdAt)}`;
    els.actionProgressText.textContent = `${stats.done} av ${stats.total}`;
    els.detailProgressFill.style.width = `${stats.percent}%`;
    els.actionsCount.textContent = `${stats.total} ${plural(stats.total, 'action', 'actions')}`;
    els.completeTask.disabled = !stats.total || stats.done !== stats.total;
    els.completionHint.textContent = !stats.total
      ? 'Lägg till minst en action'
      : stats.done !== stats.total
        ? `${stats.total - stats.done} ${plural(stats.total - stats.done, 'action återstår', 'actions återstår')}`
        : 'Allt är klart — snyggt!';

    if (!task.actions.length) {
      els.actionList.innerHTML = '<div class="actions-empty">Bryt ned saken i konkreta, daterade steg.</div>';
      return;
    }

    els.actionList.innerHTML = task.actions.map((action) => {
      const overdue = !action.completed && action.date < todayIso();
      return `
        <div class="action-row ${action.completed ? 'is-done' : ''}" data-action-id="${action.id}">
          <button class="check-button" type="button" data-action="toggle" aria-label="${action.completed ? 'Markera som inte färdig' : 'Markera som färdig'}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
          </button>
          <div class="action-copy">
            <span class="action-name">${escapeHtml(action.title)}</span>
            <span class="action-date ${overdue ? 'is-overdue' : ''}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>
              ${overdue ? 'Försenad · ' : ''}${formatDate(action.date)}
            </span>
          </div>
          <span class="action-completed-stamp">${action.completedAt ? `Klar<br>${formatDate(action.completedAt, { day: 'numeric', month: 'short' })}` : ''}</span>
          <button class="delete-action" type="button" data-action="delete" aria-label="Ta bort action">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/></svg>
          </button>
        </div>`;
    }).join('');
  }

  function openHistoryTask(id) {
    selectedHistoryTaskId = id;
    const task = getTask(id);
    if (!task) return;
    els.historyDialogTitle.textContent = task.title;
    els.historyCompletedLabel.textContent = `Färdig ${formatDateTime(task.completedAt)}`;
    els.historyActionList.innerHTML = task.actions.map((action) => `
      <div class="history-action">
        <span class="history-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg></span>
        <span><strong>${escapeHtml(action.title)}</strong><span>Planerad ${formatDate(action.date)}${action.completedAt ? ` · klar ${formatDate(action.completedAt)}` : ''}</span></span>
      </div>`).join('');
    els.historyDialog.showModal();
  }

  function switchView(view) {
    const history = view === 'history';
    els.activeView.hidden = history;
    els.historyView.hidden = !history;
    els.viewEyebrow.textContent = history ? 'DINA FRAMSTEG' : 'DIN ÖVERSIKT';
    els.viewTitle.textContent = history ? 'Det här har du klarat.' : 'Vad vill du få gjort?';
    els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.view === view));
    document.title = history ? 'Historik — Klart' : 'Klart — Att göra';
  }

  els.taskForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = els.taskTitle.value.trim();
    if (!title) return;
    const task = { id: uid('task'), title, createdAt: nowIso(), completedAt: null, actions: [] };
    state.tasks.push(task);
    saveState();
    els.taskTitle.value = '';
    render();
    openTask(task.id);
    els.actionTitle.focus();
    showToast('Saken är tillagd');
  });

  els.taskList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-task-id]');
    if (card) openTask(card.dataset.taskId);
  });

  els.historyList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-history-id]');
    if (card) openHistoryTask(card.dataset.historyId);
  });

  els.navItems.forEach((item) => item.addEventListener('click', () => switchView(item.dataset.view)));

  els.actionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const task = getTask(selectedTaskId);
    const title = els.actionTitle.value.trim();
    if (!task || !title || !els.actionDate.value) return;
    task.actions.push({ id: uid('action'), title, date: els.actionDate.value, completed: false, completedAt: null, createdAt: nowIso() });
    saveState();
    els.actionTitle.value = '';
    els.actionDate.value = todayIso();
    render();
    renderTaskDialog();
    els.actionTitle.focus();
    showToast('Action tillagd');
  });

  els.actionList.addEventListener('click', (event) => {
    const row = event.target.closest('[data-action-id]');
    const control = event.target.closest('[data-action]');
    const task = getTask(selectedTaskId);
    if (!row || !control || !task) return;
    const index = task.actions.findIndex((action) => action.id === row.dataset.actionId);
    if (index < 0) return;
    if (control.dataset.action === 'toggle') {
      const action = task.actions[index];
      action.completed = !action.completed;
      action.completedAt = action.completed ? nowIso() : null;
      showToast(action.completed ? 'Action markerad som färdig' : 'Action öppnad igen');
    } else if (control.dataset.action === 'delete') {
      task.actions.splice(index, 1);
      showToast('Action borttagen');
    }
    saveState();
    render();
    renderTaskDialog();
  });

  els.dialogTitle.addEventListener('blur', () => {
    const task = getTask(selectedTaskId);
    const title = els.dialogTitle.textContent.trim();
    if (!task) return;
    if (title) task.title = title;
    else els.dialogTitle.textContent = task.title;
    saveState();
    render();
  });

  els.dialogTitle.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); els.dialogTitle.blur(); }
  });

  els.completeTask.addEventListener('click', () => {
    const task = getTask(selectedTaskId);
    if (!task) return;
    const stats = actionStats(task);
    if (!stats.total || stats.done !== stats.total) return;
    task.completedAt = nowIso();
    saveState();
    els.taskDialog.close();
    switchView('history');
    render();
    showToast('Saken är klar och flyttad till historiken');
  });

  els.deleteTask.addEventListener('click', () => {
    const task = getTask(selectedTaskId);
    if (!task || !window.confirm(`Ta bort “${task.title}”?`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    saveState();
    els.taskDialog.close();
    render();
    showToast('Saken är borttagen');
  });

  els.restoreTask.addEventListener('click', () => {
    const task = getTask(selectedHistoryTaskId);
    if (!task) return;
    task.completedAt = null;
    saveState();
    els.historyDialog.close();
    switchView('active');
    render();
    showToast('Saken är tillbaka på listan');
  });

  els.deleteHistoryTask.addEventListener('click', () => {
    const task = getTask(selectedHistoryTaskId);
    if (!task || !window.confirm(`Ta bort “${task.title}” permanent?`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    saveState();
    els.historyDialog.close();
    render();
    showToast('Historikposten är borttagen');
  });

  els.closeDialog.addEventListener('click', () => els.taskDialog.close());
  els.closeHistoryDialog.addEventListener('click', () => els.historyDialog.close());
  [els.taskDialog, els.historyDialog].forEach((dialog) => dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  }));

  function updateConnectionStatus() {
    const online = navigator.onLine;
    els.connectionStatus.classList.toggle('is-offline', !online);
    els.connectionStatus.querySelector('span:last-child').textContent = online ? 'Redo offline' : 'Offline — allt fungerar';
  }
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
  els.installButton.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    els.installButton.hidden = true;
    showToast('Klart är installerad');
  });

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
  }

  els.todayLabel.textContent = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date());
  els.actionDate.value = todayIso();
  updateConnectionStatus();
  render();
})();
