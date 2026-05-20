// BayMaster Home: rich dashboard & parity with bay pages

// ---- Navigation helpers ----
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  setupDropdowns();
  setupMobileNavToggle();
  ensureCustomAlertModal();
  setupStickyNotes();
  bootstrapDashboard();
});

function setActiveNav() {
  const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const navLinks = document.querySelectorAll('.nav-menu a');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    const linkPath = href === '/' ? '/' : href.replace(/\/+$/, '');
    const isActive = currentPath === linkPath;
    link.classList.toggle('active', isActive);
    const dropdown = link.closest('.nav-dropdown');
    if (isActive && dropdown) dropdown.classList.add('open');
  });
}

function setupDropdowns() {
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector('.dropdown-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', evt => {
      evt.preventDefault();
      const isOpen = dropdown.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) dropdown.classList.add('open');
    });
  });
  document.addEventListener('click', evt => {
    if (!evt.target.closest('.nav-dropdown')) closeAllDropdowns();
  });
}

function closeAllDropdowns() {
  document.querySelectorAll('.nav-dropdown').forEach(dd => dd.classList.remove('open'));
}

function setupMobileNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  const navMenu = document.querySelector('.nav-menu');
  if (!toggle || !sidebar || !navMenu) return;

  const setExpanded = isExpanded => {
    toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    sidebar.classList.toggle('is-open', isExpanded);
  };

  toggle.addEventListener('click', () => {
    setExpanded(!sidebar.classList.contains('is-open'));
  });

  navMenu.addEventListener('click', event => {
    if (!window.matchMedia('(max-width: 768px)').matches) return;
    if (event.target.closest('a')) setExpanded(false);
  });

  const mq = window.matchMedia('(max-width: 768px)');
  const handleViewportChange = event => {
    if (event.matches) {
      setExpanded(false);
    } else {
      sidebar.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  };

  handleViewportChange(mq);
  if (mq.addEventListener) {
    mq.addEventListener('change', handleViewportChange);
  } else if (mq.addListener) {
    mq.addListener(handleViewportChange);
  }
}

// ---- Sticky notes helpers (shared across bays & direct projects) ----
function getProjectNotes(projectId) {
  const pinboard = document.getElementById('pinboard');
  if (!pinboard) return [];
  return Array.from(pinboard.querySelectorAll('.sticky-note'))
    .filter(n => n.dataset.projectId === projectId)
    .map(n => ({
      id: n.dataset.noteId,
      noteText: n.dataset.noteText || n.querySelector('.note-textarea')?.value || '',
      createdAt: new Date().toISOString()
    }));
}

function removeProjectNotesForProject(projectId) {
  const pinboard = document.getElementById('pinboard');
  if (!pinboard) return;
  Array.from(pinboard.querySelectorAll('.sticky-note'))
    .filter(n => n.dataset.projectId === projectId)
    .forEach(note => note.remove());
  saveProjectNotesGlobal();
}

function saveProjectNotesGlobal() {
  const pinboard = document.getElementById('pinboard');
  if (!pinboard) return;
  const notes = Array.from(pinboard.querySelectorAll('.sticky-note')).map(n => ({
    id: n.dataset.noteId,
    projectType: n.dataset.projectType || '',
    projectId: n.dataset.projectId || '',
    projectName: n.dataset.projectName || '',
    noteText: n.dataset.noteText || '',
    left: n.style.left,
    top: n.style.top
  }));
  localStorage.setItem('projectNotes', JSON.stringify(notes));
}

async function setupStickyNotes() {
  const pinboard = document.getElementById('pinboard');
  const addNoteBtn = document.getElementById('add-note');
  if (!pinboard || !addNoteBtn) return;

  const savedNotes = JSON.parse(localStorage.getItem('projectNotes')) || [];
  savedNotes.forEach(note => addProjectNote(note.projectType, note.projectId, note.projectName, note.noteText, note.left, note.top, note.id));

  addNoteBtn.addEventListener('click', () => addProjectNote());
}

function addProjectNote(projectType = '', projectId = '', projectName = '', noteText = '', left = null, top = null, noteId = null) {
  const pinboard = document.getElementById('pinboard');
  if (!pinboard) return;

  const note = document.createElement('div');
  note.className = 'sticky-note';
  note.dataset.noteId = noteId || Date.now().toString();
  note.style.left = left || `${Math.random() * Math.max(120, pinboard.offsetWidth - 320)}px`;
  note.style.top = top || `${Math.random() * Math.max(80, pinboard.offsetHeight - 260)}px`;

  note.innerHTML = `
    <div class="sticky-note-header">
      <span class="pin-icon">📌</span>
      <span class="note-title">Project Note</span>
      <button class="remove-note-btn remove-btn" aria-label="Remove note">×</button>
    </div>
    <div class="note-content">
      <div class="project-selector">
        <label>Link to Project:</label>
        <select class="project-type-select">
          <option value="">Select Project Type</option>
          <option value="bay" ${projectType === 'bay' ? 'selected' : ''}>Bay Project</option>
          <option value="direct" ${projectType === 'direct' ? 'selected' : ''}>Direct Project</option>
        </select>
        <select class="project-list-select" style="display:${projectType ? 'block' : 'none'};">
          <option value="">Select Project</option>
        </select>
        <div class="selected-project" style="display:${projectName ? 'block' : 'none'};">
          <strong>Linked to:</strong> <span class="project-display">${projectName}</span>
        </div>
      </div>
      <div class="note-text-area">
        <label>Note:</label>
        <textarea class="note-textarea" placeholder="Write your note here...">${noteText}</textarea>
      </div>
      <div class="note-actions">
        <button class="save-note-btn">Save Note</button>
        <span class="save-status"></span>
      </div>
    </div>
  `;

  pinboard.appendChild(note);

  // Drag & drop
  let isDragging = false;
  let currentX = parseFloat(note.style.left) || 0;
  let currentY = parseFloat(note.style.top) || 0;
  let initialX = 0;
  let initialY = 0;

  const header = note.querySelector('.sticky-note-header');
  header.addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    initialX = e.clientX - currentX;
    initialY = e.clientY - currentY;
    note.style.zIndex = 1000;
  });

  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;
    currentX = Math.max(0, Math.min(currentX, pinboard.offsetWidth - note.offsetWidth));
    currentY = Math.max(0, Math.min(currentY, pinboard.offsetHeight - note.offsetHeight));
    note.style.left = `${currentX}px`;
    note.style.top = `${currentY}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    note.style.zIndex = 1;
    saveProjectNotesGlobal();
  });

  // Selectors
  const projectTypeSelect = note.querySelector('.project-type-select');
  const projectListSelect = note.querySelector('.project-list-select');
  const selectedProjectDiv = note.querySelector('.selected-project');
  const projectDisplay = note.querySelector('.project-display');

  projectTypeSelect.addEventListener('change', async () => {
    const type = projectTypeSelect.value;
    if (type) {
      await loadProjectsForType(type, projectListSelect);
      projectListSelect.style.display = 'block';
      selectedProjectDiv.style.display = 'none';
    } else {
      projectListSelect.style.display = 'none';
      selectedProjectDiv.style.display = 'none';
    }
    saveProjectNotesGlobal();
  });

  projectListSelect.addEventListener('change', () => {
    const selectedOption = projectListSelect.options[projectListSelect.selectedIndex];
    if (selectedOption.value) {
      projectDisplay.textContent = selectedOption.text;
      selectedProjectDiv.style.display = 'block';
      projectListSelect.style.display = 'none';
      note.dataset.projectType = projectTypeSelect.value;
      note.dataset.projectId = selectedOption.value;
      note.dataset.projectName = selectedOption.text;
    }
    saveProjectNotesGlobal();
  });

  const noteTextarea = note.querySelector('.note-textarea');
  noteTextarea.addEventListener('input', () => {
    const saveStatus = note.querySelector('.save-status');
    saveStatus.textContent = 'Unsaved changes';
    saveStatus.style.color = 'orange';
  });

  const saveBtn = note.querySelector('.save-note-btn');
  saveBtn.addEventListener('click', () => {
    const saveStatus = note.querySelector('.save-status');
    note.dataset.noteText = noteTextarea.value;
    saveProjectNotesGlobal();
    saveStatus.textContent = 'Saved!';
    saveStatus.style.color = 'green';
    setTimeout(() => { saveStatus.textContent = ''; }, 1800);
  });

  note.querySelector('.remove-note-btn').addEventListener('click', () => {
    if (confirm('Delete this note?')) {
      note.remove();
      saveProjectNotesGlobal();
    }
  });

  if (projectType) {
    loadProjectsForType(projectType, projectListSelect).then(() => {
      if (projectId) {
        note.dataset.projectType = projectType;
        note.dataset.projectId = projectId;
        note.dataset.projectName = projectName;
      }
    });
  }

  note.dataset.noteText = noteText;
}

async function loadProjectsForType(type, selectElement) {
  if (!selectElement) return;
  try {
    selectElement.innerHTML = '<option value="">Loading...</option>';
    if (type === 'bay') {
      const response = await fetch('/data');
      const data = await response.json();
      selectElement.innerHTML = '<option value="">Select Bay Project</option>';
      (data.quadrants || []).forEach((quadrant, index) => {
        if (quadrant.projectName) {
          const option = document.createElement('option');
          option.value = `bay-${index + 1}`;
          option.textContent = `Bay ${index + 1}: ${quadrant.projectName}`;
          selectElement.appendChild(option);
        }
      });
    } else if (type === 'direct') {
        const response = await fetch('/api/technicians');
      const technicians = await response.json();
      selectElement.innerHTML = '<option value="">Select Direct Project</option>';
      technicians.forEach(tech => {
        if (Array.isArray(tech.projects)) {
          tech.projects.forEach(project => {
            if (!project.bay) {
              const option = document.createElement('option');
              option.value = `direct-${tech.name}-${project.projectName}`;
              option.textContent = `${tech.name}: ${project.projectName}`;
              selectElement.appendChild(option);
            }
          });
        }
      });
    }
  } catch (error) {
    selectElement.innerHTML = '<option value="">Error loading projects</option>';
    console.error('Error loading projects:', error);
  }
}

// ---- Dashboard data & rendering ----
const fallbackTechnicians = [
  { id: 0, name: 'Sipho Zitha' },
  { id: 1, name: 'David Mphahele' },
  { id: 2, name: 'Bernard Maano' },
  { id: 3, name: 'Spha Mthembu' },
  { id: 4, name: 'Johannes Loubser' },
  { id: 5, name: 'Temp Technicians 1' }
];

async function fetchTechniciansWithFallback() {
  try {
    const res = await fetch('/api/technicians');
    if (!res.ok) throw new Error('tech fetch failed');
    return await res.json();
  } catch (err) {
    console.warn('Using fallback technicians:', err.message);
    return [...fallbackTechnicians];
  }
}

async function fetchAlertsWithFallback() {
  try {
    const res = await fetch('/alerts');
    if (!res.ok) throw new Error('alerts fetch failed');
    const data = await res.json();
    return Array.isArray(data.alerts) ? data.alerts : [];
  } catch (err) {
    console.warn('Using empty alerts:', err.message);
    return [];
  }
}

function normalizeQuadrantsFromData(quadrants) {
  const list = Array.isArray(quadrants) ? quadrants : [];
  return list.map((q, idx) => ({
    projectName: q?.projectName || '',
    assignedPerson: q?.assignedPerson || [],
    timer: q?.timer || { start: null, end: null },
    paused: Boolean(q?.paused),
    pausedAt: q?.pausedAt || null,
    currentPauseReason: q?.currentPauseReason || '',
    pauseEvents: q?.pauseEvents || [],
    movedToDirect: Boolean(q?.movedToDirect),
    bay: q?.bay || idx + 1,
    excludedDays: q?.excludedDays || []
  }));
}

function normalizeQuadrantsFromBays(bays) {
  const list = Array.isArray(bays) ? bays : [];
  return list.map((b, idx) => ({
    projectName: b?.projectName || b?.name || '',
    assignedPerson: b?.assignedPerson || b?.assignedTeam || [],
    timer: b?.timer || { start: b?.startTime || null, end: b?.endTime || null },
    paused: Boolean(b?.paused),
    pausedAt: b?.pausedAt || null,
    currentPauseReason: b?.currentPauseReason || '',
    pauseEvents: b?.pauseEvents || [],
    movedToDirect: Boolean(b?.movedToDirect),
    currentProjectType: b?.currentProjectType || 'bay',
    directProject: b?.directProject || null,
    directProjectId: b?.directProjectId || null,
    displacedProject: b?.displacedProject || null,
    bay: b?.bayNumber || b?.bay || idx + 1,
    excludedDays: b?.excludedDays || []
  }));
}

async function fetchDashboardData() {
  let quadrants = [];
  try {
    const res = await fetch('/data');
    if (res.ok) {
      const data = await res.json();
      quadrants = normalizeQuadrantsFromData(data.quadrants || []);
    }
  } catch (err) {
    console.warn('Failed /data, will try /api/bays:', err.message);
  }

  if (!quadrants.length) {
    try {
      const res = await fetch('/api/bays');
      if (res.ok) {
        const bays = await res.json();
        quadrants = normalizeQuadrantsFromBays(bays);
      }
    } catch (err) {
      console.warn('Failed /api/bays:', err.message);
    }
  }

  const technicians = await fetchTechniciansWithFallback();
  const bayAlerts = await fetchAlertsWithFallback();
  return { quadrants, technicians, bayAlerts };
}

async function bootstrapDashboard() {
  const { quadrants, technicians, bayAlerts } = await fetchDashboardData();
  renderBayCards(quadrants, technicians, bayAlerts);
  setupDirectProjectSection();
  updateStats(quadrants);
}

function updateStats(quadrants) {
  const activeBaysEl = document.getElementById('active-bays');
  const activeTechsEl = document.getElementById('active-technicians');
  const activeProjectsEl = document.getElementById('active-projects');
  if (!activeBaysEl || !activeTechsEl || !activeProjectsEl) return;
  const sanitized = Array.isArray(quadrants) ? quadrants : [];
  const projects = sanitized.filter(q => (q?.projectName || '').trim() !== '');
  const techSet = new Set();
  sanitized.forEach(q => (q?.assignedPerson || []).forEach(t => techSet.add(t)));
  activeBaysEl.textContent = sanitized.length || 0;
  activeTechsEl.textContent = techSet.size || 0;
  activeProjectsEl.textContent = projects.length || 0;
}

function renderBayCards(quadrants, technicians, bayAlerts) {
  const container = document.getElementById('bay-status-grid');
  if (!container) return;
  container.innerHTML = '';

  const list = Array.isArray(quadrants) && quadrants.length ? quadrants : Array.from({ length: 6 }, (_, idx) => ({ bay: idx + 1 }));

  list.forEach((quadrant, index) => {
    const bayNumber = quadrant?.bay || index + 1;
    const alertObj = bayAlerts[index];
    const isDirect = quadrant.currentProjectType === 'direct' && quadrant.directProject;
    const projectDisplay = isDirect ? `${quadrant.directProject?.projectName || quadrant.projectName || 'Direct Project'} (Direct)` : quadrant.projectName || 'No Project';
    const assigned = isDirect
      ? (quadrant.directProject?.technicianName || 'Unassigned')
      : (Array.isArray(quadrant.assignedPerson) && quadrant.assignedPerson.length
        ? quadrant.assignedPerson.join(', ')
        : 'Unassigned');
    const timerForView = isDirect ? quadrant.directProject?.timer : quadrant.timer;
    const pausedForView = isDirect ? Boolean(quadrant.directProject?.paused) : Boolean(quadrant.paused);
    const pausedAtForView = isDirect ? quadrant.directProject?.pausedAt : quadrant.pausedAt;
    const card = document.createElement('div');
    card.className = 'bay-status-card bay-status-card-rich';

    const alertHtml = buildAlertHtml(alertObj, bayNumber);

    card.innerHTML = `
      <div class="bay-card-header">
        <div class="bay-title"><i class="fas fa-warehouse"></i> Bay ${bayNumber}</div>
        <a class="view-details" href="/bay${bayNumber}">View Details</a>
      </div>
      ${alertHtml}
      <p class="bay-meta"><strong>Project:</strong> ${projectDisplay}</p>
      <p class="bay-meta"><strong>Assigned:</strong> ${assigned}</p>
      <p class="bay-meta"><strong>Timer:</strong> Start: ${timerForView?.start ? new Date(timerForView.start).toLocaleString() : 'N/A'} - End: ${timerForView?.end ? new Date(timerForView.end).toLocaleString() : 'N/A'}</p>
      <p class="bay-meta" id="status-${index}" ${pausedForView ? 'class="bay-meta paused-label"' : 'class="bay-meta"'}>Status: ${pausedForView ? `Paused (at: ${pausedAtForView ? new Date(pausedAtForView).toLocaleString() : ''})` : (isDirect ? 'Direct Active' : 'Active')}</p>
      <p id="timer-${index}" class="timer"></p>
      ${isDirect ? '<div class="moved-alert">Direct project running in this bay.</div>' : (quadrant.movedToDirect ? '<div class="moved-alert">Technician moved to a direct project.</div>' : '')}
      <div class="bay-actions-row">
        <button id="pause-toggle-${index}" class="pause-toggle">${pausedForView ? 'Unpause' : 'Pause'}</button>
        <button id="finish-project-${index}" class="finish-btn">Finish Project</button>
        <button class="bay-photo-btn" id="bay-photo-btn-${index}"><span>📷</span> Take Photo</button>
        <input type="file" id="bay-photo-input-${index}" name="photo_bay${bayNumber}" accept="image/*" capture="environment" style="display:none;">
      </div>
      <button class="set-alert-btn" id="set-alert-btn-${index}">Set Alert</button>
    `;

    wireBayCard(card, quadrant, technicians, index);
    container.appendChild(card);
  });
}

function buildAlertHtml(alertObj, bayNumber) {
  if (!alertObj || !alertObj.message || !alertObj.timestamp) return '';
  const alertTime = new Date(alertObj.timestamp);
  const now = new Date();
  if ((now - alertTime) > 20 * 60 * 1000) return '';
  return `
    <div class="bay-alert">
      <span class="alert-icon">⚠️</span>
      <span class="alert-message">${alertObj.message}</span>
      <button class="remove-alert-btn" data-bay="${bayNumber}">Remove</button>
    </div>
  `;
}

function wireBayCard(card, quadrant, technicians, index) {
  const bayNumber = index + 1;
  const removeAlertBtn = card.querySelector('.remove-alert-btn');
  if (removeAlertBtn) {
    removeAlertBtn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        const resp = await fetch('/remove-bay-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bay: bayNumber })
        });
        const result = await resp.json();
        if (resp.ok) {
          removeAlertBtn.closest('.bay-alert')?.remove();
        } else {
          alert(result.error || 'Failed to remove alert');
        }
      } catch (err) {
        alert('Failed to remove alert: ' + err.message);
      }
    });
  }

  const photoBtn = card.querySelector(`#bay-photo-btn-${index}`);
  const photoInput = card.querySelector(`#bay-photo-input-${index}`);
  if (photoBtn && photoInput) {
    photoBtn.addEventListener('click', async () => {
      const phase = await selectUploadPhase();
      if (!phase) return;
      photoInput.dataset.phase = phase;
      photoInput.click();
    });
    photoInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const fieldName = this.getAttribute('name');
        const projectName = quadrant?.projectName || '';
        const phase = this.dataset.phase || '';
        this.dataset.phase = '';
        if (!phase) {
          alert('Select a phase before uploading.');
          return;
        }
        const uploadUrl = `/upload-photo/bay${bayNumber}?projectName=${encodeURIComponent(projectName)}`;
        showUploadModal(this.files[0], uploadUrl, fieldName, { projectName, phase });
      }
    });
  }

  const pauseToggleButton = card.querySelector(`#pause-toggle-${index}`);
  pauseToggleButton?.addEventListener('click', async () => {
    const bayNumber = quadrant?.bay || index + 1;
    const isDirect = quadrant.currentProjectType === 'direct' && quadrant.directProjectId;
    const pausedFlag = isDirect ? quadrant.directProject?.paused : quadrant.paused;
    if (!quadrant.projectName) {
      alert('No project to pause/unpause in this bay.');
      return;
    }
    try {
      if (isDirect) {
        const resp = await fetch(`/api/direct-projects/${quadrant.directProjectId}/pause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: pausedFlag ? 'unpause' : 'pause' })
        });
        if (!resp.ok) throw new Error('Pause update failed');
        const updated = await resp.json();
        quadrant.directProject = updated;
        pauseToggleButton.textContent = updated.paused ? 'Unpause' : 'Pause';
        const statusElement = document.getElementById(`status-${index}`);
        if (statusElement) {
          statusElement.textContent = updated.paused ? `Paused (at: ${updated.pausedAt ? new Date(updated.pausedAt).toLocaleString() : ''})` : 'Direct Active';
          statusElement.className = updated.paused ? 'bay-meta paused-label' : 'bay-meta';
        }
        return;
      }

      let payload = { action: quadrant.paused ? 'unpause' : 'pause' };
      if (!quadrant.paused) {
        const reason = prompt('Reason for pausing? (optional)', quadrant.currentPauseReason || '');
        if (reason) payload.reason = reason;
      }
      const resp = await fetch(`/api/bays/${bayNumber}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) throw new Error('Pause update failed');
      const updated = await resp.json();
      Object.assign(quadrant, {
        paused: updated.paused,
        pausedAt: updated.pausedAt,
        timer: updated.timer,
        currentPauseReason: updated.currentPauseReason,
        pauseEvents: updated.pauseEvents
      });
      pauseToggleButton.textContent = quadrant.paused ? 'Unpause' : 'Pause';
      const statusElement = document.getElementById(`status-${index}`);
      if (statusElement) {
        statusElement.textContent = quadrant.paused ? `Paused (at: ${quadrant.pausedAt ? new Date(quadrant.pausedAt).toLocaleString() : ''})` : 'Active';
        statusElement.className = quadrant.paused ? 'bay-meta paused-label' : 'bay-meta';
      }
    } catch (err) {
      alert(err.message || 'Failed to update pause state');
    }
  });

  const finishButton = card.querySelector(`#finish-project-${index}`);
  finishButton?.addEventListener('click', async () => {
    if (!quadrant.projectName) {
      alert('No project to finish in this bay.');
      return;
    }
    const isDirect = quadrant.currentProjectType === 'direct' && quadrant.directProjectId;
    const label = isDirect ? 'direct project' : 'bay project';
    if (confirm(`Mark "${quadrant.projectName}" in Bay ${bayNumber} as finished?`)) {
      try {
        const projectNotes = getProjectNotes(`bay-${bayNumber}`);
        if (isDirect) {
          const response = await fetch(`/api/direct-projects/${quadrant.directProjectId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectNotes })
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to finish direct project');
          }
        } else {
          const response = await fetch(`/api/bays/${bayNumber}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectNotes })
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to finish project');
          }
        }
        removeProjectNotesForProject(`bay-${bayNumber}`);
        alert(`The ${label} is marked as finished.`);
        bootstrapDashboard();
      } catch (error) {
        console.error('Error finishing project:', error);
        alert(`Failed to finish project: ${error.message}`);
      }
    }
  });

  const setAlertBtn = card.querySelector(`#set-alert-btn-${index}`);
  if (setAlertBtn) {
    setAlertBtn.addEventListener('click', e => {
      e.stopPropagation();
      showCustomAlertModal(async message => {
        const resp = await fetch('/set-bay-alert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bay: bayNumber, message })
        });
        const result = await resp.json();
        if (resp.ok) {
          alert('Alert set!');
          bootstrapDashboard();
        } else {
          alert(result.error || 'Failed to set alert');
        }
      });
    });
  }

  const timerElement = card.querySelector(`#timer-${index}`);
  const statusElement = card.querySelector(`#status-${index}`);
  const updateTimer = () => {
    if (!timerElement) return;
    const isDirect = quadrant.currentProjectType === 'direct' && quadrant.directProject;
    const now = new Date();
    const activeTimer = isDirect ? quadrant.directProject?.timer : quadrant.timer;
    const pausedFlag = isDirect ? Boolean(quadrant.directProject?.paused) : Boolean(quadrant.paused);
    const endDate = activeTimer?.end ? new Date(activeTimer.end) : null;

    if (pausedFlag) {
      timerElement.textContent = 'Paused';
      timerElement.style.color = 'orange';
      return;
    }

    if (!endDate) {
      timerElement.textContent = 'No Timer Set';
      timerElement.style.color = 'gray';
      return;
    }

    const diff = endDate - now;
    if (diff <= 0) {
      timerElement.textContent = "Time's up!";
      timerElement.style.color = 'red';
    } else {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      timerElement.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      timerElement.style.color = 'red';
    }
  };

  updateTimer();
  setInterval(async () => {
    try {
      const [updatedQuadrants, updatedTechnicians] = await Promise.all([
        fetch('/api/bays').then(res => res.json()),
        fetch('/api/technicians').then(res => res.json())
      ]);
      const updated = Array.isArray(updatedQuadrants) ? updatedQuadrants[index] : null;
      if (updated) {
        quadrant.paused = updated.paused;
        quadrant.pausedAt = updated.pausedAt;
        quadrant.timer = updated.timer;
        quadrant.projectName = updated.projectName;
        quadrant.assignedPerson = updated.assignedTeam || updated.assignedPerson;
        quadrant.excludedDays = updated.excludedDays || [];
        quadrant.currentPauseReason = updated.currentPauseReason;
        quadrant.currentProjectType = updated.currentProjectType || 'bay';
        quadrant.directProject = updated.directProject || null;
        quadrant.directProjectId = updated.directProjectId || null;
        quadrant.displacedProject = updated.displacedProject || null;
        technicians.length = 0;
        technicians.push(...updatedTechnicians);
        updateTimer();
        const isDirect = quadrant.currentProjectType === 'direct' && quadrant.directProject;
        const pausedFlag = isDirect ? quadrant.directProject?.paused : quadrant.paused;
        const pausedAtForView = isDirect ? quadrant.directProject?.pausedAt : quadrant.pausedAt;
        const pauseBtn = card.querySelector(`#pause-toggle-${index}`);
        if (pauseBtn) pauseBtn.textContent = pausedFlag ? 'Unpause' : 'Pause';
        if (statusElement) {
          statusElement.textContent = pausedFlag ? `Paused (at: ${pausedAtForView ? new Date(pausedAtForView).toLocaleString() : ''})` : (isDirect ? 'Direct Active' : 'Active');
          statusElement.className = pausedFlag ? 'bay-meta paused-label' : 'bay-meta';
        }
        const metaProject = card.querySelector('.bay-meta');
        if (metaProject) {
          const projectDisplay = isDirect ? `${quadrant.directProject?.projectName || quadrant.projectName || 'Direct Project'} (Direct)` : quadrant.projectName || 'No Project';
          metaProject.textContent = `Project: ${projectDisplay}`;
        }
      }
    } catch (err) {
      console.warn('Timer refresh failed', err);
    }
  }, 1000);
}

// ---- Upload modal ----
function selectUploadPhase() {
  return new Promise((resolve) => {
    let modal = document.getElementById('phase-select-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'phase-select-modal';
      modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);z-index:2000;';
      modal.innerHTML = `
        <div style="background:#ffffff;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,0.28);padding:20px 22px;min-width:280px;max-width:90vw;">
          <h2 style="margin:0 0 8px;font-size:1.1rem;">Select photo phase</h2>
          <p style="margin:0 0 14px;color:#475569;font-size:0.9rem;">Choose where this media should be stored.</p>
          <div style="display:grid;gap:10px;">
            <button type="button" data-phase="entry" style="padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;cursor:pointer;">Entry</button>
            <button type="button" data-phase="progress" style="padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;cursor:pointer;">Progress</button>
            <button type="button" data-phase="exit-delivery" style="padding:10px 14px;border-radius:10px;border:1px solid #e2e8f0;background:#f1f5f9;font-weight:600;cursor:pointer;">Exit / Delivery</button>
          </div>
          <button type="button" data-cancel style="margin-top:12px;border:none;background:transparent;color:#64748b;cursor:pointer;">Cancel</button>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const close = (value) => {
      modal.style.display = 'none';
      resolve(value);
    };

    modal.querySelectorAll('[data-phase]').forEach((button) => {
      button.onclick = () => close(button.getAttribute('data-phase'));
    });

    const cancelBtn = modal.querySelector('[data-cancel]');
    if (cancelBtn) cancelBtn.onclick = () => close(null);

    modal.style.display = 'flex';
  });
}

function showUploadModal(file, uploadUrl, fieldName = 'photo', extraFields) {
  let modal = document.getElementById('upload-progress-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'upload-progress-modal';
    modal.innerHTML = `
      <div class="upload-modal-backdrop"></div>
      <div class="upload-modal-content">
        <h2>Uploading Photo...</h2>
        <div class="upload-progress-bar-bg"><div class="upload-progress-bar" id="upload-progress-bar"></div></div>
        <div id="upload-progress-text">0%</div>
        <button id="upload-done-btn">Done</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
  const progressBar = modal.querySelector('#upload-progress-bar');
  const progressText = modal.querySelector('#upload-progress-text');
  const doneBtn = modal.querySelector('#upload-done-btn');
  doneBtn.style.display = 'none';
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  const formData = new FormData();
  if (extraFields) {
    Object.entries(extraFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });
  }
  formData.append(fieldName, file);
  const xhr = new XMLHttpRequest();
  xhr.open('POST', uploadUrl, true);
  xhr.upload.onprogress = e => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + '%';
      progressText.textContent = percent + '%';
    }
  };
  xhr.onload = function() {
    progressBar.style.width = '100%';
    progressText.textContent = '100%';
    doneBtn.style.display = 'inline-block';
  };
  xhr.onerror = function() {
    progressText.textContent = 'Upload failed.';
    progressBar.style.background = '#d32f2f';
    doneBtn.style.display = 'inline-block';
  };
  xhr.send(formData);

  doneBtn.onclick = function() {
    modal.style.display = 'none';
  };
}

// ---- Direct project assignment & list ----
function setupDirectProjectSection() {
  const assignForm = document.getElementById('direct-assign-form');
  const techSelect = document.getElementById('direct-tech-select');
  const baySelect = document.getElementById('direct-bay-select');
  const resultDiv = document.getElementById('direct-assign-result');
  const projectListSection = document.getElementById('direct-project-list');
  if (!assignForm || !techSelect) return;

  // Track active timer intervals so we can clear them before each re-render
  let directTimerIntervals = [];

  let technicians = [];
  populateTechnicians();
  populateBaySelect();

  async function populateTechnicians() {
    technicians = await fetchTechniciansWithFallback();
    techSelect.innerHTML = '<option value="">Select technician</option>' + technicians.map(t => `<option value="${t.name}">${t.name}</option>`).join('');
  }

  async function populateBaySelect() {
    if (!baySelect) return;
    try {
      const res = await fetch('/api/bays');
      const bays = await res.json();
      baySelect.innerHTML = '<option value="">Select bay</option>';
      for (let i = 1; i <= 6; i++) {
        const bay = Array.isArray(bays) ? bays.find(b => b.bayNumber === i) : null;
        const isOccupied = bay && bay.currentProjectType === 'direct';
        const projectLabel = bay && bay.projectName ? ` — ${bay.projectName}` : ' (empty)';
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = isOccupied
          ? `Bay ${i} (occupied — direct project active)`
          : `Bay ${i}${projectLabel}`;
        opt.disabled = isOccupied;
        baySelect.appendChild(opt);
      }
    } catch {
      // Fallback to plain options if the fetch fails
      baySelect.innerHTML = '<option value="">Select bay</option>' +
        [1,2,3,4,5,6].map(n => `<option value="${n}">Bay ${n}</option>`).join('');
    }
  }

  assignForm.addEventListener('submit', async e => {
    e.preventDefault();
    const projectName = document.getElementById('direct-project-name').value.trim();
    const technicianName = techSelect.value;
    const bayNumber = baySelect ? parseInt(baySelect.value, 10) : null;
    let start = document.getElementById('direct-project-start').value;
    let end = document.getElementById('direct-project-end').value;
    if (start && start.length === 16) start += ':00';
    if (end && end.length === 16) end += ':00';
    if (!projectName || !technicianName || !bayNumber || !start || !end) {
      resultDiv.textContent = 'Please fill in all fields including the bay.';
      resultDiv.style.color = 'red';
      return;
    }

    try {
      const response = await fetch('/api/direct-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, technicianName, bayNumber, timer: { start, end } })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error assigning project');
      resultDiv.textContent = data.message || 'Assignment complete.';
      resultDiv.style.color = 'green';
      assignForm.reset();
      techSelect.value = '';
      await populateBaySelect();
      await loadDirectProjects();
      await bootstrapDashboard();
    } catch (err) {
      resultDiv.textContent = err.message || 'Error assigning project.';
      resultDiv.style.color = 'red';
    }
  });

  async function loadDirectProjects() {
    if (!projectListSection) return;
    // Clear all running timer intervals from the previous render
    directTimerIntervals.forEach(id => clearInterval(id));
    directTimerIntervals = [];
    try {
      const res = await fetch('/api/direct-projects');
      // Refresh bay dropdown occupancy status each time the list reloads
      populateBaySelect();
      const projects = await res.json();
      const directProjects = Array.isArray(projects) ? projects.filter(p => p.status === 'active') : [];
      projectListSection.innerHTML = directProjects.length ?
        directProjects.map((p, i) => `
          <div class="bay-status-card direct-card">
            <h3>Project: ${p.projectName}</h3>
            <p class="bay-meta">Technician: ${p.technicianName}</p>
            <p class="bay-meta">Bay: ${p.bayNumber}</p>
            <p class="bay-meta">Start: ${p.timer?.start ? new Date(p.timer.start).toLocaleString() : 'N/A'}</p>
            <p class="bay-meta">End: ${p.timer?.end ? new Date(p.timer.end).toLocaleString() : 'N/A'}</p>
            <p id="direct-status-${i}" class="bay-meta ${p.paused ? 'paused-label' : ''}">Status: ${p.paused ? `Paused (at: ${p.pausedAt ? new Date(p.pausedAt).toLocaleString() : ''})` : 'Active'}</p>
            <p id="direct-timer-${i}" class="timer"></p>
            <div class="bay-actions-row">
              <button id="direct-pause-toggle-${i}" data-id="${p._id}" class="pause-toggle">${p.paused ? 'Unpause' : 'Pause'}</button>
              <button class="edit-direct-btn" data-id="${p._id}" data-tech="${p.technicianName}" data-project="${p.projectName}" data-start="${p.timer?.start || ''}" data-end="${p.timer?.end || ''}">Edit</button>
              <button class="finish-direct-btn" data-id="${p._id}" data-tech="${p.technicianName}" data-project="${p.projectName}">Finish Project</button>
              <button class="direct-photo-btn" id="direct-photo-btn-${i}"><span>📷</span> Take Photo</button>
              <input type="file" id="direct-photo-input-${i}" name="photo_direct_${encodeURIComponent(p.technicianName)}_${encodeURIComponent(p.projectName)}" accept="image/*" capture="environment" style="display:none;">
            </div>
          </div>
        `).join('') : '<p class="bay-meta">No direct projects assigned.</p>';

      directProjects.forEach((p, i) => {
        const timerEl = document.getElementById(`direct-timer-${i}`);
        const statusEl = document.getElementById(`direct-status-${i}`);
        const updateTimer = () => {
          if (!timerEl) return;
          if (p.paused) {
            timerEl.textContent = 'Paused';
            if (statusEl) statusEl.textContent = `Status: Paused${p.pausedAt ? ' (at: ' + new Date(p.pausedAt).toLocaleString() + ')' : ''}`;
          } else {
            const now = new Date();
            const end = new Date(p.timer.end);
            let diff = end - now;
            timerEl.style.color = 'red';
            if (diff <= 0) {
              timerEl.textContent = "Time's up!";
            } else {
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              diff -= days * (1000 * 60 * 60 * 24);
              const hours = Math.floor(diff / (1000 * 60 * 60));
              diff -= hours * (1000 * 60 * 60);
              const minutes = Math.floor(diff / (1000 * 60));
              diff -= minutes * (1000 * 60);
              const seconds = Math.floor(diff / 1000);
              timerEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
              if (statusEl) statusEl.textContent = 'Status: Active';
            }
          }
        };
        updateTimer();
        directTimerIntervals.push(setInterval(updateTimer, 1000));

        const pauseBtn = document.getElementById(`direct-pause-toggle-${i}`);
        pauseBtn?.addEventListener('click', async () => {
          try {
            const resp = await fetch(`/api/direct-projects/${p._id}/pause`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: p.paused ? 'unpause' : 'pause' })
            });
            if (!resp.ok) throw new Error('Pause/unpause failed');
            await loadDirectProjects();
            await bootstrapDashboard();
          } catch (err) {
            alert('Failed to pause/unpause project: ' + err.message);
          }
        });
      });

      document.querySelectorAll('.finish-direct-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
          const id = btn.getAttribute('data-id');
          const tech = btn.getAttribute('data-tech');
          const project = btn.getAttribute('data-project');
          if (confirm(`Finish project '${project}' for ${tech}?`)) {
            try {
              const projectNotes = getProjectNotes(`direct-${tech}-${project}`);
              const resp = await fetch(`/api/direct-projects/${id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectNotes })
              });
              if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'Failed to finish project');
              }
              removeProjectNotesForProject(`direct-${tech}-${project}`);
              await loadDirectProjects();
              await bootstrapDashboard();
            } catch (err) {
              alert('Error finishing project: ' + err.message);
            }
          }
        });
      });

      document.querySelectorAll('.edit-direct-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const id = btn.getAttribute('data-id');
          const tech = btn.getAttribute('data-tech');
          const project = btn.getAttribute('data-project');
          const start = btn.getAttribute('data-start');
          const end = btn.getAttribute('data-end');
          showEditDirectProjectModal(id, tech, project, start, end, loadDirectProjects);
        });
      });

      directProjects.forEach((p, i) => {
        const photoBtn = document.getElementById(`direct-photo-btn-${i}`);
        const photoInput = document.getElementById(`direct-photo-input-${i}`);
        if (photoBtn && photoInput) {
          photoBtn.addEventListener('click', async () => {
            const phase = await selectUploadPhase();
            if (!phase) return;
            photoInput.dataset.phase = phase;
            photoInput.click();
          });
          photoInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
              const fieldName = this.getAttribute('name');
              const phase = this.dataset.phase || '';
              this.dataset.phase = '';
              if (!phase) {
                alert('Select a phase before uploading.');
                return;
              }
              showUploadModal(this.files[0], '/upload-photo/direct', fieldName, { phase });
            }
          });
        }
      });
    } catch (err) {
      projectListSection.innerHTML = '<p class="bay-meta">Failed to load direct projects.</p>';
      console.warn('Direct project load failed', err);
    }
  }

  loadDirectProjects();
}

// ---- Edit direct project modal ----
function showEditDirectProjectModal(directId, technician, projectName, currentStart, currentEnd, onDone) {
  let modal = document.getElementById('edit-direct-project-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-direct-project-modal';
    modal.innerHTML = `
      <div class="edit-modal-backdrop"></div>
      <div class="edit-modal-content">
        <h2>Edit Direct Project</h2>
        <form id="edit-direct-form">
          <label for="edit-project-name">Project Name:</label>
          <input type="text" id="edit-project-name" required placeholder="Enter project name">
          <label for="edit-tech-select">Technician:</label>
          <select id="edit-tech-select" required><option value="">Select technician</option></select>
          <label for="edit-project-start">Start Time:</label>
          <input type="datetime-local" id="edit-project-start" required>
          <label for="edit-project-end">End Time:</label>
          <input type="datetime-local" id="edit-project-end" required>
          <div class="edit-actions">
            <button type="button" id="edit-cancel-btn">Cancel</button>
            <button type="submit" id="edit-save-btn">Update Project</button>
          </div>
        </form>
        <div id="edit-result"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  document.getElementById('edit-project-name').value = projectName;
  document.getElementById('edit-project-start').value = currentStart ? new Date(currentStart).toISOString().slice(0, 16) : '';
  document.getElementById('edit-project-end').value = currentEnd ? new Date(currentEnd).toISOString().slice(0, 16) : '';

  const techSelect = document.getElementById('edit-tech-select');
  fetch('/api/technicians')
    .then(res => res.json())
    .then(technicians => {
      techSelect.innerHTML = '<option value="">Select technician</option>' +
        technicians.map(t => `<option value="${t.name}" ${t.name === technician ? 'selected' : ''}>${t.name}</option>`).join('');
    })
    .catch(() => {
      techSelect.innerHTML = '<option value="">Select technician</option>' +
        fallbackTechnicians.map(t => `<option value="${t.name}" ${t.name === technician ? 'selected' : ''}>${t.name}</option>`).join('');
    });

  const form = document.getElementById('edit-direct-form');
  const resultDiv = document.getElementById('edit-result');

  form.onsubmit = async e => {
    e.preventDefault();
    const newProjectName = document.getElementById('edit-project-name').value.trim();
    const newTechnician = document.getElementById('edit-tech-select').value;
    const newStart = document.getElementById('edit-project-start').value;
    const newEnd = document.getElementById('edit-project-end').value;
    if (!newProjectName || !newTechnician || !newStart || !newEnd) {
      resultDiv.textContent = 'Please fill in all fields.';
      resultDiv.style.color = 'red';
      return;
    }
    try {
      const response = await fetch(`/api/direct-projects/${directId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: newProjectName,
          technicianName: newTechnician,
          timer: { start: newStart, end: newEnd }
        })
      });
      const result = await response.json();
      if (response.ok) {
        resultDiv.textContent = result.message || 'Project updated successfully!';
        resultDiv.style.color = 'green';
        setTimeout(() => {
          modal.style.display = 'none';
          if (typeof onDone === 'function') onDone();
        }, 1200);
      } else {
        resultDiv.textContent = result.error || 'Failed to update project';
        resultDiv.style.color = 'red';
      }
    } catch (error) {
      resultDiv.textContent = 'Error updating project: ' + error.message;
      resultDiv.style.color = 'red';
    }
  };

  document.getElementById('edit-cancel-btn').onclick = () => { modal.style.display = 'none'; };
  modal.querySelector('.edit-modal-backdrop').onclick = () => { modal.style.display = 'none'; };
}

// ---- Alert modal ----
function ensureCustomAlertModal() {
  if (document.getElementById('custom-alert-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'custom-alert-modal';
  modal.innerHTML = `
    <div class="custom-alert-backdrop"></div>
    <div class="custom-alert-content">
      <h2>Set Bay Alert</h2>
      <label for="custom-alert-input">Alert Message:</label>
      <textarea id="custom-alert-input"></textarea>
      <div class="custom-alert-actions">
        <button id="custom-alert-cancel">Cancel</button>
        <button id="custom-alert-ok">Set Alert</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showCustomAlertModal(onSubmit) {
  const modal = document.getElementById('custom-alert-modal');
  const input = modal.querySelector('#custom-alert-input');
  const cancelBtn = modal.querySelector('#custom-alert-cancel');
  const okBtn = modal.querySelector('#custom-alert-ok');
  modal.style.display = 'flex';
  input.value = '';
  input.focus();
  const closeModal = () => { modal.style.display = 'none'; };
  cancelBtn.onclick = closeModal;
  okBtn.onclick = async () => {
    const message = input.value.trim();
    if (!message) {
      input.style.borderColor = '#d32f2f';
      input.focus();
      return;
    }
    await onSubmit(message);
    closeModal();
  };
  modal.onkeydown = ev => { if (ev.key === 'Escape') closeModal(); };
}

// Utility navigation
function navigateTo(url) {
  window.location.href = url;
}
