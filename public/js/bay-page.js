document.addEventListener('DOMContentLoaded', async () => {
  const bayNumber = parseInt(document.body.dataset.bay || '1', 10);

  let timerInterval;

  const projectNameEl = document.getElementById('projectName');
  const assignedPersonEl = document.getElementById('assignedPerson');
  const timerRangeEl = document.getElementById('timerRange');
  const pausedStatusEl = document.getElementById('pausedStatus');
  const delayReasonEl = document.getElementById('delayReason');
  const tasksContainer = document.getElementById('tasks');
  const timerEl = document.getElementById('timer');
  const dateTimeEl = document.getElementById('dateTime');
  const movementBlock = document.getElementById('movementBlock');

  const TASK_STATE_KEY = `bay-${bayNumber}-task-state`;
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  function formatDate(value) {
    if (!value) return 'N/A';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'N/A' : dateFormatter.format(d);
  }

  function renderTasks(tasks) {
    tasksContainer.innerHTML = '';
    const saved = JSON.parse(localStorage.getItem(TASK_STATE_KEY) || '{}');

    if (!tasks || !tasks.length) {
      tasksContainer.innerHTML = '<p class="bay-meta">No tasks available.</p>';
      return;
    }

    tasks.forEach((task, idx) => {
      const key = `${bayNumber}-${idx}-${task.text || 'task'}`;
      const item = document.createElement('div');
      item.className = 'task-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = Boolean(saved[key]);
      checkbox.addEventListener('change', () => {
        const next = { ...saved, [key]: checkbox.checked };
        localStorage.setItem(TASK_STATE_KEY, JSON.stringify(next));
        item.classList.toggle('completed', checkbox.checked);
      });

      const label = document.createElement('label');
      label.innerHTML = `${task.text || 'Task'} <small>(${formatDate(task.deadline)})</small>`;
      if (task.priority === 'high') label.style.color = '#c53030';
      else if (task.priority === 'medium') label.style.color = '#d97706';
      else if (task.priority === 'low') label.style.color = '#15803d';

      if (checkbox.checked) {
        item.classList.add('completed');
      }

      item.appendChild(checkbox);
      item.appendChild(label);
      tasksContainer.appendChild(item);
    });
  }

  function renderSummary(bay) {
    projectNameEl.textContent = `Project Name: ${bay?.projectName || 'None'}`;
    const team = bay?.assignedTeam?.length ? bay.assignedTeam.join(', ') : 'Unassigned';
    assignedPersonEl.textContent = `Assigned to: ${team}`;
    const start = formatDate(bay?.timer?.start);
    const end = formatDate(bay?.timer?.end);
    timerRangeEl.textContent = `Timer Range: Start: ${start} - End: ${end}`;

    if (bay?.paused) {
      pausedStatusEl.textContent = `Status: Project Paused${bay.pausedAt ? ` (Paused at: ${formatDate(bay.pausedAt)})` : ''}`;
      pausedStatusEl.classList.add('paused-label');
    } else {
      pausedStatusEl.textContent = 'Status: Active';
      pausedStatusEl.classList.remove('paused-label');
    }

    delayReasonEl.textContent = bay?.delayReason ? `Delay Reason: ${bay.delayReason}` : '';
  }

  function renderMovement(bay) {
    if (!movementBlock) return;
    movementBlock.style.display = 'none';
    if (!Array.isArray(bay?.movedTechnicians) || !bay.movedTechnicians.length) return;
    const now = new Date();
    const recent = bay.movedTechnicians.filter(m => (now - new Date(m.movedAt)) < 24 * 60 * 60 * 1000);
    if (!recent.length) return;
    movementBlock.innerHTML = recent.map(m => `
      <div style="margin-bottom:12px;">
        <span style="font-size:1.4em;vertical-align:middle;">&#9888;&#65039;</span>
        <span style="color:#d84315;">Technician <b>${m.technician}</b> has been moved${m.movedTo ? ` to Bay ${m.movedTo}` : ''}.</span><br>
        <span style="color:#b71c1c;">Project paused at ${formatDate(m.movedAt)}.</span>
      </div>
    `).join('');
    movementBlock.style.display = 'block';
  }

  function startTimer(bay) {
    if (!timerEl || !dateTimeEl) return;
    if (timerInterval) clearInterval(timerInterval);
    const end = bay?.timer?.end ? new Date(bay.timer.end) : null;

    const update = () => {
      const now = new Date();
      if (bay?.paused) {
        timerEl.textContent = 'Paused';
        timerEl.style.color = '#d97706';
        dateTimeEl.textContent = bay.pausedAt ? `Paused at: ${formatDate(bay.pausedAt)}` : '';
        return;
      }
      if (!end || Number.isNaN(end.getTime())) {
        timerEl.textContent = 'No Timer Set';
        timerEl.style.color = '#6b7280';
        dateTimeEl.textContent = '';
        return;
      }
      const diff = end - now;
      if (diff <= 0) {
        timerEl.textContent = "Time's up!";
        timerEl.style.color = '#ef4444';
        dateTimeEl.textContent = `End Date: ${dateFormatter.format(end)}`;
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      timerEl.style.color = '#d60000';
      dateTimeEl.textContent = `End Date: ${dateFormatter.format(end)}`;
    };

    update();
    timerInterval = setInterval(update, 1000);
  }

  async function loadBay() {
    try {
      const res = await fetch(`/api/bays/${bayNumber}`);
      if (!res.ok) throw new Error('Failed to load bay');
      const bay = await res.json();

      if (!bay) {
        projectNameEl.textContent = 'No data for this bay yet';
        tasksContainer.innerHTML = '<p class="bay-meta">No tasks available.</p>';
        return;
      }

      renderSummary(bay);
      renderMovement(bay);
      renderTasks(bay.tasks || []);
      startTimer(bay);
    } catch (err) {
      console.error(err);
      projectNameEl.textContent = 'Error loading bay data';
      assignedPersonEl.textContent = '';
      timerRangeEl.textContent = '';
      pausedStatusEl.textContent = '';
      delayReasonEl.textContent = '';
      tasksContainer.innerHTML = '<p class="bay-meta">Unable to load tasks.</p>';
      if (timerEl) timerEl.textContent = '--';
      if (dateTimeEl) dateTimeEl.textContent = '';
    }
  }

  loadBay();
  setInterval(loadBay, 15000);
});
