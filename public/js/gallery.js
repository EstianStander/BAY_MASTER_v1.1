(function () {
  const projectListEl = document.getElementById('projectList');
  const detailViewEl = document.getElementById('detailView');
  const bayFilterEl = document.getElementById('bayFilter');
  const searchInputEl = document.getElementById('searchInput');
  const resultsMetaEl = document.getElementById('resultsMeta');

  const isVideo = (url) => /\.(mp4|mov|webm|m4v|avi)$/i.test(url);
  const PHASE_LABELS = {
    entry: 'Entry',
    progress: 'Progress',
    'exit-delivery': 'Exit / Delivery',
    unspecified: 'Unspecified'
  };

  let allProjects = [];
  let filteredProjects = [];
  let activeId = null;
  let selectedFiles = new Set();

  const normalize = (value) => (value || '').toLowerCase();

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

  const countMedia = (files) => {
    let photos = 0;
    let videos = 0;
    files.forEach((file) => {
      if (isVideo(file)) videos += 1;
      else photos += 1;
    });
    return { photos, videos };
  };

  const updateSelectionUI = (project) => {
    if (!project) return;
    const selectedCount = project.files.filter((fileUrl) => selectedFiles.has(fileUrl)).length;
    const selectedCountEl = detailViewEl.querySelector('[data-selected-count]');
    const downloadSelectedBtn = detailViewEl.querySelector('[data-download-selected]');
    const selectAllBtn = detailViewEl.querySelector('[data-select-all]');

    if (selectedCountEl) {
      selectedCountEl.textContent = `${selectedCount} selected`;
    }

    if (downloadSelectedBtn) {
      downloadSelectedBtn.disabled = selectedCount === 0;
    }

    if (selectAllBtn) {
      const allSelected = selectedCount === project.files.length && project.files.length > 0;
      selectAllBtn.textContent = allSelected ? 'Clear selection' : 'Select all';
    }
  };

  const downloadArchive = async (files, archiveName) => {
    if (!files || files.length === 0) return;
    try {
      const resp = await fetch('/download-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, archiveName })
      });

      if (!resp.ok) {
        const errorPayload = await resp.json().catch(() => ({}));
        throw new Error(errorPayload.error || 'Download failed');
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${archiveName || 'media-download'}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      alert('Download failed. Please try again.');
    }
  };

  const renderDetail = (project) => {
    if (!project) {
      detailViewEl.className = 'empty-state';
      detailViewEl.textContent = 'Select a project to view media.';
      return;
    }

    const mediaCounts = countMedia(project.files);
    const selectedCount = project.files.filter((fileUrl) => selectedFiles.has(fileUrl)).length;
    detailViewEl.className = '';
    detailViewEl.innerHTML = `
      <div class="detail-header">
        <p class="detail-title">${project.projectName}</p>
        <div class="detail-subtitle">${project.metaLine}</div>
        <div class="project-meta">
          <span class="chip"><i class="fa-regular fa-image"></i> ${mediaCounts.photos} photos</span>
          <span class="chip"><i class="fa-solid fa-film"></i> ${mediaCounts.videos} videos</span>
        </div>
        <div class="detail-actions">
          <button class="action-button primary" data-download-project>Download project</button>
          <button class="action-button" data-download-selected ${selectedCount === 0 ? 'disabled' : ''}>Download selected</button>
          <button class="action-button ghost" data-select-all>Select all</button>
          <span class="selection-count" data-selected-count>${selectedCount} selected</span>
        </div>
      </div>
      ${groupFilesByPhase(project.files).map((group) => `
        <div class="media-phase-group" data-phase-group="${group.key}">
          <div class="media-phase-header">
            <span class="media-phase-title">${group.label}</span>
            <span class="media-phase-count">${group.files.length} file${group.files.length === 1 ? '' : 's'}</span>
          </div>
          <div class="media-grid">
            ${group.files.map((fileUrl) => (
              isVideo(fileUrl)
                ? `
                  <div class="media-tile" data-file-url="${fileUrl}">
                    <div class="media-select">
                      <input type="checkbox" data-file="${fileUrl}" ${selectedFiles.has(fileUrl) ? 'checked' : ''} />
                    </div>
                    <span class="media-phase" data-phase="${group.key}">${group.label}</span>
                    <video controls preload="metadata" src="${fileUrl}"></video>
                  </div>
                `
                : `
                  <div class="media-tile" data-file-url="${fileUrl}">
                    <div class="media-select">
                      <input type="checkbox" data-file="${fileUrl}" ${selectedFiles.has(fileUrl) ? 'checked' : ''} />
                    </div>
                    <span class="media-phase" data-phase="${group.key}">${group.label}</span>
                    <img src="${fileUrl}" alt="${project.projectName} media" loading="lazy" />
                  </div>
                `
            )).join('')}
          </div>
        </div>
      `).join('')}
    `;

    detailViewEl.querySelectorAll('.media-select input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const fileUrl = checkbox.dataset.file;
        if (!fileUrl) return;
        if (checkbox.checked) {
          selectedFiles.add(fileUrl);
        } else {
          selectedFiles.delete(fileUrl);
        }
        updateSelectionUI(project);
      });
    });

    const downloadProjectBtn = detailViewEl.querySelector('[data-download-project]');
    downloadProjectBtn?.addEventListener('click', () => {
      downloadArchive(project.files, project.projectName);
    });

    const downloadSelectedBtn = detailViewEl.querySelector('[data-download-selected]');
    downloadSelectedBtn?.addEventListener('click', () => {
      const files = project.files.filter((fileUrl) => selectedFiles.has(fileUrl));
      downloadArchive(files, `${project.projectName}-selected`);
    });

    const selectAllBtn = detailViewEl.querySelector('[data-select-all]');
    selectAllBtn?.addEventListener('click', () => {
      const allSelected = project.files.every((fileUrl) => selectedFiles.has(fileUrl));
      if (allSelected) {
        selectedFiles = new Set();
        detailViewEl.querySelectorAll('.media-select input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = false;
        });
      } else {
        selectedFiles = new Set(project.files);
        detailViewEl.querySelectorAll('.media-select input[type="checkbox"]').forEach((checkbox) => {
          checkbox.checked = true;
        });
      }
      updateSelectionUI(project);
    });

    updateSelectionUI(project);
  };

  const renderList = () => {
    projectListEl.innerHTML = '';
    if (filteredProjects.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No projects match the current filter.';
      projectListEl.appendChild(empty);
      renderDetail(null);
      resultsMetaEl.textContent = '0 projects';
      return;
    }

    filteredProjects.forEach((project) => {
      const item = document.createElement('div');
      item.className = `project-item${project.id === activeId ? ' active' : ''}`;
      item.dataset.projectId = project.id;

      const mediaCounts = countMedia(project.files);
      item.innerHTML = `
        <div class="project-title">${project.projectName}</div>
        <div class="project-meta">
          <span>${project.metaLine}</span>
          <span>${project.files.length} files</span>
        </div>
        <div class="project-meta">
          <span class="chip"><i class="fa-regular fa-image"></i> ${mediaCounts.photos}</span>
          <span class="chip"><i class="fa-solid fa-film"></i> ${mediaCounts.videos}</span>
        </div>
      `;

      item.addEventListener('click', () => {
        activeId = project.id;
        selectedFiles = new Set();
        renderList();
        renderDetail(project);
      });

      projectListEl.appendChild(item);
    });

    resultsMetaEl.textContent = `${filteredProjects.length} project${filteredProjects.length === 1 ? '' : 's'}`;

    const activeProject = filteredProjects.find((p) => p.id === activeId) || filteredProjects[0];
    activeId = activeProject.id;
    selectedFiles = new Set();
    renderDetail(activeProject);
    const activeItem = projectListEl.querySelector(`[data-project-id="${activeProject.id}"]`);
    activeItem?.classList.add('active');
  };

  const applyFilters = () => {
    const bayFilter = bayFilterEl.value;
    const searchValue = normalize(searchInputEl.value);

    filteredProjects = allProjects.filter((project) => {
      if (bayFilter !== 'all') {
        if (bayFilter === 'direct' && project.type !== 'direct') return false;
        if (bayFilter !== 'direct' && project.bay !== bayFilter) return false;
      }

      if (!searchValue) return true;
      const haystack = normalize(`${project.projectName} ${project.metaLine}`);
      return haystack.includes(searchValue);
    });

    if (!filteredProjects.find((p) => p.id === activeId)) {
      activeId = filteredProjects.length ? filteredProjects[0].id : null;
    }

    renderList();
  };

  const buildProjects = (data) => {
    const projects = [];

    Object.entries(data.bays || {}).forEach(([bayKey, projectMap]) => {
      Object.entries(projectMap || {}).forEach(([projectName, files]) => {
        if (!Array.isArray(files) || files.length === 0) return;
        projects.push({
          id: `${bayKey}-${projectName}`,
          type: 'bay',
          bay: bayKey,
          projectName,
          metaLine: `${bayKey.toUpperCase()} project`,
          files
        });
      });
    });

    Object.entries(data.direct || {}).forEach(([techName, projectMap]) => {
      Object.entries(projectMap || {}).forEach(([projectName, files]) => {
        if (!Array.isArray(files) || files.length === 0) return;
        projects.push({
          id: `direct-${techName}-${projectName}`,
          type: 'direct',
          bay: 'direct',
          projectName,
          metaLine: `Direct - ${techName}`,
          files
        });
      });
    });

    return projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
  };

  async function loadGallery() {
    try {
      const resp = await fetch('/project-images-structure');
      const data = await resp.json();
      allProjects = buildProjects(data);
      filteredProjects = allProjects.slice();
      renderList();
    } catch (err) {
      console.error('Gallery load failed', err);
      projectListEl.innerHTML = '';
      detailViewEl.className = 'empty-state';
      detailViewEl.textContent = 'Failed to load gallery data.';
      resultsMetaEl.textContent = '0 projects';
    }
  }

  bayFilterEl.addEventListener('change', applyFilters);
  searchInputEl.addEventListener('input', applyFilters);
  document.addEventListener('DOMContentLoaded', loadGallery);
})();
