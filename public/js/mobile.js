(function () {
  const bayListEl = document.getElementById('bayList');
  const directListEl = document.getElementById('directList');
  const toastContainer = document.getElementById('toastContainer');
  const overlay = document.getElementById('uploadOverlay');
  const uploadBar = document.getElementById('uploadBar');
  const uploadPercent = document.getElementById('uploadPercent');
  const uploadLabel = document.getElementById('uploadLabel');

  const showToast = (message, type) => {
    const div = document.createElement('div');
    div.className = `toast${type === 'error' ? ' error' : ''}`;
    div.textContent = message;
    toastContainer.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  };

  const selectUploadPhase = () => new Promise((resolve) => {
    let modal = document.getElementById('phase-select-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'phase-select-modal';
      modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,0.55);z-index:500;';
      modal.innerHTML = `
        <div style="background:#ffffff;border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,0.28);padding:20px 22px;min-width:260px;max-width:90vw;">
          <h2 style="margin:0 0 8px;font-size:1.05rem;">Select photo phase</h2>
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

  const uploadWithProgress = async ({ file, url, fieldName, label, extraFields }) => {
    const form = new FormData();
    if (extraFields) {
      Object.entries(extraFields).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          form.append(key, value);
        }
      });
    }
    form.append(fieldName, file, file.name);

    overlay.style.display = 'flex';
    uploadBar.style.width = '0%';
    uploadPercent.textContent = '0%';
    uploadLabel.textContent = label;

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          uploadBar.style.width = percent + '%';
          uploadPercent.textContent = percent + '%';
          uploadLabel.textContent = percent < 100 ? label : 'Processing...';
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          try {
            const resp = JSON.parse(xhr.responseText);
            reject(new Error(resp.error || 'Upload failed'));
          } catch {
            reject(new Error('Upload failed'));
          }
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  };

  const wireUploadInput = (input, config) => {
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const phase = input.dataset.phase || '';
      input.dataset.phase = '';
      if (!phase) {
        showToast('Select a phase before uploading.', 'error');
        input.value = '';
        return;
      }
      const extraFields = typeof config.extraFields === 'function'
        ? config.extraFields(phase)
        : { ...(config.extraFields || {}), phase };
      try {
        await uploadWithProgress({
          file,
          url: config.url,
          fieldName: config.fieldName,
          label: config.label,
          extraFields
        });
        showToast(config.successLabel);
        input.value = '';
      } catch (e) {
        console.error(e);
        showToast(e.message || 'Upload failed', 'error');
      } finally {
        overlay.style.display = 'none';
      }
    });
  };

  const createBayCard = (bayIndex, projectName, assignedPerson) => {
    const bayNum = bayIndex + 1;
    const hasProject = Boolean(projectName);
    const title = hasProject ? projectName : 'No active project';
    const people = Array.isArray(assignedPerson) && assignedPerson.length ? assignedPerson.join(', ') : 'Unassigned';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <span class="badge">Bay ${bayNum}</span>
      </div>
      <div>
        <p class="title">${title}</p>
        <p class="subtitle"><i class="fa-regular fa-user"></i> ${people}</p>
        <div class="actions">
          <input type="file" accept="image/*" capture="environment" class="hidden-input" id="file_bay_${bayNum}_photo" />
          <input type="file" accept="video/*" capture="environment" class="hidden-input" id="file_bay_${bayNum}_video" />
          <button class="btn btn-photo" data-bay-photo="${bayNum}"><i class="fa-solid fa-camera"></i> Photo</button>
          <button class="btn btn-video" data-bay-video="${bayNum}"><i class="fa-solid fa-video"></i> Video</button>
        </div>
      </div>
    `;

    const photoBtn = card.querySelector('button[data-bay-photo]');
    const videoBtn = card.querySelector('button[data-bay-video]');
    const photoInput = card.querySelector(`#file_bay_${bayNum}_photo`);
    const videoInput = card.querySelector(`#file_bay_${bayNum}_video`);

    photoBtn.addEventListener('click', async () => {
      const phase = await selectUploadPhase();
      if (!phase) return;
      photoInput.dataset.phase = phase;
      photoInput.click();
    });
    videoBtn.addEventListener('click', async () => {
      const phase = await selectUploadPhase();
      if (!phase) return;
      videoInput.dataset.phase = phase;
      videoInput.click();
    });

    const bayUrl = `/upload-photo/bay${bayNum}?projectName=${encodeURIComponent(projectName || '')}`;
    const extraFields = hasProject ? { projectName } : null;

    wireUploadInput(photoInput, {
      url: bayUrl,
      fieldName: `photo_bay${bayNum}`,
      label: `Uploading photo to Bay ${bayNum}...`,
      successLabel: `Bay ${bayNum}: Photo uploaded`,
      extraFields: (phase) => ({ ...(extraFields || {}), phase })
    });

    wireUploadInput(videoInput, {
      url: bayUrl,
      fieldName: `photo_bay${bayNum}`,
      label: `Uploading video to Bay ${bayNum}...`,
      successLabel: `Bay ${bayNum}: Video uploaded`,
      extraFields: (phase) => ({ ...(extraFields || {}), phase })
    });

    return card;
  };

  const createDirectCard = (project) => {
    const techName = project.technicianName || 'Technician';
    const title = project.projectName || 'Untitled';
    const range = project.timer && project.timer.start && project.timer.end
      ? `${new Date(project.timer.start).toLocaleDateString()} to ${new Date(project.timer.end).toLocaleDateString()}`
      : 'No schedule';

    const safeSegment = (value) => encodeURIComponent(value).replace(/_/g, '%5F');
    const safeTech = safeSegment(techName);
    const safeProject = safeSegment(title);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <span class="badge">Direct</span>
      </div>
      <div>
        <p class="title">${title}</p>
        <p class="subtitle"><i class="fa-solid fa-user-gear"></i> ${techName} - ${range}</p>
        <div class="actions">
          <input type="file" accept="image/*" capture="environment" class="hidden-input" id="file_direct_${safeTech}_${safeProject}_photo" />
          <input type="file" accept="video/*" capture="environment" class="hidden-input" id="file_direct_${safeTech}_${safeProject}_video" />
          <button class="btn btn-photo" data-direct-photo="${safeTech}|${safeProject}"><i class="fa-solid fa-camera"></i> Photo</button>
          <button class="btn btn-video" data-direct-video="${safeTech}|${safeProject}"><i class="fa-solid fa-video"></i> Video</button>
        </div>
      </div>
    `;

    const photoBtn = card.querySelector('button[data-direct-photo]');
    const videoBtn = card.querySelector('button[data-direct-video]');
    const photoInput = card.querySelector(`#file_direct_${CSS.escape(safeTech)}_${CSS.escape(safeProject)}_photo`);
    const videoInput = card.querySelector(`#file_direct_${CSS.escape(safeTech)}_${CSS.escape(safeProject)}_video`);

    photoBtn.addEventListener('click', async () => {
      const phase = await selectUploadPhase();
      if (!phase) return;
      photoInput.dataset.phase = phase;
      photoInput.click();
    });
    videoBtn.addEventListener('click', async () => {
      const phase = await selectUploadPhase();
      if (!phase) return;
      videoInput.dataset.phase = phase;
      videoInput.click();
    });

    const fieldName = `photo_direct_${safeTech}_${safeProject}`;

    wireUploadInput(photoInput, {
      url: '/upload-photo/direct',
      fieldName,
      label: `Uploading photo for ${techName}...`,
      successLabel: `${techName}: Photo uploaded`,
      extraFields: (phase) => ({ phase })
    });

    wireUploadInput(videoInput, {
      url: '/upload-photo/direct',
      fieldName,
      label: `Uploading video for ${techName}...`,
      successLabel: `${techName}: Video uploaded`,
      extraFields: (phase) => ({ phase })
    });

    return card;
  };

  async function load() {
    bayListEl.innerHTML = '';
    directListEl.innerHTML = '';

    try {
      const [dataRes, directRes] = await Promise.all([
        fetch('/data'),
        fetch('/api/direct-projects')
      ]);

      const data = await dataRes.json();
      const directProjects = await directRes.json();

      if (Array.isArray(data?.quadrants)) {
        data.quadrants.forEach((bay, idx) => {
          const assigned = bay.assignedPerson || bay.assignedTeam || [];
          const card = createBayCard(idx, bay.projectName, assigned);
          bayListEl.appendChild(card);
        });
      }

      const activeDirects = Array.isArray(directProjects)
        ? directProjects.filter(p => !p.status || p.status === 'active')
        : [];

      if (activeDirects.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'card';
        empty.innerHTML = '<div></div><div><p class="title">No direct projects</p><p class="subtitle">Direct assignments will appear here.</p></div>';
        directListEl.appendChild(empty);
      } else {
        activeDirects.forEach((project) => {
          directListEl.appendChild(createDirectCard(project));
        });
      }
    } catch (e) {
      console.error('Load error:', e);
      showToast('Failed to load projects', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', load);
  setInterval(load, 120000);
})();
