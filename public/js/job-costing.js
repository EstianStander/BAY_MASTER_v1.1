const FIXED_RATE_NORMAL = 590.16;
const FIXED_RATE_OT15 = 885.24;
const FIXED_RATE_OT20 = 1180.32;

const state = {
  id: null,
  projectSource: '',
  projectId: '',
  projectName: '',
  bayNumber: null,
  materials: [],
  technicians: []
};

const els = {
  projectSelect: document.getElementById('project-select'),
  jobSelect: document.getElementById('job-select'),
  companyName: document.getElementById('companyName'),
  customerOrderNo: document.getElementById('customerOrderNo'),
  ticketNo: document.getElementById('ticketNo'),
  quoteNo: document.getElementById('quoteNo'),
  jobNo: document.getElementById('jobNo'),
  category: document.getElementById('category'),
  description: document.getElementById('description'),
  actualNormal: document.getElementById('actualNormal'),
  actualOt15: document.getElementById('actualOt15'),
  actualOt20: document.getElementById('actualOt20'),
  revenue: document.getElementById('revenue'),
  allocNormal: document.getElementById('allocNormal'),
  allocOt15: document.getElementById('allocOt15'),
  allocOt20: document.getElementById('allocOt20'),
  normalTotal: document.getElementById('normalTotal'),
  ot15Total: document.getElementById('ot15Total'),
  ot20Total: document.getElementById('ot20Total'),
  totalMaterialCost: document.getElementById('totalMaterialCost'),
  totalLabourCost: document.getElementById('totalLabourCost'),
  totalCost: document.getElementById('totalCost'),
  grossProfit: document.getElementById('grossProfit'),
  markup: document.getElementById('markup'),
  margin: document.getElementById('margin'),
  costPct: document.getElementById('costPct'),
  hoursVariance: document.getElementById('hoursVariance'),
  hoursCostImpact: document.getElementById('hoursCostImpact'),
  techHoursWarning: document.getElementById('techHoursWarning'),
  materialsTbody: document.querySelector('#materials-table tbody'),
  techniciansTbody: document.querySelector('#tech-table tbody'),
  techSelect: document.getElementById('tech-select'),
  techHours: document.getElementById('tech-hours'),
  techMain: document.getElementById('tech-main'),
  addTech: document.getElementById('add-tech'),
  addMaterial: document.getElementById('add-material'),
  importCsv: document.getElementById('import-csv'),
  csvFile: document.getElementById('csv-file'),
  saveJob: document.getElementById('save-job'),
  newJob: document.getElementById('new-job'),
  deleteJob: document.getElementById('delete-job')
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return `R ${toNumber(value).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value) {
  return `${toNumber(value).toFixed(2)}%`;
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return res.json();
}

async function loadProjects() {
  const projects = await fetchJson('/api/job-costing/projects');
  els.projectSelect.innerHTML = '<option value="">Select project</option>';
  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = JSON.stringify({
      source: project.source,
      id: project.id,
      projectName: project.projectName,
      bayNumber: project.bayNumber
    });
    option.textContent = project.label;
    els.projectSelect.appendChild(option);
  });
}

async function loadJobs() {
  const jobs = await fetchJson('/api/job-costing');
  els.jobSelect.innerHTML = '<option value="">Select saved sheet</option>';
  jobs.forEach((job) => {
    const option = document.createElement('option');
    option.value = job._id;
    option.textContent = `${job.jobNo || 'No Job No'} - ${job.projectName || 'No Project'}`;
    els.jobSelect.appendChild(option);
  });
}

async function loadCompanies() {
  const companies = await fetchJson('/api/job-costing/companies');
  els.companyName.innerHTML = '<option value="">Select company</option>';
  companies.forEach((company) => {
    const option = document.createElement('option');
    option.value = company._id;
    option.textContent = company.name;
    option.dataset.name = company.name;
    els.companyName.appendChild(option);
  });
}

async function loadTechnicians() {
  const technicians = await fetchJson('/api/technicians');
  els.techSelect.innerHTML = '<option value="">Select technician</option>';
  technicians.forEach((tech) => {
    const option = document.createElement('option');
    option.value = tech._id;
    option.textContent = tech.name;
    option.dataset.name = tech.name;
    els.techSelect.appendChild(option);
  });
}

function bindNavUI() {
  const navToggle = document.querySelector('.nav-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (navToggle && sidebar) {
    navToggle.addEventListener('click', () => {
      const open = sidebar.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('.dropdown-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const dropdown = button.closest('.nav-dropdown');
      if (!dropdown) return;
      dropdown.classList.toggle('open');
      const expanded = dropdown.classList.contains('open');
      button.setAttribute('aria-expanded', String(expanded));
    });
  });
}

function collectPayload() {
  return {
    projectSource: state.projectSource,
    projectId: state.projectId,
    projectName: state.projectName,
    bayNumber: state.bayNumber,
    companyId: els.companyName.value || null,
    companyName: (els.companyName.selectedOptions[0]?.dataset.name || '').trim(),
    customerOrderNo: els.customerOrderNo.value.trim(),
    ticketNo: els.ticketNo.value.trim(),
    quoteNo: els.quoteNo.value.trim(),
    jobNo: els.jobNo.value.trim(),
    category: els.category.value,
    description: els.description.value.trim(),
    revenue: toNumber(els.revenue.value),
    actualNormal: toNumber(els.actualNormal.value),
    actualOt15: toNumber(els.actualOt15.value),
    actualOt20: toNumber(els.actualOt20.value),
    allocNormal: toNumber(els.allocNormal.value),
    allocOt15: toNumber(els.allocOt15.value),
    allocOt20: toNumber(els.allocOt20.value),
    materials: state.materials,
    technicians: state.technicians,
    status: 'Draft'
  };
}

function resetSheet() {
  state.id = null;
  state.projectSource = '';
  state.projectId = '';
  state.projectName = '';
  state.bayNumber = null;
  state.materials = [];
  state.technicians = [];

  els.projectSelect.value = '';
  els.jobSelect.value = '';
  els.companyName.value = '';
  els.customerOrderNo.value = '';
  els.ticketNo.value = '';
  els.quoteNo.value = '';
  els.jobNo.value = '';
  els.description.value = '';
  els.revenue.value = '0';
  els.actualNormal.value = '0';
  els.actualOt15.value = '0';
  els.actualOt20.value = '0';
  els.allocNormal.value = '0';
  els.allocOt15.value = '0';
  els.allocOt20.value = '0';

  renderMaterials();
  renderTechnicians();
  recalc();
}

function fillFromJob(job) {
  state.id = job._id;
  state.projectSource = job.projectSource;
  state.projectId = job.projectId;
  state.projectName = job.projectName || '';
  state.bayNumber = job.bayNumber || null;
  state.materials = Array.isArray(job.materials) ? job.materials.map((m) => ({
    item: m.item || '',
    description: m.description || '',
    qty: toNumber(m.qty),
    costPrice: toNumber(m.costPrice)
  })) : [];
  state.technicians = Array.isArray(job.technicians) ? job.technicians.map((t) => ({
    technicianId: t.technicianId || null,
    technicianName: t.technicianName || '',
    hours: toNumber(t.hours),
    isMainTechnician: Boolean(t.isMainTechnician)
  })) : [];

  const projectValue = JSON.stringify({
    source: state.projectSource,
    id: state.projectId,
    projectName: state.projectName,
    bayNumber: state.bayNumber
  });
  const exists = Array.from(els.projectSelect.options).some((option) => option.value === projectValue);
  els.projectSelect.value = exists ? projectValue : '';

  const cid = job.companyId && job.companyId !== '000000000000000000000000' ? job.companyId : '';
  els.companyName.value = cid;
  els.customerOrderNo.value = job.customerOrderNo || '';
  els.ticketNo.value = job.ticketNo || '';
  els.quoteNo.value = job.quoteNo || '';
  els.jobNo.value = job.jobNo || '';
  els.category.value = job.category || 'Other General';
  els.description.value = job.description || '';
  els.revenue.value = toNumber(job.revenue);
  els.actualNormal.value = toNumber(job.actualNormal);
  els.actualOt15.value = toNumber(job.actualOt15);
  els.actualOt20.value = toNumber(job.actualOt20);
  els.allocNormal.value = toNumber(job.allocNormal);
  els.allocOt15.value = toNumber(job.allocOt15);
  els.allocOt20.value = toNumber(job.allocOt20);

  renderMaterials();
  renderTechnicians();
  recalc();
}

function renderMaterials() {
  els.materialsTbody.innerHTML = '';
  state.materials.forEach((row, index) => {
    const tr = document.createElement('tr');
    const total = toNumber(row.qty) * toNumber(row.costPrice);
    tr.innerHTML = `
      <td><input data-mat="item" data-index="${index}" value="${row.item || ''}"></td>
      <td><input data-mat="description" data-index="${index}" value="${row.description || ''}"></td>
      <td><input data-mat="qty" data-index="${index}" type="number" min="0" step="0.01" value="${toNumber(row.qty)}"></td>
      <td><input data-mat="costPrice" data-index="${index}" type="number" min="0" step="0.01" value="${toNumber(row.costPrice)}"></td>
      <td data-mat-total="${index}">${money(total)}</td>
      <td><button data-remove-material="${index}" class="btn-danger">X</button></td>
    `;
    els.materialsTbody.appendChild(tr);
  });
}

function renderTechnicians() {
  els.techniciansTbody.innerHTML = '';
  state.technicians.forEach((tech, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${tech.technicianName || ''}</td>
      <td><input data-tech-hours="${index}" type="number" min="0" step="0.01" value="${toNumber(tech.hours)}"></td>
      <td><input data-tech-main="${index}" type="checkbox" ${tech.isMainTechnician ? 'checked' : ''}></td>
      <td><button data-remove-tech="${index}" class="btn-danger">X</button></td>
    `;
    els.techniciansTbody.appendChild(tr);
  });
}

function recalc() {
  const actualNormal = toNumber(els.actualNormal.value);
  const actualOt15 = toNumber(els.actualOt15.value);
  const actualOt20 = toNumber(els.actualOt20.value);
  const allocNormal = toNumber(els.allocNormal.value);
  const allocOt15 = toNumber(els.allocOt15.value);
  const allocOt20 = toNumber(els.allocOt20.value);
  const revenue = toNumber(els.revenue.value);

  const totalMaterialCost = state.materials.reduce((sum, row) => sum + (toNumber(row.qty) * toNumber(row.costPrice)), 0);
  const normalTotal = actualNormal * FIXED_RATE_NORMAL;
  const ot15Total = actualOt15 * FIXED_RATE_OT15;
  const ot20Total = actualOt20 * FIXED_RATE_OT20;
  const totalLabourCost = normalTotal + ot15Total + ot20Total;
  const totalCost = totalMaterialCost + totalLabourCost;
  const grossProfit = revenue - totalCost;

  const markup = totalCost > 0 ? (grossProfit / totalCost) * 100 : 0;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const costPct = revenue > 0 ? (totalCost / revenue) * 100 : 0;

  const allocatedHours = allocNormal + allocOt15 + allocOt20;
  const actualHours = actualNormal + actualOt15 + actualOt20;
  const hoursVariance = allocatedHours - actualHours;
  const hourlyCost = actualHours > 0 ? totalLabourCost / actualHours : 0;
  const hoursCostImpact = hoursVariance * hourlyCost;

  const totalTechHours = state.technicians.reduce((sum, row) => sum + toNumber(row.hours), 0);
  const hoursDiff = actualHours - totalTechHours;

  els.normalTotal.textContent = money(normalTotal);
  els.ot15Total.textContent = money(ot15Total);
  els.ot20Total.textContent = money(ot20Total);
  els.totalMaterialCost.textContent = money(totalMaterialCost);
  els.totalLabourCost.textContent = money(totalLabourCost);
  els.totalCost.textContent = money(totalCost);
  els.grossProfit.textContent = money(grossProfit);
  els.markup.textContent = pct(markup);
  els.margin.textContent = pct(margin);
  els.costPct.textContent = pct(costPct);
  els.hoursVariance.textContent = hoursVariance.toFixed(2);
  els.hoursCostImpact.textContent = money(hoursCostImpact);

  if (Math.abs(hoursDiff) > 0.01) {
    els.techHoursWarning.textContent = `Mismatch: ${hoursDiff.toFixed(2)} hrs`;
    els.techHoursWarning.classList.add('warn');
  } else {
    els.techHoursWarning.textContent = 'Match';
    els.techHoursWarning.classList.remove('warn');
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const splitCsv = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values.map((v) => v.replace(/^"|"$/g, ''));
  };

  const header = splitCsv(lines[0]).map((h) => h.toLowerCase());
  const getIndex = (...names) => header.findIndex((h) => names.includes(h));

  const idxItem = getIndex('item');
  const idxDesc = getIndex('description', 'desc');
  const idxQty = getIndex('quantity', 'qty');
  const idxCost = getIndex('cost price', 'cost', 'unit cost');

  if (idxItem < 0) return [];

  const rows = [];
  lines.slice(1).forEach((line) => {
    const values = splitCsv(line);
    const item = (values[idxItem] || '').trim();
    if (!item) return;
    rows.push({
      item,
      description: (values[idxDesc] || '').trim(),
      qty: toNumber(values[idxQty]),
      costPrice: toNumber(values[idxCost])
    });
  });

  return rows;
}

function bindEvents() {
  els.projectSelect.addEventListener('change', () => {
    if (!els.projectSelect.value) {
      state.projectSource = '';
      state.projectId = '';
      state.projectName = '';
      state.bayNumber = null;
      return;
    }
    const selected = JSON.parse(els.projectSelect.value);
    state.projectSource = selected.source;
    state.projectId = selected.id;
    state.projectName = selected.projectName;
    state.bayNumber = selected.bayNumber;
  });

  els.jobSelect.addEventListener('change', async () => {
    if (!els.jobSelect.value) return;
    const job = await fetchJson(`/api/job-costing/${els.jobSelect.value}`);
    fillFromJob(job);
  });

  els.addMaterial.addEventListener('click', () => {
    state.materials.push({ item: '', description: '', qty: 0, costPrice: 0 });
    renderMaterials();
    recalc();
  });

  els.materialsTbody.addEventListener('input', (event) => {
    const target = event.target;
    const key = target.dataset.mat;
    const index = Number(target.dataset.index);
    if (!key || !Number.isInteger(index) || !state.materials[index]) return;
    if (key === 'qty' || key === 'costPrice') {
      state.materials[index][key] = toNumber(target.value);
    } else {
      state.materials[index][key] = target.value;
    }
    const row = state.materials[index];
    const rowTotal = toNumber(row.qty) * toNumber(row.costPrice);
    const totalCell = els.materialsTbody.querySelector(`[data-mat-total="${index}"]`);
    if (totalCell) totalCell.textContent = money(rowTotal);
    recalc();
  });

  els.materialsTbody.addEventListener('click', (event) => {
    const target = event.target;
    const index = Number(target.dataset.removeMaterial);
    if (!Number.isInteger(index)) return;
    state.materials.splice(index, 1);
    renderMaterials();
    recalc();
  });

  els.addTech.addEventListener('click', () => {
    const option = els.techSelect.options[els.techSelect.selectedIndex];
    if (!option || !option.value) return;

    const existingIndex = state.technicians.findIndex((row) => String(row.technicianId) === option.value);
    if (existingIndex >= 0) return;

    if (els.techMain.checked) {
      state.technicians.forEach((row) => {
        row.isMainTechnician = false;
      });
    }

    state.technicians.push({
      technicianId: option.value,
      technicianName: option.dataset.name || option.textContent,
      hours: toNumber(els.techHours.value),
      isMainTechnician: Boolean(els.techMain.checked)
    });

    els.techHours.value = '';
    els.techMain.checked = false;
    renderTechnicians();
    recalc();
  });

  els.techniciansTbody.addEventListener('input', (event) => {
    const target = event.target;
    const index = Number(target.dataset.techHours);
    if (!Number.isInteger(index) || !state.technicians[index]) return;
    state.technicians[index].hours = toNumber(target.value);
    recalc();
  });

  els.techniciansTbody.addEventListener('change', (event) => {
    const target = event.target;
    const index = Number(target.dataset.techMain);
    if (!Number.isInteger(index) || !state.technicians[index]) return;
    state.technicians.forEach((row, i) => {
      row.isMainTechnician = i === index;
    });
    renderTechnicians();
    recalc();
  });

  els.techniciansTbody.addEventListener('click', (event) => {
    const target = event.target;
    const index = Number(target.dataset.removeTech);
    if (!Number.isInteger(index)) return;
    state.technicians.splice(index, 1);
    renderTechnicians();
    recalc();
  });

  [
    els.actualNormal,
    els.actualOt15,
    els.actualOt20,
    els.allocNormal,
    els.allocOt15,
    els.allocOt20,
    els.revenue
  ].forEach((input) => {
    input.addEventListener('input', recalc);
  });

  els.importCsv.addEventListener('click', async () => {
    const file = els.csvFile.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) return;
    state.materials.push(...rows);
    renderMaterials();
    recalc();
  });

  els.saveJob.addEventListener('click', async () => {
    try {
      const payload = collectPayload();
      if (!payload.projectSource || !payload.projectId) {
        alert('Please link this sheet to a project first.');
        return;
      }

      if (state.id) {
        const updated = await fetchJson(`/api/job-costing/${state.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        fillFromJob(updated);
      } else {
        const created = await fetchJson('/api/job-costing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        fillFromJob(created);
      }

      await loadJobs();
      if (state.id) els.jobSelect.value = state.id;
      alert('Saved.');
    } catch (error) {
      console.error(error);
      alert(`Save failed: ${error.message}`);
    }
  });

  els.newJob.addEventListener('click', () => {
    resetSheet();
  });

  els.deleteJob.addEventListener('click', async () => {
    if (!state.id) return;
    if (!confirm('Delete this job costing sheet?')) return;

    try {
      await fetchJson(`/api/job-costing/${state.id}`, { method: 'DELETE' });
      resetSheet();
      await loadJobs();
    } catch (error) {
      console.error(error);
      alert(`Delete failed: ${error.message}`);
    }
  });
}

async function init() {
  bindNavUI();
  bindEvents();
  await Promise.all([loadProjects(), loadJobs(), loadTechnicians(), loadCompanies()]);
  recalc();
}

init().catch((error) => {
  console.error('Failed to initialize job costing page', error);
  alert(`Failed to load Job Costing page: ${error.message}`);
});
