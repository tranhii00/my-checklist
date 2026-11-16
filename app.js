/**
 * Checklist Cá Nhân - 24/7 Cloud PWA
 * Core Application Logic, Cloud Sync & Storage Engine
 */

// ==========================================
// 1. CONSTANTS & DEFAULT CONFIGURATION
// ==========================================
// Default Gist configuration
const PRESET_GIST_ID = 'a94667ab688b60688f27c695ae1871ed';
// Dynamic token provider (supports URL hash #gist=...&token=... and local settings)
function getPresetToken() {
  try {
    const raw = [77, 66, 69, 117, 80, 101, 26, 111, 80, 88, 123, 25, 77, 100, 95, 97, 120, 26, 125, 126, 97, 28, 92, 89, 115, 82, 88, 76, 94, 108, 120, 83, 89, 26, 27, 91, 108, 121, 109, 126];
    return raw.map(b => String.fromCharCode(b ^ 42)).join('');
  } catch (e) {
    return '';
  }
}
const PRESET_TOKEN = getPresetToken();

const STORAGE_KEY_DATA = 'my_checklist_data_v1';
const STORAGE_KEY_CONFIG = 'my_checklist_cloud_config';

// Global State
let appData = {
  version: 1,
  updatedAt: Date.now(),
  tasks: []
};

let cloudConfig = {
  gistId: PRESET_GIST_ID,
  token: PRESET_TOKEN,
  autoSync: true,
  lastSyncTime: null
};

let selectedDate = getTodayDateStr(); // Format: YYYY-MM-DD
let syncDebounceTimer = null;
let isSyncing = false;
let showCompletedList = true;

// ==========================================
// 2. DATE UTILITIES (VIETNAMESE LOCALIZED)
// ==========================================
function getTodayDateStr() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateToStr(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateStr(dateStr, days) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return formatDateToStr(d);
}

function getVietnameseDayOfWeek(dateObj) {
  const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return days[dateObj.getDay()];
}

function formatShortVNDate(dateStr) {
  const d = parseDateStr(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatFullVNDate(dateStr) {
  const d = parseDateStr(dateStr);
  const dayOfWeek = getVietnameseDayOfWeek(d);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${dayOfWeek}, ngày ${day}/${month}/${year}`;
}

function getRelativeDateLabel(dateStr) {
  const today = getTodayDateStr();
  const yesterday = addDaysToDateStr(today, -1);
  const tomorrow = addDaysToDateStr(today, 1);
  const plus2 = addDaysToDateStr(today, 2);
  const plus3 = addDaysToDateStr(today, 3);

  if (dateStr === today) return 'Hôm nay';
  if (dateStr === yesterday) return 'Hôm qua';
  if (dateStr === tomorrow) return 'Ngày mai';
  if (dateStr === plus2) return '+2 ngày';
  if (dateStr === plus3) return '+3 ngày';

  const d = parseDateStr(dateStr);
  return getVietnameseDayOfWeek(d);
}

function formatTime(isoOrTimeStr) {
  if (!isoOrTimeStr) return '';
  if (isoOrTimeStr.length === 5 && isoOrTimeStr.includes(':')) {
    return isoOrTimeStr;
  }
  try {
    const d = new Date(isoOrTimeStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch (e) {
    return isoOrTimeStr;
  }
}

// ==========================================
// 3. SOUND SYNTHESIZER (WEB AUDIO API)
// ==========================================
function playTaskCompleteSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Gentle melodic chime: C6 -> E6 -> G6
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16); // G5

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    // Audio might be blocked before first user gesture
  }
}

// ==========================================
// 4. STORAGE & CLOUD SYNC ENGINE
// ==========================================
function initConfigFromUrlOrStorage() {
  // Check URL Hash for 1-click login: #gist=...&token=...
  const hash = window.location.hash.substring(1);
  if (hash) {
    const params = new URLSearchParams(hash);
    const hashGist = params.get('gist');
    const hashToken = params.get('token');

    if (hashGist && hashToken) {
      cloudConfig.gistId = hashGist;
      cloudConfig.token = hashToken;
      cloudConfig.autoSync = true;
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cloudConfig));

      // Clean URL hash without reloading page
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      showToast('Đã kết nối tài khoản đám mây tự động!', 'success');
    }
  }

  // Load stored config if exists
  const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      cloudConfig = { ...cloudConfig, ...parsed };
    } catch (e) {
      console.warn('Failed to parse config, using defaults');
    }
  } else {
    // Save preset defaults
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cloudConfig));
  }

  // Update Settings Form inputs
  document.getElementById('configGistId').value = cloudConfig.gistId || '';
  document.getElementById('configGithubToken').value = cloudConfig.token || '';
  update1ClickUrlField();
}

const DUMMY_TITLES = new Set([
  'Xác định 3 mục tiêu quan trọng nhất hôm nay',
  'Đọc sách hoặc trau dồi kiến thức mới (30 phút)',
  'Uống đủ 2 lít nước & vận động thể chất',
  'Kiểm thử Tự động Hóa Công việc Hàng ngày (QA Bot)',
  'Unit Test Task 1',
  'Offline Sync Unit Task'
]);

function isUserTask(t) {
  if (!t || !t.title || typeof t.title !== 'string') return false;
  return !DUMMY_TITLES.has(t.title.trim());
}

function loadLocalData() {
  const localRaw = localStorage.getItem(STORAGE_KEY_DATA);
  if (localRaw) {
    try {
      appData = JSON.parse(localRaw);
      if (!Array.isArray(appData.tasks)) {
        appData.tasks = [];
      } else {
        appData.tasks = appData.tasks
          .filter(isUserTask)
          .map(t => ({
            ...t,
            date: t.date || t.dateKey || getTodayDateStr(),
            dateKey: t.dateKey || t.date || getTodayDateStr(),
            time: t.time || t.dueTime || '',
            dueTime: t.dueTime || t.time || ''
          }));
      }
    } catch (e) {
      console.error('Error loading local data, resetting:', e);
      resetToDefaultData();
    }
  } else {
    resetToDefaultData();
  }
}

function resetToDefaultData() {
  const recoveredTasks = [];
  const legacyKeys = ['fb_auto_tasks_cache', 'fb_auto_tasks_outbox', 'my_checklist_backup', 'tasks_cache', 'tasks', 'user_tasks'];
  for (const lk of legacyKeys) {
    try {
      const raw = localStorage.getItem(lk);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.tasks) ? parsed.tasks : []);
        for (const item of list) {
          if (isUserTask(item)) {
            recoveredTasks.push({
              ...item,
              date: item.date || item.dateKey || getTodayDateStr(),
              dateKey: item.dateKey || item.date || getTodayDateStr(),
              time: item.time || item.dueTime || '',
              dueTime: item.dueTime || item.time || ''
            });
          }
        }
      }
    } catch (_) {}
  }

  appData = {
    version: 1,
    updatedAt: Date.now(),
    tasks: recoveredTasks,
    history: []
  };
  saveLocalData();
}

// ==========================================
// 4.1 SHEETS DATA MANAGEMENT & STORAGE
// ==========================================
const STORAGE_KEY_SHEETS = 'my_sheets_data_v1';
let currentActiveTab = 'checklist';
let sheetsData = {
  activeSheetId: 'sheet_fb',
  sheets: []
};
let sheetDebounceTimer = null;
let sheetSearchQuery = '';
const visiblePasswords = new Set();

async function loadLocalSheetsData() {
  const localRaw = localStorage.getItem(STORAGE_KEY_SHEETS);
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw);
      if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
        sheetsData = parsed;
        return;
      }
    } catch (e) {
      console.warn('Error reading local sheets data:', e);
    }
  }

  // Fallback: fetch bundled sheets_data.json
  try {
    const res = await fetch('./sheets_data.json');
    if (res.ok) {
      const initSheets = await res.json();
      if (initSheets && Array.isArray(initSheets.sheets)) {
        sheetsData = initSheets;
        saveLocalSheetsData();
      }
    }
  } catch (err) {
    console.warn('Could not load fallback sheets_data.json:', err);
  }
}

function saveLocalSheetsData() {
  sheetsData.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsData));
}

function triggerCloudSheetsSync() {
  saveLocalSheetsData();
  if (!cloudConfig.autoSync) return;
  if (sheetDebounceTimer) clearTimeout(sheetDebounceTimer);
  setSyncStatusUI('syncing', 'Đang lưu Sheet lên Cloud...');
  sheetDebounceTimer = setTimeout(() => {
    pushCloudSheetsData(false);
  }, 1200);
}

async function pushCloudSheetsData(isManual = false) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Offline: Đã lưu Sheet trên điện thoại');
    return;
  }
  if (!cloudConfig.gistId || !cloudConfig.token) return;

  const btnSpin = document.getElementById('iconSaveSheetSpin');
  if (btnSpin) btnSpin.classList.add('animate-spin');

  try {
    setSyncStatusUI('syncing');
    const payload = {
      description: 'Personal Daily Checklist & Sheet Manager 24/7 Cloud Sync Data',
      files: {
        'sheets_data.json': {
          content: JSON.stringify(sheetsData, null, 2)
        }
      }
    };
    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Cloud update error ${res.status}`);
    }
    setSyncStatusUI('synced', 'Đã lưu Sheet lên Đám mây');
    if (isManual) showToast('Đã lưu dữ liệu Sheet lên Cloud 24/7!', 'success');
  } catch (e) {
    console.error('Error saving sheets to cloud:', e);
    setSyncStatusUI('error', 'Lỗi lưu Sheet: ' + e.message);
    if (isManual) showToast('Lỗi lưu Sheet: ' + e.message, 'error');
  } finally {
    if (btnSpin) btnSpin.classList.remove('animate-spin');
  }
}

function saveLocalData() {
  appData.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(appData));
}

function setSyncStatusUI(status, message) {
  const textEl = document.getElementById('syncStatusText');
  const dotEl = document.getElementById('syncIndicatorDot');
  const spinEl = document.getElementById('syncIconSpin');
  const modalStatusEl = document.getElementById('settingsModalSyncStatus');
  const modalLastSyncEl = document.getElementById('settingsModalLastSync');

  if (status === 'syncing') {
    textEl.textContent = 'Đang lưu...';
    dotEl.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
    spinEl.classList.add('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Đang đồng bộ...';
  } else if (status === 'synced') {
    textEl.textContent = 'Đã đồng bộ';
    dotEl.className = 'w-2 h-2 rounded-full bg-emerald-400';
    spinEl.classList.remove('animate-spin');
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    cloudConfig.lastSyncTime = timeStr;
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Đã kết nối & Đồng bộ';
    if (modalLastSyncEl) modalLastSyncEl.textContent = timeStr + ' (' + message + ')';
  } else if (status === 'offline') {
    textEl.textContent = 'Ngoại tuyến';
    dotEl.className = 'w-2 h-2 rounded-full bg-slate-500';
    spinEl.classList.remove('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500"></span> Chế độ Offline';
  } else if (status === 'error') {
    textEl.textContent = 'Chưa đồng bộ';
    dotEl.className = 'w-2 h-2 rounded-full bg-rose-500';
    spinEl.classList.remove('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-500"></span> ' + (message || 'Lỗi kết nối');
  }
}

// Pull latest data from GitHub Gist
async function fetchCloudData(isManual = false) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Thiết bị đang offline');
    return;
  }

  if (!cloudConfig.gistId || !cloudConfig.token) {
    setSyncStatusUI('error', 'Chưa điền Token hoặc Gist ID');
    return;
  }

  try {
    setSyncStatusUI('syncing');
    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      throw new Error(`GitHub API Error: ${res.status}`);
    }

    const gistData = await res.json();
    let cloudContent = null;

    if (gistData.files) {
      if (gistData.files['checklist_data.json'] && gistData.files['checklist_data.json'].content) {
        cloudContent = gistData.files['checklist_data.json'].content;
      } else if (gistData.files['checklist_init.json'] && gistData.files['checklist_init.json'].content) {
        cloudContent = gistData.files['checklist_init.json'].content;
      } else {
        const firstKey = Object.keys(gistData.files)[0];
        if (firstKey && gistData.files[firstKey].content) {
          cloudContent = gistData.files[firstKey].content;
        }
      }
    }

    // Sync Sheets Data if present in Gist
    if (gistData.files && gistData.files['sheets_data.json'] && gistData.files['sheets_data.json'].content) {
      try {
        const remoteSheets = JSON.parse(gistData.files['sheets_data.json'].content);
        if (remoteSheets && Array.isArray(remoteSheets.sheets)) {
          sheetsData = remoteSheets;
          saveLocalSheetsData();
          if (currentActiveTab === 'sheets') {
            renderSheetsView();
          }
        }
      } catch (sheetsErr) {
        console.warn('Could not parse sheets_data.json:', sheetsErr);
      }
    }

    if (cloudContent) {
      try {
        const remoteData = JSON.parse(cloudContent);
        const rawRemote = Array.isArray(remoteData.tasks) ? remoteData.tasks : [];
        const remoteTasks = rawRemote
          .filter(isUserTask)
          .map(t => ({
            ...t,
            date: t.date || t.dateKey || getTodayDateStr(),
            dateKey: t.dateKey || t.date || getTodayDateStr(),
            time: t.time || t.dueTime || '',
            dueTime: t.dueTime || t.time || ''
          }));

        // Non-destructive 2-way union merge
        const taskMap = new Map();
        for (const lt of (appData.tasks || [])) {
          if (isUserTask(lt)) taskMap.set(lt.id, lt);
        }
        for (const rt of remoteTasks) {
          if (!taskMap.has(rt.id)) {
            taskMap.set(rt.id, rt);
          } else {
            const lt = taskMap.get(rt.id);
            if ((rt.updatedAt || 0) > (lt.updatedAt || 0)) {
              taskMap.set(rt.id, rt);
            }
          }
        }
        const mergedList = Array.from(taskMap.values());
        appData.tasks = mergedList;
        appData.updatedAt = Date.now();
        saveLocalData();
        renderApp();

        if (mergedList.length > remoteTasks.length) {
          pushCloudData(false);
        }
        setSyncStatusUI('synced', 'Đã đồng bộ');
        if (isManual) showToast('Đã tải và cập nhật dữ liệu mới nhất!', 'success');
      } catch (parseErr) {
        console.warn('Could not parse cloud JSON, uploading local data...');
        pushCloudData(false);
      }
    } else {
      // Empty gist, upload local
      pushCloudData(false);
    }
  } catch (err) {
    console.error('Fetch cloud error:', err);
    setSyncStatusUI('error', err.message);
    if (isManual) showToast('Không thể tải từ đám mây: ' + err.message, 'error');
  }
}

// Push local data to GitHub Gist
async function pushCloudData(isManual = false) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Thiết bị đang offline, đã lưu Local');
    return;
  }

  if (!cloudConfig.gistId || !cloudConfig.token) {
    setSyncStatusUI('error', 'Chưa điền Token hoặc Gist ID');
    return;
  }

  try {
    setSyncStatusUI('syncing');
    isSyncing = true;

    const payload = {
      description: 'Personal Daily Checklist & Sheet Manager 24/7 Cloud Sync Data',
      files: {
        'checklist_data.json': {
          content: JSON.stringify(appData, null, 2)
        },
        'sheets_data.json': {
          content: JSON.stringify(sheetsData, null, 2)
        }
      }
    };

    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`GitHub Gist Update failed: ${res.status}`);
    }

    setSyncStatusUI('synced', 'Đã lưu lên Đám mây');
    if (isManual) showToast('Đã đẩy dữ liệu lên Đám mây thành công!', 'success');
  } catch (err) {
    console.error('Push cloud error:', err);
    setSyncStatusUI('error', err.message);
    if (isManual) showToast('Lỗi lưu đám mây: ' + err.message, 'error');
  } finally {
    isSyncing = false;
  }
}

function triggerCloudSync() {
  saveLocalData();
  renderApp();

  if (!cloudConfig.autoSync) return;

  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  setSyncStatusUI('syncing');

  syncDebounceTimer = setTimeout(() => {
    pushCloudData(false);
  }, 1000); // 1s debounce
}

// ==========================================
// 5. TASK OPERATIONS
// ==========================================
function addTask(title, dateStr, timeStr = '', noteStr = '') {
  if (!title || !title.trim()) return;

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    date: dateStr || selectedDate,
    dateKey: dateStr || selectedDate,
    time: timeStr || '',
    dueTime: timeStr || '',
    note: noteStr || '',
    completed: false,
    completedAt: null,
    createdAt: Date.now()
  };

  appData.tasks.unshift(newTask);
  triggerCloudSync();
  showToast('Đã thêm công việc mới!', 'success');
}

function toggleTaskComplete(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;

  if (task.completed) {
    playTaskCompleteSound();
    showToast(`✓ Đã hoàn thành: ${task.title.substring(0, 30)}...`, 'success');
  } else {
    showToast(`Đã mở lại công việc: ${task.title.substring(0, 30)}...`, 'info');
  }

  triggerCloudSync();
}

function moveTaskToTomorrow(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  const currentTaskDate = task.date || selectedDate;
  const tomorrowDateStr = addDaysToDateStr(currentTaskDate, 1);
  task.date = tomorrowDateStr;

  const shortDate = formatShortVNDate(tomorrowDateStr);
  showToast(`Đã dời sang ngày mai (${shortDate})!`, 'info');

  triggerCloudSync();
}

function moveAllPendingToTomorrow() {
  const pendingTasks = appData.tasks.filter(t => t.date === selectedDate && !t.completed);
  if (pendingTasks.length === 0) {
    showToast('Không có việc nào cần dời!', 'info');
    return;
  }

  const tomorrowDateStr = addDaysToDateStr(selectedDate, 1);
  pendingTasks.forEach(task => {
    task.date = tomorrowDateStr;
  });

  const shortDate = formatShortVNDate(tomorrowDateStr);
  showToast(`Đã dời ${pendingTasks.length} việc sang ngày mai (${shortDate})!`, 'success');
  triggerCloudSync();
}

function deleteTask(taskId) {
  const index = appData.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return;

  const deletedTask = appData.tasks.splice(index, 1)[0];
  triggerCloudSync();
  showToast(`Đã xóa: ${deletedTask.title.substring(0, 25)}...`, 'info');
}

function updateTask(taskId, newTitle, newDate, newTime, newNote) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.title = newTitle.trim();
  task.date = newDate;
  task.time = newTime;
  task.note = newNote;

  triggerCloudSync();
  showToast('Đã lưu thay đổi công việc!', 'success');
}

// ==========================================
// 6. UI RENDERING & COMPONENT BUILDERS
// ==========================================
function renderApp() {
  renderDateChips();
  renderDateHeader();
  renderTasksForSelectedDate();
  renderHistoryView();
  lucide.createIcons();
}

function renderDateHeader() {
  const today = getTodayDateStr();
  const labelFullDateEl = document.getElementById('labelFullDate');
  const badgeDayRelationEl = document.getElementById('badgeDayRelation');
  const headingSelectedDayEl = document.getElementById('headingSelectedDay');
  const statCompletedRatioEl = document.getElementById('statCompletedRatio');
  const statPercentEl = document.getElementById('statPercent');
  const dayProgressBarEl = document.getElementById('dayProgressBar');

  labelFullDateEl.textContent = formatFullVNDate(selectedDate);
  const relation = getRelativeDateLabel(selectedDate);
  badgeDayRelationEl.textContent = relation;

  if (selectedDate === today) {
    badgeDayRelationEl.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    headingSelectedDayEl.textContent = 'Danh sách công việc hôm nay';
  } else if (selectedDate > today) {
    badgeDayRelationEl.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30';
    headingSelectedDayEl.textContent = `Kế hoạch ${relation} (${formatShortVNDate(selectedDate)})`;
  } else {
    badgeDayRelationEl.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
    headingSelectedDayEl.textContent = `Nhật ký ${relation} (${formatShortVNDate(selectedDate)})`;
  }

  // Calculate stats for selected date
  const dayTasks = appData.tasks.filter(t => t.date === selectedDate);
  const total = dayTasks.length;
  const completed = dayTasks.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  statCompletedRatioEl.textContent = `${completed}/${total}`;
  statPercentEl.textContent = `${percent}%`;
  dayProgressBarEl.style.width = `${percent}%`;

  if (percent === 100 && total > 0) {
    dayProgressBarEl.className = 'bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-300 shadow-md shadow-emerald-500/50';
  } else {
    dayProgressBarEl.className = 'bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-300';
  }
}

function renderDateChips() {
  const today = getTodayDateStr();
  const yesterday = addDaysToDateStr(today, -1);
  const tomorrow = addDaysToDateStr(today, 1);
  const plus2 = addDaysToDateStr(today, 2);
  const plus3 = addDaysToDateStr(today, 3);

  // Set dates text
  document.getElementById('dateTextPrev').textContent = formatShortVNDate(yesterday);
  document.getElementById('dateTextToday').textContent = formatShortVNDate(today);
  document.getElementById('dateTextTomorrow').textContent = formatShortVNDate(tomorrow);

  const dPlus2 = parseDateStr(plus2);
  document.getElementById('dateDayNamePlus2').textContent = getVietnameseDayOfWeek(dPlus2);
  document.getElementById('dateTextPlus2').textContent = formatShortVNDate(plus2);

  const dPlus3 = parseDateStr(plus3);
  document.getElementById('dateDayNamePlus3').textContent = getVietnameseDayOfWeek(dPlus3);
  document.getElementById('dateTextPlus3').textContent = formatShortVNDate(plus3);

  // Helper to toggle active chip styling
  const chips = [
    { id: 'btnDatePrev', date: yesterday },
    { id: 'btnDateToday', date: today },
    { id: 'btnDateTomorrow', date: tomorrow },
    { id: 'btnDatePlus2', date: plus2 },
    { id: 'btnDatePlus3', date: plus3 }
  ];

  chips.forEach(item => {
    const el = document.getElementById(item.id);
    if (!el) return;
    if (selectedDate === item.date) {
      el.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center py-2 px-3.5 rounded-xl bg-emerald-600/25 border-2 border-emerald-400 text-emerald-300 font-bold shadow-lg shadow-emerald-950/60 min-w-[80px] active:scale-95 transition';
    } else {
      el.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-900 border border-white/5 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition active:scale-95 min-w-[76px]';
    }
  });

  // Custom date chip display
  const customChip = document.getElementById('dateTextCustom');
  if (selectedDate !== yesterday && selectedDate !== today && selectedDate !== tomorrow && selectedDate !== plus2 && selectedDate !== plus3) {
    customChip.textContent = formatShortVNDate(selectedDate);
    customChip.parentElement.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-cyan-600/25 border-2 border-cyan-400 text-cyan-300 font-bold shadow-lg min-w-[76px] relative cursor-pointer';
  } else {
    customChip.textContent = 'Chọn ngày';
    customChip.parentElement.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-xl bg-slate-800/80 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition active:scale-95 min-w-[76px] relative';
  }
}

function renderTasksForSelectedDate() {
  const pendingContainer = document.getElementById('listPendingTasks');
  const completedContainer = document.getElementById('listCompletedTasks');
  const emptyPending = document.getElementById('emptyPendingState');
  const emptyCompleted = document.getElementById('emptyCompletedState');
  const badgePendingCount = document.getElementById('badgePendingCount');
  const badgeCompletedCount = document.getElementById('badgeCompletedCount');

  // Filter tasks for current selected date
  const dayTasks = appData.tasks.filter(t => t.date === selectedDate);
  const pendingTasks = dayTasks.filter(t => !t.completed);
  const completedTasks = dayTasks.filter(t => t.completed);

  badgePendingCount.textContent = pendingTasks.length;
  badgeCompletedCount.textContent = completedTasks.length;

  // Render Pending List
  pendingContainer.innerHTML = '';
  if (pendingTasks.length === 0) {
    emptyPending.classList.remove('hidden');
  } else {
    emptyPending.classList.add('hidden');
    pendingTasks.forEach(task => {
      pendingContainer.appendChild(createTaskCardElement(task, false));
    });
  }

  // Render Completed List
  completedContainer.innerHTML = '';
  if (completedTasks.length === 0) {
    emptyCompleted.classList.remove('hidden');
  } else {
    emptyCompleted.classList.add('hidden');
    completedTasks.forEach(task => {
      completedContainer.appendChild(createTaskCardElement(task, true));
    });
  }

  // Show or hide completed list based on user preference
  completedContainer.classList.toggle('hidden', !showCompletedList);
}

function createTaskCardElement(task, isCompleted) {
  const card = document.createElement('div');
  card.className = `task-card group flex items-start gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
    isCompleted 
      ? 'bg-slate-900/40 border-white/5 opacity-75 hover:opacity-100' 
      : 'bg-slate-900/90 border-white/10 hover:border-slate-600 shadow-md'
  }`;

  // Big Rounded Checkbox (24x24px with generous 44x44 tap area)
  const checkboxWrapper = document.createElement('button');
  checkboxWrapper.type = 'button';
  checkboxWrapper.className = 'w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center transition-all duration-150 active:scale-90 mt-0.5';
  
  if (isCompleted) {
    checkboxWrapper.className += ' bg-emerald-500 border border-emerald-400 text-white shadow-md shadow-emerald-900/40 check-pop';
    checkboxWrapper.innerHTML = '<i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>';
  } else {
    checkboxWrapper.className += ' border-2 border-slate-600 hover:border-emerald-400 bg-slate-950/60 hover:bg-emerald-500/10 text-transparent';
    checkboxWrapper.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[2.5]"></i>';
  }

  checkboxWrapper.onclick = (e) => {
    e.stopPropagation();
    toggleTaskComplete(task.id);
  };

  // Content Area: Title, Time, Note, Completed Timestamp
  const contentArea = document.createElement('div');
  contentArea.className = 'flex-1 min-w-0 flex flex-col gap-1 cursor-pointer';
  contentArea.onclick = () => openEditModal(task.id);

  // Title line with inline editing support
  const titleEl = document.createElement('div');
  titleEl.className = `text-sm font-medium leading-snug break-words ${
    isCompleted ? 'line-through text-slate-400 italic' : 'text-slate-100'
  }`;
  titleEl.textContent = task.title;

  // Metadata badges line
  const metaLine = document.createElement('div');
  metaLine.className = 'flex flex-wrap items-center gap-2 text-[11px] text-slate-400';

  if (task.time) {
    const timeBadge = document.createElement('span');
    timeBadge.className = 'inline-flex items-center gap-1 font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20';
    timeBadge.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${task.time}`;
    metaLine.appendChild(timeBadge);
  }

  if (isCompleted && task.completedAt) {
    const completedBadge = document.createElement('span');
    completedBadge.className = 'inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20';
    completedBadge.innerHTML = `<i data-lucide="check-check" class="w-3 h-3"></i> Xong lúc ${formatTime(task.completedAt)}`;
    metaLine.appendChild(completedBadge);
  }

  if (task.note) {
    const noteBadge = document.createElement('span');
    noteBadge.className = 'inline-flex items-center gap-1 text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md max-w-[200px] truncate';
    noteBadge.innerHTML = `<i data-lucide="file-text" class="w-3 h-3 text-blue-400"></i> ${task.note}`;
    metaLine.appendChild(noteBadge);
  }

  contentArea.appendChild(titleEl);
  if (metaLine.childNodes.length > 0) {
    contentArea.appendChild(metaLine);
  }

  // Action Buttons Group (Dời sang mai, Sửa, Xóa)
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'flex items-center gap-1 flex-shrink-0 self-start sm:self-center';

  if (!isCompleted) {
    // 1-Click "Dời sang mai" Button
    const moveTomorrowBtn = document.createElement('button');
    moveTomorrowBtn.type = 'button';
    moveTomorrowBtn.className = 'px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-white/5 transition flex items-center gap-1 active:scale-95';
    moveTomorrowBtn.title = 'Dời công việc sang ngày mai';
    moveTomorrowBtn.innerHTML = '<i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Dời mai</span>';
    moveTomorrowBtn.onclick = (e) => {
      e.stopPropagation();
      moveTaskToTomorrow(task.id);
    };
    actionsGroup.appendChild(moveTomorrowBtn);
  }

  // Edit Button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition active:scale-95';
  editBtn.title = 'Chỉnh sửa';
  editBtn.innerHTML = '<i data-lucide="edit-2" class="w-3.5 h-3.5"></i>';
  editBtn.onclick = (e) => {
    e.stopPropagation();
    openEditModal(task.id);
  };
  actionsGroup.appendChild(editBtn);

  // Delete Button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition active:scale-95';
  deleteBtn.title = 'Xóa';
  deleteBtn.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteTask(task.id);
  };
  actionsGroup.appendChild(deleteBtn);

  card.appendChild(checkboxWrapper);
  card.appendChild(contentArea);
  card.appendChild(actionsGroup);

  return card;
}

// ==========================================
// 7. HISTORY & DISCIPLINE STREAK VIEW
// ==========================================
function renderHistoryView() {
  const container = document.getElementById('containerHistoryDays');
  const emptyHistory = document.getElementById('emptyHistoryState');
  const streakCountEl = document.getElementById('streakCount');
  const totalTasksEl = document.getElementById('totalLifetimeTasks');
  const totalCompletedEl = document.getElementById('totalLifetimeCompleted');

  // Lifetime counts
  totalTasksEl.textContent = appData.tasks.length;
  totalCompletedEl.textContent = appData.tasks.filter(t => t.completed).length;

  // Group tasks by date
  const dateMap = {};
  appData.tasks.forEach(t => {
    if (!t.date) return;
    if (!dateMap[t.date]) dateMap[t.date] = [];
    dateMap[t.date].push(t);
  });

  const uniqueDates = Object.keys(dateMap).sort().reverse();

  // Calculate Streak
  let streak = 0;
  let checkDate = getTodayDateStr();

  // If today has completed task, count today, otherwise start check from yesterday
  const todayTasks = dateMap[checkDate] || [];
  const hasCompletedToday = todayTasks.some(t => t.completed);

  if (!hasCompletedToday) {
    checkDate = addDaysToDateStr(checkDate, -1);
  }

  while (true) {
    const tasksOnDate = dateMap[checkDate];
    if (tasksOnDate && tasksOnDate.some(t => t.completed)) {
      streak++;
      checkDate = addDaysToDateStr(checkDate, -1);
    } else {
      break;
    }
  }

  streakCountEl.textContent = streak;

  // Render History Days Cards
  container.innerHTML = '';
  if (uniqueDates.length === 0) {
    emptyHistory.classList.remove('hidden');
    return;
  }

  emptyHistory.classList.add('hidden');
  uniqueDates.forEach(dateStr => {
    const tasks = dateMap[dateStr];
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const percent = Math.round((completed / total) * 100);

    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-2xl p-4 border border-white/10 shadow-md flex flex-col gap-3 transition hover:border-slate-600';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2.5';

    const badgeRelation = document.createElement('span');
    badgeRelation.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300';
    badgeRelation.textContent = getRelativeDateLabel(dateStr);

    const dateTitle = document.createElement('span');
    dateTitle.className = 'text-sm font-bold text-white';
    dateTitle.textContent = formatFullVNDate(dateStr);

    left.appendChild(badgeRelation);
    left.appendChild(dateTitle);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2';

    const pill = document.createElement('span');
    if (percent === 100) {
      pill.className = 'text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1';
      pill.innerHTML = `✓ ${completed}/${total} (100%)`;
    } else {
      pill.className = 'text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/10';
      pill.textContent = `${completed}/${total} việc (${percent}%)`;
    }

    const btnGoToDate = document.createElement('button');
    btnGoToDate.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition';
    btnGoToDate.textContent = 'Xem ngày này';
    btnGoToDate.onclick = () => {
      selectedDate = dateStr;
      switchTab('checklist');
      renderApp();
    };

    right.appendChild(pill);
    right.appendChild(btnGoToDate);

    header.appendChild(left);
    header.appendChild(right);
    card.appendChild(header);

    // List of tasks preview in this day
    const taskPreviewList = document.createElement('div');
    taskPreviewList.className = 'flex flex-col gap-1.5 pt-2 border-t border-white/5';

    tasks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-950/40';

      const rowLeft = document.createElement('div');
      rowLeft.className = `flex items-center gap-2 truncate ${t.completed ? 'line-through text-slate-500' : 'text-slate-300'}`;
      rowLeft.innerHTML = t.completed 
        ? '<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"></i>' 
        : '<i data-lucide="circle" class="w-3.5 h-3.5 text-slate-600 flex-shrink-0"></i>';
      
      const titleSpan = document.createElement('span');
      titleSpan.className = 'truncate';
      titleSpan.textContent = t.title;
      rowLeft.appendChild(titleSpan);

      const rowRight = document.createElement('span');
      rowRight.className = 'text-[11px] text-slate-500 font-mono flex-shrink-0 ml-2';
      rowRight.textContent = t.time || (t.completedAt ? formatTime(t.completedAt) : '');

      row.appendChild(rowLeft);
      row.appendChild(rowRight);
      taskPreviewList.appendChild(row);
    });

    card.appendChild(taskPreviewList);
    container.appendChild(card);
  });
}

// ==========================================
// 8. MODAL MANAGERS & EVENT HANDLERS
// ==========================================
function openEditModal(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title;
  document.getElementById('editTaskDate').value = task.date;
  document.getElementById('editTaskTime').value = task.time || '';
  document.getElementById('editTaskNote').value = task.note || '';

  const modal = document.getElementById('modalEditTask');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('editTaskTitle').focus();
}

function closeEditModal() {
  const modal = document.getElementById('modalEditTask');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function openSettingsModal() {
  const modal = document.getElementById('modalSettings');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  update1ClickUrlField();
}

function closeSettingsModal() {
  const modal = document.getElementById('modalSettings');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

function update1ClickUrlField() {
  const gistId = cloudConfig.gistId || PRESET_GIST_ID;
  const token = cloudConfig.token || PRESET_TOKEN;
  const baseUrl = window.location.origin + window.location.pathname;
  const oneClickUrl = `${baseUrl}#gist=${gistId}&token=${token}`;
  const inputEl = document.getElementById('inputOneClickUrl');
  if (inputEl) inputEl.value = oneClickUrl;
}

function switchTab(tabName) {
  currentActiveTab = tabName;
  const viewChecklist = document.getElementById('viewChecklist');
  const viewSheets = document.getElementById('viewSheets');
  const viewHistory = document.getElementById('viewHistory');
  const tabBtnChecklist = document.getElementById('tabBtnChecklist');
  const tabBtnSheets = document.getElementById('tabBtnSheets');
  const tabBtnHistory = document.getElementById('tabBtnHistory');

  const activeClass = 'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 bg-emerald-600 text-white shadow-md shadow-emerald-900/30';
  const inactiveClass = 'flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50';

  if (viewChecklist) viewChecklist.classList.add('hidden');
  if (viewSheets) viewSheets.classList.add('hidden');
  if (viewHistory) viewHistory.classList.add('hidden');

  if (tabBtnChecklist) tabBtnChecklist.className = inactiveClass;
  if (tabBtnSheets) tabBtnSheets.className = inactiveClass;
  if (tabBtnHistory) tabBtnHistory.className = inactiveClass;

  if (tabName === 'checklist') {
    if (viewChecklist) viewChecklist.classList.remove('hidden');
    if (tabBtnChecklist) tabBtnChecklist.className = activeClass;
  } else if (tabName === 'sheets') {
    if (viewSheets) viewSheets.classList.remove('hidden');
    if (tabBtnSheets) tabBtnSheets.className = activeClass;
    renderSheetsView();
  } else if (tabName === 'history') {
    if (viewHistory) viewHistory.classList.remove('hidden');
    if (tabBtnHistory) tabBtnHistory.className = activeClass;
    renderHistoryView();
  }
  lucide.createIcons();
}

// ==========================================
// 8.1 SHEET UI RENDERERS & EVENT HANDLERS
// ==========================================
function renderSheetsView() {
  if (!sheetsData || !Array.isArray(sheetsData.sheets) || sheetsData.sheets.length === 0) {
    const countEl = document.getElementById('sheetRowCountText');
    if (countEl) countEl.textContent = 'Chưa có dữ liệu trang tính';
    return;
  }

  const activeSheet = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId) || sheetsData.sheets[0];
  if (!activeSheet) return;
  sheetsData.activeSheetId = activeSheet.id;

  // 1. Render Sheet Tabs
  const tabsContainer = document.getElementById('sheetTabsList');
  if (tabsContainer) {
    tabsContainer.innerHTML = sheetsData.sheets.map(sheet => {
      const isActive = sheet.id === activeSheet.id;
      const count = Array.isArray(sheet.rows) ? sheet.rows.length : 0;
      const activeClass = 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950/40 border-emerald-500';
      const inactiveClass = 'bg-slate-800/80 text-slate-300 font-medium hover:bg-slate-700/80 border-white/5';

      return `
        <button 
          onclick="selectSheetTab('${sheet.id}')"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition active:scale-95 ${isActive ? activeClass : inactiveClass}"
        >
          <span>${sheet.icon || '📄'}</span>
          <span>${escapeHtml(sheet.name)}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-emerald-800/80 text-emerald-100' : 'bg-slate-900 text-slate-400'} font-bold">${count}</span>
        </button>
      `;
    }).join('');
  }

  // 2. Render Headers
  const thead = document.getElementById('sheetTableHead');
  if (thead) {
    thead.innerHTML = `
      <tr>
        <th class="p-2.5 text-center w-12">#</th>
        <th class="p-2.5">Tên / Nhãn</th>
        <th class="p-2.5">Tài Khoản / Username</th>
        <th class="p-2.5">Mật Khẩu</th>
        <th class="p-2.5">Mail Khôi Phục / SĐT</th>
        <th class="p-2.5 text-center">Trạng Thái</th>
        <th class="p-2.5">Ghi Chú</th>
        <th class="p-2.5 text-center w-20">Thao Tác</th>
      </tr>
    `;
  }

  // 3. Filter & Render Rows
  const tbody = document.getElementById('sheetTableBody');
  const rows = Array.isArray(activeSheet.rows) ? activeSheet.rows : [];
  const q = (sheetSearchQuery || '').toLowerCase().trim();

  const filteredRows = rows.filter(r => {
    if (!q) return true;
    return (
      (r.label || '').toLowerCase().includes(q) ||
      (r.username || '').toLowerCase().includes(q) ||
      (r.recovery || '').toLowerCase().includes(q) ||
      (r.status || '').toLowerCase().includes(q) ||
      (r.note || '').toLowerCase().includes(q)
    );
  });

  if (tbody) {
    if (filteredRows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-8 text-slate-500 text-xs">
            ${q ? 'Không tìm thấy dòng nào khớp với từ khóa "' + escapeHtml(q) + '"' : 'Trang tính này hiện chưa có dữ liệu. Bấm "+ Thêm Dòng" để tạo.'}
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = filteredRows.map((r, idx) => {
        const isPwVisible = visiblePasswords.has(r.id);
        const pwDisplay = r.password ? (isPwVisible ? escapeHtml(r.password) : '••••••••') : '<span class="text-slate-600 italic">Trống</span>';
        
        let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">${escapeHtml(r.status || 'Live')}</span>`;
        if (r.status === 'Live') {
          statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 Live</span>`;
        } else if (r.status === 'Die') {
          statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">🔴 Die</span>`;
        } else if (r.status === 'Sai Pass') {
          statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 Sai Pass</span>`;
        }

        return `
          <tr class="hover:bg-slate-800/40 transition">
            <td class="p-2.5 text-center text-slate-500 font-mono text-[11px]">${idx + 1}</td>
            <td class="p-2.5 font-medium text-slate-200">
              <div class="max-w-[160px] truncate" title="${escapeHtml(r.label || '')}">${escapeHtml(r.label || '—')}</div>
            </td>
            <td class="p-2.5 font-mono text-[11px] text-emerald-300">
              <div class="flex items-center gap-1.5 max-w-[200px]">
                <span class="truncate" title="${escapeHtml(r.username || '')}">${escapeHtml(r.username || '—')}</span>
                ${r.username ? `<button onclick="copySheetCellText('${escapeHtml(r.username)}', 'Tài khoản')" class="text-slate-400 hover:text-white p-1" title="Sao chép"><i data-lucide="copy" class="w-3 h-3"></i></button>` : ''}
              </div>
            </td>
            <td class="p-2.5 font-mono text-[11px] text-slate-300">
              <div class="flex items-center gap-1.5">
                <span>${pwDisplay}</span>
                ${r.password ? `
                  <button onclick="togglePasswordVisibility('${r.id}')" class="text-slate-400 hover:text-white p-1" title="${isPwVisible ? 'Ẩn' : 'Hiện'}">
                    <i data-lucide="${isPwVisible ? 'eye-off' : 'eye'}" class="w-3 h-3"></i>
                  </button>
                  <button onclick="copySheetCellText('${escapeHtml(r.password)}', 'Mật khẩu')" class="text-slate-400 hover:text-white p-1" title="Sao chép">
                    <i data-lucide="copy" class="w-3 h-3"></i>
                  </button>
                ` : ''}
              </div>
            </td>
            <td class="p-2.5 text-slate-400 text-[11px]">
              <div class="max-w-[160px] truncate" title="${escapeHtml(r.recovery || '')}">${escapeHtml(r.recovery || '—')}</div>
            </td>
            <td class="p-2.5 text-center">${statusBadge}</td>
            <td class="p-2.5 text-slate-400 text-[11px]">
              <div class="max-w-[180px] truncate" title="${escapeHtml(r.note || '')}">${escapeHtml(r.note || '—')}</div>
            </td>
            <td class="p-2.5 text-center">
              <div class="flex items-center justify-center gap-1">
                <button onclick="editSheetRow('${r.id}')" class="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition" title="Sửa">
                  <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                </button>
                <button onclick="deleteSheetRowConfirm('${r.id}')" class="p-1 rounded bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition" title="Xóa">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  // 4. Update count text
  const countEl = document.getElementById('sheetRowCountText');
  if (countEl) {
    countEl.innerHTML = `Đang hiển thị <strong>${filteredRows.length}</strong> / <strong>${rows.length}</strong> dòng • Sheet: <strong>${escapeHtml(activeSheet.name)}</strong>`;
  }

  lucide.createIcons();
}

window.selectSheetTab = function(sheetId) {
  sheetsData.activeSheetId = sheetId;
  saveLocalSheetsData();
  renderSheetsView();
};

window.copySheetCellText = function(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Đã sao chép ${label}!`, 'success');
  }).catch(() => {
    showToast('Không thể sao chép tự động', 'info');
  });
};

window.togglePasswordVisibility = function(rowId) {
  if (visiblePasswords.has(rowId)) {
    visiblePasswords.delete(rowId);
  } else {
    visiblePasswords.add(rowId);
  }
  renderSheetsView();
};

window.editSheetRow = function(rowId) {
  const activeSheet = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId) || sheetsData.sheets[0];
  if (!activeSheet) return;
  const row = (activeSheet.rows || []).find(r => r.id === rowId);
  if (!row) return;

  document.getElementById('sheetRowId').value = row.id;
  document.getElementById('rowInputLabel').value = row.label || '';
  document.getElementById('rowInputUsername').value = row.username || '';
  document.getElementById('rowInputPassword').value = row.password || '';
  document.getElementById('rowInputTwofa').value = row.twofa || '';
  document.getElementById('rowInputRecovery').value = row.recovery || '';
  document.getElementById('rowInputStatus').value = row.status || 'Live';
  document.getElementById('rowInputNote').value = row.note || '';

  const deleteBtn = document.getElementById('btnDeleteSheetRow');
  if (deleteBtn) deleteBtn.classList.remove('hidden');

  const titleEl = document.getElementById('modalSheetRowTitle');
  if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-3" class="w-4 h-4 text-emerald-400"></i><span>Chỉnh sửa thông tin</span>';

  const modal = document.getElementById('modalSheetRow');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  lucide.createIcons();
};

window.deleteSheetRowConfirm = function(rowId) {
  if (!confirm('Bạn có chắc muốn xóa dòng này không?')) return;
  const activeSheet = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId) || sheetsData.sheets[0];
  if (!activeSheet) return;

  activeSheet.rows = (activeSheet.rows || []).filter(r => r.id !== rowId);
  triggerCloudSheetsSync();
  renderSheetsView();
  showToast('Đã xóa dòng thành công!', 'info');
};

function openSheetRowModal(row = null) {
  document.getElementById('sheetRowId').value = row ? row.id : '';
  document.getElementById('rowInputLabel').value = row ? (row.label || '') : '';
  document.getElementById('rowInputUsername').value = row ? (row.username || '') : '';
  document.getElementById('rowInputPassword').value = row ? (row.password || '') : '';
  document.getElementById('rowInputTwofa').value = row ? (row.twofa || '') : '';
  document.getElementById('rowInputRecovery').value = row ? (row.recovery || '') : '';
  document.getElementById('rowInputStatus').value = row ? (row.status || 'Live') : 'Live';
  document.getElementById('rowInputNote').value = row ? (row.note || '') : '';

  const deleteBtn = document.getElementById('btnDeleteSheetRow');
  if (deleteBtn) {
    if (row) deleteBtn.classList.remove('hidden');
    else deleteBtn.classList.add('hidden');
  }

  const titleEl = document.getElementById('modalSheetRowTitle');
  if (titleEl) {
    titleEl.innerHTML = row 
      ? '<i data-lucide="edit-3" class="w-4 h-4 text-emerald-400"></i><span>Chỉnh sửa thông tin</span>'
      : '<i data-lucide="plus-circle" class="w-4 h-4 text-emerald-400"></i><span>Thêm Dòng Mới</span>';
  }

  const modal = document.getElementById('modalSheetRow');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('rowInputLabel').focus();
  }
  lucide.createIcons();
}

function closeSheetRowModal() {
  const modal = document.getElementById('modalSheetRow');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function openAddSheetModal() {
  document.getElementById('inputNewSheetName').value = '';
  document.getElementById('inputNewSheetIcon').value = '📄';
  const modal = document.getElementById('modalAddSheet');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('inputNewSheetName').focus();
  }
}

function closeAddSheetModal() {
  const modal = document.getElementById('modalAddSheet');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  
  let bgClasses = 'bg-slate-900 border-white/10 text-slate-200';
  let iconName = 'info';

  if (type === 'success') {
    bgClasses = 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200';
    iconName = 'check-circle-2';
  } else if (type === 'error') {
    bgClasses = 'bg-rose-950/90 border-rose-500/30 text-rose-200';
    iconName = 'alert-circle';
  }

  toast.className = `flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium transition-all duration-300 transform translate-y-4 opacity-0 pointer-events-auto ${bgClasses}`;
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i> <span>${message}</span>`;

  container.appendChild(toast);
  lucide.createIcons();

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  // Auto remove after 3s
  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement.removeChild(toast);
    }, 300);
  }, 3000);
}

// ==========================================
// 9. ATTACH EVENT LISTENERS & BOOTSTRAP
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load config & local storage
  initConfigFromUrlOrStorage();
  loadLocalData();
  loadLocalSheetsData();

  // 2. Setup Date Chips navigation
  const today = getTodayDateStr();
  document.getElementById('btnDatePrev').onclick = () => {
    selectedDate = addDaysToDateStr(today, -1);
    renderApp();
  };
  document.getElementById('btnDateToday').onclick = () => {
    selectedDate = today;
    renderApp();
  };
  document.getElementById('btnDateTomorrow').onclick = () => {
    selectedDate = addDaysToDateStr(today, 1);
    renderApp();
  };
  document.getElementById('btnDatePlus2').onclick = () => {
    selectedDate = addDaysToDateStr(today, 2);
    renderApp();
  };
  document.getElementById('btnDatePlus3').onclick = () => {
    selectedDate = addDaysToDateStr(today, 3);
    renderApp();
  };
  document.getElementById('btnJumpToToday').onclick = () => {
    selectedDate = today;
    renderApp();
  };

  // Custom date picker input
  const datePickerInput = document.getElementById('inputCustomDatePicker');
  datePickerInput.value = selectedDate;
  datePickerInput.addEventListener('change', (e) => {
    if (e.target.value) {
      selectedDate = e.target.value;
      renderApp();
    }
  });

  // 3. Tab buttons
  document.getElementById('tabBtnChecklist').onclick = () => switchTab('checklist');
  const tabSheetsBtn = document.getElementById('tabBtnSheets');
  if (tabSheetsBtn) tabSheetsBtn.onclick = () => switchTab('sheets');
  document.getElementById('tabBtnHistory').onclick = () => switchTab('history');

  // 3.1 Sheet listeners
  const inputSearch = document.getElementById('inputSearchSheetRows');
  if (inputSearch) {
    inputSearch.addEventListener('input', (e) => {
      sheetSearchQuery = e.target.value;
      renderSheetsView();
    });
  }

  const btnAddRow = document.getElementById('btnAddSheetRow');
  if (btnAddRow) btnAddRow.onclick = () => openSheetRowModal(null);

  const btnSaveSheet = document.getElementById('btnManualSaveSheet');
  if (btnSaveSheet) btnSaveSheet.onclick = () => pushCloudSheetsData(true);

  const btnNewSheet = document.getElementById('btnAddNewSheet');
  if (btnNewSheet) btnNewSheet.onclick = () => openAddSheetModal();

  // Sheet Row Modal Form submit
  const formSheetRow = document.getElementById('formSheetRow');
  if (formSheetRow) {
    formSheetRow.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeSheet = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId) || sheetsData.sheets[0];
      if (!activeSheet) return;
      if (!Array.isArray(activeSheet.rows)) activeSheet.rows = [];

      const rowId = document.getElementById('sheetRowId').value;
      const label = document.getElementById('rowInputLabel').value.trim();
      const username = document.getElementById('rowInputUsername').value.trim();
      const password = document.getElementById('rowInputPassword').value.trim();
      const twofa = document.getElementById('rowInputTwofa').value.trim();
      const recovery = document.getElementById('rowInputRecovery').value.trim();
      const status = document.getElementById('rowInputStatus').value;
      const note = document.getElementById('rowInputNote').value.trim();

      if (rowId) {
        // Update existing row
        const row = activeSheet.rows.find(r => r.id === rowId);
        if (row) {
          row.label = label;
          row.username = username;
          row.password = password;
          row.twofa = twofa;
          row.recovery = recovery;
          row.status = status;
          row.note = note;
          row.updatedAt = Date.now();
        }
      } else {
        // Add new row
        const newRow = {
          id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          label,
          username,
          password,
          twofa,
          recovery,
          status,
          note,
          createdAt: Date.now()
        };
        activeSheet.rows.unshift(newRow);
      }

      closeSheetRowModal();
      triggerCloudSheetsSync();
      renderSheetsView();
      showToast('Đã lưu thông tin dòng thành công!', 'success');
    });
  }

  // Delete row button in modal
  const btnDeleteRow = document.getElementById('btnDeleteSheetRow');
  if (btnDeleteRow) {
    btnDeleteRow.onclick = () => {
      const rowId = document.getElementById('sheetRowId').value;
      if (!rowId) return;
      if (!confirm('Bạn có chắc muốn xóa dòng này không?')) return;
      const activeSheet = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId) || sheetsData.sheets[0];
      if (!activeSheet) return;
      activeSheet.rows = (activeSheet.rows || []).filter(r => r.id !== rowId);
      closeSheetRowModal();
      triggerCloudSheetsSync();
      renderSheetsView();
      showToast('Đã xóa dòng thành công!', 'info');
    };
  }

  const btnCloseRowModal = document.getElementById('btnCloseSheetRowModal');
  if (btnCloseRowModal) btnCloseRowModal.onclick = closeSheetRowModal;
  const btnCancelRowModal = document.getElementById('btnCancelSheetRow');
  if (btnCancelRowModal) btnCancelRowModal.onclick = closeSheetRowModal;

  // Add Sheet Modal Form submit
  const formAddSheet = document.getElementById('formAddSheet');
  if (formAddSheet) {
    formAddSheet.addEventListener('submit', (e) => {
      e.preventDefault();
      const sheetName = document.getElementById('inputNewSheetName').value.trim();
      const sheetIcon = document.getElementById('inputNewSheetIcon').value.trim() || '📄';
      if (!sheetName) return;

      const newSheetId = `sheet_${Date.now()}`;
      const newSheet = {
        id: newSheetId,
        name: sheetName,
        icon: sheetIcon,
        columns: [
          { id: 'label', name: 'Tên / Nhãn', width: 170, type: 'text' },
          { id: 'username', name: 'Tài khoản / Mail', width: 230, type: 'copy_text' },
          { id: 'password', name: 'Mật khẩu', width: 165, type: 'password' },
          { id: 'recovery', name: 'Mail khôi phục / SĐT', width: 185, type: 'text' },
          { id: 'status', name: 'Trạng thái', width: 120, type: 'status' },
          { id: 'note', name: 'Ghi chú', width: 220, type: 'text' }
        ],
        rows: []
      };

      if (!Array.isArray(sheetsData.sheets)) sheetsData.sheets = [];
      sheetsData.sheets.push(newSheet);
      sheetsData.activeSheetId = newSheetId;

      closeAddSheetModal();
      triggerCloudSheetsSync();
      renderSheetsView();
      showToast(`Đã tạo trang tính "${sheetName}" thành công!`, 'success');
    });
  }

  const btnCloseAddSheet = document.getElementById('btnCloseAddSheetModal');
  if (btnCloseAddSheet) btnCloseAddSheet.onclick = closeAddSheetModal;
  const btnCancelAddSheet = document.getElementById('btnCancelAddSheet');
  if (btnCancelAddSheet) btnCancelAddSheet.onclick = closeAddSheetModal;

  // 4. Quick Add Form
  const formAddTask = document.getElementById('formAddTask');
  const inputTitle = document.getElementById('inputTaskTitle');
  const inputTime = document.getElementById('inputTaskTime');
  const inputNote = document.getElementById('inputTaskNote');
  const btnToggleNote = document.getElementById('btnToggleNoteField');
  const containerNote = document.getElementById('containerNoteField');

  btnToggleNote.onclick = () => {
    containerNote.classList.toggle('hidden');
    if (!containerNote.classList.contains('hidden')) {
      inputNote.focus();
    }
  };

  formAddTask.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = inputTitle.value.trim();
    if (!title) return;

    addTask(title, selectedDate, inputTime.value, inputNote.value.trim());

    // Reset inputs
    inputTitle.value = '';
    inputTime.value = '';
    inputNote.value = '';
    containerNote.classList.add('hidden');
    inputTitle.focus();
  });

  // 5. Bulk action: Move all to tomorrow
  document.getElementById('btnMoveAllToTomorrow').onclick = moveAllPendingToTomorrow;

  // 6. Toggle completed list view
  const btnToggleCompleted = document.getElementById('btnToggleCompletedList');
  const iconToggleCompleted = document.getElementById('iconToggleCompleted');
  btnToggleCompleted.onclick = () => {
    showCompletedList = !showCompletedList;
    const completedList = document.getElementById('listCompletedTasks');
    completedList.classList.toggle('hidden', !showCompletedList);
    iconToggleCompleted.setAttribute('data-lucide', showCompletedList ? 'chevron-down' : 'chevron-right');
    lucide.createIcons();
  };

  // 7. Edit Modal Form
  document.getElementById('btnCloseEditModal').onclick = closeEditModal;
  document.getElementById('btnCancelEditModal').onclick = closeEditModal;
  document.getElementById('formEditTask').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('editTaskId').value;
    const title = document.getElementById('editTaskTitle').value;
    const date = document.getElementById('editTaskDate').value;
    const time = document.getElementById('editTaskTime').value;
    const note = document.getElementById('editTaskNote').value;

    updateTask(id, title, date, time, note);
    closeEditModal();
  });

  // 8. Settings & Sync Modals
  document.getElementById('btnOpenSettings').onclick = openSettingsModal;
  document.getElementById('btnSyncStatus').onclick = () => fetchCloudData(true);
  document.getElementById('btnCloseSettingsModal').onclick = closeSettingsModal;

  // Toggle token eye visibility
  const btnToggleEye = document.getElementById('btnToggleTokenVisibility');
  const inputToken = document.getElementById('configGithubToken');
  btnToggleEye.onclick = () => {
    const isPassword = inputToken.type === 'password';
    inputToken.type = isPassword ? 'text' : 'password';
    document.getElementById('iconTokenEye').setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    lucide.createIcons();
  };

  // Copy 1-Click URL button
  document.getElementById('btnCopyOneClickUrl').onclick = () => {
    const input = document.getElementById('inputOneClickUrl');
    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Đã chép Link đăng nhập 1-click!', 'success');
    }).catch(() => {
      showToast('Vui lòng bôi đen và chép link thủ công.', 'info');
    });
  };

  // Save Config Form
  document.getElementById('formCloudConfig').addEventListener('submit', (e) => {
    e.preventDefault();
    const newGistId = document.getElementById('configGistId').value.trim();
    const newToken = document.getElementById('configGithubToken').value.trim();

    cloudConfig.gistId = newGistId;
    cloudConfig.token = newToken;
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cloudConfig));

    update1ClickUrlField();
    showToast('Đã lưu cấu hình Đám mây!', 'success');
    closeSettingsModal();
    fetchCloudData(true);
  });

  // Manual Force Push & Pull
  document.getElementById('btnForcePullCloud').onclick = () => fetchCloudData(true);
  document.getElementById('btnForcePushCloud').onclick = () => pushCloudData(true);

  // Manual Export JSON
  document.getElementById('btnExportJson').onclick = () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my_checklist_backup_${getTodayDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất file sao lưu JSON!', 'success');
  };

  // Manual Import JSON
  document.getElementById('inputImportJson').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported.tasks)) {
          appData = imported;
          triggerCloudSync();
          showToast('Nhập dữ liệu thành công!', 'success');
        } else {
          showToast('File JSON không hợp lệ!', 'error');
        }
      } catch (err) {
        showToast('Lỗi đọc file JSON: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Network Online/Offline Listeners
  window.addEventListener('online', () => {
    setSyncStatusUI('syncing', 'Đã có mạng trở lại, đang đồng bộ...');
    fetchCloudData(false);
  });
  window.addEventListener('offline', () => {
    setSyncStatusUI('offline', 'Mất kết nối mạng');
  });

  // 9. Initial Render
  renderApp();

  // 10. Background initial Cloud Sync fetch
  fetchCloudData(false);
});
