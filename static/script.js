/* ── DOM refs ── */
const pagesInput     = document.getElementById('pagesPerSplit');
const decrementBtn   = document.getElementById('decrementBtn');
const incrementBtn   = document.getElementById('incrementBtn');
const namesInput     = document.getElementById('namesInput');
const pdfFileInput   = document.getElementById('pdfInput');
const dropZone       = document.getElementById('dropZone');
const countBadge     = document.getElementById('countBadge');
const splitHint      = document.getElementById('splitHint');
const dropSub        = document.getElementById('dropSub');
const validationMsg  = document.getElementById('validationMsg');
const submitBtn      = document.getElementById('submitBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const toast          = document.getElementById('toast');
const previewEmpty   = document.getElementById('previewEmpty');
const previewList    = document.getElementById('previewList');
const loadingText = document.getElementById('loadingText');

/* ── State ── */
let selectedFile = null;

/* ───────────────────────────────────────────
   Stepper (+/−) buttons
─────────────────────────────────────────── */
decrementBtn.addEventListener('click', () => {
  const v = parseInt(pagesInput.value) || 1;
  if (v > 1) { pagesInput.value = v - 1; onPagesChange(); }
});

incrementBtn.addEventListener('click', () => {
  const v = parseInt(pagesInput.value) || 0;
  pagesInput.value = v + 1;
  onPagesChange();
});

pagesInput.addEventListener('input', onPagesChange);

function onPagesChange() {
  const v = parseInt(pagesInput.value);
  if (v > 0) {
    splitHint.textContent =
      `Example: if you set ${v} page${v > 1 ? 's' : ''} per split, a ${v * 5}-page PDF will be divided into 5 files.`;
  }
  validate();
  updatePreview();
}

/* ───────────────────────────────────────────
   Names textarea
─────────────────────────────────────────── */
namesInput.addEventListener('input', () => {
  const names = getNames();
  const n = names.length;
  countBadge.textContent = `${n} name${n !== 1 ? 's' : ''}`;
  countBadge.className = 'count-badge' + (n > 0 ? ' ok' : '');
  validate();
  updatePreview();
});

function getNames() {
  return namesInput.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

/* ───────────────────────────────────────────
   File input — click & drag/drop
─────────────────────────────────────────── */
pdfFileInput.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  f && f.type === 'application/pdf' ? handleFile(f) : showToast('Please drop a valid PDF file', 'error', true);
});

function handleFile(f) {
  if (!f) return;
  if (f.type !== 'application/pdf') { showToast('Only PDF files are accepted', 'error', true); return; }

  selectedFile = f;
  dropZone.classList.add('has-file');

  /* Swap drop body content */
  const body = dropZone.querySelector('.drop-body');

  /* Remove old file-selected node if re-uploading */
  const old = dropZone.querySelector('.file-selected');
  if (old) old.remove();

  const fileNode = document.createElement('div');
  fileNode.className = 'file-selected';
  fileNode.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="3" width="16" height="22" rx="2" stroke="#3b82f6" stroke-width="1.8"/>
      <path d="M17 3 L21 7" stroke="#3b82f6" stroke-width="1.8"/>
      <rect x="17" y="3" width="4" height="4" rx="0.5" stroke="#3b82f6" stroke-width="1.8" fill="white"/>
      <path d="M9 13 h14 M9 17 h10 M9 21 h7" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <span class="file-selected-name">${f.name}</span>
    <span class="file-selected-sub">${(f.size / 1024 / 1024).toFixed(2)} MB &mdash; click to change</span>
  `;
  body.after(fileNode);

  validate();
  updatePreview();
}

/* ───────────────────────────────────────────
   Live preview panel
─────────────────────────────────────────── */
function updatePreview() {
  const pages = parseInt(pagesInput.value);
  const names = getNames();

  if (!selectedFile || !pages || pages < 1) {
    previewEmpty.style.display = '';
    previewList.style.display  = 'none';
    previewList.innerHTML = '';
    return;
  }

  /* We don't know total pages without reading the file,
     so we base the preview on the names count (or a minimum of 1 row). */
  const rowCount = Math.max(names.length, 1);
  previewEmpty.style.display = 'none';
  previewList.style.display  = '';

  let html = '';
  for (let i = 0; i < rowCount; i++) {
    const name = names[i] || null;
    const startPage = i * pages + 1;
    const endPage   = (i + 1) * pages;
    const pageRange = startPage === endPage ? `p.${startPage}` : `p.${startPage}–${endPage}`;
    html += `
      <div class="preview-row">
        <span class="preview-row-index">${String(i + 1).padStart(2, '0')}</span>
        <span class="preview-row-name${name ? '' : ' auto-named'}">${name ? escHtml(name) + '.pdf' : '(auto-named).pdf'}</span>
        <span class="preview-row-pages">${pageRange}</span>
      </div>`;
  }
  previewList.innerHTML = html;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ───────────────────────────────────────────
   Validation
─────────────────────────────────────────── */
function validate() {
  const pages = parseInt(pagesInput.value);
  const names = getNames();

  if (!pages || pages < 1) {
    setMsg('Enter the number of pages per output file', '');
    submitBtn.disabled = true; return;
  }
  if (names.length === 0) {
    setMsg('Enter at least one output file name', '');
    submitBtn.disabled = true; return;
  }
  if (!selectedFile) {
    setMsg('Upload a PDF file to split', '');
    submitBtn.disabled = true; return;
  }

  setMsg(`Ready — ${names.length} file${names.length !== 1 ? 's' : ''} will be created`, 'ok');
  submitBtn.disabled = false;
}

function setMsg(text, type) {
  validationMsg.textContent = text;
  validationMsg.className = 'validation-msg' + (type ? ' ' + type : '');
}

/* ───────────────────────────────────────────
   Submit
─────────────────────────────────────────── */
submitBtn.addEventListener('click', async () => {
  const pages = parseInt(pagesInput.value);
  const names = getNames();
  if (!pages || !names.length || !selectedFile) return;

  const formData = new FormData();
  formData.append('pages_per_split', pages);
  formData.append('names', names.join('\n'));
  formData.append('pdf', selectedFile);

  loadingOverlay.classList.add('show');
  submitBtn.disabled = true;

  try {
    loadingText.innerText = "Uploading your PDF...";

    const fetchPromise = fetch('/split', { method: 'POST', body: formData });

    loadingText.innerText = "Splitting your PDF...";

    const res = await fetchPromise;

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown server error' }));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    loadingText.innerText = "Preparing download...";

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `split_${selectedFile.name.replace('.pdf', '')}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    showToast(`✓ ${names.length} PDF${names.length > 1 ? 's' : ''} created and downloaded!`, 'success');

  } catch (err) {
    showToast(`Error: ${err.message}`, 'error', true);
  } finally {
    loadingOverlay.classList.remove('show');
    submitBtn.disabled = false;
  }
});

/* ───────────────────────────────────────────
   Toast
─────────────────────────────────────────── */
let toastTimer;

function hideToast() {
  toast.classList.remove('show');
}

function showToast(msg, type = 'success', persistent = false) {

  clearTimeout(toastTimer);

  toast.innerHTML = `
    <span>${msg}</span>
    <button class="toast-close" onclick="hideToast()">×</button>
  `;

  toast.className = `toast ${type} show`;

  if (!persistent) {
    toastTimer = setTimeout(() => hideToast(), 4500);
  }
}

/* ── Init ── */
validate();
