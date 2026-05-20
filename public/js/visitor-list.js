document.addEventListener('DOMContentLoaded', () => {
  const visitorBody = document.getElementById('visitor-table-body');
  const workshopBody = document.getElementById('workshop-table-body');
  const visitorCount = document.getElementById('visitor-count');
  const workshopCount = document.getElementById('workshop-count');

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  };

  const renderRows = (rows, target, columns, formPath) => {
    if (!target) return;
    if (!rows.length) {
      target.innerHTML = '<tr><td colspan="5" class="table-empty">No records yet.</td></tr>';
      return;
    }

    target.innerHTML = rows.map((row) => {
      const values = columns.map((col) => escapeHtml(col(row)));
      const rowId = row?._id || '';
      if (!rowId) {
        return `<tr>${values.map((value) => `<td>${value}</td>`).join('')}</tr>`;
      }
      return `<tr class="clickable-row" tabindex="0" role="link" aria-label="Open visitor details" data-record-id="${escapeHtml(rowId)}" data-form-path="${escapeHtml(formPath)}">${values.map((value) => `<td>${value}</td>`).join('')}</tr>`;
    }).join('');

    target.querySelectorAll('tr.clickable-row').forEach((rowEl) => {
      const openRecord = () => {
        const recordId = rowEl.dataset.recordId;
        const targetForm = rowEl.dataset.formPath || '/visitor-form';
        if (!recordId) return;
        const url = `${targetForm}?recordId=${encodeURIComponent(recordId)}&mode=view`;
        window.location.href = url;
      };

      rowEl.addEventListener('click', openRecord);
      rowEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openRecord();
        }
      });
    });
  };

  const loadTable = async (type) => {
    const response = await fetch(`/api/visitors?type=${type}`);
    if (!response.ok) return [];
    return response.json();
  };

  Promise.all([loadTable('visitor'), loadTable('delivery'), loadTable('workshop')])
    .then(([visitorRows, deliveryRows, workshopRows]) => {
      const allVisitorRows = [...deliveryRows, ...visitorRows]
        .sort((a, b) => new Date(b.createdAt || b.inductionDate || 0) - new Date(a.createdAt || a.inductionDate || 0));

      if (visitorCount) visitorCount.textContent = `${allVisitorRows.length} total`;
      if (workshopCount) workshopCount.textContent = `${workshopRows.length} total`;

      renderRows(allVisitorRows, visitorBody, [
        (row) => formatDate(row.createdAt || row.inductionDate),
        (row) => row.delivery?.name || row.visitor?.name || '—',
        (row) => row.delivery?.company || row.visitor?.company || '—',
        (row) => row.delivery?.contactNo || row.visitor?.contactNo || '—',
        (row) => row.delivery?.idNumber || row.visitor?.idNumber || '—'
      ], '/visitor-form');

      renderRows(workshopRows, workshopBody, [
        (row) => formatDate(row.createdAt || row.inductionDate),
        (row) => row.visitor?.company || '—',
        (row) => row.visitor?.contactNo || '—',
        (row) => row.visitor?.name || '—',
        (row) => row.visitor?.idNumber || '—'
      ], '/workshop-visitor-form');
    })
    .catch(() => {
      if (visitorBody) {
        visitorBody.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load visitors.</td></tr>';
      }
      if (workshopBody) {
        workshopBody.innerHTML = '<tr><td colspan="5" class="table-empty">Failed to load workshop visitors.</td></tr>';
      }
    });
});
