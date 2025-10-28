const STORAGE_KEY = 'job_apps_v1';
let apps = [];
let editId = null;

// DOM elements
const tbody = document.getElementById('tbody');
const empty = document.getElementById('empty');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const addBtn = document.getElementById('addBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');
const companyEl = document.getElementById('company');
const positionEl = document.getElementById('position');
const appliedDateEl = document.getElementById('appliedDate');
const statusEl = document.getElementById('status');
const linkEl = document.getElementById('link');
const notesEl = document.getElementById('notes');
const searchEl = document.getElementById('search');
const filterStatusEl = document.getElementById('filterStatus');
const sortByEl = document.getElementById('sortBy');
const clearAllBtn = document.getElementById('clearAll');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const fileInput = document.getElementById('fileInput');

// Helpers
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const saveToStorage = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
const loadFromStorage = () => { try { apps = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { apps = [] } };
const formatDate = d => !d ? '-' : new Date(d).toLocaleDateString('id-ID');
const statusClass = s => ({
  Applied: 'status-applied',
  Interview: 'status-interview',
  Offer: 'status-offer',
  Rejected: 'status-rejected',
  Accepted: 'status-interview'
}[s] || '');

const escapeHtml = s => s ? s.replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])) : '';

function render() {
  tbody.innerHTML = '';
  const q = searchEl.value.toLowerCase().trim();
  const filter = filterStatusEl.value;

  let list = apps.filter(a => {
    const hay = (a.company + ' ' + a.position + ' ' + (a.notes || '')).toLowerCase();
    return (!q || hay.includes(q)) && (!filter || a.status === filter);
  });

  const sortBy = sortByEl.value;
  list.sort((a,b)=>{
    if(sortBy==='date_desc') return new Date(b.appliedDate||0)-new Date(a.appliedDate||0);
    if(sortBy==='date_asc') return new Date(a.appliedDate||0)-new Date(b.appliedDate||0);
    if(sortBy==='company_asc') return a.company.localeCompare(b.company);
    if(sortBy==='company_desc') return b.company.localeCompare(a.company);
    return 0;
  });

  empty.style.display = list.length ? 'none' : 'block';

  list.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(a.company)}</strong><div class="small muted">${escapeHtml(a.link||'')}</div></td>
      <td>${escapeHtml(a.position)}</td>
      <td>${formatDate(a.appliedDate)}</td>
      <td><span class="chip ${statusClass(a.status)}">${a.status}</span></td>
      <td class="small">${escapeHtml(a.notes||'')}</td>
      <td class="actions">
        <button class="btn-ghost" data-id="${a.id}" data-act="edit">✏️</button>
        <button class="btn-ghost" data-id="${a.id}" data-act="copy">📋</button>
        <button class="btn-ghost danger" data-id="${a.id}" data-act="delete">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button').forEach(b => b.onclick = handleRowAction);
}

function handleRowAction(e) {
  const id = e.target.dataset.id;
  const act = e.target.dataset.act;
  const item = apps.find(x => x.id === id);
  if (!item) return;

  if (act === 'delete') {
    if (confirm('Hapus data ini?')) {
      apps = apps.filter(x => x.id !== id);
      saveToStorage(); render();
    }
  } else if (act === 'edit') {
    openModalForEdit(id);
  } else if (act === 'copy') {
    navigator.clipboard.writeText(`${item.company} - ${item.position} (${item.status})\n${item.link}\n${item.notes}`);
    alert('Disalin ke clipboard');
  }
}

// Modal
function openModal() {
  editId = null;
  modalTitle.textContent = 'Tambah Lamaran';
  [companyEl, positionEl, linkEl, notesEl].forEach(el => el.value = '');
  appliedDateEl.value = '';
  statusEl.value = 'Applied';
  modal.style.display = 'flex';
}
function closeModal() { modal.style.display = 'none'; }
function openModalForEdit(id) {
  const item = apps.find(x => x.id === id);
  if (!item) return;
  editId = id;
  modalTitle.textContent = 'Edit Lamaran';
  Object.assign(companyEl, { value: item.company });
  Object.assign(positionEl, { value: item.position });
  appliedDateEl.value = item.appliedDate || '';
  statusEl.value = item.status || 'Applied';
  linkEl.value = item.link || '';
  notesEl.value = item.notes || '';
  modal.style.display = 'flex';
}

addBtn.onclick = openModal;
cancelBtn.onclick = closeModal;
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

saveBtn.onclick = () => {
  const payload = {
    company: companyEl.value.trim(),
    position: positionEl.value.trim(),
    appliedDate: appliedDateEl.value || new Date().toISOString().slice(0,10),
    status: statusEl.value,
    link: linkEl.value.trim(),
    notes: notesEl.value.trim()
  };
  if (!payload.company || !payload.position) return alert('Masukkan perusahaan dan posisi');
  if (editId) apps = apps.map(a => a.id === editId ? {...a, ...payload} : a);
  else apps.push({...payload, id: uid()});
  saveToStorage(); render(); closeModal();
};

// Search & Filters
searchEl.oninput = render;
filterStatusEl.onchange = render;
sortByEl.onchange = render;

// Clear All
clearAllBtn.onclick = () => {
  if (confirm('Hapus semua data lamaran?')) {
    apps = []; saveToStorage(); render();
  }
};

// CSV Import / Export
exportBtn.onclick = () => {
  if (apps.length === 0) return alert('Tidak ada data untuk diekspor');
  const csv = toCSV(apps);
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'job-applications.csv';
  a.click();
};

importBtn.onclick = () => fileInput.click();
fileInput.onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const imported = parseCSV(text);
  if (!imported.length) return alert('CSV tidak valid');
  const merged = imported.map(r=>({...r, id:uid()}));
  if (confirm(`Impor ${merged.length} data? Tambahkan ke data lama?`)) apps = apps.concat(merged);
  else apps = merged;
  saveToStorage(); render();
};

// CSV helpers
function toCSV(arr){
  const keys = ['company','position','appliedDate','status','link','notes'];
  const lines = [keys.join(',')];
  arr.forEach(r=>{
    lines.push(keys.map(k => `"${(r[k]||'').replace(/"/g,'""')}"`).join(','));
  });
  return lines.join('\n');
}

function parseCSV(txt){
  const lines = txt.split('\n').filter(Boolean);
  const keys = lines[0].split(',').map(k=>k.replace(/"/g,'').trim());
  return lines.slice(1).map(l=>{
    const vals = l.split(',').map(v=>v.replace(/"/g,'').trim());
    return keys.reduce((o,k,i)=>(o[k]=vals[i]||'',o),{});
  });
}

// Init
(function bootstrap(){
  loadFromStorage();
  if (!apps.length) {
    apps = [
      {id:uid(), company:'Contoh Tech', position:'Frontend Developer', appliedDate:'2025-10-01', status:'Applied', link:'https://example.com', notes:'Follow up minggu depan'},
      {id:uid(), company:'PT Kreatif', position:'UI/UX Designer', appliedDate:'2025-09-12', status:'Interview', link:'', notes:'Interview dgn HRD Senin'}
    ];
    saveToStorage();
  }
  render();
})();
