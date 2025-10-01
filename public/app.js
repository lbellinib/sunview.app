const state = {
  token: localStorage.getItem('valet.token') || null,
  agent: null,
  queue: JSON.parse(localStorage.getItem('valet.queue') || '[]'),
  selectedDepartureId: null,
};

const loginView = document.getElementById('login-view');
const mainView = document.getElementById('main-view');
const loginForm = document.getElementById('login-form');
const pinInput = document.getElementById('pin-input');
const agentInfo = document.getElementById('agent-info');
const logoutBtn = document.getElementById('logout-btn');
const arrivalTab = document.getElementById('arrival-tab');
const departureTab = document.getElementById('departure-tab');
const adminTab = document.getElementById('admin-tab');
const arrivalView = document.getElementById('arrival-view');
const departureView = document.getElementById('departure-view');
const adminView = document.getElementById('admin-view');
const toastEl = document.getElementById('toast');
const arrivalForm = document.getElementById('arrival-form');
const arrivalStatus = document.getElementById('arrival-status');
const arrivalPhoto = document.getElementById('arrival-photo');
const photoPreview = document.getElementById('photo-preview');
const photoPreviewImg = document.getElementById('photo-preview-img');
const retakeBtn = document.getElementById('retake-btn');
const offlineQueueEl = document.getElementById('offline-queue');
const departureForm = document.getElementById('departure-form');
const departureStatus = document.getElementById('departure-status');
const departureResults = document.getElementById('departure-results');
const adminFilterForm = document.getElementById('admin-filter-form');
const adminTableBody = document.querySelector('#admin-table tbody');
const adminSummary = document.getElementById('admin-summary');
const adminExportBtn = document.getElementById('admin-export-csv');
const adminViewHtmlBtn = document.getElementById('admin-view-html');
const adminDateInput = document.getElementById('admin-date');
const adminStatusInput = document.getElementById('admin-status');

function showToast(message, type = 'info') {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastEl.dataset.type = type;
  setTimeout(() => toastEl.classList.add('hidden'), 2800);
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    logout();
    throw new Error('Session expired');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

function logout() {
  state.token = null;
  state.agent = null;
  localStorage.removeItem('valet.token');
  mainView.classList.add('hidden');
  loginView.classList.remove('hidden');
  pinInput.value = '';
}

async function bootstrap() {
  if (state.token) {
    try {
      const me = await api('/api/me');
      state.agent = me;
      afterLogin();
    } catch (error) {
      console.warn(error);
      logout();
    }
  }
  renderQueueStatus();
}

function afterLogin() {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  agentInfo.textContent = `${state.agent.firstName} ${state.agent.lastName} · ${state.agent.role}`;
  adminTab.classList.toggle('hidden', !state.agent.isManager);
  switchTab('arrival');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const pin = pinInput.value.trim();
  if (!pin) return;
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    state.token = result.token;
    state.agent = result.agent;
    localStorage.setItem('valet.token', state.token);
    afterLogin();
    showToast('Signed in');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

logoutBtn.addEventListener('click', logout);

function switchTab(tab) {
  const tabs = {
    arrival: { tab: arrivalTab, view: arrivalView },
    departure: { tab: departureTab, view: departureView },
    admin: { tab: adminTab, view: adminView },
  };
  Object.entries(tabs).forEach(([key, value]) => {
    const selected = key === tab;
    value.tab?.setAttribute('aria-selected', selected);
    value.tab?.classList.toggle('primary', selected);
    value.tab?.classList.toggle('secondary', !selected);
    value.view.classList.toggle('hidden', !selected);
  });
  if (tab === 'admin') {
    loadAdminData();
  }
}

arrivalTab.addEventListener('click', () => switchTab('arrival'));
departureTab.addEventListener('click', () => switchTab('departure'));
adminTab.addEventListener('click', () => switchTab('admin'));

arrivalPhoto.addEventListener('change', () => {
  const file = arrivalPhoto.files?.[0];
  if (!file) {
    photoPreview.classList.add('hidden');
    photoPreviewImg.src = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    photoPreviewImg.src = reader.result;
    photoPreview.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

retakeBtn.addEventListener('click', () => {
  arrivalPhoto.value = '';
  photoPreviewImg.src = '';
  photoPreview.classList.add('hidden');
});

function renderQueueStatus() {
  if (!state.queue.length) {
    offlineQueueEl.classList.add('hidden');
    offlineQueueEl.textContent = '';
    return;
  }
  offlineQueueEl.classList.remove('hidden');
  offlineQueueEl.textContent = `Queued submissions: ${state.queue.length}. They will sync when back online.`;
}

async function submitArrival(formData) {
  arrivalStatus.textContent = 'Submitting…';
  arrivalStatus.classList.remove('error', 'success');
  try {
    const result = await api('/api/arrivals', {
      method: 'POST',
      body: formData,
    });
    arrivalStatus.textContent = `Arrival saved for ticket ${result.record.ticketUid}.`;
    arrivalStatus.classList.add('success');
    showToast(`Arrival saved · Ticket ${result.record.ticketUid}`);
    arrivalForm.reset();
    photoPreview.classList.add('hidden');
    photoPreviewImg.src = '';
  } catch (error) {
    arrivalStatus.textContent = error.message;
    arrivalStatus.classList.add('error');
    throw error;
  }
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

async function processQueue() {
  if (!navigator.onLine || !state.queue.length || !state.token) return;
  const item = state.queue[0];
  if (item.type === 'arrival') {
    const blob = dataUrlToBlob(item.payload.imageDataUrl);
    const formData = new FormData();
    Object.entries(item.payload.fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, value);
    });
    formData.append('image', blob, 'queued.jpg');
    try {
      await submitArrival(formData);
      state.queue.shift();
      localStorage.setItem('valet.queue', JSON.stringify(state.queue));
      renderQueueStatus();
      processQueue();
    } catch (error) {
      console.warn('Queue submission failed', error);
    }
  }
}

window.addEventListener('online', () => {
  showToast('Back online. Syncing queued arrivals.');
  processQueue();
});

arrivalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(arrivalForm);
  if (!navigator.onLine) {
    const imageFile = arrivalPhoto.files?.[0];
    if (!imageFile) {
      arrivalStatus.textContent = 'Photo required even offline';
      arrivalStatus.classList.add('error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const fields = Object.fromEntries(formData.entries());
      delete fields.image;
      const payload = {
        type: 'arrival',
        payload: {
          fields,
          imageDataUrl: reader.result,
        },
      };
      state.queue.push(payload);
      localStorage.setItem('valet.queue', JSON.stringify(state.queue));
      renderQueueStatus();
      arrivalForm.reset();
      photoPreview.classList.add('hidden');
      photoPreviewImg.src = '';
      arrivalStatus.textContent = 'Offline: arrival queued';
      arrivalStatus.classList.add('success');
    };
    reader.readAsDataURL(imageFile);
    return;
  }

  try {
    await submitArrival(formData);
  } catch (error) {
    if (error.message.includes('Failed to fetch')) {
      showToast('Network lost. Arrival queued for sync.', 'error');
    }
  }
});

function renderDepartureResults(results, suppressEmptyMessage = false) {
  departureResults.innerHTML = '';
  if (!results.length) {
    if (!suppressEmptyMessage) {
      departureStatus.textContent = 'No active records match that query.';
      departureStatus.classList.add('error');
    }
    return;
  }
  departureStatus.textContent = `${results.length} match${results.length > 1 ? 'es' : ''} found.`;
  departureStatus.classList.remove('error');
  results.forEach((record) => {
    const card = document.createElement('article');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="grid">
        <div>
          <strong>Ticket:</strong> ${record.ticketUid}<br />
          <strong>Plate:</strong> ${record.plate.number}
        </div>
        <img src="${record.image.thumbUrl}" alt="Vehicle preview" loading="lazy" />
      </div>
      <p class="muted small">Arrived: ${new Date(record.arrivalLocal || record.arrivalTimestampUtc).toLocaleString()}</p>
      <button class="primary">Close & release</button>
    `;
    const btn = card.querySelector('button');
    btn.addEventListener('click', () => confirmDeparture(record.id));
    departureResults.appendChild(card);
  });
}

departureForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  departureStatus.textContent = 'Searching…';
  departureStatus.classList.remove('error');
  const query = departureForm.query.value.trim();
  if (!query) return;
  try {
    const result = await api(`/api/records/search?query=${encodeURIComponent(query)}`);
    renderDepartureResults(result.results);
  } catch (error) {
    departureStatus.textContent = error.message;
    departureStatus.classList.add('error');
  }
});

async function confirmDeparture(recordId) {
  try {
    const result = await api('/api/departures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId }),
    });
    showToast(`Departure closed · ${result.durationMinutes} min`);
    departureStatus.textContent = `Closed ticket ${result.record.ticketUid} in ${result.durationMinutes} minutes.`;
    departureStatus.classList.remove('error');
    renderDepartureResults([], true);
  } catch (error) {
    departureStatus.textContent = error.message;
    departureStatus.classList.add('error');
  }
}

async function loadAdminData(event) {
  event?.preventDefault();
  if (!state.agent?.isManager) return;
  const params = new URLSearchParams();
  if (adminStatusInput.value) params.set('status', adminStatusInput.value);
  if (adminDateInput.value) params.set('date', adminDateInput.value);
  try {
    const result = await api(`/api/admin/records?${params.toString()}`);
    renderAdminTable(result.records);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderAdminTable(records) {
  adminTableBody.innerHTML = '';
  if (!records.length) {
    adminTableBody.innerHTML = '<tr><td colspan="5">No records</td></tr>';
    adminSummary.textContent = '';
    return;
  }
  const parked = records.filter((r) => r.status === 'parked').length;
  const closed = records.filter((r) => r.status === 'closed').length;
  adminSummary.textContent = `${records.length} records · ${parked} parked · ${closed} closed`;
  records.forEach((record) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${record.ticketUid}</td>
      <td>${record.plate.number}</td>
      <td>${record.status}</td>
      <td>${new Date(record.arrivalLocal || record.arrivalTimestampUtc).toLocaleString()}</td>
      <td>${record.departureLocal ? new Date(record.departureLocal).toLocaleString() : '—'}</td>
    `;
    adminTableBody.appendChild(tr);
  });
}

adminFilterForm.addEventListener('submit', loadAdminData);

adminExportBtn.addEventListener('click', async () => {
  if (!adminDateInput.value) {
    showToast('Select a date to export.', 'error');
    return;
  }
  const params = new URLSearchParams({ date: adminDateInput.value });
  const response = await api(`/api/admin/reports/daily?${params.toString()}`);
  if (response instanceof Response) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `valet-report-${adminDateInput.value}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
});

adminViewHtmlBtn.addEventListener('click', async () => {
  if (!adminDateInput.value) {
    showToast('Select a date to view the summary.', 'error');
    return;
  }
  const params = new URLSearchParams({ date: adminDateInput.value });
  const response = await api(`/api/admin/reports/daily/html?${params.toString()}`);
  if (response instanceof Response) {
    const html = await response.text();
    const summaryWindow = window.open('', '_blank');
    summaryWindow.document.write(html);
    summaryWindow.document.close();
  }
});

setInterval(processQueue, 10000);

bootstrap();
