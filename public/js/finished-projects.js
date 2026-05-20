document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('finished-list');
  const searchInput = document.getElementById('finished-search');
  const sortSelect = document.getElementById('finished-sort');
  const totalEl = document.getElementById('finished-total');
  const directEl = document.getElementById('finished-direct-total');
  const delayEl = document.getElementById('finished-delay-total');

  let projects = [];
  const detailModal = document.getElementById('finished-detail-modal');
  const detailTitle = document.getElementById('detail-title');
  const detailSubtitle = document.getElementById('detail-subtitle');
  const detailMeta = document.getElementById('detail-meta');
  const detailPauses = document.getElementById('detail-pauses');
  const detailDelay = document.getElementById('detail-delay');
  const detailNotes = document.getElementById('detail-notes');
  const detailMedia = document.getElementById('detail-media');
  const detailMediaMeta = document.getElementById('detail-media-meta');
  const mediaLightbox = document.getElementById('finished-media-lightbox');
  const lightboxImg = document.getElementById('finished-lightbox-img');
  const lightboxVideo = document.getElementById('finished-lightbox-video');

  const isVideo = (url) => /\.(mp4|mov|webm|m4v|avi)$/i.test(url);
  const PHASE_LABELS = {
    entry: 'Entry',
    progress: 'Progress',
    'exit-delivery': 'Exit / Delivery',
    unspecified: 'Unspecified'
  };

  let mediaStructure = null;
  let mediaPromise = null;

  const formatDate = (value) => {
    if (!value) return 'N/A';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 'N/A';
    let diff = e - s;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);
    const minutes = Math.floor(diff / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMs = (ms) => {
    if (!ms || Number.isNaN(ms)) return 'N/A';
    const minutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    const remMinutes = minutes % 60;
    return `${days}d ${remHours}h ${remMinutes}m`;
  };

  const getNoteTexts = (notes) => {
    if (!Array.isArray(notes)) return [];
    return notes
      .map(n => {
        if (typeof n === 'string') return n.trim();
        if (n && typeof n.noteText === 'string') return n.noteText.trim();
        if (n && typeof n.text === 'string') return n.text.trim();
        return '';
      })
      .filter(Boolean);
  };

  const normalizeKey = (value) => (value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const getPhaseLabel = (fileUrl) => {
    const safeUrl = (fileUrl || '').split('?')[0];
    const parts = safeUrl.split('/').filter(Boolean);
    const candidate = (parts[parts.length - 2] || '').toLowerCase();
    const phaseKey = PHASE_LABELS[candidate] ? candidate : 'unspecified';
    return { key: phaseKey, label: PHASE_LABELS[phaseKey] };
  };

  const groupFilesByPhase = (files) => {
    const groups = new Map();
    files.forEach((fileUrl) => {
      const phase = getPhaseLabel(fileUrl);
      if (!groups.has(phase.key)) {
        groups.set(phase.key, { key: phase.key, label: phase.label, files: [] });
      }
      groups.get(phase.key).files.push(fileUrl);
    });

    const order = ['entry', 'progress', 'exit-delivery', 'unspecified'];
    return order
      .filter((key) => groups.has(key))
      .map((key) => groups.get(key));
  };

  const getMediaStructure = async () => {
    if (mediaStructure) return mediaStructure;
    if (mediaPromise) return mediaPromise;
    mediaPromise = fetch('/project-images-structure')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
    mediaStructure = await mediaPromise;
    return mediaStructure;
  };

  const findNormalizedMatch = (projectMap, normalizedName) => {
    if (!projectMap || !normalizedName) return null;
    for (const [name, files] of Object.entries(projectMap)) {
      if (normalizeKey(name) === normalizedName) return files;
    }
    return null;
  };

  const findMediaForProject = (project, structure) => {
    if (!project || !structure) return [];
    const projectName = project.projectName || '';
    const normalizedName = normalizeKey(projectName);

    if (project.bayNumber) {
      const bayKey = `bay${project.bayNumber}`;
      const bayProjects = structure.bays?.[bayKey] || null;
      if (bayProjects) {
        if (bayProjects[projectName]) return bayProjects[projectName];
        const normalized = findNormalizedMatch(bayProjects, normalizedName);
        if (normalized) return normalized;
      }
    }

    const teams = Array.isArray(project.assignedTeam) ? project.assignedTeam : [];
    for (const teamName of teams) {
      const directProjects = structure.direct?.[teamName] || null;
      if (!directProjects) continue;
      if (directProjects[projectName]) return directProjects[projectName];
      const normalized = findNormalizedMatch(directProjects, normalizedName);
      if (normalized) return normalized;
    }

    const directAll = structure.direct || {};
    for (const projectMap of Object.values(directAll)) {
      if (projectMap && projectMap[projectName]) return projectMap[projectName];
      const normalized = findNormalizedMatch(projectMap, normalizedName);
      if (normalized) return normalized;
    }

    return [];
  };

  const renderMediaSection = (files) => {
    if (!detailMedia || !detailMediaMeta) return;
    detailMedia.innerHTML = '';
    if (!Array.isArray(files) || files.length === 0) {
      detailMediaMeta.textContent = '0 files';
      detailMedia.append(createEmptyState('No media found for this project.'));
      return;
    }

    const counts = files.reduce((acc, file) => {
      if (isVideo(file)) acc.videos += 1;
      else acc.photos += 1;
      return acc;
    }, { photos: 0, videos: 0 });
    detailMediaMeta.textContent = `${files.length} files - ${counts.photos} photos - ${counts.videos} videos`;

    const fragment = document.createDocumentFragment();
    const grouped = groupFilesByPhase(files);
    grouped.forEach((group) => {
      const groupWrap = document.createElement('div');
      groupWrap.className = 'detail-phase-group';
      groupWrap.dataset.phaseGroup = group.key;

      const header = document.createElement('div');
      header.className = 'detail-phase-header';
      const title = document.createElement('span');
      title.className = 'detail-phase-title';
      title.textContent = group.label;
      const count = document.createElement('span');
      count.className = 'detail-phase-count';
      count.textContent = `${group.files.length} file${group.files.length === 1 ? '' : 's'}`;
      header.append(title, count);
      groupWrap.append(header);

      const grid = document.createElement('div');
      grid.className = 'detail-media-grid';

      group.files.forEach((fileUrl) => {
        const link = document.createElement('a');
        link.className = 'detail-media-item';
        link.href = fileUrl;
        link.target = '_blank';
        link.rel = 'noopener';

        const phaseBadge = document.createElement('span');
        phaseBadge.className = 'detail-phase-badge';
        phaseBadge.dataset.phase = group.key;
        phaseBadge.textContent = group.label;

        if (isVideo(fileUrl)) {
          const badge = document.createElement('span');
          badge.className = 'detail-media-badge';
          badge.textContent = 'Video';
          const video = document.createElement('video');
          video.src = fileUrl;
          video.muted = true;
          video.preload = 'metadata';
          video.playsInline = true;
          link.append(badge, phaseBadge, video);
        } else {
          const img = document.createElement('img');
          img.src = fileUrl;
          img.alt = 'Project media';
          img.loading = 'lazy';
          link.append(phaseBadge, img);
        }

        grid.append(link);
      });

      groupWrap.append(grid);
      fragment.append(groupWrap);
    });
    detailMedia.append(fragment);
    bindMediaClicks();
  };

  const openMediaLightbox = (fileUrl) => {
    if (!mediaLightbox || !fileUrl) return;
    if (isVideo(fileUrl)) {
      if (lightboxImg) {
        lightboxImg.classList.remove('active');
        lightboxImg.src = '';
      }
      if (lightboxVideo) {
        lightboxVideo.src = fileUrl;
        lightboxVideo.classList.add('active');
      }
    } else {
      if (lightboxVideo) {
        lightboxVideo.pause();
        lightboxVideo.classList.remove('active');
        lightboxVideo.removeAttribute('src');
        lightboxVideo.load();
      }
      if (lightboxImg) {
        lightboxImg.src = fileUrl;
        lightboxImg.classList.add('active');
      }
    }
    mediaLightbox.classList.add('active');
    mediaLightbox.setAttribute('aria-hidden', 'false');
  };

  const closeMediaLightbox = () => {
    if (!mediaLightbox) return;
    if (lightboxVideo) {
      lightboxVideo.pause();
      lightboxVideo.classList.remove('active');
      lightboxVideo.removeAttribute('src');
      lightboxVideo.load();
    }
    if (lightboxImg) {
      lightboxImg.classList.remove('active');
      lightboxImg.src = '';
    }
    mediaLightbox.classList.remove('active');
    mediaLightbox.setAttribute('aria-hidden', 'true');
  };

  const bindMediaClicks = () => {
    detailMedia?.querySelectorAll('.detail-media-item').forEach((item) => {
      item.style.cursor = 'zoom-in';
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const fileUrl = item.getAttribute('href');
        openMediaLightbox(fileUrl);
      });
    });
  };

  const loadMediaForProject = async (project) => {
    if (!detailMedia || !detailMediaMeta) return;
    detailMediaMeta.textContent = 'Loading media...';
    detailMedia.innerHTML = '<div class="loading-card">Loading media...</div>';
    const structure = await getMediaStructure();
    const files = findMediaForProject(project, structure);
    renderMediaSection(files);
  };

  function closeDetail() {
    if (detailModal) detailModal.classList.remove('active');
  }

  function openDetail(project) {
    if (!detailModal || !project) return;
    detailTitle.textContent = project.projectName || 'Finished Project';
    const bay = project.bayNumber ? `Bay ${project.bayNumber}` : 'Bay N/A';
    detailSubtitle.textContent = `${bay} • Completed: ${formatDate(project.completedAt || project.updatedAt || project.createdAt)}`;

    detailMeta.innerHTML = '';
    const metaItems = [
      { label: 'Bay', value: bay },
      { label: 'Team', value: Array.isArray(project.assignedTeam) && project.assignedTeam.length ? project.assignedTeam.join(', ') : 'Unassigned' },
      { label: 'Timeline', value: `${formatDate(project.timer?.start)} → ${formatDate(project.timer?.end)}` },
      { label: 'Duration', value: formatDuration(project.timer?.start, project.timer?.end) },
      { label: 'Pause Count', value: Array.isArray(project.pauseEvents) ? `${project.pauseEvents.length}` : '0' },
      { label: 'Moved to Direct', value: project.movedToDirect ? 'Yes' : 'No' },
      { label: 'Created', value: formatDate(project.createdAt) },
      { label: 'Updated', value: formatDate(project.updatedAt) }
    ];
    metaItems.forEach(item => {
      const card = document.createElement('div');
      card.className = 'detail-card';
      card.innerHTML = `<div class="label">${item.label}</div><div class="value">${item.value}</div>`;
      detailMeta.append(card);
    });

    detailPauses.innerHTML = '';
    const pauses = Array.isArray(project.pauseEvents) ? project.pauseEvents : [];
    if (!pauses.length) {
      detailPauses.append(createEmptyState('No pause events captured.'));
    } else {
      pauses.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'detail-item';
        const pausedAt = formatDate(p.pausedAt);
        const resumedAt = formatDate(p.resumedAt);
        const duration = p.durationMs ? formatMs(p.durationMs) : 'N/A';
        div.innerHTML = `
          <div class="meta">Pause ${idx + 1}: ${pausedAt} → ${resumedAt} (${duration})</div>
          <div class="reason">Reason: ${(p.reason || 'N/A')}</div>
        `;
        detailPauses.append(div);
      });
    }

    detailDelay.textContent = (project.delayReason || '').trim() || 'No delays captured.';

    detailNotes.innerHTML = '';
    const noteTexts = getNoteTexts(project.projectNotes);
    if (!noteTexts.length) {
      detailNotes.append(createEmptyState('No notes captured for this project.'));
    } else {
      noteTexts.forEach((text, idx) => {
        const div = document.createElement('div');
        div.className = 'detail-item';
        div.innerHTML = `<div class="meta">Note ${idx + 1}</div><div class="reason">${text}</div>`;
        detailNotes.append(div);
      });
    }

    loadMediaForProject(project);

    detailModal.classList.add('active');
    detailModal.setAttribute('aria-hidden', 'false');
  }

  function updateStats() {
    const total = projects.length;
    const directMoves = projects.filter(p => p.movedToDirect).length;
    const delayed = projects.filter(p => (p.delayReason || '').trim()).length;
    if (totalEl) totalEl.textContent = total;
    if (directEl) directEl.textContent = directMoves;
    if (delayEl) delayEl.textContent = delayed;
  }

  function createMetaRow(label, value) {
    const row = document.createElement('div');
    row.className = 'meta-row';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'meta-label';
    labelSpan.textContent = label;
    const valueSpan = document.createElement('span');
    valueSpan.className = 'meta-value';
    valueSpan.textContent = value;
    row.append(labelSpan, valueSpan);
    return row;
  }

  function createChip(text, className = '') {
    const span = document.createElement('span');
    span.className = className ? `chip ${className}` : 'chip';
    span.textContent = text;
    return span;
  }

  function createEmptyState(message) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = message;
    return div;
  }

  function buildCard(project) {
    const assignedTeam = Array.isArray(project.assignedTeam) && project.assignedTeam.length
      ? project.assignedTeam.join(', ')
      : 'Unassigned';
    const pauseCount = Array.isArray(project.pauseEvents) ? project.pauseEvents.length : 0;
    const noteTexts = getNoteTexts(project.projectNotes);
    const delayReason = (project.delayReason || '').trim();

    const card = document.createElement('div');
    card.className = 'finished-card';

    const header = document.createElement('div');
    header.className = 'finished-card-header';
    header.append(createChip(project.bayNumber ? `Bay ${project.bayNumber}` : 'Bay N/A', 'chip-bay'));
    if (project.movedToDirect) header.append(createChip('Moved to Direct', 'chip-direct'));
    if (delayReason) header.append(createChip('Delayed', 'chip-warn'));
    card.append(header);

    const title = document.createElement('h3');
    title.textContent = project.projectName || 'Untitled project';
    card.append(title);

    const metaBlock = document.createElement('div');
    metaBlock.className = 'finished-meta';
    metaBlock.append(
      createMetaRow('Team', assignedTeam),
      createMetaRow('Timeline', `${formatDate(project.timer?.start)} → ${formatDate(project.timer?.end)}`),
      createMetaRow('Duration', formatDuration(project.timer?.start, project.timer?.end)),
      createMetaRow('Completed', formatDate(project.completedAt || project.updatedAt || project.createdAt)),
      createMetaRow('Pauses', `${pauseCount}`)
    );
    card.append(metaBlock);

    const delayBlock = document.createElement('div');
    delayBlock.className = 'delay-block';
    const delayLabel = document.createElement('span');
    delayLabel.className = 'meta-label';
    delayLabel.textContent = 'Delay Reason';
    const delayValue = document.createElement('span');
    delayValue.className = 'meta-value';
    delayValue.textContent = delayReason || 'No delays captured';
    delayBlock.append(delayLabel, delayValue);
    card.append(delayBlock);

    const notesBlock = document.createElement('div');
    notesBlock.className = 'notes-block';
    const notesTitle = document.createElement('div');
    notesTitle.className = 'notes-title';
    notesTitle.textContent = noteTexts.length ? `Notes (${noteTexts.length})` : 'Notes';
    notesBlock.append(notesTitle);
    if (noteTexts.length) {
      const ul = document.createElement('ul');
      ul.className = 'notes-list';
      noteTexts.slice(0, 3).forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        ul.append(li);
      });
      if (noteTexts.length > 3) {
        const more = document.createElement('li');
        more.className = 'notes-more';
        more.textContent = `+${noteTexts.length - 3} more note(s)`;
        ul.append(more);
      }
      notesBlock.append(ul);
    } else {
      const emptyNotes = document.createElement('p');
      emptyNotes.className = 'notes-empty';
      emptyNotes.textContent = 'No notes captured for this project.';
      notesBlock.append(emptyNotes);
    }
    card.append(notesBlock);

    card.addEventListener('click', () => openDetail(project));
    return card;
  }

  function filterProjects() {
    const query = (searchInput?.value || '').trim().toLowerCase();
    if (!query) return [...projects];
    return projects.filter(p => {
      const name = (p.projectName || '').toLowerCase();
      const team = Array.isArray(p.assignedTeam) ? p.assignedTeam.join(' ').toLowerCase() : '';
      const bayText = p.bayNumber ? `bay ${p.bayNumber}` : '';
      return name.includes(query) || team.includes(query) || bayText.includes(query) || String(p.bayNumber || '').includes(query);
    });
  }

  function sortProjects(list) {
    const sortBy = sortSelect?.value || 'recent';
    return [...list].sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.completedAt || a.updatedAt || a.createdAt || 0) - new Date(b.completedAt || b.updatedAt || b.createdAt || 0);
      }
      if (sortBy === 'bay') {
        return (a.bayNumber || 0) - (b.bayNumber || 0);
      }
      if (sortBy === 'name') {
        return (a.projectName || '').localeCompare(b.projectName || '');
      }
      return new Date(b.completedAt || b.updatedAt || b.createdAt || 0) - new Date(a.completedAt || a.updatedAt || a.createdAt || 0);
    });
  }

  function render() {
    if (!listEl) return;
    const filtered = sortProjects(filterProjects());
    listEl.innerHTML = '';
    if (!filtered.length) {
      listEl.append(createEmptyState('No finished projects match your search.'));
      return;
    }
    const fragment = document.createDocumentFragment();
    filtered.forEach(project => fragment.append(buildCard(project)));
    listEl.append(fragment);
  }

  async function loadProjects() {
    if (listEl) listEl.innerHTML = '<div class="loading-card">Loading finished projects...</div>';
    try {
      const res = await fetch('/api/finished-projects');
      if (!res.ok) throw new Error('Unable to load finished projects right now.');
      const data = await res.json();
      projects = Array.isArray(data) ? data : [];
      updateStats();
      render();
    } catch (err) {
      console.error(err);
      if (listEl) listEl.innerHTML = '<div class="error-card">Failed to load finished projects.</div>';
      if (totalEl) totalEl.textContent = '0';
      if (directEl) directEl.textContent = '0';
      if (delayEl) delayEl.textContent = '0';
    }
  }

  searchInput?.addEventListener('input', render);
  sortSelect?.addEventListener('change', render);

  loadProjects();

  // Modal wiring
  detailModal?.addEventListener('click', evt => {
    if (evt.target?.dataset?.close === 'detail') closeDetail();
  });
  document.addEventListener('keydown', evt => {
    if (evt.key === 'Escape' && detailModal?.classList.contains('active')) closeDetail();
  });

  mediaLightbox?.addEventListener('click', (evt) => {
    if (evt.target?.dataset?.close === 'media-lightbox') closeMediaLightbox();
  });
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && mediaLightbox?.classList.contains('active')) closeMediaLightbox();
  });
});
