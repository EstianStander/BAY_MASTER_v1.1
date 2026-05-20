document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('equipment-form');
  const list = document.getElementById('equipment-list');
  const status = document.getElementById('form-status');
  const photoInput = document.getElementById('photo');
  const previewContainer = document.getElementById('photo-preview-container');
  const previewList = document.getElementById('photo-preview-list');
  const resetBtn = document.getElementById('form-reset');
  const equipmentIdInput = document.getElementById('equipmentId');
  const equipmentNameInput = document.getElementById('equipmentName');
  const customerNameInput = document.getElementById('customerName');
  const customerContactInput = document.getElementById('customerContact');
  const historyList = document.getElementById('equipment-history');
  const historyModal = document.getElementById('equipment-history-modal');
  const historyTitle = document.getElementById('equipment-history-title');
  const historySubtitle = document.getElementById('equipment-history-subtitle');
  const historyBody = document.getElementById('equipment-history-body');
  const detailModal = document.getElementById('equipment-detail-modal');
  const detailTitle = document.getElementById('equipment-detail-title');
  const detailSubtitle = document.getElementById('equipment-detail-subtitle');
  const detailMeta = document.getElementById('equipment-detail-meta');
  const detailIssue = document.getElementById('equipment-detail-issue');
  const detailPhotos = document.getElementById('equipment-detail-photos');
  const deleteBtn = document.getElementById('equipment-delete-btn');
  const submitBtn = form?.querySelector('button[type="submit"]');
  let selectedFiles = [];
  let currentEquipment = null;
  let allEquipment = [];
  let equipmentIndex = new Map();
  let autofillTimer = null;

  function setStatus(message, type = 'info') {
    if (!status) return;
    status.textContent = message;
    status.className = `form-status ${type}`;
  }

  function clearPreview() {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    previewContainer.style.display = 'none';
    if (previewList) {
      previewList.innerHTML = '';
      previewList.style.display = 'none';
    }
    selectedFiles = [];
    if (photoInput) photoInput.value = '';
  }

  function renderPreview(files) {
    if (!previewContainer) return;
    if (!files || !files.length) {
      clearPreview();
      return;
    }
    previewContainer.innerHTML = Array.from(files).map(file => {
      const url = URL.createObjectURL(file);
      return `<div class="preview-thumb"><img src="${url}" alt="Preview"></div>`;
    }).join('');
    previewContainer.style.display = 'grid';

    if (previewList) {
      previewList.innerHTML = Array.from(files).map(file => {
        const sizeKb = Math.round(file.size / 1024);
        return `<div class="preview-item"><span>${file.name}</span><span class="preview-size">${sizeKb} KB</span></div>`;
      }).join('');
      previewList.style.display = 'block';
    }
  }

  function renderEquipment(items) {
    if (!list) return;
    if (!Array.isArray(items) || !items.length) {
      list.innerHTML = '<div class="empty-card">No equipment booked in yet.</div>';
      return;
    }

    list.innerHTML = items.map(item => {
      const received = item.receivedAt || item.createdAt;
      const receivedText = received ? new Date(received).toLocaleString() : 'Just now';
      const photos = Array.isArray(item.photoUrls) ? item.photoUrls : (item.photoUrl ? [item.photoUrl] : []);
      const firstPhoto = photos[0];
      const countBadge = photos.length > 1 ? `<span class="photo-count">${photos.length} photos</span>` : '';
      const photoSection = firstPhoto ? `<div class="equipment-photo"><img src="${firstPhoto}" alt="${item.equipmentName || 'Equipment'} photo">${countBadge}</div>` : '';
      return `
        <article class="equipment-card finished-card" data-id="${item._id || ''}">
          <header class="equipment-card-header finished-card-header">
            <div>
              <p class="equipment-id">${item.equipmentId || ''}</p>
              <h3>${item.equipmentName || 'Equipment'}</h3>
              <p class="equipment-meta">${item.category || 'Uncategorised'} · ${receivedText}</p>
            </div>
            <span class="chip chip-bay">Booked In</span>
          </header>
          <p class="equipment-issue">${item.issueDescription || ''}</p>
          ${photoSection}
        </article>
      `;
    }).join('');
  }

  function renderHistory(items) {
    if (!historyList) return;
    if (!Array.isArray(items) || !items.length) {
      historyList.innerHTML = '<div class="empty-card">No equipment history yet.</div>';
      return;
    }

    const header = `
      <div class="history-row header">
        <div>Status</div>
        <div>Equipment</div>
        <div>Customer</div>
        <div>Booked In</div>
        <div>Checked Out</div>
      </div>
    `;

    const rows = items.map(item => {
      const status = item.status === 'checked-out' ? 'checked-out' : 'in-workshop';
      const statusLabel = status === 'checked-out' ? 'Checked Out' : 'In Workshop';
      const received = item.receivedAt || item.createdAt;
      const receivedText = received ? new Date(received).toLocaleDateString() : 'N/A';
      const checkedOutText = item.checkedOutAt ? new Date(item.checkedOutAt).toLocaleDateString() : 'N/A';
      const customer = item.customerName || item.customerContact || 'N/A';
      const contact = item.customerName && item.customerContact ? ` · ${item.customerContact}` : '';
      return `
        <div class="history-row clickable" data-equipment-id="${item.equipmentId || ''}">
          <div><span class="status-pill ${status === 'checked-out' ? 'status-out' : 'status-in'}">${statusLabel}</span></div>
          <div>
            <strong>${item.equipmentName || 'Equipment'}</strong>
            <div class="muted">${item.equipmentId || ''}</div>
          </div>
          <div>${customer}${contact}</div>
          <div>${receivedText}</div>
          <div>${checkedOutText}</div>
        </div>
      `;
    }).join('');

    historyList.innerHTML = header + rows;
  }

  function indexEquipment(items) {
    equipmentIndex = new Map();
    items.forEach(item => {
      const key = (item.equipmentId || '').toLowerCase();
      if (!key) return;
      if (!equipmentIndex.has(key)) {
        equipmentIndex.set(key, item);
      }
    });
  }

  function clearAutofill() {
    if (equipmentNameInput) equipmentNameInput.value = '';
    if (customerNameInput) customerNameInput.value = '';
    if (customerContactInput) customerContactInput.value = '';
  }

  function applyAutofill(item) {
    if (!item) {
      clearAutofill();
      return;
    }
    if (equipmentNameInput) equipmentNameInput.value = item.equipmentName || '';
    if (customerNameInput) customerNameInput.value = item.customerName || '';
    if (customerContactInput) customerContactInput.value = item.customerContact || '';
  }

  async function loadEquipment() {
    if (!list) return;
    list.innerHTML = '<div class="loading-card">Loading equipment...</div>';
    try {
      const res = await fetch('/api/equipment');
      if (!res.ok) throw new Error('Failed to load equipment');
      const data = await res.json();
      allEquipment = Array.isArray(data) ? data : [];
      indexEquipment(allEquipment);
      const active = allEquipment.filter(item => (item.status || 'in-workshop') === 'in-workshop');
      renderEquipment(active);
      bindCardClicks(active);
      renderHistory(allEquipment);
      bindHistoryClicks();
      bindGalleryClicks();
    } catch (err) {
      list.innerHTML = `<div class="error-card">${err.message}</div>`;
      if (historyList) historyList.innerHTML = '<div class="error-card">Unable to load history.</div>';
    }
  }

  if (photoInput) {
    photoInput.addEventListener('change', () => {
      const incoming = Array.from(photoInput.files || []);
      selectedFiles = [...selectedFiles, ...incoming].slice(0, 10);

      // Rebuild FileList with accumulated files so FormData sees them all
      const dt = new DataTransfer();
      selectedFiles.forEach(file => dt.items.add(file));
      photoInput.files = dt.files;

      renderPreview(photoInput.files || []);
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', clearPreview);
  }

  if (form) {
    form.addEventListener('submit', async evt => {
      evt.preventDefault();
      const formData = new FormData(form);
      setStatus('Saving equipment...', 'info loading-dots');
      if (submitBtn) submitBtn.disabled = true;
      form.classList.add('is-loading');
      try {
        const res = await fetch('/api/equipment', { method: 'POST', body: formData });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || 'Failed to save equipment');
        }
        setStatus('Equipment booked in successfully.', 'success');
        form.reset();
        clearPreview();
        await loadEquipment();
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'Unable to save equipment', 'error');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        form.classList.remove('is-loading');
      }
    });
  }

  function showDetail(item) {
    if (!detailModal || !item) return;
    currentEquipment = item;
    detailTitle.textContent = item.equipmentName || 'Equipment';
    const received = item.receivedAt || item.createdAt;
    const receivedText = received ? new Date(received).toLocaleString() : 'Just now';
    detailSubtitle.textContent = `${item.category || 'Uncategorised'} · ${receivedText}`;

    detailMeta.innerHTML = `
      <div class="detail-card"><strong>ID</strong><br>${item.equipmentId || ''}</div>
      <div class="detail-card"><strong>Category</strong><br>${item.category || ''}</div>
      <div class="detail-card"><strong>Received</strong><br>${receivedText}</div>
      <div class="detail-card"><strong>Customer</strong><br>${item.customerName || 'N/A'}</div>
      <div class="detail-card"><strong>Contact</strong><br>${item.customerContact || 'N/A'}</div>
    `;
    detailIssue.textContent = item.issueDescription || '';

    const photos = Array.isArray(item.photoUrls) ? item.photoUrls : (item.photoUrl ? [item.photoUrl] : []);
    if (photos.length) {
      detailPhotos.innerHTML = photos.map(url => `<div class="gallery-img"><img src="${url}" alt="${item.equipmentName || 'Equipment'} photo"></div>`).join('');
      bindGalleryClicks();
    } else {
      detailPhotos.innerHTML = '<p>No photos uploaded.</p>';
    }

    detailModal.classList.add('active');
  }

  function showHistory(equipmentId) {
    if (!historyModal || !historyBody || !equipmentId) return;
    const key = equipmentId.toLowerCase();
    const bookings = allEquipment
      .filter(item => (item.equipmentId || '').toLowerCase() === key)
      .sort((a, b) => new Date(b.receivedAt || b.createdAt) - new Date(a.receivedAt || a.createdAt));

    if (!bookings.length) return;

    const latest = bookings[0];
    historyTitle.textContent = `${latest.equipmentName || 'Equipment'} (${latest.equipmentId || ''})`;
    const customerLine = latest.customerName || latest.customerContact || 'N/A';
    historySubtitle.textContent = `Customer: ${customerLine}`;

    historyBody.innerHTML = bookings.map((booking, index) => {
      const received = booking.receivedAt || booking.createdAt;
      const receivedText = received ? new Date(received).toLocaleString() : 'N/A';
      const checkedOutText = booking.checkedOutAt ? new Date(booking.checkedOutAt).toLocaleString() : 'N/A';
      const photos = Array.isArray(booking.photoUrls) ? booking.photoUrls : (booking.photoUrl ? [booking.photoUrl] : []);
      const photosHtml = photos.length
        ? photos.map(url => `<img src="${url}" alt="${booking.equipmentName || 'Equipment'} photo">`).join('')
        : '<p class="muted">No photos uploaded for this booking.</p>';
      const divider = index < bookings.length - 1 ? '<div class="history-entry-divider"></div>' : '';
      return `
        <div class="history-entry">
          <div class="history-entry-header">
            <div>Booked in: ${receivedText}</div>
            <div class="history-entry-meta">Booked out: ${checkedOutText}</div>
          </div>
          <div class="history-entry-reason">Reason: ${booking.issueDescription || 'N/A'}</div>
          <div class="history-entry-photos">${photosHtml}</div>
          ${divider}
        </div>
      `;
    }).join('');

    bindHistoryGalleryClicks();
    historyModal.classList.add('active');
  }

  function bindCardClicks(items) {
    if (!list) return;
    list.querySelectorAll('.equipment-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const item = items.find(i => (i._id || '') === id);
        showDetail(item);
      });
    });
  }

  function bindHistoryClicks() {
    if (!historyList) return;
    historyList.querySelectorAll('.history-row.clickable').forEach(row => {
      row.addEventListener('click', () => {
        const equipmentId = row.dataset.equipmentId;
        if (equipmentId) showHistory(equipmentId);
      });
    });
  }

  document.querySelectorAll('[data-close="equipment-detail"]').forEach(btn => {
    btn.addEventListener('click', () => detailModal?.classList.remove('active'));
  });

  document.querySelectorAll('[data-close="equipment-history"]').forEach(btn => {
    btn.addEventListener('click', () => historyModal?.classList.remove('active'));
  });

  detailModal?.addEventListener('click', evt => {
    if (evt.target === detailModal) detailModal.classList.remove('active');
  });

  historyModal?.addEventListener('click', evt => {
    if (evt.target === historyModal) historyModal.classList.remove('active');
  });

  deleteBtn?.addEventListener('click', async () => {
    if (!currentEquipment?._id) return;
    const confirmed = window.confirm('Mark this equipment as checked out of the workshop?');
    if (!confirmed) return;
    try {
      setStatus('Marking equipment as checked out...', 'info loading-dots');
      const res = await fetch(`/api/equipment/${currentEquipment._id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove equipment');
      detailModal.classList.remove('active');
      await loadEquipment();
      setStatus('Equipment marked as checked out.', 'success');
    } catch (err) {
      console.error(err);
      setStatus(err.message || 'Unable to remove equipment', 'error');
    }
  });

  if (equipmentIdInput) {
    equipmentIdInput.addEventListener('input', () => {
      if (autofillTimer) window.clearTimeout(autofillTimer);
      autofillTimer = window.setTimeout(() => {
        const idValue = equipmentIdInput.value.trim().toLowerCase();
        if (!idValue) {
          clearAutofill();
          return;
        }
        const match = equipmentIndex.get(idValue);
        if (match) {
          applyAutofill(match);
        } else {
          clearAutofill();
        }
      }, 300);
    });
  }

  // Lightweight image lightbox for inspecting photos
  const lightbox = document.createElement('div');
  lightbox.id = 'photo-lightbox';
  lightbox.innerHTML = `
    <div class="photo-lightbox-backdrop"></div>
    <div class="photo-lightbox-body">
      <img id="lightbox-img" alt="Equipment photo">
    </div>
  `;
  document.body.appendChild(lightbox);
  const lightboxImg = lightbox.querySelector('#lightbox-img');
  const closeLightbox = () => lightbox.classList.remove('active');
  lightbox.addEventListener('click', closeLightbox);

  function bindGalleryClicks() {
    bindImageClicks(detailPhotos);
  }

  function bindHistoryGalleryClicks() {
    bindImageClicks(historyBody);
  }

  function bindImageClicks(container) {
    container?.querySelectorAll('img').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', ev => {
        ev.stopPropagation();
        if (!lightboxImg) return;
        lightboxImg.src = img.src;
        lightbox.classList.add('active');
      });
    });
  }

  loadEquipment();
});
