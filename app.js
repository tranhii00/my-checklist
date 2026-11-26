/**
 * Checklist Cá Nhân - 24/7 Cloud PWA
 * Core Application Logic, Cloud Sync & Storage Engine
 */

// ==========================================
// 0. SAFE RUNTIME & COMPATIBILITY HELPERS (SAFARI / WEBKIT SHIELD)
// ==========================================
function safeEscapeHtml(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
const escapeHtml = safeEscapeHtml;

function safeParseDate(input) {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  const str = String(input).trim().replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T');
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
}

function refreshIcons() {
  try {
    if (window.lucide?.createIcons) {
      lucide.createIcons();
    }
  } catch (_) {}
}

function getTaskDate(t) {
  return (t && (t.date || t.dateKey)) || '';
}

if (typeof window !== 'undefined') {
  window.safeEscapeHtml = safeEscapeHtml;
  window.escapeHtml = safeEscapeHtml;
  window.safeParseDate = safeParseDate;
  window.refreshIcons = refreshIcons;
}

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

let checklistViewMode = 'day'; // 'day' | 'all' | 'gym'
let allFilterStatus = 'all';   // 'all' | 'pending' | 'overdue' | 'completed'
let allTimeRange = 'all';      // 'all' | 'past' | 'upcoming' | '7d' | '30d'
let allSearchQuery = '';
let allSortOrder = 'desc';     // 'desc' | 'asc'
let historyMonthFilter = 'all';
let historySearchQuery = '';
const collapsedAllDates = new Set();

let allSearchDebounceTimer = null;
let historySearchDebounceTimer = null;
let sheetSearchDebounceTimer = null;

// ==========================================
// 1.1 GYM PLAN STATE & STORAGE KEYS
// ==========================================
const STORAGE_KEY_GYM = 'pcl_gym_data_v1';
const STORAGE_KEY_GYM_DIRTY = 'pcl_gym_dirty_v1';
let gymData = (typeof window !== 'undefined' && window.GymPlan)
  ? window.GymPlan.getDefaultGymData()
  : { version: 1, workoutGroups: [], dailyLogs: {}, weeklyCheckins: {}, baseline: {}, updatedAt: 0 };
let gymDebounceTimer = null;
let gymSubTab = 'groups'; // 'groups' | 'review'
let selectedGymReviewWeek = (typeof window !== 'undefined' && window.GymPlan)
  ? window.GymPlan.getWeekNumberForDate(selectedDate)
  : 1;
const expandedGymGroupIds = new Set();
const autoPopulatedWorkoutDates = new Set();

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
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) {
    return new Date();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function diffDaysBetween(dateStrA, dateStrB) {
  if (!dateStrA || !dateStrB) return 0;
  const [yA, mA, dA] = String(dateStrA).split('-').map(Number);
  const [yB, mB, dB] = String(dateStrB).split('-').map(Number);
  if (!yA || !mA || !dA || !yB || !mB || !dB) return 0;
  const utcA = Date.UTC(yA, mA - 1, dA);
  const utcB = Date.UTC(yB, mB - 1, dB);
  return Math.round((utcA - utcB) / 86400000);
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

function getShortVietnameseDayOfWeek(dateObj) {
  const days = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
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
  if (typeof isoOrTimeStr === 'string' && isoOrTimeStr.length === 5 && isoOrTimeStr.includes(':')) {
    return isoOrTimeStr;
  }
  try {
    const d = safeParseDate(isoOrTimeStr);
    if (isNaN(d.getTime())) return String(isoOrTimeStr);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch (e) {
    return String(isoOrTimeStr);
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
  'Offline Sync Unit Task',
  'Chạy chiến dịch Seeding 50 nhóm Bất Động Sản',
  'Nuôi & Lướt Newfeed cho dàn 10 Nick mới',
  'Xử lý checkpoint Nick Admin Page',
  'Nghiên cứu kịch bản TikTok & StoryFlow AI'
]);

function isUserTask(t) {
  if (!t || !t.title || typeof t.title !== 'string') return false;
  const title = t.title.trim();
  if (!title) return false;
  if (DUMMY_TITLES.has(title)) return false;
  const idStr = String(t.id || '');
  if (idStr.startsWith('task_sample_')) return false;
  if (Array.isArray(appData.deletedIds) && appData.deletedIds.includes(idStr)) return false;
  const lower = title.toLowerCase();
  if (lower.includes('chạy chiến dịch seeding 50 nhóm') || lower.includes('nuôi & lướt newfeed') || lower.includes('xử lý checkpoint nick') || lower.includes('nghiên cứu kịch bản tiktok')) {
    return false;
  }
  return true;
}

function loadLocalData() {
  const localRaw = localStorage.getItem(STORAGE_KEY_DATA);
  if (localRaw) {
    try {
      appData = JSON.parse(localRaw);
      if (!Array.isArray(appData.deletedIds)) {
        appData.deletedIds = [];
      }
      const deletedSet = new Set(appData.deletedIds);
      if (!Array.isArray(appData.tasks)) {
        appData.tasks = [];
      } else {
        appData.tasks = appData.tasks
          .filter(t => isUserTask(t) && !deletedSet.has(t.id))
          .map(t => {
            const base = {
              ...t,
              date: t.date || t.dateKey || getTodayDateStr(),
              dateKey: t.dateKey || t.date || getTodayDateStr(),
              time: t.time || t.dueTime || '',
              dueTime: t.dueTime || t.time || ''
            };
            if (base.gymType === 'exercise' && window.GymPlan) {
              const checks = window.GymPlan.normalizeExerciseSetChecks(base);
              base.gymSets = checks.length;
              base.gymSetChecks = checks;
            }
            return base;
          });
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
  const legacyKeys = ['fb_auto_tasks_cache', 'fb_auto_tasks_outbox', 'my_checklist_backup', 'tasks_cache', 'tasks', 'user_tasks'];
  for (const lk of legacyKeys) {
    try {
      localStorage.removeItem(lk);
    } catch (_) {}
  }

  appData = {
    version: 1,
    updatedAt: Date.now(),
    tasks: [],
    deletedIds: [
      'task_sample_1', 'task_sample_2', 'task_sample_3', 'task_sample_4',
      'task_sample_5', 'task_sample_6', 'task_sample_7', 'task_sample_8'
    ],
    history: []
  };
  saveLocalData();
}

// ==========================================
// 4.1 SHEETS DATA MANAGEMENT & STORAGE
// ==========================================
const STORAGE_KEY_SHEETS = 'my_sheets_data_v1';
const STORAGE_KEY_SHEETS_DIRTY = 'my_sheets_dirty_v1';
let currentActiveTab = 'checklist';
let sheetsData = {
  activeSheetId: 'sheet_fb',
  sheets: []
};
let sheetDebounceTimer = null;
let sheetSearchQuery = '';
const visiblePasswords = new Set();

const DEFAULT_SHEET_COLUMNS = [
  { id: 'label', name: 'Tên / Nhãn', width: 170, type: 'text' },
  { id: 'username', name: 'Tài khoản / Mail', width: 230, type: 'copy_text' },
  { id: 'password', name: 'Mật khẩu', width: 165, type: 'password' },
  { id: 'recovery', name: 'Mail khôi phục / SĐT', width: 185, type: 'text' },
  { id: 'status', name: 'Trạng thái', width: 120, type: 'status' },
  { id: 'note', name: 'Ghi chú', width: 220, type: 'text' }
];

function getActiveSheet() {
  if (!sheetsData || !Array.isArray(sheetsData.sheets) || sheetsData.sheets.length === 0) {
    return null;
  }
  const found = sheetsData.sheets.find(s => s.id === sheetsData.activeSheetId);
  if (found) return found;
  sheetsData.activeSheetId = sheetsData.sheets[0].id;
  return sheetsData.sheets[0];
}

function getResolvedColumns(activeSheet) {
  if (activeSheet && Array.isArray(activeSheet.columns) && activeSheet.columns.length > 0) {
    return activeSheet.columns;
  }
  return DEFAULT_SHEET_COLUMNS;
}

function shouldAdoptRemoteSheets(remoteSheets) {
  if (!remoteSheets || !Array.isArray(remoteSheets.sheets)) return false;
  if (sheetDebounceTimer) return false;

  const localHasSheets = Array.isArray(sheetsData?.sheets) && sheetsData.sheets.length > 0;
  if (!localHasSheets) return true;

  const isLocalDirty = localStorage.getItem(STORAGE_KEY_SHEETS_DIRTY) === '1';
  const localTs = Number(sheetsData?.updatedAt || 0);
  const remoteTs = Number(remoteSheets?.updatedAt || 0);

  if (localTs > 0 && remoteTs > 0) {
    if (localTs > remoteTs) return false;
    return true;
  }
  if (isLocalDirty) return false;
  return true;
}

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

  // Fallback: fetch bundled sheets_data.json without bumping updatedAt above cloud
  try {
    const res = await fetch('./sheets_data.json');
    if (res.ok) {
      const initSheets = await res.json();
      if (initSheets && Array.isArray(initSheets.sheets)) {
        sheetsData = initSheets;
        saveLocalSheetsData(false);
      }
    }
  } catch (err) {
    console.warn('Could not load fallback sheets_data.json:', err);
  }
}

function saveLocalSheetsData(touchTimestamp = true) {
  if (touchTimestamp) {
    sheetsData.updatedAt = Date.now();
  }
  localStorage.setItem(STORAGE_KEY_SHEETS, JSON.stringify(sheetsData));
}

function triggerCloudSheetsSync() {
  saveLocalSheetsData(true);
  localStorage.setItem(STORAGE_KEY_SHEETS_DIRTY, '1');
  if (!cloudConfig.autoSync) return;
  if (sheetDebounceTimer) clearTimeout(sheetDebounceTimer);
  setSyncStatusUI('syncing', 'Đang lưu Sheet lên Cloud...');
  sheetDebounceTimer = setTimeout(() => {
    sheetDebounceTimer = null;
    pushCloudSheetsData(false);
  }, 1200);
}

async function pushCloudSheetsData(isManual = false, options = {}) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Offline: Đã lưu Sheet trên điện thoại');
    return;
  }
  if (!cloudConfig.gistId || !cloudConfig.token) return;

  if (!sheetsData.updatedAt) {
    sheetsData.updatedAt = Date.now();
  }

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
    const fetchConfig = {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    };
    if (options && options.keepalive) {
      fetchConfig.keepalive = true;
    }
    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, fetchConfig);
    if (!res.ok) {
      throw new Error(`Cloud update error ${res.status}`);
    }
    localStorage.removeItem(STORAGE_KEY_SHEETS_DIRTY);
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

// ==========================================
// 4.2 GYM DATABASE LOCAL & CLOUD GIST SYNC
// ==========================================
function loadLocalGymData() {
  if (!window.GymPlan) return;
  const raw = localStorage.getItem(STORAGE_KEY_GYM);
  if (raw) {
    try {
      gymData = window.GymPlan.normalizeGymData(JSON.parse(raw));
      return;
    } catch (e) {
      console.warn('Error loading local gym data, resetting to defaults:', e);
    }
  }
  gymData = window.GymPlan.getDefaultGymData();
  saveLocalGymData(false);
}

function saveLocalGymData(touchTimestamp = true) {
  if (touchTimestamp) {
    gymData.updatedAt = Date.now();
  }
  try {
    localStorage.setItem(STORAGE_KEY_GYM, JSON.stringify(gymData));
  } catch (e) {
    console.warn('Could not persist gym data to localStorage:', e);
  }
}

function ensureGymDailyLog(dateStr) {
  if (!dateStr) return null;
  if (!gymData.dailyLogs || typeof gymData.dailyLogs !== 'object') {
    gymData.dailyLogs = {};
  }
  if (!gymData.dailyLogs[dateStr] || typeof gymData.dailyLogs[dateStr] !== 'object') {
    gymData.dailyLogs[dateStr] = {
      date: dateStr,
      workoutGroupId: null,
      groupId: null,
      workoutGroupName: '',
      groupName: '',
      habits: {},
      weights: {},
      completedExercises: {},
      exerciseDone: {},
      setProgress: {},
      clearedWorkout: false,
      note: '',
      updatedAt: 0
    };
  }
  const log = gymData.dailyLogs[dateStr];
  if (!log.habits || typeof log.habits !== 'object') log.habits = {};
  if (!log.weights || typeof log.weights !== 'object') log.weights = {};
  if (!log.completedExercises || typeof log.completedExercises !== 'object') log.completedExercises = {};
  if (!log.exerciseDone || typeof log.exerciseDone !== 'object') log.exerciseDone = {};
  if (!log.setProgress || typeof log.setProgress !== 'object') log.setProgress = {};
  if (typeof log.clearedWorkout !== 'boolean') log.clearedWorkout = Boolean(log.clearedWorkout);
  return log;
}

function mirrorTaskStateToGymData(task) {
  if (!task || !window.GymPlan) return false;
  const dateStr = getTaskDate(task);
  if (!dateStr) return false;

  const habitId = window.GymPlan.resolveHabitIdFromTask(task);
  const isExercise = task.gymType === 'exercise';
  if (!habitId && !isExercise) return false;

  const now = Date.now();
  const log = ensureGymDailyLog(dateStr);
  if (!log) return false;

  if (habitId) {
    log.habits[habitId] = Boolean(task.completed);
  }
  if (isExercise) {
    if (task.gymGroupId) {
      log.workoutGroupId = task.gymGroupId;
      log.groupId = task.gymGroupId;
    }
    if (task.gymGroupName) {
      log.workoutGroupName = task.gymGroupName;
      log.groupName = task.gymGroupName;
    }
    log.clearedWorkout = false;
    if (task.gymExerciseId) {
      const canonExId = window.GymPlan.canonicalizeExerciseId
        ? window.GymPlan.canonicalizeExerciseId(task.gymExerciseId)
        : task.gymExerciseId;
      const checks = window.GymPlan.normalizeExerciseSetChecks(task);
      log.setProgress[canonExId] = checks.slice();
      log.completedExercises[canonExId] = Boolean(task.completed);
      log.exerciseDone[canonExId] = Boolean(task.completed);
      const parsedW = window.GymPlan.parsePositiveWeight(task.gymWeightKg);
      if (parsedW !== null) {
        log.weights[canonExId] = parsedW;
      }
    }
  }

  log.updatedAt = now;
  gymData.updatedAt = now;
  saveLocalGymData(true);
  localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  return true;
}

function triggerCloudGymSync() {
  saveLocalGymData(true);
  localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  if (!cloudConfig.autoSync) return;
  if (gymDebounceTimer) clearTimeout(gymDebounceTimer);
  setSyncStatusUI('syncing', 'Đang lưu dữ liệu Gym...');
  gymDebounceTimer = setTimeout(() => {
    gymDebounceTimer = null;
    pushCloudGymData(false);
  }, 1100);
}

async function pushCloudGymData(isManual = false, options = {}) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Offline: Đã lưu Gym trên điện thoại');
    return;
  }
  if (!cloudConfig.gistId || !cloudConfig.token) return;
  if (!gymData.updatedAt) gymData.updatedAt = Date.now();

  try {
    setSyncStatusUI('syncing');
    const payload = {
      description: 'Personal Daily Checklist & Sheet Manager 24/7 Cloud Sync Data',
      files: {
        'gym_data.json': {
          content: JSON.stringify(gymData, null, 2)
        }
      }
    };
    const fetchConfig = {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    };
    if (options && options.keepalive) {
      fetchConfig.keepalive = true;
    }
    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, fetchConfig);
    if (!res.ok) {
      throw new Error(`Cloud gym update error ${res.status}`);
    }
    localStorage.removeItem(STORAGE_KEY_GYM_DIRTY);
    setSyncStatusUI('synced', 'Đã lưu Gym lên Đám mây');
    if (isManual) showToast('Đã lưu dữ liệu Gym lên Cloud 24/7!', 'success');
  } catch (err) {
    console.error('Error pushing gym_data.json:', err);
    setSyncStatusUI('error', 'Lỗi lưu Gym: ' + err.message);
    if (isManual) showToast('Lỗi lưu Gym: ' + err.message, 'error');
  }
}

function setSyncStatusUI(status, message) {
  const textEl = document.getElementById('syncStatusText');
  const dotEl = document.getElementById('syncIndicatorDot');
  const spinEl = document.getElementById('syncIconSpin');
  const modalStatusEl = document.getElementById('settingsModalSyncStatus');
  const modalLastSyncEl = document.getElementById('settingsModalLastSync');

  if (status === 'syncing') {
    textEl.textContent = 'Đang lưu...';
    dotEl.className = 'flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    spinEl.classList.add('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="flex-shrink-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Đang đồng bộ...';
  } else if (status === 'synced') {
    textEl.textContent = 'Đã đồng bộ';
    dotEl.className = 'flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400';
    spinEl.classList.remove('animate-spin');
    const timeStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    cloudConfig.lastSyncTime = timeStr;
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400"></span> Đã kết nối & Đồng bộ';
    if (modalLastSyncEl) modalLastSyncEl.textContent = timeStr + ' (' + message + ')';
  } else if (status === 'offline') {
    textEl.textContent = 'Ngoại tuyến';
    dotEl.className = 'flex-shrink-0 w-2 h-2 rounded-full bg-slate-500';
    spinEl.classList.remove('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="flex-shrink-0 w-2 h-2 rounded-full bg-slate-500"></span> Chế độ Offline';
  } else if (status === 'error') {
    textEl.textContent = 'Chưa đồng bộ';
    dotEl.className = 'flex-shrink-0 w-2 h-2 rounded-full bg-rose-500';
    spinEl.classList.remove('animate-spin');
    if (modalStatusEl) modalStatusEl.innerHTML = '<span class="flex-shrink-0 w-2 h-2 rounded-full bg-rose-500"></span> ' + (message || 'Lỗi kết nối');
  }
}

// Pull latest data from GitHub Gist
async function fetchCloudData(isManual = false) {
  if (!navigator.onLine) {
    setSyncStatusUI('offline', 'Thiết bị đang offline');
    maybeAutoLoadTodaysWorkout(false);
    return;
  }

  if (!cloudConfig.gistId || !cloudConfig.token) {
    setSyncStatusUI('error', 'Chưa điền Token hoặc Gist ID');
    maybeAutoLoadTodaysWorkout(false);
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
    let needSheetsPush = false;
    if (gistData.files && gistData.files['sheets_data.json'] && gistData.files['sheets_data.json'].content) {
      try {
        const remoteSheets = JSON.parse(gistData.files['sheets_data.json'].content);
        if (remoteSheets && Array.isArray(remoteSheets.sheets)) {
          if (shouldAdoptRemoteSheets(remoteSheets)) {
            sheetsData = remoteSheets;
            saveLocalSheetsData(false);
            localStorage.removeItem(STORAGE_KEY_SHEETS_DIRTY);
            if (currentActiveTab === 'sheets') {
              renderSheetsView();
            }
          } else if (!sheetDebounceTimer) {
            needSheetsPush = true;
          }
        }
      } catch (sheetsErr) {
        console.warn('Could not parse sheets_data.json:', sheetsErr);
      }
    }

    // Sync Gym Plan Data (gym_data.json) if present in Gist (non-destructive 2-way merge)
    let needGymPush = localStorage.getItem(STORAGE_KEY_GYM_DIRTY) === '1';
    if (window.GymPlan && gistData.files && gistData.files['gym_data.json'] && gistData.files['gym_data.json'].content) {
      try {
        const remoteGym = JSON.parse(gistData.files['gym_data.json'].content);
        if (remoteGym && typeof remoteGym === 'object') {
          const remoteTs = Number(remoteGym.updatedAt || 0);
          const localTs = Number(gymData.updatedAt || 0);
          const mergedGym = window.GymPlan.mergeGymData(gymData, remoteGym);
          gymData = mergedGym;
          saveLocalGymData(false);
          if (localTs > remoteTs || needGymPush) {
            needGymPush = true;
          } else {
            localStorage.removeItem(STORAGE_KEY_GYM_DIRTY);
            needGymPush = false;
          }
          renderGymQuickBar();
          if (checklistViewMode === 'gym') {
            renderGymSection();
          }
        }
      } catch (gymErr) {
        console.warn('Could not parse gym_data.json:', gymErr);
      }
    } else if (window.GymPlan && Number(gymData.updatedAt || 0) > 0) {
      // Seed gym_data.json to Gist if not present yet and local has user edits
      needGymPush = true;
    }

    // Sync Tunnel Status if present in Gist
    if (gistData.files && gistData.files['tunnel_status.json'] && gistData.files['tunnel_status.json'].content) {
      try {
        const remoteTunnel = JSON.parse(gistData.files['tunnel_status.json'].content);
        if (remoteTunnel && typeof remoteTunnel === 'object') {
          const cleanUrl = remoteTunnel.tunnel_url || remoteTunnel.mobileUrl || (remoteTunnel.publicUrl ? `${remoteTunnel.publicUrl.replace(/\/$/, '')}/?pin=${remoteTunnel.pin || '686868'}&mobile=1` : '');
          tunnelStatus = {
            ...tunnelStatus,
            ...remoteTunnel,
            tunnel_url: cleanUrl || remoteTunnel.tunnel_url || remoteTunnel.publicUrl || ''
          };
          if (currentActiveTab === 'autofb') {
            renderAutoFbView();
          }
        }
      } catch (tunErr) {
        console.warn('Could not parse tunnel_status.json:', tunErr);
      }
    }

    let triggeredFullPush = false;
    if (cloudContent) {
      try {
        const remoteData = JSON.parse(cloudContent);
        // Merge tombstones (deletedIds)
        const localDeleted = new Set(Array.isArray(appData.deletedIds) ? appData.deletedIds : []);
        const remoteDeleted = new Set(Array.isArray(remoteData.deletedIds) ? remoteData.deletedIds : []);
        const allDeleted = new Set([...localDeleted, ...remoteDeleted]);
        appData.deletedIds = Array.from(allDeleted);

        const rawRemote = Array.isArray(remoteData.tasks) ? remoteData.tasks : [];
        const remoteTasks = rawRemote
          .filter(t => isUserTask(t) && !allDeleted.has(t.id))
          .map(t => {
            const base = {
              ...t,
              date: t.date || t.dateKey || getTodayDateStr(),
              dateKey: t.dateKey || t.date || getTodayDateStr(),
              time: t.time || t.dueTime || '',
              dueTime: t.dueTime || t.time || ''
            };
            if (base.gymType === 'exercise' && window.GymPlan) {
              const checks = window.GymPlan.normalizeExerciseSetChecks(base);
              base.gymSets = checks.length;
              base.gymSetChecks = checks;
            }
            return base;
          });

        // Non-destructive 2-way union merge respecting deleted tombstones
        const taskMap = new Map();
        for (const lt of (appData.tasks || [])) {
          if (isUserTask(lt) && !allDeleted.has(lt.id)) taskMap.set(lt.id, lt);
        }
        for (const rt of remoteTasks) {
          if (!allDeleted.has(rt.id) && isUserTask(rt)) {
            if (!taskMap.has(rt.id)) {
              taskMap.set(rt.id, rt);
            } else {
              const lt = taskMap.get(rt.id);
              // So sánh (rt.updatedAt || 0) > (lt.updatedAt || 0). Nếu rt.updatedAt === lt.updatedAt hoặc thiếu, ưu tiên giữ local để không mất thao tác vừa thực hiện
              if ((rt.updatedAt || 0) > (lt.updatedAt || 0)) {
                taskMap.set(rt.id, rt);
              }
            }
          }
        }
        const mergedList = Array.from(taskMap.values());
        appData.tasks = mergedList;
        appData.updatedAt = Date.now();
        saveLocalData();

        // Auto-load today's scheduled workout (T2-T7) if empty & not explicitly cleared
        const didAutoLoadToday = maybeAutoLoadTodaysWorkout(false);
        if (!didAutoLoadToday) {
          renderApp();
        }

        let hasLocalNewer = didAutoLoadToday;
        if (!hasLocalNewer) {
          for (const t of mergedList) {
            const rt = remoteTasks.find(r => r.id === t.id);
            if (!rt || (t.updatedAt || 0) > (rt.updatedAt || 0)) {
              hasLocalNewer = true;
              break;
            }
          }
        }
        if (hasLocalNewer || appData.tasks.length > remoteTasks.length) {
          triggeredFullPush = true;
          pushCloudData(false);
        }
        setSyncStatusUI('synced', 'Đã đồng bộ');
        if (isManual) showToast('Đã tải và cập nhật dữ liệu mới nhất!', 'success');
      } catch (parseErr) {
        console.warn('Could not parse cloud JSON, uploading local data...');
        maybeAutoLoadTodaysWorkout(false);
        triggeredFullPush = true;
        pushCloudData(false);
      }
    } else {
      // Empty gist, upload local
      maybeAutoLoadTodaysWorkout(false);
      triggeredFullPush = true;
      pushCloudData(false);
    }

    if (needSheetsPush && !triggeredFullPush) {
      pushCloudSheetsData(false);
    }
    if (needGymPush && !triggeredFullPush && !gymDebounceTimer) {
      pushCloudGymData(false);
    }
  } catch (err) {
    console.error('Fetch cloud error:', err);
    setSyncStatusUI('error', err.message);
    maybeAutoLoadTodaysWorkout(false);
    if (isManual) showToast('Không thể tải từ đám mây: ' + err.message, 'error');
  }
}

// Push local data to GitHub Gist
async function pushCloudData(isManual = false, options = {}) {
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

    const filesPayload = {
      'checklist_data.json': {
        content: JSON.stringify(appData, null, 2)
      }
    };
    if (sheetsData && Array.isArray(sheetsData.sheets) && sheetsData.sheets.length > 0) {
      if (!sheetsData.updatedAt) sheetsData.updatedAt = Date.now();
      filesPayload['sheets_data.json'] = {
        content: JSON.stringify(sheetsData, null, 2)
      };
    }
    if (window.GymPlan && gymData && typeof gymData === 'object') {
      if (!gymData.updatedAt) gymData.updatedAt = Date.now();
      filesPayload['gym_data.json'] = {
        content: JSON.stringify(gymData, null, 2)
      };
    }

    const payload = {
      description: 'Personal Daily Checklist & Sheet Manager 24/7 Cloud Sync Data',
      files: filesPayload
    };

    const fetchConfig = {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${cloudConfig.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    };

    if (options && options.keepalive) {
      fetchConfig.keepalive = true;
    }

    const res = await fetch(`https://api.github.com/gists/${cloudConfig.gistId}`, fetchConfig);

    if (!res.ok) {
      throw new Error(`GitHub Gist Update failed: ${res.status}`);
    }

    if (filesPayload['sheets_data.json']) {
      localStorage.removeItem(STORAGE_KEY_SHEETS_DIRTY);
    }
    if (filesPayload['gym_data.json']) {
      localStorage.removeItem(STORAGE_KEY_GYM_DIRTY);
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
    syncDebounceTimer = null;
    pushCloudData(false);
  }, 1000); // 1s debounce
}

// ==========================================
// 5. TASK OPERATIONS
// ==========================================
function addTask(title, dateStr, timeStr = '', noteStr = '') {
  if (!title || !title.trim()) return;

  const now = Date.now();
  const newTask = {
    id: 'task_' + now + '_' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    date: dateStr || selectedDate,
    dateKey: dateStr || selectedDate,
    time: timeStr || '',
    dueTime: timeStr || '',
    note: noteStr || '',
    completed: false,
    completedAt: null,
    createdAt: now,
    updatedAt: now
  };

  appData.tasks.unshift(newTask);
  appData.updatedAt = now;
  triggerCloudSync();
  showToast('Đã thêm công việc mới!', 'success');
}

function toggleExerciseSet(taskId, setIdx) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task || !window.GymPlan) return;

  const checks = window.GymPlan.normalizeExerciseSetChecks(task);
  const totalSets = checks.length;
  if (setIdx < 0 || setIdx >= totalSets) return;

  const wasCompleted = Boolean(task.completed);
  checks[setIdx] = !checks[setIdx];

  const doneSets = checks.filter(Boolean).length;
  const allDone = doneSets === totalSets;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  task.gymSets = totalSets;
  task.gymSetChecks = checks;
  task.completed = allDone;
  task.completedAt = allDone ? nowIso : null;
  task.updatedAt = now;
  appData.updatedAt = now;

  mirrorTaskStateToGymData(task);
  saveLocalData();
  renderApp();

  if (allDone && !wasCompleted) {
    playTaskCompleteSound();
    showToast(`✓ Hoàn thành đủ ${totalSets}/${totalSets} hiệp: ${task.title.substring(0, 32)}`, 'success');
  } else if (!allDone && wasCompleted) {
    showToast(`Đã mở lại (${doneSets}/${totalSets} hiệp): ${task.title.substring(0, 28)}`, 'info');
  }

  triggerCloudSync();
}

function toggleTaskComplete(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Per-set rule for Gym exercises: step next unticked set when incomplete; uncheck all sets when reopening
  if (task.gymType === 'exercise' && window.GymPlan) {
    const checks = window.GymPlan.normalizeExerciseSetChecks(task);
    const totalSets = checks.length;
    if (!task.completed) {
      const nextUntickedIdx = checks.findIndex(v => !v);
      if (nextUntickedIdx !== -1) {
        toggleExerciseSet(taskId, nextUntickedIdx);
        return;
      }
      // All sets already checked but completed flag lagged -> mark completed
      const now = Date.now();
      task.gymSets = totalSets;
      task.gymSetChecks = checks;
      task.completed = true;
      task.completedAt = new Date(now).toISOString();
      task.updatedAt = now;
      appData.updatedAt = now;
      mirrorTaskStateToGymData(task);
      saveLocalData();
      renderApp();
      playTaskCompleteSound();
      showToast(`✓ Hoàn thành đủ ${totalSets}/${totalSets} hiệp: ${task.title.substring(0, 32)}`, 'success');
      triggerCloudSync();
      return;
    }

    // Completed -> reopen by unchecking all sets
    const now = Date.now();
    task.gymSets = totalSets;
    task.gymSetChecks = Array(totalSets).fill(false);
    task.completed = false;
    task.completedAt = null;
    task.updatedAt = now;
    appData.updatedAt = now;

    mirrorTaskStateToGymData(task);
    saveLocalData();
    renderApp();
    showToast(`Đã mở lại bài tập (0/${totalSets} hiệp): ${task.title.substring(0, 28)}`, 'info');
    triggerCloudSync();
    return;
  }

  const now = Date.now();
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.updatedAt = now;
  appData.updatedAt = now;

  // Mirror habit or exercise completion immediately into Gym Database
  mirrorTaskStateToGymData(task);

  saveLocalData();
  renderApp();

  if (task.completed) {
    playTaskCompleteSound();
    showToast(`✓ Đã hoàn thành: ${task.title.substring(0, 30)}...`, 'success');
  } else {
    showToast(`Đã mở lại công việc: ${task.title.substring(0, 30)}...`, 'info');
  }

  triggerCloudSync();
}

function updateExerciseTaskWeight(taskId, rawWeightVal) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task || !window.GymPlan) return;

  const parsedWeight = window.GymPlan.parsePositiveWeight(rawWeightVal);
  const currentWeight = window.GymPlan.parsePositiveWeight(task.gymWeightKg);
  if (parsedWeight === currentWeight) return;

  const now = Date.now();
  const taskDate = getTaskDate(task) || selectedDate;
  task.gymWeightKg = parsedWeight;
  task.updatedAt = now;
  appData.updatedAt = now;

  const log = ensureGymDailyLog(taskDate);
  if (log && task.gymExerciseId) {
    if (task.gymGroupId) {
      log.workoutGroupId = task.gymGroupId;
      log.groupId = task.gymGroupId;
    }
    if (task.gymGroupName) {
      log.workoutGroupName = task.gymGroupName;
      log.groupName = task.gymGroupName;
    }
    if (parsedWeight !== null) {
      log.weights[task.gymExerciseId] = parsedWeight;
    } else {
      delete log.weights[task.gymExerciseId];
    }
    log.updatedAt = now;
    gymData.updatedAt = now;
    saveLocalGymData(true);
    localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  }

  saveLocalData();
  renderGymQuickBar();
  if (checklistViewMode === 'gym' && gymSubTab === 'review') {
    renderGymReviewView();
  }

  if (parsedWeight !== null) {
    showToast(`✓ Đã ghi tạ ${parsedWeight} kg · ${task.title.substring(0, 28)}`, 'success');
  }

  // Debounce atomic Cloud Gist sync (checklist_data.json + gym_data.json)
  if (cloudConfig.autoSync) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    setSyncStatusUI('syncing', 'Đang lưu mức tạ...');
    syncDebounceTimer = setTimeout(() => {
      syncDebounceTimer = null;
      pushCloudData(false);
    }, 1000);
  }
}

function moveTaskToTomorrow(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = Date.now();
  const currentTaskDate = getTaskDate(task) || selectedDate;
  const tomorrowDateStr = addDaysToDateStr(currentTaskDate, 1);
  task.date = tomorrowDateStr;
  task.dateKey = tomorrowDateStr;
  task.updatedAt = now;
  appData.updatedAt = now;

  const shortDate = formatShortVNDate(tomorrowDateStr);
  showToast(`Đã dời sang ngày mai (${shortDate})!`, 'info');

  saveLocalData();
  renderApp();
  triggerCloudSync();
}

function moveTaskToToday(taskId) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  const today = getTodayDateStr();
  const now = Date.now();
  task.date = today;
  task.dateKey = today;
  task.updatedAt = now;
  appData.updatedAt = now;

  showToast(`Đã dời việc về hôm nay (${formatShortVNDate(today)})!`, 'success');
  saveLocalData();
  renderApp();
  triggerCloudSync();
}

function moveAllPendingToTomorrow() {
  const pendingTasks = appData.tasks.filter(t => getTaskDate(t) === selectedDate && !t.completed);
  if (pendingTasks.length === 0) {
    showToast('Không có việc nào cần dời!', 'info');
    return;
  }

  const now = Date.now();
  const tomorrowDateStr = addDaysToDateStr(selectedDate, 1);
  pendingTasks.forEach(task => {
    task.date = tomorrowDateStr;
    task.dateKey = tomorrowDateStr;
    task.updatedAt = now;
  });
  appData.updatedAt = now;

  const shortDate = formatShortVNDate(tomorrowDateStr);
  showToast(`Đã dời ${pendingTasks.length} việc sang ngày mai (${shortDate})!`, 'success');
  saveLocalData();
  renderApp();
  triggerCloudSync();
}

function moveAllPendingToToday() {
  const today = getTodayDateStr();
  const pendingTasks = appData.tasks.filter(t => getTaskDate(t) === selectedDate && !t.completed);
  if (pendingTasks.length === 0) {
    showToast('Không có việc chưa xong để dời!', 'info');
    return;
  }

  const now = Date.now();
  pendingTasks.forEach(task => {
    task.date = today;
    task.dateKey = today;
    task.updatedAt = now;
  });
  appData.updatedAt = now;

  showToast(`Đã dời ${pendingTasks.length} việc về hôm nay (${formatShortVNDate(today)})!`, 'success');
  saveLocalData();
  renderApp();
  triggerCloudSync();
}

function moveAllOverdueToToday() {
  const today = getTodayDateStr();
  const overdueTasks = appData.tasks.filter(t => {
    const d = getTaskDate(t);
    return d && d < today && !t.completed;
  });
  if (overdueTasks.length === 0) {
    showToast('Không có công việc quá hạn nào!', 'info');
    return;
  }

  const now = Date.now();
  overdueTasks.forEach(task => {
    task.date = today;
    task.dateKey = today;
    task.updatedAt = now;
  });
  appData.updatedAt = now;

  showToast(`Đã dời ${overdueTasks.length} việc quá hạn về hôm nay (${formatShortVNDate(today)})!`, 'success');
  saveLocalData();
  renderApp();
  triggerCloudSync();
}

function deleteTask(taskId) {
  const index = appData.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return;

  const deletedTask = appData.tasks.splice(index, 1)[0];
  if (!Array.isArray(appData.deletedIds)) {
    appData.deletedIds = [];
  }
  if (!appData.deletedIds.includes(taskId)) {
    appData.deletedIds.push(taskId);
  }
  const now = Date.now();
  appData.updatedAt = now;
  saveLocalData();
  renderApp();
  triggerCloudSync();
  showToast(`Đã xóa: ${deletedTask.title.substring(0, 25)}...`, 'info');
}

function updateTask(taskId, newTitle, newDate, newTime, newNote) {
  const task = appData.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = Date.now();
  task.title = newTitle.trim();
  task.date = newDate;
  task.dateKey = newDate;
  task.time = newTime;
  task.dueTime = newTime;
  task.note = newNote;
  task.updatedAt = now;
  appData.updatedAt = now;

  saveLocalData();
  renderApp();
  triggerCloudSync();
  showToast('Đã lưu thay đổi công việc!', 'success');
}

// ==========================================
// 6. UI RENDERING & COMPONENT BUILDERS
// ==========================================
function setChecklistViewMode(mode) {
  checklistViewMode = (mode === 'all' || mode === 'gym') ? mode : 'day';
  const daySection = document.getElementById('checklistDaySection');
  const allSection = document.getElementById('checklistAllSection');
  const gymSection = document.getElementById('checklistGymSection');
  const btnDay = document.getElementById('btnChecklistModeDay');
  const btnAll = document.getElementById('btnChecklistModeAll');
  const btnGym = document.getElementById('btnChecklistModeGym');
  const badgeAll = document.getElementById('badgeAllTasksTotal');

  if (daySection) daySection.classList.toggle('hidden', checklistViewMode !== 'day');
  if (allSection) allSection.classList.toggle('hidden', checklistViewMode !== 'all');
  if (gymSection) gymSection.classList.toggle('hidden', checklistViewMode !== 'gym');

  const activePillClass = 'flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-[8px] text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors duration-150 bg-emerald-600 text-white active:scale-[0.99]';
  const inactivePillClass = 'flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1.5 sm:px-3 rounded-[8px] text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 active:scale-[0.99]';

  if (btnDay) btnDay.className = checklistViewMode === 'day' ? activePillClass : inactivePillClass;
  if (btnAll) btnAll.className = checklistViewMode === 'all' ? activePillClass : inactivePillClass;
  if (btnGym) btnGym.className = checklistViewMode === 'gym' ? activePillClass : inactivePillClass;
  if (badgeAll) {
    badgeAll.textContent = String((appData.tasks || []).length);
    badgeAll.className = checklistViewMode === 'all'
      ? 'tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-800/80 text-emerald-100 border border-emerald-400/30 leading-none'
      : 'tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10 leading-none';
  }

  if (checklistViewMode === 'all') {
    renderAllTasksView();
  } else if (checklistViewMode === 'gym') {
    renderGymSection();
  } else {
    renderDateChips();
    renderDateHeader();
    renderOverdueBanner();
    renderGymQuickBar();
    renderTasksForSelectedDate();
  }
  refreshIcons();
}

function renderApp() {
  renderDateChips();
  renderDateHeader();
  renderOverdueBanner();
  renderGymQuickBar();
  renderTasksForSelectedDate();
  renderAllTasksView();
  if (checklistViewMode === 'gym') {
    renderGymSection();
  }
  renderHistoryView();
  refreshIcons();
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
  const dayTasks = appData.tasks.filter(t => getTaskDate(t) === selectedDate);
  const total = dayTasks.length;
  const completed = dayTasks.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  statCompletedRatioEl.textContent = `${completed}/${total}`;
  statPercentEl.textContent = `${percent}%`;
  dayProgressBarEl.style.width = `${percent}%`;

  if (percent === 100 && total > 0) {
    dayProgressBarEl.className = 'bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-[width] duration-300 ease-out';
  } else {
    dayProgressBarEl.className = 'bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-[width] duration-300 ease-out';
  }
}

function renderDateChips() {
  const strip = document.getElementById('dateChipsStrip');
  const today = getTodayDateStr();
  const yesterday = addDaysToDateStr(today, -1);
  const tomorrow = addDaysToDateStr(today, 1);

  const statsByDate = {};
  (appData.tasks || []).forEach(t => {
    const d = getTaskDate(t);
    if (!d) return;
    if (!statsByDate[d]) statsByDate[d] = { total: 0, pending: 0 };
    statsByDate[d].total++;
    if (!t.completed) statsByDate[d].pending++;
  });

  const diffFromToday = diffDaysBetween(selectedDate, today);
  const isWithinDefaultWindow = diffFromToday >= -3 && diffFromToday <= 2;

  const stripDates = [];
  if (isWithinDefaultWindow) {
    for (let offset = -3; offset <= 2; offset++) {
      stripDates.push(addDaysToDateStr(today, offset));
    }
  } else {
    for (let offset = -2; offset <= 3; offset++) {
      stripDates.push(addDaysToDateStr(selectedDate, offset));
    }
  }

  if (strip) {
    strip.innerHTML = '';
    let activeEl = null;

    stripDates.forEach(dateStr => {
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === today;
      const stats = statsByDate[dateStr] || { total: 0, pending: 0 };

      let topLabel = getShortVietnameseDayOfWeek(parseDateStr(dateStr));
      if (dateStr === today) topLabel = 'Hôm nay';
      else if (dateStr === yesterday) topLabel = 'Hôm qua';
      else if (dateStr === tomorrow) topLabel = 'Ngày mai';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-chip-date', dateStr);

      if (isSelected) {
        btn.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center h-[54px] min-w-[66px] px-2.5 py-1.5 rounded-xl whitespace-nowrap bg-emerald-600/20 border border-emerald-400 ring-1 ring-emerald-400/30 text-emerald-300 font-bold active:scale-95 transition-colors';
      } else if (isToday) {
        btn.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center h-[54px] min-w-[66px] px-2.5 py-1.5 rounded-xl whitespace-nowrap bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-400 text-emerald-300 transition-colors active:scale-95';
      } else {
        btn.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center h-[54px] min-w-[66px] px-2.5 py-1.5 rounded-xl whitespace-nowrap bg-slate-900/90 border border-white/[0.08] hover:border-slate-600 text-slate-400 hover:text-slate-200 transition-colors active:scale-95';
      }

      const labelSpan = document.createElement('span');
      labelSpan.className = `text-[10px] font-semibold leading-tight whitespace-nowrap ${isSelected ? 'text-emerald-300' : (isToday ? 'text-emerald-400' : 'text-slate-400')}`;
      labelSpan.textContent = topLabel;

      const dateSpan = document.createElement('span');
      dateSpan.className = `tabular-nums text-xs font-bold mt-0.5 leading-tight whitespace-nowrap ${isSelected ? 'text-white' : 'text-slate-200'}`;
      dateSpan.textContent = formatShortVNDate(dateStr);

      const badgeSpan = document.createElement('span');
      if (stats.pending > 0) {
        badgeSpan.className = 'tabular-nums mt-0.5 text-[9px] font-bold px-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 leading-tight';
        badgeSpan.textContent = String(stats.pending);
      } else if (stats.total > 0) {
        badgeSpan.className = 'mt-0.5 text-[9px] font-bold px-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 leading-tight';
        badgeSpan.textContent = '✓';
      } else {
        badgeSpan.className = 'mt-0.5 text-[9px] opacity-0 leading-tight';
        badgeSpan.textContent = '0';
      }

      btn.appendChild(labelSpan);
      btn.appendChild(dateSpan);
      btn.appendChild(badgeSpan);

      btn.onclick = () => {
        selectedDate = dateStr;
        renderApp();
      };

      strip.appendChild(btn);
      if (isSelected) activeEl = btn;
    });

    if (activeEl) {
      const centerActiveChip = () => {
        const targetLeft = activeEl.offsetLeft - (strip.clientWidth - activeEl.offsetWidth) / 2;
        strip.scrollLeft = Math.max(0, targetLeft);
      };
      centerActiveChip();
      requestAnimationFrame(centerActiveChip);
    }
  }

  // Update custom date picker label when outside default window or outside strip
  const customChip = document.getElementById('dateTextCustom');
  const datePickerInput = document.getElementById('inputCustomDatePicker');
  if (datePickerInput) datePickerInput.value = selectedDate;

  if (customChip) {
    if (!isWithinDefaultWindow || !stripDates.includes(selectedDate)) {
      customChip.textContent = formatShortVNDate(selectedDate);
      customChip.parentElement.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center h-[54px] px-2 rounded-xl bg-cyan-600/20 border border-cyan-400 ring-1 ring-cyan-400/30 text-cyan-300 font-bold min-w-[60px] whitespace-nowrap relative cursor-pointer transition-colors active:scale-95';
    } else {
      customChip.textContent = 'Chọn ngày';
      customChip.parentElement.className = 'date-chip flex-shrink-0 flex flex-col items-center justify-center h-[54px] px-2 rounded-xl bg-slate-900/90 border border-white/[0.08] hover:border-emerald-500/50 cursor-pointer transition-colors active:scale-95 min-w-[60px] whitespace-nowrap relative';
    }
  }
}

function renderOverdueBanner() {
  const banner = document.getElementById('overdueBanner');
  if (!banner) return;

  const today = getTodayDateStr();
  if (selectedDate !== today) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  const overdueTasks = (appData.tasks || []).filter(t => {
    const d = getTaskDate(t);
    return d && d < today && !t.completed;
  });

  if (overdueTasks.length === 0) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  const countByDate = {};
  overdueTasks.forEach(t => {
    const d = getTaskDate(t);
    countByDate[d] = (countByDate[d] || 0) + 1;
  });
  const overdueDates = Object.keys(countByDate).sort().reverse();

  banner.innerHTML = '';
  banner.classList.remove('hidden');

  const topRow = document.createElement('div');
  topRow.className = 'flex flex-wrap items-center justify-between gap-2';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'flex items-center gap-2 text-xs text-amber-200 font-semibold';
  titleWrap.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-400 flex-shrink-0"></i><span>Còn <strong class="tabular-nums">${overdueTasks.length}</strong> việc chưa xong từ ngày trước</span>`;

  const btnGroup = document.createElement('div');
  btnGroup.className = 'flex items-center gap-1.5 flex-shrink-0';

  const btnViewOverdue = document.createElement('button');
  btnViewOverdue.type = 'button';
  btnViewOverdue.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 transition-colors active:scale-95 whitespace-nowrap';
  btnViewOverdue.textContent = 'Xem quá hạn';
  btnViewOverdue.onclick = () => {
    allFilterStatus = 'overdue';
    allTimeRange = 'all';
    setChecklistViewMode('all');
  };

  const btnMoveToday = document.createElement('button');
  btnMoveToday.type = 'button';
  btnMoveToday.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors active:scale-95 whitespace-nowrap';
  btnMoveToday.title = 'Dời tất cả việc quá hạn về hôm nay';
  btnMoveToday.textContent = 'Về hôm nay';
  btnMoveToday.onclick = () => moveAllOverdueToToday();

  btnGroup.appendChild(btnViewOverdue);
  btnGroup.appendChild(btnMoveToday);
  topRow.appendChild(titleWrap);
  topRow.appendChild(btnGroup);

  const pillsRow = document.createElement('div');
  pillsRow.className = 'flex items-center gap-1.5 overflow-x-auto no-scrollbar';
  overdueDates.forEach(dateStr => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'tabular-nums flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-950/70 hover:bg-slate-900 text-amber-300 border border-amber-500/20 transition-colors active:scale-95 whitespace-nowrap';
    pill.textContent = `${formatShortVNDate(dateStr)} (${countByDate[dateStr]})`;
    pill.title = `Xem ngày ${formatFullVNDate(dateStr)}`;
    pill.onclick = () => {
      selectedDate = dateStr;
      renderApp();
    };
    pillsRow.appendChild(pill);
  });

  banner.appendChild(topRow);
  banner.appendChild(pillsRow);
}

function renderTasksForSelectedDate() {
  const pendingContainer = document.getElementById('listPendingTasks');
  const completedContainer = document.getElementById('listCompletedTasks');
  const emptyPending = document.getElementById('emptyPendingState');
  const emptyCompleted = document.getElementById('emptyCompletedState');
  const badgePendingCount = document.getElementById('badgePendingCount');
  const badgeCompletedCount = document.getElementById('badgeCompletedCount');
  const btnMoveAll = document.getElementById('btnMoveAllToTomorrow');

  // Filter tasks for current selected date & sort Gym exercises by gymOrder ascending (1, 2, 3...)
  const sortDayTasks = (list) => {
    return list
      .map((task, idx) => ({ task, idx }))
      .sort((a, b) => {
        const aIsEx = a.task.gymType === 'exercise' ? 1 : 0;
        const bIsEx = b.task.gymType === 'exercise' ? 1 : 0;
        if (aIsEx !== bIsEx) return aIsEx - bIsEx;
        if (aIsEx === 1) {
          const ordDiff = (Number(a.task.gymOrder) || 999) - (Number(b.task.gymOrder) || 999);
          if (ordDiff !== 0) return ordDiff;
        }
        return a.idx - b.idx;
      })
      .map(item => item.task);
  };

  const dayTasks = appData.tasks.filter(t => getTaskDate(t) === selectedDate);
  const pendingTasks = sortDayTasks(dayTasks.filter(t => !t.completed));
  const completedTasks = sortDayTasks(dayTasks.filter(t => t.completed));

  badgePendingCount.textContent = pendingTasks.length;
  badgeCompletedCount.textContent = completedTasks.length;

  // Dynamic bulk move button: past days move to today, today/future move to tomorrow
  if (btnMoveAll) {
    const today = getTodayDateStr();
    if (selectedDate < today) {
      btnMoveAll.innerHTML = '<i data-lucide="calendar-check" class="w-3.5 h-3.5"></i> Dời tất cả về hôm nay';
      btnMoveAll.title = 'Chuyển tất cả việc chưa xong của ngày này về hôm nay';
      btnMoveAll.onclick = moveAllPendingToToday;
    } else {
      btnMoveAll.innerHTML = '<i data-lucide="chevrons-right" class="w-3.5 h-3.5"></i> Dời tất cả sang mai';
      btnMoveAll.title = 'Chuyển tất cả việc chưa xong sang ngày mai';
      btnMoveAll.onclick = moveAllPendingToTomorrow;
    }
  }

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

function createTaskCardElement(task, isCompleted, options = {}) {
  const isGymExercise = task.gymType === 'exercise';
  const setChecks = isGymExercise
    ? (window.GymPlan ? window.GymPlan.normalizeExerciseSetChecks(task) : [Boolean(isCompleted)])
    : [];
  const totalSets = setChecks.length;
  const doneSets = setChecks.filter(Boolean).length;
  const isPartialSets = isGymExercise && !isCompleted && doneSets > 0 && doneSets < totalSets;

  const card = document.createElement('div');
  card.className = `task-card group flex items-start gap-3 p-3.5 rounded-2xl border transition-colors duration-150 ${
    isCompleted
      ? (isGymExercise
          ? 'bg-slate-900/60 border-emerald-500/20 opacity-90 hover:opacity-100'
          : 'bg-slate-900/45 border-white/[0.06] opacity-75 hover:opacity-100')
      : (isPartialSets
          ? 'bg-slate-900/95 border-amber-500/35 hover:border-amber-400/55'
          : 'bg-slate-900/90 border-white/[0.08] hover:border-slate-600')
  }`;

  // Main Left Checkbox (For Gym Exercises: shows doneSets/totalSets & steps next unticked set; ✓ reopens all sets)
  const checkboxWrapper = document.createElement('button');
  checkboxWrapper.type = 'button';

  if (isGymExercise) {
    checkboxWrapper.className = 'min-w-[36px] h-8 px-1 flex-shrink-0 rounded-xl flex items-center justify-center transition-colors duration-150 active:scale-90 mt-0.5 tabular-nums';
    if (isCompleted) {
      checkboxWrapper.className += ' bg-emerald-500 border border-emerald-400 text-white check-pop';
      checkboxWrapper.innerHTML = '<i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>';
      checkboxWrapper.title = 'Đã đủ hiệp — Bấm để mở lại & bỏ tick tất cả các hiệp';
      checkboxWrapper.onclick = (e) => {
        e.stopPropagation();
        toggleTaskComplete(task.id);
      };
    } else {
      if (isPartialSets) {
        checkboxWrapper.className += ' border-2 border-amber-400/85 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[11px] font-extrabold leading-none';
      } else {
        checkboxWrapper.className += ' border-2 border-slate-600 hover:border-emerald-400 bg-slate-950/70 hover:bg-emerald-500/10 text-slate-300 text-[11px] font-extrabold leading-none';
      }
      checkboxWrapper.textContent = `${doneSets}/${totalSets}`;
      checkboxWrapper.title = `Bấm để tick Hiệp ${Math.min(totalSets, (setChecks.findIndex(v => !v) + 1) || 1)}/${totalSets}`;
      checkboxWrapper.onclick = (e) => {
        e.stopPropagation();
        const nextIdx = setChecks.findIndex(v => !v);
        if (nextIdx !== -1) {
          toggleExerciseSet(task.id, nextIdx);
        } else {
          toggleTaskComplete(task.id);
        }
      };
    }
  } else {
    checkboxWrapper.className = 'w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center transition-colors duration-150 active:scale-90 mt-0.5';
    if (isCompleted) {
      checkboxWrapper.className += ' bg-emerald-500 border border-emerald-400 text-white check-pop';
      checkboxWrapper.innerHTML = '<i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>';
    } else {
      checkboxWrapper.className += ' border-2 border-slate-600 hover:border-emerald-400 bg-slate-950/60 hover:bg-emerald-500/10 text-transparent';
      checkboxWrapper.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[2.5]"></i>';
    }
    checkboxWrapper.onclick = (e) => {
      e.stopPropagation();
      toggleTaskComplete(task.id);
    };
  }

  // Content Area: Title, Time, Note, Per-Set Checkboxes, Completed Timestamp
  const contentArea = document.createElement('div');
  contentArea.className = 'flex-1 min-w-0 flex flex-col gap-1 cursor-pointer';
  contentArea.onclick = () => openEditModal(task.id);

  // Title line with Gym Order & ★ Key badge support
  const titleEl = document.createElement('div');
  titleEl.className = `text-sm font-medium leading-snug break-words ${
    isCompleted ? 'line-through text-slate-400 italic' : 'text-slate-100'
  }`;
  if (isGymExercise && Number(task.gymOrder) > 0) {
    const orderBadge = document.createElement('span');
    orderBadge.className = 'tabular-nums inline-block text-xs font-bold text-slate-500 mr-1.5 not-italic no-underline';
    orderBadge.textContent = `${task.gymOrder}.`;
    titleEl.appendChild(orderBadge);
  }
  if (isGymExercise && task.gymIsKey) {
    const starBadge = document.createElement('span');
    starBadge.className = 'inline-flex items-center gap-0.5 align-middle text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/35 mr-1.5 not-italic no-underline';
    starBadge.textContent = '★';
    starBadge.title = 'Bài chủ lực theo dõi tăng tạ';
    titleEl.appendChild(starBadge);
  }
  titleEl.appendChild(document.createTextNode(task.title));

  // Metadata badges line
  const metaLine = document.createElement('div');
  metaLine.className = 'flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400';

  const today = getTodayDateStr();
  const taskDate = getTaskDate(task);
  const isOverdue = !isCompleted && Boolean(taskDate) && taskDate < today;

  if (options.showOverdueBadge && isOverdue) {
    const overdueBadge = document.createElement('span');
    overdueBadge.className = 'inline-flex items-center gap-1 font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20';
    overdueBadge.innerHTML = '<i data-lucide="alert-triangle" class="w-3 h-3"></i> Quá hạn';
    metaLine.appendChild(overdueBadge);
  }

  if (task.gymType === 'habit') {
    const habitBadge = document.createElement('span');
    habitBadge.className = 'inline-flex items-center gap-1 font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/25';
    habitBadge.innerHTML = '<i data-lucide="sparkles" class="w-3 h-3"></i> Thói quen Gym';
    metaLine.appendChild(habitBadge);
  }

  if (isGymExercise) {
    const setsRepsStr = task.gymSetsReps || (Number(task.gymSets) > 0 ? `${task.gymSets} × ${task.gymReps || '10-12'}` : (task.gymReps || ''));
    if (setsRepsStr) {
      const setsBadge = document.createElement('span');
      setsBadge.className = 'tabular-nums inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/25';
      const restTxt = task.gymRest && task.gymRest !== '-' ? ` · ${task.gymRest}` : '';
      setsBadge.textContent = `${setsRepsStr}${restTxt}`;
      metaLine.appendChild(setsBadge);
    }
    if (task.gymGroupName) {
      const grpBadge = document.createElement('span');
      grpBadge.className = 'inline-flex items-center font-semibold text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-md border border-white/[0.06]';
      grpBadge.textContent = task.gymGroupName;
      metaLine.appendChild(grpBadge);
    }
  }

  if (task.time) {
    const timeBadge = document.createElement('span');
    timeBadge.className = 'tabular-nums inline-flex items-center gap-1 font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20';
    timeBadge.innerHTML = `<i data-lucide="clock" class="w-3 h-3"></i> ${escapeHtml(task.time)}`;
    metaLine.appendChild(timeBadge);
  }

  if (isCompleted && task.completedAt) {
    const completedBadge = document.createElement('span');
    completedBadge.className = 'tabular-nums inline-flex items-center gap-1 font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20';
    completedBadge.innerHTML = `<i data-lucide="check-check" class="w-3 h-3"></i> Xong lúc ${escapeHtml(formatTime(task.completedAt))}`;
    metaLine.appendChild(completedBadge);
  }

  if (task.note && !isGymExercise) {
    const noteBadge = document.createElement('span');
    noteBadge.className = 'inline-flex items-center gap-1 text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md max-w-[180px] sm:max-w-[220px] truncate';
    noteBadge.innerHTML = `<i data-lucide="file-text" class="w-3 h-3 text-blue-400 flex-shrink-0"></i> ${escapeHtml(task.note)}`;
    metaLine.appendChild(noteBadge);
  }

  contentArea.appendChild(titleEl);

  // Machine subtitle line for Gym exercises
  if (isGymExercise && task.gymMachine) {
    const machineEl = document.createElement('div');
    machineEl.className = 'text-[11px] text-slate-400 leading-snug break-words';
    machineEl.textContent = `Máy: ${task.gymMachine}`;
    contentArea.appendChild(machineEl);
  }

  if (metaLine.childNodes.length > 0) {
    contentArea.appendChild(metaLine);
  }

  // Per-Set Sub-Checkboxes inside every Gym exercise card (BOTH pending & completed)
  if (isGymExercise && totalSets > 0) {
    const setPct = Math.round((doneSets / totalSets) * 100);
    const setSection = document.createElement('div');
    setSection.className = 'mt-1.5 pt-2 border-t border-white/[0.06] flex flex-col gap-1.5';
    setSection.onclick = (e) => e.stopPropagation();

    const setHeaderRow = document.createElement('div');
    setHeaderRow.className = 'flex items-center justify-between gap-2';

    const setCountBadge = document.createElement('span');
    setCountBadge.className = `tabular-nums inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
      doneSets === totalSets
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
        : (doneSets > 0
            ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
            : 'bg-slate-950/80 text-slate-400 border-white/[0.08]')
    }`;
    setCountBadge.textContent = doneSets === totalSets
      ? `✓ ${doneSets}/${totalSets} hiệp`
      : `${doneSets}/${totalSets} hiệp`;

    const setHintEl = document.createElement('span');
    setHintEl.className = `tabular-nums text-[10px] font-semibold ${
      doneSets === totalSets ? 'text-emerald-400' : (doneSets > 0 ? 'text-cyan-300' : 'text-slate-500')
    }`;
    setHintEl.textContent = doneSets === totalSets
      ? 'Đủ hiệp'
      : `Tick từng hiệp (${setPct}%)`;

    setHeaderRow.appendChild(setCountBadge);
    setHeaderRow.appendChild(setHintEl);
    setSection.appendChild(setHeaderRow);

    // 3px progress bar
    const progTrack = document.createElement('div');
    progTrack.className = 'w-full h-[3px] rounded-full bg-slate-800/90 overflow-hidden';
    const progFill = document.createElement('div');
    progFill.className = `h-full rounded-full transition-[width] duration-200 ease-out ${
      doneSets === totalSets
        ? 'bg-emerald-400'
        : 'bg-gradient-to-r from-amber-400 to-cyan-400'
    }`;
    progFill.style.width = `${setPct}%`;
    progTrack.appendChild(progFill);
    setSection.appendChild(progTrack);

    // Thumb-friendly row of set pills ([☐ Hiệp 1], [☑ Hiệp 2], [☐ Hiệp 3]...)
    const pillsRow = document.createElement('div');
    pillsRow.className = 'flex flex-wrap items-center gap-1.5 pt-0.5';

    for (let idx = 0; idx < totalSets; idx += 1) {
      const checked = Boolean(setChecks[idx]);
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.setAttribute('aria-pressed', checked ? 'true' : 'false');
      pill.className = `min-h-[34px] px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95 select-none whitespace-nowrap tabular-nums border ${
        checked
          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/30 shadow-sm shadow-emerald-950/30'
          : 'bg-slate-950/90 text-slate-300 border-white/[0.12] hover:border-emerald-500/40 hover:bg-slate-800/90'
      }`;

      const boxSpan = document.createElement('span');
      boxSpan.className = `w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-colors ${
        checked
          ? 'bg-emerald-500 text-slate-950'
          : 'border border-slate-500 bg-slate-900/90'
      }`;
      if (checked) {
        boxSpan.innerHTML = '<svg viewBox="0 0 12 12" class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 6.3 4.8 8.9 9.8 3.3"/></svg>';
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `Hiệp ${idx + 1}`;

      pill.appendChild(boxSpan);
      pill.appendChild(labelSpan);
      pill.onclick = (e) => {
        e.stopPropagation();
        toggleExerciseSet(task.id, idx);
      };

      pillsRow.appendChild(pill);
    }

    setSection.appendChild(pillsRow);
    contentArea.appendChild(setSection);
  }

  // Inline compact [ ___ kg ] weight logger right on the task card for gym exercises
  if (task.gymType === 'exercise' && task.gymGroupId !== 'rest_sunday') {
    const prevWeight = window.GymPlan && task.gymExerciseId
      ? window.GymPlan.getLatestExerciseWeight(gymData, appData.tasks, task.gymExerciseId, taskDate)
      : null;
    const savedWeight = window.GymPlan
      ? (window.GymPlan.parsePositiveWeight(task.gymWeightKg) ??
         window.GymPlan.parsePositiveWeight(gymData?.dailyLogs?.[taskDate]?.weights?.[task.gymExerciseId]))
      : null;

    const weightRow = document.createElement('div');
    weightRow.className = 'flex flex-wrap items-center gap-1.5 mt-1';
    weightRow.onclick = (e) => e.stopPropagation();

    const weightWrap = document.createElement('div');
    weightWrap.className = `inline-flex items-center gap-1 max-w-full min-w-0 rounded-lg px-1.5 sm:px-2 py-1 border transition-colors ${
      savedWeight !== null
        ? 'bg-emerald-500/10 border-emerald-500/35'
        : (task.gymIsKey ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/90 border-white/[0.1]')
    }`;

    const kgLabel = document.createElement('span');
    kgLabel.className = `text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${task.gymIsKey ? 'text-amber-300' : 'text-slate-400'}`;
    kgLabel.textContent = task.gymIsKey ? '★ Tạ:' : 'Tạ:';

    const kgInput = document.createElement('input');
    kgInput.type = 'number';
    kgInput.step = '0.5';
    kgInput.min = '0';
    kgInput.setAttribute('inputmode', 'decimal');
    kgInput.className = 'tabular-nums w-[92px] sm:w-[120px] min-w-0 bg-transparent text-[11px] sm:text-xs font-bold text-white placeholder-slate-500 focus:outline-none';
    kgInput.placeholder = prevWeight !== null ? `Lần trước: ${prevWeight}kg` : 'Nhập kg...';
    if (savedWeight !== null) {
      kgInput.value = String(savedWeight);
    }
    kgInput.onclick = (e) => e.stopPropagation();
    kgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        kgInput.blur();
      }
    });
    const commitWeight = () => {
      updateExerciseTaskWeight(task.id, kgInput.value);
      const valNum = window.GymPlan ? window.GymPlan.parsePositiveWeight(kgInput.value) : null;
      weightWrap.className = `inline-flex items-center gap-1 max-w-full min-w-0 rounded-lg px-1.5 sm:px-2 py-1 border transition-colors ${
        valNum !== null
          ? 'bg-emerald-500/10 border-emerald-500/35'
          : (task.gymIsKey ? 'bg-amber-500/10 border-amber-500/30' : 'bg-slate-950/90 border-white/[0.1]')
      }`;
    };
    kgInput.addEventListener('change', commitWeight);
    kgInput.addEventListener('blur', commitWeight);

    const kgUnit = document.createElement('span');
    kgUnit.className = 'text-[10px] font-semibold text-slate-400';
    kgUnit.textContent = 'kg';

    weightWrap.appendChild(kgLabel);
    weightWrap.appendChild(kgInput);
    weightWrap.appendChild(kgUnit);
    weightRow.appendChild(weightWrap);

    if (prevWeight !== null && savedWeight !== null) {
      const diff = Math.round((savedWeight - prevWeight) * 10) / 10;
      const hintSpan = document.createElement('span');
      hintSpan.className = `tabular-nums text-[10px] font-semibold ${diff > 0 ? 'text-emerald-400' : (diff < 0 ? 'text-rose-400' : 'text-slate-400')}`;
      hintSpan.textContent = diff > 0
        ? `+${diff}kg (Trước: ${prevWeight}kg)`
        : (diff < 0 ? `${diff}kg (Trước: ${prevWeight}kg)` : `Trước: ${prevWeight}kg`);
      weightRow.appendChild(hintSpan);
    }

    contentArea.appendChild(weightRow);
  }

  // Action Buttons Group (Về hôm nay / Dời mai, Sửa, Xóa)
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'flex items-center gap-1 flex-shrink-0 self-start sm:self-center';

  if (!isCompleted) {
    const moveBtn = document.createElement('button');
    moveBtn.type = 'button';
    if (isOverdue) {
      moveBtn.className = 'px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/30 transition-colors flex items-center gap-1 active:scale-95 whitespace-nowrap';
      moveBtn.title = 'Dời công việc về hôm nay';
      moveBtn.innerHTML = '<i data-lucide="calendar-check" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Về hôm nay</span>';
      moveBtn.onclick = (e) => {
        e.stopPropagation();
        moveTaskToToday(task.id);
      };
    } else {
      moveBtn.className = 'px-2 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-white/[0.06] transition-colors flex items-center gap-1 active:scale-95 whitespace-nowrap';
      moveBtn.title = 'Dời công việc sang ngày mai';
      moveBtn.innerHTML = '<i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> <span class="hidden sm:inline">Dời mai</span>';
      moveBtn.onclick = (e) => {
        e.stopPropagation();
        moveTaskToTomorrow(task.id);
      };
    }
    actionsGroup.appendChild(moveBtn);
  }

  // Edit Button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors active:scale-95';
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
  deleteBtn.className = 'p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors active:scale-95';
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

function renderAllTasksView() {
  const allTasks = Array.isArray(appData.tasks) ? appData.tasks : [];
  const today = getTodayDateStr();

  const totalCount = allTasks.length;
  const pendingCount = allTasks.filter(t => !t.completed).length;
  const overdueCount = allTasks.filter(t => {
    const d = getTaskDate(t);
    return !t.completed && Boolean(d) && d < today;
  }).length;
  const doneCount = allTasks.filter(t => !!t.completed).length;

  const badgeAll = document.getElementById('badgeAllTasksTotal');
  if (badgeAll) badgeAll.textContent = String(totalCount);

  const countTotalEl = document.getElementById('allCountTotal');
  const countPendingEl = document.getElementById('allCountPending');
  const countOverdueEl = document.getElementById('allCountOverdue');
  const countDoneEl = document.getElementById('allCountDone');
  if (countTotalEl) countTotalEl.textContent = String(totalCount);
  if (countPendingEl) countPendingEl.textContent = String(pendingCount);
  if (countOverdueEl) countOverdueEl.textContent = String(overdueCount);
  if (countDoneEl) countDoneEl.textContent = String(doneCount);

  // Highlight active KPI filter card
  const filterButtons = [
    { id: 'btnAllFilterAll', key: 'all', active: 'bg-emerald-600/20 border border-emerald-500 ring-1 ring-emerald-500/40', inactive: 'bg-slate-900/90 border border-white/[0.08] hover:border-emerald-500/40' },
    { id: 'btnAllFilterPending', key: 'pending', active: 'bg-amber-600/20 border border-amber-400 ring-1 ring-amber-400/40', inactive: 'bg-slate-900/90 border border-white/[0.08] hover:border-amber-500/40' },
    { id: 'btnAllFilterOverdue', key: 'overdue', active: 'bg-rose-600/20 border border-rose-400 ring-1 ring-rose-400/40', inactive: 'bg-slate-900/90 border border-white/[0.08] hover:border-rose-500/40' },
    { id: 'btnAllFilterDone', key: 'completed', active: 'bg-cyan-600/20 border border-cyan-400 ring-1 ring-cyan-400/40', inactive: 'bg-slate-900/90 border border-white/[0.08] hover:border-cyan-500/40' }
  ];
  filterButtons.forEach(item => {
    const btn = document.getElementById(item.id);
    if (!btn) return;
    const isSelected = allFilterStatus === item.key;
    btn.className = `flex flex-col items-start justify-between p-3 rounded-2xl text-left transition-colors active:scale-95 ${isSelected ? item.active : item.inactive}`;
  });

  // Update time range buttons
  document.querySelectorAll('[data-all-range]').forEach(btn => {
    const rangeVal = btn.getAttribute('data-all-range');
    const isActive = rangeVal === allTimeRange;
    btn.className = isActive
      ? 'flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white transition-colors active:scale-95'
      : 'flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800/80 text-slate-300 hover:text-white border border-white/[0.06] transition-colors active:scale-95';
  });

  const labelSortEl = document.getElementById('labelAllTasksSort');
  if (labelSortEl) {
    labelSortEl.textContent = allSortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước';
  }

  const btnClearSearch = document.getElementById('btnClearAllSearch');
  if (btnClearSearch) {
    btnClearSearch.classList.toggle('hidden', !allSearchQuery);
  }

  const btnMoveOverdue = document.getElementById('btnMoveAllOverdueFromAll');
  if (btnMoveOverdue) {
    btnMoveOverdue.classList.toggle('hidden', overdueCount === 0);
    btnMoveOverdue.innerHTML = `<i data-lucide="calendar-check" class="w-3.5 h-3.5"></i><span>Dời ${overdueCount} quá hạn về hôm nay</span>`;
  }

  const container = document.getElementById('containerAllTasksGrouped');
  const emptyState = document.getElementById('emptyAllTasksState');
  if (!container || !emptyState) return;

  const q = (allSearchQuery || '').toLowerCase().trim();
  const min7d = addDaysToDateStr(today, -7);
  const min30d = addDaysToDateStr(today, -30);

  const filteredTasks = allTasks.filter(t => {
    const d = getTaskDate(t);
    if (allFilterStatus === 'pending' && t.completed) return false;
    if (allFilterStatus === 'overdue' && (t.completed || !d || d >= today)) return false;
    if (allFilterStatus === 'completed' && !t.completed) return false;

    if (allTimeRange === 'past' && (!d || d >= today)) return false;
    if (allTimeRange === 'upcoming' && (!d || d < today)) return false;
    if (allTimeRange === '7d' && (!d || d < min7d || d > today)) return false;
    if (allTimeRange === '30d' && (!d || d < min30d || d > today)) return false;

    if (q) {
      const titleMatch = (t.title || '').toLowerCase().includes(q);
      const noteMatch = (t.note || '').toLowerCase().includes(q);
      const dateMatch = d.includes(q) || (d ? formatFullVNDate(d).toLowerCase().includes(q) : false);
      if (!titleMatch && !noteMatch && !dateMatch) return false;
    }
    return true;
  });

  container.innerHTML = '';
  if (filteredTasks.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // Group filtered tasks by date
  const grouped = {};
  filteredTasks.forEach(t => {
    const d = getTaskDate(t) || 'unknown';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  });

  const sortedDates = Object.keys(grouped).sort();
  if (allSortOrder === 'desc') sortedDates.reverse();

  sortedDates.forEach(dateStr => {
    const groupTasks = grouped[dateStr].slice().sort((a, b) => {
      if (Boolean(a.completed) !== Boolean(b.completed)) {
        return a.completed ? 1 : -1;
      }
      const aIsEx = a.gymType === 'exercise' ? 1 : 0;
      const bIsEx = b.gymType === 'exercise' ? 1 : 0;
      if (aIsEx === 1 && bIsEx === 1) {
        const ordDiff = (Number(a.gymOrder) || 999) - (Number(b.gymOrder) || 999);
        if (ordDiff !== 0) return ordDiff;
      }
      return (a.time || a.dueTime || '').localeCompare(b.time || b.dueTime || '');
    });

    const total = groupTasks.length;
    const done = groupTasks.filter(t => t.completed).length;
    const hasOverdue = dateStr !== 'unknown' && dateStr < today && done < total;
    const isCollapsed = collapsedAllDates.has(dateStr);

    const groupCard = document.createElement('div');
    groupCard.className = `rounded-2xl border bg-slate-900/75 shadow-md overflow-hidden transition ${
      hasOverdue ? 'border-amber-500/30' : 'border-white/10'
    }`;

    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-950/60 cursor-pointer select-none hover:bg-slate-900/80 transition';
    header.onclick = () => {
      if (collapsedAllDates.has(dateStr)) collapsedAllDates.delete(dateStr);
      else collapsedAllDates.add(dateStr);
      renderAllTasksView();
      refreshIcons();
    };

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2 min-w-0';

    const chevron = document.createElement('i');
    chevron.setAttribute('data-lucide', isCollapsed ? 'chevron-right' : 'chevron-down');
    chevron.className = 'w-4 h-4 text-slate-400 flex-shrink-0';

    const relBadge = document.createElement('span');
    if (dateStr === today) {
      relBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex-shrink-0';
    } else if (hasOverdue) {
      relBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex-shrink-0';
    } else if (dateStr > today) {
      relBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex-shrink-0';
    } else {
      relBadge.className = 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex-shrink-0';
    }
    relBadge.textContent = dateStr === 'unknown' ? 'Khác' : getRelativeDateLabel(dateStr);

    const dateTitle = document.createElement('span');
    dateTitle.className = 'text-xs sm:text-sm font-bold text-white truncate';
    dateTitle.textContent = dateStr === 'unknown' ? 'Chưa gắn ngày' : formatFullVNDate(dateStr);

    left.appendChild(chevron);
    left.appendChild(relBadge);
    left.appendChild(dateTitle);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 flex-shrink-0 ml-auto';

    const ratioPill = document.createElement('span');
    if (done === total && total > 0) {
      ratioPill.className = 'tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap';
      ratioPill.textContent = `✓ ${done}/${total}`;
    } else {
      ratioPill.className = 'tabular-nums text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-white/[0.08] whitespace-nowrap';
      ratioPill.textContent = `${done}/${total}`;
    }
    right.appendChild(ratioPill);

    if (dateStr !== 'unknown') {
      const btnGoDay = document.createElement('button');
      btnGoDay.type = 'button';
      btnGoDay.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-white/[0.08] transition-colors active:scale-95 whitespace-nowrap';
      btnGoDay.textContent = 'Xem ngày này';
      btnGoDay.onclick = (e) => {
        e.stopPropagation();
        selectedDate = dateStr;
        setChecklistViewMode('day');
      };
      right.appendChild(btnGoDay);
    }

    header.appendChild(left);
    header.appendChild(right);
    groupCard.appendChild(header);

    if (!isCollapsed) {
      const listWrap = document.createElement('div');
      listWrap.className = 'p-2.5 flex flex-col gap-2 border-t border-white/5';
      groupTasks.forEach(task => {
        listWrap.appendChild(createTaskCardElement(task, !!task.completed, { showOverdueBadge: true }));
      });
      groupCard.appendChild(listWrap);
    }

    container.appendChild(groupCard);
  });
}

// ==========================================
// 6.5 GYM PLAN 6 BUỔI (QUICK BAR, NHÓM TẬP, REVIEW 12 TUẦN & SHEETS SYNC)
// ==========================================
function renderGymQuickBar() {
  if (!window.GymPlan) return;
  const selectEl = document.getElementById('selectQuickGymGroup');
  const progressBadge = document.getElementById('gymQuickWorkoutProgress');
  const applyBtn = document.getElementById('btnQuickApplyGymGroup');
  const clearBtn = document.getElementById('btnQuickClearGymGroup');
  if (!selectEl) return;

  const groups = Array.isArray(gymData.workoutGroups) && gymData.workoutGroups.length > 0
    ? gymData.workoutGroups
    : window.GymPlan.DEFAULT_WORKOUT_GROUPS;

  const summary = window.GymPlan.getDayHabitSummary(selectedDate, gymData, appData.tasks);
  const suggested = window.GymPlan.getSuggestedGroupForDate(selectedDate, groups);
  const preferredId = summary.workoutGroupId || suggested?.id || groups[0]?.id || '';

  // Repopulate dropdown preserving user's choice if same date, otherwise defaulting to active/suggested group
  const prevDateAttr = selectEl.getAttribute('data-for-date');
  const currentVal = selectEl.value;
  selectEl.innerHTML = groups.map((g) => {
    const exList = Array.isArray(g.exercises) ? g.exercises : [];
    const exLen = exList.length;
    const totalSets = exList.reduce((s, e) => s + (Number(e.sets) > 0 ? Number(e.sets) : 0), 0);
    const setsHint = totalSets > 0 ? ` · ${totalSets} hiệp` : '';
    const tag = g.id === suggested?.id ? ' ★ Gợi ý' : '';
    return `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)} (${exLen} bài${setsHint})${tag}</option>`;
  }).join('');

  if (prevDateAttr === selectedDate && currentVal && groups.some(g => g.id === currentVal)) {
    selectEl.value = currentVal;
  } else if (preferredId && groups.some(g => g.id === preferredId)) {
    selectEl.value = preferredId;
  }
  selectEl.setAttribute('data-for-date', selectedDate);

  const hasExercisesOnDate = (appData.tasks || []).some(
    t => getTaskDate(t) === selectedDate && t.gymType === 'exercise'
  );

  // Active workout progress badge (e.g. T5 - Push B · 0/7 bài · 0/21 hiệp)
  if (progressBadge) {
    if (hasExercisesOnDate && summary.exerciseTotalCount > 0) {
      const grpLabel = summary.workoutGroupName || 'Buổi tập';
      const allDone = summary.exerciseDoneCount === summary.exerciseTotalCount && summary.setsDone === summary.setsTarget && summary.setsTarget > 0;
      const inProgress = summary.setsDone > 0 && !allDone;
      progressBadge.textContent = `${allDone ? '✓ ' : ''}${grpLabel} · ${summary.exerciseDoneCount}/${summary.exerciseTotalCount} bài · ${summary.setsDone}/${summary.setsTarget} hiệp`;
      progressBadge.className = `tabular-nums text-[11px] font-bold px-2.5 py-0.5 rounded-full border max-w-full truncate ${
        allDone
          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          : (inProgress
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
              : 'bg-slate-800/90 text-slate-200 border-white/[0.1]')
      }`;
    } else if (gymData?.dailyLogs?.[selectedDate]?.clearedWorkout) {
      progressBadge.textContent = 'Đã bỏ buổi tập ngày này';
      progressBadge.className = 'tabular-nums text-[11px] font-semibold px-2.5 py-0.5 rounded-full border bg-slate-800/80 text-slate-400 border-white/[0.08] max-w-full truncate';
    } else {
      progressBadge.className = 'hidden tabular-nums text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 max-w-full truncate';
    }
  }

  // Update apply button text & toggle compact clear workout button
  if (applyBtn) {
    const span = applyBtn.querySelector('span');
    if (span) {
      span.textContent = hasExercisesOnDate ? 'Đổi buổi' : '+ Nạp / Đổi buổi';
    }
  }

  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !hasExercisesOnDate);
  }
}

function maybeAutoLoadTodaysWorkout(shouldSyncCloud = true) {
  if (!window.GymPlan) return false;
  const todayStr = getTodayDateStr();
  if (autoPopulatedWorkoutDates.has(todayStr)) return false;

  const todayObj = parseDateStr(todayStr);
  const dow = todayObj.getDay(); // 0=CN, 1=T2..6=T7
  if (dow < 1 || dow > 6) {
    autoPopulatedWorkoutDates.add(todayStr);
    return false;
  }

  const todayExercises = (appData.tasks || []).filter(
    t => getTaskDate(t) === todayStr && t.gymType === 'exercise'
  );
  if (todayExercises.length > 0) {
    autoPopulatedWorkoutDates.add(todayStr);
    return false;
  }

  if (gymData?.dailyLogs?.[todayStr]?.clearedWorkout) {
    autoPopulatedWorkoutDates.add(todayStr);
    return false;
  }

  const groups = Array.isArray(gymData.workoutGroups) && gymData.workoutGroups.length > 0
    ? gymData.workoutGroups
    : window.GymPlan.DEFAULT_WORKOUT_GROUPS;
  const suggested = window.GymPlan.getSuggestedGroupForDate(todayStr, groups);
  if (!suggested || suggested.isRestDay || !Array.isArray(suggested.exercises) || suggested.exercises.length === 0) {
    autoPopulatedWorkoutDates.add(todayStr);
    return false;
  }

  autoPopulatedWorkoutDates.add(todayStr);
  const { tasksToAdd } = window.GymPlan.createWorkoutTasksForDate(
    todayStr,
    suggested,
    appData.tasks,
    gymData
  );
  if (tasksToAdd.length === 0) return false;

  appData.tasks.push(...tasksToAdd);

  const now = Date.now();
  const log = ensureGymDailyLog(todayStr);
  if (log) {
    log.workoutGroupId = suggested.id;
    log.groupId = suggested.id;
    log.workoutGroupName = suggested.name;
    log.groupName = suggested.name;
    log.clearedWorkout = false;
    log.updatedAt = now;
  }
  gymData.updatedAt = now;
  appData.updatedAt = now;

  saveLocalGymData(true);
  localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  saveLocalData();
  renderApp();

  if (shouldSyncCloud) {
    triggerCloudSync();
  }
  showToast(`🏋️ Tự động nạp buổi tập hôm nay: ${suggested.name} (${tasksToAdd.length} bài)`, 'info');
  return true;
}

function clearGymWorkoutForDate(dateStr) {
  const targetDate = dateStr || selectedDate;
  const exerciseTasks = (appData.tasks || []).filter(
    t => getTaskDate(t) === targetDate && t.gymType === 'exercise'
  );
  if (exerciseTasks.length === 0) {
    showToast('Ngày này chưa có bài tập gym nào để bỏ.', 'info');
    return;
  }

  const removeIds = exerciseTasks.map(t => t.id);
  const removeSet = new Set(removeIds);
  appData.tasks = appData.tasks.filter(t => !removeSet.has(t.id));

  if (!Array.isArray(appData.deletedIds)) {
    appData.deletedIds = [];
  }
  const deletedIdsSet = new Set(appData.deletedIds);
  removeIds.forEach(id => deletedIdsSet.add(id));
  appData.deletedIds = Array.from(deletedIdsSet);

  const now = Date.now();
  const log = ensureGymDailyLog(targetDate);
  if (log) {
    log.clearedWorkout = true;
    log.workoutGroupId = null;
    log.groupId = null;
    log.workoutGroupName = '';
    log.groupName = '';
    log.setProgress = {};
    log.completedExercises = {};
    log.exerciseDone = {};
    log.updatedAt = now;
  }
  gymData.updatedAt = now;
  appData.updatedAt = now;

  autoPopulatedWorkoutDates.add(targetDate);
  saveLocalGymData(true);
  localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  saveLocalData();
  renderApp();
  triggerCloudSync();
  showToast(`Đã bỏ buổi tập (${removeIds.length} bài) của ngày ${formatShortVNDate(targetDate)}.`, 'info');
}

function applyGymGroupToDate(groupId, dateStr, switchToDayAfter = false) {
  if (!window.GymPlan || !groupId) return;
  const targetDate = dateStr || selectedDate;
  const groups = gymData.workoutGroups || window.GymPlan.DEFAULT_WORKOUT_GROUPS;
  const group = groups.find(g => g.id === groupId);
  if (!group) {
    showToast('Không tìm thấy nhóm tập đã chọn!', 'error');
    return;
  }

  const { tasksToAdd, replacedIds } = window.GymPlan.createWorkoutTasksForDate(
    targetDate,
    group,
    appData.tasks,
    gymData
  );

  // Cleanly remove uncompleted old exercise tasks on targetDate (recording tombstones for cloud sync)
  if (replacedIds.length > 0) {
    const repSet = new Set(replacedIds);
    appData.tasks = appData.tasks.filter(t => !repSet.has(t.id));
    if (!Array.isArray(appData.deletedIds)) appData.deletedIds = [];
    const deletedIdsSet = new Set(appData.deletedIds);
    replacedIds.forEach(id => deletedIdsSet.add(id));
    appData.deletedIds = Array.from(deletedIdsSet);
  }

  if (tasksToAdd.length > 0) {
    // Keep exercises in clean 1..N order
    appData.tasks.push(...tasksToAdd);
  }

  const now = Date.now();
  const log = ensureGymDailyLog(targetDate);
  if (log) {
    log.workoutGroupId = group.id;
    log.groupId = group.id;
    log.workoutGroupName = group.name;
    log.groupName = group.name;
    log.clearedWorkout = false;
    log.updatedAt = now;
  }
  gymData.updatedAt = now;
  appData.updatedAt = now;

  autoPopulatedWorkoutDates.add(targetDate);
  saveLocalGymData(true);
  localStorage.setItem(STORAGE_KEY_GYM_DIRTY, '1');
  saveLocalData();

  if (switchToDayAfter) {
    selectedDate = targetDate;
    setChecklistViewMode('day');
  } else {
    renderApp();
  }

  triggerCloudSync();
  const actionVerb = replacedIds.length > 0 ? 'Đã đổi sang' : 'Đã nạp';
  showToast(`✓ ${actionVerb} "${group.name}" (${tasksToAdd.length} bài) vào ${formatShortVNDate(targetDate)}!`, 'success');
}

function setGymSubTab(tab) {
  gymSubTab = tab === 'review' ? 'review' : 'groups';
  const groupsView = document.getElementById('gymSubGroupsView');
  const reviewView = document.getElementById('gymSubReviewView');
  const btnGroups = document.getElementById('btnGymSubGroups');
  const btnReview = document.getElementById('btnGymSubReview');

  if (groupsView) groupsView.classList.toggle('hidden', gymSubTab !== 'groups');
  if (reviewView) reviewView.classList.toggle('hidden', gymSubTab !== 'review');

  const activeCls = 'flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-[8px] text-xs font-bold whitespace-nowrap transition-colors duration-150 bg-emerald-600 text-white active:scale-[0.99]';
  const inactiveCls = 'flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-[8px] text-xs font-semibold whitespace-nowrap transition-colors duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 active:scale-[0.99]';

  if (btnGroups) btnGroups.className = gymSubTab === 'groups' ? activeCls : inactiveCls;
  if (btnReview) btnReview.className = gymSubTab === 'review' ? activeCls : inactiveCls;

  renderGymSection();
}

function renderGymSection() {
  if (!window.GymPlan) return;
  if (gymSubTab === 'review') {
    renderGymReviewView();
  } else {
    renderGymGroupsView();
  }
  refreshIcons();
}

function renderGymGroupsView() {
  const container = document.getElementById('containerGymGroupsList');
  const metaEl = document.getElementById('labelGymGroupsMeta');
  if (!container || !window.GymPlan) return;

  const groups = Array.isArray(gymData.workoutGroups) && gymData.workoutGroups.length > 0
    ? gymData.workoutGroups
    : window.GymPlan.DEFAULT_WORKOUT_GROUPS;

  const activeGroups = groups.filter(g => !g.isRestDay);
  const totalExercises = activeGroups.reduce((sum, g) => sum + (g.exercises?.length || 0), 0);
  const totalKeyLifts = activeGroups.reduce((sum, g) => sum + (g.exercises || []).filter(e => e.isKey).length, 0);
  const totalSets = activeGroups.reduce((sum, g) => sum + (g.exercises || []).reduce((s, e) => s + (Number(e.sets) || 0), 0), 0);

  if (metaEl) {
    metaEl.textContent = `${groups.length} nhóm • ${totalExercises} bài tập • ${totalKeyLifts} bài ★ • ${totalSets} hiệp/tuần`;
  }

  const today = getTodayDateStr();
  const daySummary = window.GymPlan.getDayHabitSummary(selectedDate, gymData, appData.tasks);
  const isTodaySelected = selectedDate === today;
  const applyBaseLabel = daySummary.exerciseTotalCount > 0
    ? (isTodaySelected ? 'Đổi buổi hôm nay' : `Đổi buổi ${formatShortVNDate(selectedDate)}`)
    : (isTodaySelected ? 'Nạp vào hôm nay' : `Nạp vào ${formatShortVNDate(selectedDate)}`);

  container.innerHTML = groups.map((group) => {
    const isExpanded = expandedGymGroupIds.has(group.id);
    const exercises = Array.isArray(group.exercises) ? group.exercises : [];
    const groupSets = exercises.reduce((s, e) => s + (Number(e.sets) || 0), 0);
    const groupKeys = exercises.filter(e => e.isKey).length;
    const isLoadedToday = daySummary.workoutGroupId === group.id && daySummary.exerciseTotalCount > 0;
    const groupIdEsc = escapeHtml(group.id);

    const exercisesHtml = isExpanded ? `
      <div class="border-t border-white/[0.06] bg-slate-950/50 p-3 flex flex-col gap-2">
        ${group.priorityNote ? `
          <div class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5 flex-shrink-0"></i>
            <span>${escapeHtml(group.priorityNote)}</span>
          </div>
        ` : ''}
        <div class="flex flex-col gap-1.5">
          ${exercises.length === 0 ? `
            <p class="text-xs text-slate-500 text-center py-3">Nhóm này chưa có bài tập nào. Thêm bài tập ở form bên dưới!</p>
          ` : exercises.map((ex, idx) => {
            const exIdEsc = escapeHtml(ex.id);
            const latestKg = window.GymPlan.getLatestExerciseWeight(gymData, appData.tasks, ex.id, '');
            const setsText = Number(ex.sets) > 0 ? `${ex.sets} × ${ex.reps || '10-12'}` : (ex.reps || '');
            return `
              <div class="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-900/90 border border-white/[0.06]">
                <div class="flex items-start gap-2 min-w-0 flex-1">
                  <button type="button" data-gym-toggle-key="${groupIdEsc}::${exIdEsc}" class="mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors active:scale-90 ${
                    ex.isKey
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : 'bg-slate-950/80 text-slate-600 hover:text-amber-300 border-white/[0.08]'
                  }" title="Đánh dấu bài chủ lực ★">★</button>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-semibold text-slate-100 leading-snug break-words">
                      <span class="tabular-nums text-slate-500 mr-1">${idx + 1}.</span>${escapeHtml(ex.name)}
                    </div>
                    ${ex.machine ? `<div class="text-[11px] text-slate-400 mt-0.5 break-words">Máy: ${escapeHtml(ex.machine)}</div>` : ''}
                    ${ex.alt ? `<div class="text-[10px] text-slate-500 mt-0.5 break-words">Thay thế: ${escapeHtml(ex.alt)}</div>` : ''}
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                      ${setsText ? `<span class="tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">${escapeHtml(setsText)}${ex.rest && ex.rest !== '-' ? ' · ' + escapeHtml(ex.rest) : ''}</span>` : ''}
                      ${latestKg !== null ? `<span class="tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">Gần nhất: ${latestKg}kg</span>` : ''}
                    </div>
                  </div>
                </div>
                <button type="button" data-gym-del-ex="${groupIdEsc}::${exIdEsc}" class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 flex-shrink-0 transition-colors" title="Xóa bài tập này">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Inline Add Custom Exercise Form -->
        <form data-gym-add-ex-form="${groupIdEsc}" class="mt-1 p-2.5 rounded-xl bg-slate-900/80 border border-dashed border-white/[0.12] flex flex-col gap-2">
          <div class="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm bài tập vào "${escapeHtml(group.name)}"
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <input type="text" name="exName" required placeholder="Tên bài tập mới..." class="w-full bg-slate-950 text-xs text-white placeholder-slate-500 rounded-lg px-2.5 py-1.5 border border-white/[0.08] focus:outline-none focus:border-emerald-500">
            <input type="text" name="exMachine" placeholder="Máy tập / dụng cụ..." class="w-full bg-slate-950 text-xs text-white placeholder-slate-500 rounded-lg px-2.5 py-1.5 border border-white/[0.08] focus:outline-none focus:border-emerald-500">
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <input type="number" name="exSets" value="3" min="1" max="10" class="w-16 tabular-nums bg-slate-950 text-xs text-white rounded-lg px-2 py-1.5 border border-white/[0.08] focus:outline-none focus:border-emerald-500" title="Số hiệp">
            <input type="text" name="exReps" value="8-12" placeholder="Rep" class="w-20 bg-slate-950 text-xs text-white rounded-lg px-2 py-1.5 border border-white/[0.08] focus:outline-none focus:border-emerald-500" title="Số rep">
            <input type="text" name="exRest" value="90s" placeholder="Nghỉ" class="w-16 bg-slate-950 text-xs text-white rounded-lg px-2 py-1.5 border border-white/[0.08] focus:outline-none focus:border-emerald-500" title="Thời gian nghỉ">
            <label class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-1.5 rounded-lg border border-amber-500/25 cursor-pointer select-none">
              <input type="checkbox" name="exIsKey" class="accent-amber-400">
              <span>★ Chủ lực</span>
            </label>
            <button type="submit" class="ml-auto px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors active:scale-95 whitespace-nowrap">
              + Thêm bài
            </button>
          </div>
        </form>
      </div>
    ` : '';

    return `
      <div class="rounded-2xl bg-slate-900/90 border ${isLoadedToday ? 'border-emerald-500/45' : 'border-white/[0.08]'} overflow-hidden">
        <div class="p-3 flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2 cursor-pointer select-none" data-gym-toggle-group="${groupIdEsc}">
            <div class="flex items-start gap-2 min-w-0 flex-1">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style="background-color: ${escapeHtml(group.color || '#10b981')}"></span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-sm font-bold text-white">${escapeHtml(group.name)}</span>
                  ${isLoadedToday ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">Đang nạp</span>' : ''}
                  ${group.priorityLegs ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">Ưu tiên Chân</span>' : ''}
                </div>
                ${group.focus ? `<p class="text-[11px] text-slate-400 mt-0.5 line-clamp-2">${escapeHtml(group.focus)}</p>` : ''}
              </div>
            </div>
            <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-slate-400 flex-shrink-0 mt-1"></i>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-white/[0.05]">
            <div class="flex items-center gap-1.5 text-[10px] font-semibold tabular-nums text-slate-400">
              <span class="px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/[0.06] text-slate-300">${exercises.length} bài</span>
              ${groupSets > 0 ? `<span class="px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/[0.06] text-slate-300">${groupSets} hiệp</span>` : ''}
              ${groupKeys > 0 ? `<span class="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-300">${groupKeys} ★</span>` : ''}
            </div>

            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button type="button" data-gym-apply-group="${groupIdEsc}" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/35 text-emerald-300 text-[11px] font-bold whitespace-nowrap transition-colors active:scale-95">
                ${escapeHtml(applyBaseLabel)}
              </button>
              ${!group.isBuiltIn ? `
                <button type="button" data-gym-del-group="${groupIdEsc}" class="p-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-white/[0.06] transition-colors" title="Xóa nhóm tùy chỉnh">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
        ${exercisesHtml}
      </div>
    `;
  }).join('');
}

function renderGymReviewView() {
  if (!window.GymPlan) return;
  const analytics = window.GymPlan.computeWeeklyAnalytics(gymData, appData.tasks);
  const { baseline, weeks, totals, keyLiftsSummary, dailyHistory } = analytics;

  // 1. Summary subtitle
  const summaryEl = document.getElementById('labelGymProgramSummary');
  if (summaryEl) {
    const wtPart = totals.latestWeightKg !== null
      ? `Cân mới nhất: ${totals.latestWeightKg}kg (${window.GymPlan.formatSigned(totals.weightDeltaFromT0, 'kg')})`
      : `Mốc T0: ${baseline.weightKg}kg · SMM ${baseline.smmKg}kg`;
    summaryEl.textContent = `${totals.totalSessions} buổi (${totals.attendancePct}%) • ${totals.totalGreenDays} Ngày Xanh • ${totals.keyLiftsProgressedCount}/12 bài ★ tăng (+${totals.totalKeyLiftGainKg}kg) • ${wtPart}`;
  }

  // 2. Week selector dropdown T1..T12
  const weekSelect = document.getElementById('selectGymReviewWeek');
  if (weekSelect) {
    weekSelect.innerHTML = weeks.map((wk) => {
      const rangeStr = `${window.GymPlan.formatVnDateShort(wk.mondayDate)}–${window.GymPlan.formatVnDateShort(wk.sundayDate)}`;
      const tag = wk.hasActivity ? ` · ${wk.sessionsCount}/6` : '';
      return `<option value="${wk.weekNum}">${escapeHtml(wk.code)} (${rangeStr})${tag}</option>`;
    }).join('');
    weekSelect.value = String(selectedGymReviewWeek);
  }

  const wk = weeks[Math.max(0, Math.min(11, selectedGymReviewWeek - 1))] || weeks[0];
  if (!wk) return;

  const datesEl = document.getElementById('labelGymReviewWeekDates');
  if (datesEl) {
    datesEl.textContent = `CN ${window.GymPlan.formatVnDateShort(wk.sundayDate)}`;
  }

  // 3. 4 Compact KPI cards
  const kpiWorkouts = document.getElementById('gymKpiWorkouts');
  const kpiClean = document.getElementById('gymKpiCleanEat');
  const kpiSteps = document.getElementById('gymKpiStepsSleep');
  const kpiGreen = document.getElementById('gymKpiGreenDays');
  if (kpiWorkouts) kpiWorkouts.textContent = `${wk.sessionsCount}/6`;
  if (kpiClean) kpiClean.textContent = `${wk.cleanEatingDays}/7`;
  if (kpiSteps) kpiSteps.textContent = `${wk.stepsSleepDays}/7`;
  if (kpiGreen) kpiGreen.textContent = String(wk.greenDays);

  // 4. Sunday Check-in inputs (preserve active input focus if user is currently typing)
  const setValSafe = (id, val) => {
    const el = document.getElementById(id);
    if (!el || document.activeElement === el) return;
    el.value = val !== null && val !== undefined ? String(val) : '';
  };
  setValSafe('inputGymBaselineWaist', baseline.waistCm);
  setValSafe('inputGymWeekWeight', wk.weightKg);
  setValSafe('inputGymWeekWaist', wk.waistCm);
  setValSafe('inputGymWeekNote', wk.note);

  const feelSelect = document.getElementById('selectGymWeekFeel');
  if (feelSelect && document.activeElement !== feelSelect) {
    const curFeel = wk.strengthTrend || '';
    // Map legacy synonyms cleanly so dropdown displays matched option
    if (curFeel === 'Tăng đều') feelSelect.value = 'Tăng tốt';
    else if (curFeel === 'Giữ nguyên' || curFeel === 'Ổn định') feelSelect.value = 'Giữ ổn';
    else feelSelect.value = curFeel;
  }

  // Delta pills
  const deltaWeightEl = document.getElementById('gymDeltaWeightBadge');
  const deltaWaistEl = document.getElementById('gymDeltaWaistBadge');
  if (deltaWeightEl) {
    if (wk.weightDelta !== null) {
      deltaWeightEl.textContent = `Cân: ${window.GymPlan.formatSigned(wk.weightDelta, 'kg')}`;
      deltaWeightEl.classList.remove('hidden');
      deltaWeightEl.className = `px-2 py-0.5 rounded-full border ${wk.weightDelta <= 0 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`;
    } else {
      deltaWeightEl.classList.add('hidden');
    }
  }
  if (deltaWaistEl) {
    if (wk.waistDelta !== null) {
      deltaWaistEl.textContent = `Eo: ${window.GymPlan.formatSigned(wk.waistDelta, 'cm')}`;
      deltaWaistEl.classList.remove('hidden');
      deltaWaistEl.className = `px-2 py-0.5 rounded-full border ${wk.waistDelta <= -0.5 ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : (wk.waistDelta <= 0 ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' : 'bg-rose-500/15 text-rose-300 border-rose-500/30')}`;
    } else {
      deltaWaistEl.classList.add('hidden');
    }
  }

  // Auto-adjustment advice box
  const adviceBox = document.getElementById('boxGymAutoAdvice');
  const adviceText = document.getElementById('textGymAutoAdvice');
  if (adviceText) adviceText.textContent = wk.advice;
  if (adviceBox) {
    const toneMap = {
      emerald: 'rounded-xl p-2.5 bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2',
      amber: 'rounded-xl p-2.5 bg-amber-500/10 border border-amber-500/25 flex items-start gap-2',
      rose: 'rounded-xl p-2.5 bg-rose-500/10 border border-rose-500/25 flex items-start gap-2',
      cyan: 'rounded-xl p-2.5 bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-2',
      neutral: 'rounded-xl p-2.5 bg-slate-950/70 border border-white/[0.08] flex items-start gap-2'
    };
    adviceBox.className = toneMap[wk.adviceTone] || toneMap.neutral;
  }

  // 5. 12 ★ Key Lifts Inline Editable List
  const keyLiftsContainer = document.getElementById('containerGymKeyLifts');
  const klProgressBadge = document.getElementById('badgeGymKeyLiftsProgress');
  if (klProgressBadge) {
    klProgressBadge.textContent = `${wk.loggedKeyLiftsCount}/12 tuần ${wk.shortCode}`;
  }
  if (keyLiftsContainer) {
    keyLiftsContainer.innerHTML = keyLiftsSummary.map((kl) => {
      const weekVal = wk.keyLiftWeights[kl.exerciseId];
      const source = wk.keyLiftSources[kl.exerciseId];
      const gainStr = kl.gainKg !== null
        ? (kl.gainKg > 0 ? `+${kl.gainKg}kg` : (kl.gainKg < 0 ? `${kl.gainKg}kg` : '0kg'))
        : '—';
      const gainCls = kl.gainKg !== null && kl.gainKg > 0
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        : 'bg-slate-800/80 text-slate-400 border-white/[0.06]';
      const placeholder = kl.latestKg !== null ? `${kl.latestKg}` : 'kg';

      return `
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-white/[0.06]">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-white/[0.06] whitespace-nowrap">${escapeHtml(kl.session)}</span>
              <span class="text-xs font-semibold text-white truncate">${escapeHtml(kl.name)}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5 truncate">${escapeHtml(kl.machine)} • ${escapeHtml(kl.target)}${kl.startWeightKg !== null ? ` • Đầu: ${kl.startWeightKg}kg` : ''}</div>
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <div class="inline-flex items-center gap-1 bg-slate-900 rounded-lg px-2 py-1 border ${weekVal !== null ? 'border-amber-500/35' : 'border-white/[0.08]'}">
              <input
                type="number"
                step="0.5"
                min="0"
                inputmode="decimal"
                data-keylift-ex="${escapeHtml(kl.exerciseId)}"
                value="${weekVal !== null && weekVal !== undefined ? escapeHtml(String(weekVal)) : ''}"
                placeholder="${escapeHtml(placeholder)}"
                title="${source === 'auto' ? 'Tự động lấy từ log phòng gym tuần này' : 'Nhập mức tạ tuần ' + escapeHtml(wk.shortCode)}"
                class="tabular-nums w-12 bg-transparent text-xs font-bold text-right text-white placeholder-slate-600 focus:outline-none"
              >
              <span class="text-[10px] text-slate-400">kg</span>
            </div>
            <span class="tabular-nums text-[10px] font-bold px-1.5 py-1 rounded-lg border min-w-[46px] text-center ${gainCls}">${escapeHtml(gainStr)}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 6. Permanent Daily Gym Database Archive
  renderGymDailyHistory(dailyHistory);
}

function renderGymDailyHistory(dailyHistory) {
  const historyContainer = document.getElementById('containerGymDailyHistory');
  const historyBadge = document.getElementById('badgeGymHistoryCount');
  const items = Array.isArray(dailyHistory) ? dailyHistory : [];
  if (historyBadge) {
    historyBadge.textContent = `${items.length} ngày`;
  }
  if (!historyContainer) return;

  if (items.length === 0) {
    historyContainer.innerHTML = `
      <div class="py-6 px-3 rounded-xl border border-dashed border-white/[0.08] text-center text-xs text-slate-400">
        Chưa có bản ghi Gym nào. Hãy nạp buổi tập qua nút <strong>+ Nạp / Đổi buổi</strong> và tick đủ hiệp ở tab Theo ngày!
      </div>
    `;
    return;
  }

  historyContainer.innerHTML = items.map((item) => {
    const setsDone = Number(item.setsDone) || 0;
    const setsTarget = Number(item.setsTarget) || 0;
    const exDone = Number(item.exerciseDoneCount) || 0;
    const exTotal = Number(item.exerciseTotalCount) || 0;
    const hasWorkout = exTotal > 0 || setsTarget > 0;
    const allWorkoutDone = hasWorkout && exDone === exTotal && (setsTarget === 0 || setsDone === setsTarget);

    const workoutProgressCls = allWorkoutDone
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : (item.workoutDone || setsDone > 0
          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
          : 'bg-slate-800/90 text-slate-300 border-white/10');

    const statusCls = item.status === 'green'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
      : (item.status === 'yellow'
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
        : (item.status === 'red'
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/35'
          : 'bg-slate-800 text-slate-400 border-white/10'));

    const sortedWeights = (item.allWeightsLogged || []).slice().sort((a, b) => (b.isKey ? 1 : 0) - (a.isKey ? 1 : 0));
    const weightsPills = sortedWeights.slice(0, 6).map((w) => {
      return `<span class="tabular-nums text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/25 truncate max-w-[175px]">${w.isKey ? '★ ' : ''}${escapeHtml(w.name)}: ${w.weightKg}kg</span>`;
    }).join('');

    return `
      <div class="p-2.5 rounded-xl bg-slate-950/70 border ${allWorkoutDone ? 'border-emerald-500/25' : 'border-white/[0.06]'} flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0 flex-wrap">
            <span class="tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">T${item.weekNum}</span>
            <span class="tabular-nums text-xs font-bold text-white truncate">${escapeHtml(formatFullVNDate(item.dateStr))}</span>
            ${hasWorkout ? `<span class="tabular-nums text-[10px] font-bold px-2 py-0.5 rounded-full border ${workoutProgressCls}">${allWorkoutDone ? '✓ ' : ''}${exDone}/${exTotal} bài · ${setsDone}/${setsTarget} hiệp</span>` : ''}
            ${item.doneCount > 0 ? `<span class="tabular-nums text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCls}">${item.doneCount}/6 · ${escapeHtml(item.label)}</span>` : ''}
          </div>
          <button type="button" data-gym-jump-date="${escapeHtml(item.dateStr)}" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-[11px] font-semibold border border-white/[0.08] transition-colors active:scale-95 whitespace-nowrap flex-shrink-0">
            Xem ngày
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          ${item.workoutGroupName ? `<span class="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-semibold">${escapeHtml(item.workoutGroupName)}</span>` : ''}
          ${weightsPills}
        </div>
      </div>
    `;
  }).join('');
}

function saveSundayCheckinField() {
  if (!window.GymPlan) return;
  const now = Date.now();

  const baseWaistEl = document.getElementById('inputGymBaselineWaist');
  const wkWeightEl = document.getElementById('inputGymWeekWeight');
  const wkWaistEl = document.getElementById('inputGymWeekWaist');
  const wkFeelEl = document.getElementById('selectGymWeekFeel');
  const wkNoteEl = document.getElementById('inputGymWeekNote');

  if (baseWaistEl) {
    const bw = window.GymPlan.parseNullableNumber(baseWaistEl.value);
    if (!gymData.baseline) gymData.baseline = { ...window.GymPlan.DEFAULT_BASELINE };
    gymData.baseline.waistCm = bw;
    gymData.baseline.updatedAt = now;
  }

  const wkKey = String(selectedGymReviewWeek);
  if (!gymData.weeklyCheckins || typeof gymData.weeklyCheckins !== 'object') {
    gymData.weeklyCheckins = {};
  }
  const existing = gymData.weeklyCheckins[wkKey] || { weekNum: selectedGymReviewWeek, keyLiftWeights: {} };
  const feelVal = wkFeelEl ? wkFeelEl.value.trim() : existing.strengthTrend;

  gymData.weeklyCheckins[wkKey] = {
    ...existing,
    weekNum: selectedGymReviewWeek,
    weightKg: wkWeightEl ? window.GymPlan.parseNullableNumber(wkWeightEl.value) : existing.weightKg,
    waistCm: wkWaistEl ? window.GymPlan.parseNullableNumber(wkWaistEl.value) : existing.waistCm,
    strengthTrend: feelVal,
    strengthFeel: feelVal,
    note: wkNoteEl ? wkNoteEl.value : existing.note,
    updatedAt: now
  };

  gymData.updatedAt = now;
  triggerCloudGymSync();
  renderGymReviewView();
  refreshIcons();
}

function saveKeyLiftWeekWeight(exerciseId, rawVal) {
  if (!window.GymPlan || !exerciseId) return;
  const now = Date.now();
  const wkKey = String(selectedGymReviewWeek);
  if (!gymData.weeklyCheckins || typeof gymData.weeklyCheckins !== 'object') {
    gymData.weeklyCheckins = {};
  }
  const existing = gymData.weeklyCheckins[wkKey] || { weekNum: selectedGymReviewWeek, keyLiftWeights: {} };
  if (!existing.keyLiftWeights || typeof existing.keyLiftWeights !== 'object') {
    existing.keyLiftWeights = {};
  }

  const parsed = window.GymPlan.parsePositiveWeight(rawVal);
  const current = window.GymPlan.parsePositiveWeight(existing.keyLiftWeights[exerciseId]);
  if (parsed === current) return;

  if (parsed !== null) {
    existing.keyLiftWeights[exerciseId] = parsed;
  } else {
    delete existing.keyLiftWeights[exerciseId];
  }
  existing.updatedAt = now;
  gymData.weeklyCheckins[wkKey] = existing;
  gymData.updatedAt = now;

  triggerCloudGymSync();
  renderGymReviewView();
  refreshIcons();
  if (parsed !== null) {
    showToast(`✓ Đã lưu tạ ${parsed} kg cho tuần T${selectedGymReviewWeek}!`, 'success');
  }
}

async function syncGymToSheets() {
  if (!window.GymPlan) return;
  const btn = document.getElementById('btnGymSyncToSheets');
  if (btn) btn.disabled = true;

  try {
    if (!sheetsData || !Array.isArray(sheetsData.sheets) || sheetsData.sheets.length === 0) {
      await loadLocalSheetsData();
    }
    if (!Array.isArray(sheetsData.sheets)) {
      sheetsData.sheets = [];
    }

    const generatedSheets = window.GymPlan.buildGymAccountSheets(gymData, appData.tasks);
    generatedSheets.forEach((gSheet) => {
      const idx = sheetsData.sheets.findIndex(s => s.id === gSheet.id);
      if (idx >= 0) {
        sheetsData.sheets[idx] = gSheet;
      } else {
        sheetsData.sheets.push(gSheet);
      }
    });

    sheetsData.updatedAt = Date.now();
    saveLocalSheetsData(true);
    localStorage.setItem(STORAGE_KEY_SHEETS_DIRTY, '1');
    renderSheetsView();

    // Push sheets_data.json + gym_data.json to GitHub Gist 24/7
    await pushCloudSheetsData(false);
    await pushCloudGymData(false);

    showToast('✓ Đã đồng bộ 2 bảng Gym sang Bảng Tính (Sheets) & Cloud 24/7!', 'success');
  } catch (err) {
    console.error('[Gym] Sync to sheets error:', err);
    showToast('Lỗi đồng bộ bảng Gym: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function exportGymCsv() {
  if (!window.GymPlan) return;
  try {
    const csv = window.GymPlan.buildGymReviewCsv(gymData, appData.tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gym_weekly_review_${getTodayDateStr()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Đã xuất file CSV Review 12 Tuần & 12 Bài ★!', 'success');
  } catch (err) {
    showToast('Lỗi xuất CSV: ' + err.message, 'error');
  }
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
  const monthSelect = document.getElementById('selectHistoryMonth');

  // Lifetime counts
  totalTasksEl.textContent = appData.tasks.length;
  totalCompletedEl.textContent = appData.tasks.filter(t => t.completed).length;

  // Group ALL tasks by date
  const dateMap = {};
  appData.tasks.forEach(t => {
    const d = getTaskDate(t);
    if (!d) return;
    if (!dateMap[d]) dateMap[d] = [];
    dateMap[d].push(t);
  });

  const uniqueDates = Object.keys(dateMap).sort().reverse();

  // Populate month dropdown while preserving selection
  if (monthSelect) {
    const months = Array.from(new Set(uniqueDates.map(d => d.slice(0, 7)).filter(Boolean))).sort().reverse();
    const prevValue = historyMonthFilter || 'all';
    monthSelect.innerHTML = '<option value="all">Tất cả các tháng</option>';
    months.forEach(ym => {
      const [y, m] = ym.split('-');
      const opt = document.createElement('option');
      opt.value = ym;
      opt.textContent = `Tháng ${m}/${y}`;
      monthSelect.appendChild(opt);
    });
    if (prevValue === 'all' || months.includes(prevValue)) {
      monthSelect.value = prevValue;
      historyMonthFilter = prevValue;
    } else {
      monthSelect.value = 'all';
      historyMonthFilter = 'all';
    }
  }

  // Calculate Streak
  const today = getTodayDateStr();
  let streak = 0;
  let checkDate = today;

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

  // Apply month & search filters for feed display
  const q = (historySearchQuery || '').toLowerCase().trim();
  const filteredDates = uniqueDates.filter(dateStr => {
    if (historyMonthFilter !== 'all' && !dateStr.startsWith(historyMonthFilter)) {
      return false;
    }
    if (!q) return true;
    if (dateStr.includes(q) || formatFullVNDate(dateStr).toLowerCase().includes(q)) return true;
    return dateMap[dateStr].some(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    );
  });

  // Render History Days Cards
  container.innerHTML = '';
  if (filteredDates.length === 0) {
    emptyHistory.classList.remove('hidden');
    return;
  }

  emptyHistory.classList.add('hidden');
  filteredDates.forEach(dateStr => {
    const allDayTasks = dateMap[dateStr];
    const total = allDayTasks.length;
    const completed = allDayTasks.filter(t => t.completed).length;
    const percent = Math.round((completed / total) * 100);

    const visibleTasks = q
      ? (dateStr.includes(q) || formatFullVNDate(dateStr).toLowerCase().includes(q)
          ? allDayTasks
          : allDayTasks.filter(t => (t.title || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q)))
      : allDayTasks;

    const card = document.createElement('div');
    card.className = 'bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-white/[0.08] flex flex-col gap-3 transition-colors hover:border-slate-600';

    const header = document.createElement('div');
    header.className = 'flex flex-wrap items-center justify-between gap-2';

    const left = document.createElement('div');
    left.className = 'flex items-center gap-2 min-w-0';

    const badgeRelation = document.createElement('span');
    badgeRelation.className = 'text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 flex-shrink-0 whitespace-nowrap';
    badgeRelation.textContent = getRelativeDateLabel(dateStr);

    const dateTitle = document.createElement('span');
    dateTitle.className = 'tabular-nums text-sm font-bold text-white truncate';
    dateTitle.textContent = formatFullVNDate(dateStr);

    left.appendChild(badgeRelation);
    left.appendChild(dateTitle);

    const right = document.createElement('div');
    right.className = 'flex items-center gap-2 flex-shrink-0';

    const pill = document.createElement('span');
    if (percent === 100) {
      pill.className = 'tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 whitespace-nowrap';
      pill.innerHTML = `✓ ${completed}/${total} (100%)`;
    } else {
      pill.className = 'tabular-nums text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-white/[0.08] whitespace-nowrap';
      pill.textContent = `${completed}/${total} việc (${percent}%)`;
    }

    const btnGoToDate = document.createElement('button');
    btnGoToDate.type = 'button';
    btnGoToDate.className = 'px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors whitespace-nowrap';
    btnGoToDate.textContent = 'Xem ngày này';
    btnGoToDate.onclick = () => {
      selectedDate = dateStr;
      switchTab('checklist');
      setChecklistViewMode('day');
    };

    right.appendChild(pill);
    right.appendChild(btnGoToDate);

    header.appendChild(left);
    header.appendChild(right);
    card.appendChild(header);

    // List of tasks preview in this day
    const taskPreviewList = document.createElement('div');
    taskPreviewList.className = 'flex flex-col gap-1.5 pt-2 border-t border-white/5';

    visibleTasks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-lg bg-slate-950/40';

      const rowLeft = document.createElement('div');
      rowLeft.className = 'flex items-center gap-2 min-w-0 flex-1';

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = `w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition active:scale-90 ${
        t.completed
          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
          : 'bg-slate-900 text-slate-500 hover:text-emerald-400 border border-white/10 hover:border-emerald-500/40'
      }`;
      toggleBtn.title = t.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành';
      toggleBtn.innerHTML = t.completed
        ? '<i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>'
        : '<i data-lucide="circle" class="w-3 h-3"></i>';
      toggleBtn.onclick = (e) => {
        e.stopPropagation();
        toggleTaskComplete(t.id);
      };

      const titleSpan = document.createElement('span');
      titleSpan.className = `truncate ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}`;
      titleSpan.textContent = t.title;

      rowLeft.appendChild(toggleBtn);
      rowLeft.appendChild(titleSpan);

      if (t.gymType === 'exercise' && window.GymPlan) {
        const checks = window.GymPlan.normalizeExerciseSetChecks(t);
        const doneS = checks.filter(Boolean).length;
        const totalS = checks.length;
        const setMini = document.createElement('span');
        setMini.className = `tabular-nums flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
          doneS === totalS
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            : (doneS > 0 ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-white/[0.06]')
        }`;
        setMini.textContent = `${doneS}/${totalS} hiệp`;
        rowLeft.appendChild(setMini);
      }

      const rowRight = document.createElement('div');
      rowRight.className = 'flex items-center gap-2 flex-shrink-0';

      if (!t.completed && dateStr < today) {
        const moveBtn = document.createElement('button');
        moveBtn.type = 'button';
        moveBtn.className = 'px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition active:scale-95';
        moveBtn.textContent = 'Về hôm nay';
        moveBtn.onclick = (e) => {
          e.stopPropagation();
          moveTaskToToday(t.id);
        };
        rowRight.appendChild(moveBtn);
      }

      const timeStr = t.time || t.dueTime || (t.completedAt ? formatTime(t.completedAt) : '');
      if (timeStr) {
        const timeEl = document.createElement('span');
        timeEl.className = 'tabular-nums text-[11px] text-slate-500 font-mono';
        timeEl.textContent = timeStr;
        rowRight.appendChild(timeEl);
      }

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
  document.getElementById('editTaskDate').value = getTaskDate(task);
  document.getElementById('editTaskTime').value = task.time || task.dueTime || '';
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

const STORAGE_KEY_TUNNEL = 'my_checklist_tunnel_status';
function loadStoredTunnelStatus() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TUNNEL);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}
const storedTunnel = loadStoredTunnelStatus();
let tunnelStatus = {
  online: storedTunnel?.online ?? false,
  laptopActive: storedTunnel?.laptopActive ?? false,
  tunnel_url: storedTunnel?.tunnel_url || '',
  publicUrl: storedTunnel?.publicUrl || '',
  mobileUrl: storedTunnel?.mobileUrl || '',
  lanMobileUrl: storedTunnel?.lanMobileUrl || '',
  lanUrl: storedTunnel?.lanUrl || '',
  pin: storedTunnel?.pin || '686868',
  updatedAt: storedTunnel?.updatedAt || 0
};

let autofbPollTimer = null;

async function checkTunnelStatusDirectly(manual = false) {
  const btnRefresh = document.getElementById('btnRefreshAutoFbState');
  if (btnRefresh && manual) {
    const icon = btnRefresh.querySelector('i');
    if (icon) icon.classList.add('animate-spin');
  }

  try {
    const gistId = cloudConfig.gistId || PRESET_GIST_ID;
    const token = cloudConfig.token || PRESET_TOKEN;
    if (!gistId) return;

    const url = `https://api.github.com/gists/${gistId}?_t=${Date.now()}`;
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files['tunnel_status.json'] && data.files['tunnel_status.json'].content) {
        const parsed = JSON.parse(data.files['tunnel_status.json'].content);
        if (parsed && typeof parsed === 'object') {
          const cleanUrl = parsed.tunnel_url || parsed.mobileUrl || (parsed.publicUrl ? `${parsed.publicUrl.replace(/\/$/, '')}/?pin=${parsed.pin || '686868'}&mobile=1` : '');
          const prevOnline = tunnelStatus.online;
          const prevUrl = tunnelStatus.tunnel_url;
          
          tunnelStatus = {
            ...tunnelStatus,
            ...parsed,
            tunnel_url: cleanUrl || parsed.tunnel_url || parsed.publicUrl || ''
          };
          localStorage.setItem(STORAGE_KEY_TUNNEL, JSON.stringify(tunnelStatus));

          // Only trigger UI update if state actually changed or manual refresh
          if (prevOnline !== tunnelStatus.online || prevUrl !== tunnelStatus.tunnel_url || manual) {
            renderAutoFbView();
          }

          if (manual) {
            showToast(tunnelStatus.online ? 'Đã kết nối thành công với Laptop!' : 'Đã kiểm tra: Laptop hiện đang tắt.', tunnelStatus.online ? 'success' : 'info');
          }
        }
      }
    }
  } catch (err) {
    console.warn('[AutoFB] Check tunnel status error:', err);
    if (manual) showToast('Lỗi kiểm tra kết nối: ' + err.message, 'error');
  } finally {
    if (btnRefresh && manual) {
      const icon = btnRefresh.querySelector('i');
      if (icon) icon.classList.remove('animate-spin');
    }
  }
}

function showAutoFbIframeLoader() {
  const loader = document.getElementById('autoFbIframeLoader');
  if (loader) {
    loader.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
  }
}

window.handleAutoFbIframeLoad = function() {
  const iframe = document.getElementById('autoFbIframe');
  const loader = document.getElementById('autoFbIframeLoader');
  if (!loader) return;
  // Ignore blank initial load when iframe src is not yet pointed at the tunnel
  if (iframe && (!iframe.getAttribute('src') || iframe.src === 'about:blank')) {
    return;
  }
  loader.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => {
    if (loader.classList.contains('opacity-0')) {
      loader.classList.add('hidden');
    }
  }, 220);
};

window.reloadAutoFbIframe = function() {
  const iframe = document.getElementById('autoFbIframe');
  if (iframe) {
    const src = iframe.src;
    showAutoFbIframeLoader();
    iframe.src = 'about:blank';
    setTimeout(() => { iframe.src = src; }, 100);
    showToast('Đang nạp lại bảng điều khiển FB...', 'info');
  }
};

function switchTab(tabName) {
  currentActiveTab = tabName;
  const viewChecklist = document.getElementById('viewChecklist');
  const viewSheets = document.getElementById('viewSheets');
  const viewAutoFb = document.getElementById('viewAutoFb');
  const viewHistory = document.getElementById('viewHistory');
  const tabBtnChecklist = document.getElementById('tabBtnChecklist');
  const tabBtnSheets = document.getElementById('tabBtnSheets');
  const tabBtnAutoFb = document.getElementById('tabBtnAutoFb');
  const tabBtnHistory = document.getElementById('tabBtnHistory');

  const activeClass = 'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 rounded-[8px] text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-150 bg-emerald-600 text-white';
  const inactiveClass = 'flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 rounded-[8px] text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-150 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60';

  if (viewChecklist) viewChecklist.classList.add('hidden');
  if (viewSheets) viewSheets.classList.add('hidden');
  if (viewAutoFb) viewAutoFb.classList.add('hidden');
  if (viewHistory) viewHistory.classList.add('hidden');

  if (tabBtnChecklist) tabBtnChecklist.className = inactiveClass;
  if (tabBtnSheets) tabBtnSheets.className = inactiveClass;
  if (tabBtnAutoFb) tabBtnAutoFb.className = inactiveClass;
  if (tabBtnHistory) tabBtnHistory.className = inactiveClass;

  if (tabName === 'checklist') {
    if (viewChecklist) viewChecklist.classList.remove('hidden');
    if (tabBtnChecklist) tabBtnChecklist.className = activeClass;
    if (checklistViewMode === 'day') {
      renderDateChips();
    }
    if (autofbPollTimer) { clearInterval(autofbPollTimer); autofbPollTimer = null; }
  } else if (tabName === 'sheets') {
    if (viewSheets) viewSheets.classList.remove('hidden');
    if (tabBtnSheets) tabBtnSheets.className = activeClass;
    if (autofbPollTimer) { clearInterval(autofbPollTimer); autofbPollTimer = null; }
    loadAndRenderSheetsTab();
  } else if (tabName === 'autofb') {
    if (viewAutoFb) viewAutoFb.classList.remove('hidden');
    if (tabBtnAutoFb) tabBtnAutoFb.className = activeClass;
    renderAutoFbView();
    checkTunnelStatusDirectly(false);
    if (autofbPollTimer) clearInterval(autofbPollTimer);
    // Poll smoothly every 25s without destructive DOM churn
    autofbPollTimer = setInterval(() => {
      if (currentActiveTab === 'autofb') {
        checkTunnelStatusDirectly(false);
      }
    }, 25000);
  } else if (tabName === 'history') {
    if (viewHistory) viewHistory.classList.remove('hidden');
    if (tabBtnHistory) tabBtnHistory.className = activeClass;
    renderHistoryView();
    if (autofbPollTimer) { clearInterval(autofbPollTimer); autofbPollTimer = null; }
  }
  refreshIcons();
}

// ==========================================
// 8.0 AUTO FB CONTROLLER
// ==========================================
function renderAutoFbView() {
  const container = document.getElementById('autoFbStateContainer');
  if (!container) return;

  try {
    const pin = tunnelStatus.pin || '686868';
    const targetUrl = tunnelStatus.tunnel_url || tunnelStatus.mobileUrl || (tunnelStatus.publicUrl ? `${tunnelStatus.publicUrl.replace(/\/$/, '')}/?pin=${pin}&mobile=1` : '');
    const isOnline = tunnelStatus.online !== false && !!targetUrl;
    // Heartbeat check: nếu có updatedAt thì kiểm tra trong vòng 5 phút (300,000ms)
    const isFresh = (tunnelStatus.updatedAt > 0) ? (Date.now() - tunnelStatus.updatedAt < 300000) : isOnline;
    const isLaptopActive = isOnline && isFresh && !!targetUrl;

    // 1. Build persistent non-destructive skeleton if not yet built
    let wrapper = document.getElementById('autoFbWrapper');
    let existingIframe = document.getElementById('autoFbIframe');
    if (!wrapper || !existingIframe) {
      container.innerHTML = `
        <div id="autoFbWrapper" class="flex flex-col gap-2.5 w-full">
          <!-- SECTION 1: ONLINE (TOOLBAR + IFRAME) -->
          <div id="autoFbOnlineSection" class="${isLaptopActive ? '' : 'hidden'} flex flex-col gap-2.5 w-full">
            <div class="bg-slate-900/90 rounded-2xl p-3 sm:p-3.5 border border-emerald-500/25 flex flex-wrap items-center justify-between gap-2.5 text-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-white text-xs sm:text-sm whitespace-nowrap">Laptop Online</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 whitespace-nowrap">● Đã kết nối</span>
                  </div>
                  <p class="text-[11px] text-slate-400 truncate mt-0.5">Giao diện điều khiển Auto Facebook từ xa</p>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button 
                  type="button"
                  onclick="reloadAutoFbIframe()" 
                  class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-white/[0.08] flex items-center gap-1.5 text-xs font-semibold transition-colors active:scale-95 whitespace-nowrap" 
                  title="Nạp lại bảng điều khiển"
                >
                  <i data-lucide="rotate-cw" class="w-3.5 h-3.5 flex-shrink-0"></i>
                  <span>Nạp lại</span>
                </button>

                <a 
                  id="btnAutoFbFullscreen"
                  href="${escapeHtml(targetUrl)}" 
                  target="_blank" 
                  rel="noreferrer" 
                  class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 text-xs transition-colors active:scale-95 whitespace-nowrap"
                  title="Mở tab mới toàn màn hình"
                >
                  <i data-lucide="external-link" class="w-3.5 h-3.5 flex-shrink-0"></i>
                  <span>Toàn màn hình</span>
                </a>

                <button 
                  type="button"
                  id="btnRefreshAutoFbState"
                  onclick="checkTunnelStatusDirectly(true)" 
                  aria-label="Kiểm tra lại kết nối"
                  class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors active:scale-95 border border-white/[0.08] flex-shrink-0" 
                  title="Kiểm tra lại kết nối"
                >
                  <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

            <!-- Khung nhúng iframe với overlay chờ tải mượt mà & chiều cao cố định chống giật Safari iOS -->
            <div class="relative w-full rounded-2xl overflow-hidden border border-white/[0.1] bg-slate-950" style="height: 72vh; height: 72dvh; min-height: 540px; contain: paint;">
              <div id="autoFbIframeLoader" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/95 px-6 text-center transition-opacity duration-200">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <i data-lucide="loader-2" class="w-6 h-6 animate-spin"></i>
                </div>
                <div class="flex flex-col gap-1 max-w-xs">
                  <p class="text-sm font-semibold text-slate-100">Đang tải giao diện điều khiển Laptop...</p>
                  <p class="text-xs text-slate-400">Đang kết nối an toàn tới phiên làm việc Auto_Post_FB</p>
                </div>
              </div>
              <iframe 
                id="autoFbIframe"
                src="${isLaptopActive && targetUrl ? escapeHtml(targetUrl) : ''}" 
                onload="handleAutoFbIframeLoad()"
                class="relative z-0 w-full h-full border-0 bg-slate-950 block"
                allow="clipboard-read; clipboard-write; fullscreen"
                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts allow-downloads"
                title="Bảng Điều Khiển Auto Facebook"
              ></iframe>
            </div>
          </div>

          <!-- SECTION 2: OFFLINE (THÔNG BÁO LAPTOP TẮT) -->
          <div id="autoFbOfflineSection" class="${isLaptopActive ? 'hidden' : ''} bg-slate-900/90 rounded-2xl p-5 sm:p-6 border border-white/[0.08] flex flex-col items-center justify-center text-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <i data-lucide="laptop" class="w-7 h-7 text-amber-400"></i>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2">
              <h3 class="text-base font-bold text-slate-100">Laptop đang tắt / Tool FB chưa mở</h3>
              <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold border border-white/[0.08] whitespace-nowrap">○ LAPTOP TẮT</span>
            </div>

            <p class="text-xs text-slate-300 max-w-md leading-relaxed">
              Hai tab <strong class="text-emerald-400">Checklist</strong> và <strong class="text-emerald-400">Bảng Tính</strong> vẫn đang hoạt động 24/7 bình thường.<br>
              Khi bạn mở Laptop và chạy <strong class="text-amber-400 font-semibold">Auto_Post_FB</strong>, tab này sẽ <strong class="text-cyan-400 font-semibold">tự động kết nối</strong> để bạn điều khiển từ xa!
            </p>

            <div class="bg-slate-950/80 rounded-xl p-3.5 border border-white/[0.06] w-full max-w-md text-left text-xs text-slate-300 flex flex-col gap-2">
              <div class="flex items-center gap-2 text-cyan-400 font-semibold">
                <i data-lucide="info" class="w-4 h-4 flex-shrink-0"></i>
                <span>Các bước kết nối:</span>
              </div>
              <ol class="list-decimal list-inside space-y-1 text-slate-400 text-[11px] pl-1">
                <li>Mở máy tính Laptop của bạn.</li>
                <li>Chạy shortcut hoặc file <strong class="text-white">Auto_Post_FB</strong> trên màn hình.</li>
                <li>Sau vài giây, tab này sẽ <strong class="text-emerald-400">tự động hiển thị màn hình điều khiển</strong>!</li>
              </ol>
            </div>

            <div class="flex items-center gap-2 mt-1">
              <button 
                type="button"
                onclick="checkTunnelStatusDirectly(true)" 
                class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors active:scale-95 border border-white/[0.08]"
              >
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Kiểm tra kết nối lại ngay</span>
              </button>
            </div>
          </div>
        </div>
      `;
      refreshIcons();
      return;
    }

    // 2. Persistent update: toggle classes & sync iframe src without destroying DOM
    const onlineSection = document.getElementById('autoFbOnlineSection');
    const offlineSection = document.getElementById('autoFbOfflineSection');
    const iframe = document.getElementById('autoFbIframe');
    const btnFullscreen = document.getElementById('btnAutoFbFullscreen');

    if (btnFullscreen && targetUrl) {
      btnFullscreen.href = targetUrl;
    }

    if (isLaptopActive) {
      if (onlineSection) onlineSection.classList.remove('hidden');
      if (offlineSection) offlineSection.classList.add('hidden');
      if (iframe && targetUrl) {
        // ONLY update src if empty or target origin changed (never re-trigger reload if already loaded!)
        const targetClean = targetUrl.split('?')[0];
        if (!iframe.src || iframe.src === 'about:blank' || !iframe.src.includes(targetClean)) {
          showAutoFbIframeLoader();
          iframe.src = targetUrl;
        }
      }
    } else {
      if (onlineSection) onlineSection.classList.add('hidden');
      if (offlineSection) offlineSection.classList.remove('hidden');
    }
  } catch (err) {
    console.error('[AutoFB] renderAutoFbView error:', err);
  }
}

// ==========================================
// 8.1 SHEET UI RENDERERS & EVENT HANDLERS
// ==========================================
function copyTextToClipboard(text, label = 'dữ liệu') {
  const value = text === null || text === undefined ? '' : String(text);
  if (!value) {
    showToast(`Không có ${label} để sao chép`, 'info');
    return;
  }

  const fallbackCopy = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        showToast(`Đã sao chép ${label}!`, 'success');
      } else {
        showToast('Không thể sao chép tự động', 'info');
      }
    } catch (_) {
      showToast('Không thể sao chép tự động', 'info');
    }
  };

  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(value).then(() => {
      showToast(`Đã sao chép ${label}!`, 'success');
    }).catch(() => {
      fallbackCopy();
    });
  } else {
    fallbackCopy();
  }
}

function getSheetStatusBadgeHtml(statusVal) {
  const s = (statusVal === null || statusVal === undefined) ? '' : String(statusVal).trim();
  if (!s) {
    return '<span class="text-slate-600 italic">—</span>';
  }
  const lower = s.toLowerCase();
  if (lower === 'live') {
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">🟢 Live</span>';
  }
  if (lower === 'đang dùng' || lower === 'dang dung') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">🔵 ${escapeHtml(s)}</span>`;
  }
  if (lower === 'chờ nuôi' || lower === 'cho nuoi') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">🟡 ${escapeHtml(s)}</span>`;
  }
  if (lower === 'checkpoint') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30">🟠 ${escapeHtml(s)}</span>`;
  }
  if (lower === 'die') {
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">🔴 Die</span>';
  }
  if (lower === 'sai pass') {
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">🟡 Sai Pass</span>';
  }
  if (lower === 'chờ duyệt' || lower === 'cho duyet') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/60 text-slate-300 border border-slate-600">⚪ ${escapeHtml(s)}</span>`;
  }
  if (lower === 'cần check' || lower === 'can check') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">🟠 ${escapeHtml(s)}</span>`;
  }
  if (lower === 'tăng tốt' || lower === 'tăng đều') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">📈 ${escapeHtml(s)}</span>`;
  }
  if (lower === 'giữ ổn' || lower === 'ổn định' || lower === 'giữ nguyên') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">⚖️ ${escapeHtml(s)}</span>`;
  }
  if (lower === 'hơi tụt') {
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">⚠️ ${escapeHtml(s)}</span>`;
  }
  return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">${escapeHtml(s)}</span>`;
}

function renderSheetCellHtml(row, col, colIndex) {
  const rawVal = row[col.id];
  const strVal = (rawVal === null || rawVal === undefined) ? '' : String(rawVal);
  const trimmedVal = strVal.trim();
  const hasVal = trimmedVal.length > 0;
  const colType = col.type || 'text';
  const rowIdEsc = escapeHtml(row.id);
  const colIdEsc = escapeHtml(col.id);

  if (colType === 'password') {
    const pwKey = `${row.id}::${col.id}`;
    const pwKeyEsc = escapeHtml(pwKey);
    const isPwVisible = visiblePasswords.has(pwKey) || visiblePasswords.has(row.id);
    const pwDisplay = hasVal
      ? (isPwVisible ? escapeHtml(strVal) : '••••••••')
      : '<span class="text-slate-600 italic">Trống</span>';

    return `
      <td class="px-3 py-2.5 font-mono text-[11px] text-slate-300">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="max-w-[125px] sm:max-w-[165px] truncate">${pwDisplay}</span>
          ${hasVal ? `
            <button type="button" data-toggle-pw="${pwKeyEsc}" class="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors" title="${isPwVisible ? 'Ẩn' : 'Hiện'}">
              <i data-lucide="${isPwVisible ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" data-copy-row="${rowIdEsc}" data-copy-col="${colIdEsc}" class="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors" title="Sao chép">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
  }

  if (colType === '2fa') {
    return `
      <td class="px-3 py-2.5 font-mono text-[11px] text-cyan-300">
        <div class="flex items-center gap-1.5 min-w-0">
          ${hasVal
            ? `<span class="max-w-[140px] sm:max-w-[175px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 truncate" title="${escapeHtml(strVal)}">${escapeHtml(strVal)}</span>
               <button type="button" data-copy-row="${rowIdEsc}" data-copy-col="${colIdEsc}" class="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors" title="Sao chép 2FA">
                 <i data-lucide="copy" class="w-3.5 h-3.5"></i>
               </button>`
            : '<span class="text-slate-600">—</span>'}
        </div>
      </td>
    `;
  }

  if (colType === 'status') {
    return `<td class="px-3 py-2.5 text-center">${getSheetStatusBadgeHtml(strVal)}</td>`;
  }

  const isHttpLink = /^https?:\/\//i.test(trimmedVal);
  if (colType === 'link' || (colType === 'text' && isHttpLink)) {
    return `
      <td class="px-3 py-2.5 text-[11px]">
        <div class="flex items-center gap-1.5 min-w-0">
          ${hasVal
            ? (isHttpLink
                ? `<a href="${escapeHtml(trimmedVal)}" target="_blank" rel="noopener noreferrer" class="max-w-[140px] sm:max-w-[175px] text-cyan-400 hover:text-cyan-300 underline truncate" title="${escapeHtml(trimmedVal)}">${escapeHtml(trimmedVal)}</a>`
                : `<span class="max-w-[140px] sm:max-w-[175px] text-slate-300 truncate" title="${escapeHtml(strVal)}">${escapeHtml(strVal)}</span>`) +
              `<button type="button" data-copy-row="${rowIdEsc}" data-copy-col="${colIdEsc}" class="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors" title="Sao chép link">
                 <i data-lucide="copy" class="w-3.5 h-3.5"></i>
               </button>`
            : '<span class="text-slate-600">—</span>'}
        </div>
      </td>
    `;
  }

  if (colType === 'number') {
    return `
      <td class="px-3 py-2.5 text-right font-mono tabular-nums text-[11px] text-slate-200">
        ${hasVal ? escapeHtml(strVal) : '<span class="text-slate-600">—</span>'}
      </td>
    `;
  }

  if (colType === 'copy_text' || col.id === 'copy_text' || col.id === 'username') {
    return `
      <td class="px-3 py-2.5 font-mono text-[11px] text-emerald-300">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="max-w-[135px] sm:max-w-[175px] truncate" title="${escapeHtml(strVal)}">${hasVal ? escapeHtml(strVal) : '—'}</span>
          ${hasVal ? `
            <button type="button" data-copy-row="${rowIdEsc}" data-copy-col="${colIdEsc}" class="flex-shrink-0 text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors" title="Sao chép">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          ` : ''}
        </div>
      </td>
    `;
  }

  const textToneClass = colIndex === 0 ? 'font-medium text-slate-200' : 'text-slate-300 text-[11px]';
  const maxWidthClass = colIndex === 0 ? 'max-w-[115px] sm:max-w-[175px]' : 'max-w-[160px] sm:max-w-[175px]';
  return `
    <td class="px-3 py-2.5 ${textToneClass}">
      <div class="${maxWidthClass} truncate" title="${escapeHtml(strVal)}">${hasVal ? escapeHtml(strVal) : '—'}</div>
    </td>
  `;
}

function updateSheetScrollHint() {
  const scrollWrap = document.getElementById('sheetTableScrollWrap');
  const scrollHint = document.getElementById('sheetScrollHint');
  if (!scrollWrap || !scrollHint) return;
  const hasOverflow = scrollWrap.scrollWidth > scrollWrap.clientWidth + 4;
  scrollHint.classList.toggle('hidden', !hasOverflow);
}

async function loadAndRenderSheetsTab() {
  const countEl = document.getElementById('sheetRowCountText');
  const tbody = document.getElementById('sheetTableBody');
  const activeSheet = getActiveSheet();
  const colSpan = getResolvedColumns(activeSheet).length + 2;

  if (countEl) {
    countEl.innerHTML = '<span class="inline-flex items-center gap-1.5 text-cyan-400 font-medium"><i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Đang tải dữ liệu mới nhất từ Cloud...</span>';
  }
  if (tbody && (!sheetsData || !Array.isArray(sheetsData.sheets) || sheetsData.sheets.length === 0)) {
    tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-12 text-slate-400 text-xs"><div class="flex flex-col items-center gap-2"><i data-lucide="loader-2" class="w-6 h-6 animate-spin text-cyan-400"></i><span>Đang nạp dữ liệu mới nhất từ Laptop / Cloud...</span></div></td></tr>`;
  }
  refreshIcons();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const gistId = cloudConfig.gistId || PRESET_GIST_ID;
    const token = cloudConfig.token || PRESET_TOKEN;

    if (!gistId || !navigator.onLine) {
      throw new Error('Thiết bị đang offline hoặc chưa kết nối Cloud');
    }

    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (token) headers['Authorization'] = `token ${token}`;

    const res = await fetch(`https://api.github.com/gists/${gistId}?_t=${Date.now()}`, {
      headers,
      signal: controller.signal
    });

    if (res.ok) {
      const data = await res.json();
      if (data.files && data.files['sheets_data.json'] && data.files['sheets_data.json'].content) {
        const parsed = JSON.parse(data.files['sheets_data.json'].content);
        if (parsed && Array.isArray(parsed.sheets)) {
          if (shouldAdoptRemoteSheets(parsed)) {
            sheetsData = parsed;
            saveLocalSheetsData(false);
            localStorage.removeItem(STORAGE_KEY_SHEETS_DIRTY);
          } else if (!sheetDebounceTimer) {
            pushCloudSheetsData(false);
          }
        }
      }
      if (data.files && data.files['tunnel_status.json'] && data.files['tunnel_status.json'].content) {
        try {
          const parsedTun = JSON.parse(data.files['tunnel_status.json'].content);
          if (parsedTun && typeof parsedTun === 'object') {
            const cleanUrl = parsedTun.tunnel_url || parsedTun.mobileUrl || (parsedTun.publicUrl ? `${parsedTun.publicUrl.replace(/\/$/, '')}/?pin=${parsedTun.pin || '686868'}&mobile=1` : '');
            tunnelStatus = {
              ...tunnelStatus,
              ...parsedTun,
              tunnel_url: cleanUrl || parsedTun.tunnel_url || parsedTun.publicUrl || ''
            };
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[Sheets] Cloud fetch failed/timed out:', err.message);
    if (!sheetsData || !Array.isArray(sheetsData.sheets) || sheetsData.sheets.length === 0) {
      const localRaw = localStorage.getItem(STORAGE_KEY_SHEETS);
      if (localRaw) {
        try {
          const parsed = JSON.parse(localRaw);
          if (parsed && Array.isArray(parsed.sheets)) {
            sheetsData = parsed;
          }
        } catch (_) {}
      }
    }
    if (err.name === 'AbortError') {
      showToast('Đã hết thời gian chờ Cloud (6s). Đang hiển thị dữ liệu lưu trên máy!', 'info');
    } else if (!navigator.onLine) {
      showToast('Đang offline. Hiển thị dữ liệu trang tính lưu trên máy!', 'info');
    }
  } finally {
    clearTimeout(timeoutId);
    renderSheetsView();
  }
}

function renderSheetsView() {
  const activeSheet = getActiveSheet();
  const columns = getResolvedColumns(activeSheet);
  const colSpan = columns.length + 2;

  try {
    if (!activeSheet) {
      const countEl = document.getElementById('sheetRowCountText');
      if (countEl) countEl.textContent = 'Chưa có dữ liệu trang tính';
      const tbody = document.getElementById('sheetTableBody');
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-8 text-slate-500 text-xs">Chưa có dữ liệu trang tính. Bấm "Thêm Sheet" để bắt đầu.</td></tr>`;
      }
      return;
    }

    // 1. Render Sheet Tabs
    const tabsContainer = document.getElementById('sheetTabsList');
    if (tabsContainer) {
      tabsContainer.innerHTML = sheetsData.sheets.map(sheet => {
        const isActive = sheet.id === activeSheet.id;
        const count = Array.isArray(sheet.rows) ? sheet.rows.length : 0;
        const activeClass = 'bg-emerald-600 text-white font-semibold border-emerald-500';
        const inactiveClass = 'bg-slate-800/80 text-slate-300 font-medium hover:bg-slate-700/80 border-white/[0.06]';

        return `
          <button
            type="button"
            data-sheet-id="${escapeHtml(sheet.id)}"
            class="flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs transition-colors active:scale-95 ${isActive ? activeClass : inactiveClass}"
          >
            <span>${escapeHtml(sheet.icon || '📄')}</span>
            <span>${escapeHtml(sheet.name)}</span>
            <span class="tabular-nums text-[10px] px-1.5 py-0.5 rounded-full leading-none ${isActive ? 'bg-emerald-800/80 text-emerald-100' : 'bg-slate-900 text-slate-400'} font-bold">${count}</span>
          </button>
        `;
      }).join('');
    }

    // 2. Render Dynamic Headers
    const thead = document.getElementById('sheetTableHead');
    if (thead) {
      const dynamicThs = columns.map(col => {
        const alignClass = col.type === 'status' ? 'text-center' : (col.type === 'number' ? 'text-right' : '');
        return `<th class="px-3 py-2.5 ${alignClass}">${escapeHtml(col.name || col.id)}</th>`;
      }).join('');
      thead.innerHTML = `
        <tr>
          <th class="px-2.5 py-2.5 text-center w-10">#</th>
          ${dynamicThs}
          <th class="px-3 py-2.5 text-center w-20">Thao Tác</th>
        </tr>
      `;
    }

    // 3. Filter across ALL dynamic columns & Render Rows
    const tbody = document.getElementById('sheetTableBody');
    const rows = Array.isArray(activeSheet.rows) ? activeSheet.rows : [];
    const q = (sheetSearchQuery || '').toLowerCase().trim();

    const filteredRows = rows.filter(r => {
      if (!q) return true;
      for (const col of columns) {
        const val = r[col.id];
        if (val !== null && val !== undefined && String(val).toLowerCase().includes(q)) {
          return true;
        }
      }
      if (r.twofa && String(r.twofa).toLowerCase().includes(q)) return true;
      return false;
    });

    if (tbody) {
      if (filteredRows.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="${colSpan}" class="text-center py-8 text-slate-500 text-xs">
              ${q ? 'Không tìm thấy dòng nào khớp với từ khóa "' + escapeHtml(q) + '"' : 'Trang tính này hiện chưa có dữ liệu. Bấm "Thêm dòng" để tạo.'}
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = filteredRows.map((r, idx) => {
          const rowIdEsc = escapeHtml(r.id);
          const cellsHtml = columns.map((col, colIdx) => renderSheetCellHtml(r, col, colIdx)).join('');

          return `
            <tr class="hover:bg-slate-800/40 transition-colors">
              <td class="px-2.5 py-2.5 text-center text-slate-500 font-mono tabular-nums text-[11px]">${idx + 1}</td>
              ${cellsHtml}
              <td class="px-3 py-2.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button type="button" data-edit-row="${rowIdEsc}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 transition-colors" title="Sửa">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button type="button" data-delete-row="${rowIdEsc}" class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors" title="Xóa">
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
      countEl.innerHTML = `<span class="tabular-nums"><strong>${filteredRows.length}</strong> / <strong>${rows.length}</strong> dòng</span> • <strong>${escapeHtml(activeSheet.name)}</strong>`;
    }
  } catch (err) {
    console.error('[Sheets] renderSheetsView error:', err);
    const countEl = document.getElementById('sheetRowCountText');
    if (countEl) {
      countEl.innerHTML = `<span class="text-rose-400 font-semibold">Lỗi hiển thị bảng tính: ${escapeHtml(err.message)}</span>`;
    }
    const tbody = document.getElementById('sheetTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" class="text-center py-8 text-rose-400 text-xs">
            <div class="flex flex-col items-center gap-2">
              <p>Đã xảy ra lỗi khi tải dữ liệu bảng tính.</p>
              <button type="button" onclick="loadAndRenderSheetsTab()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold">
                Thử tải lại dữ liệu
              </button>
            </div>
          </td>
        </tr>
      `;
    }
  } finally {
    refreshIcons();
    requestAnimationFrame(updateSheetScrollHint);
  }
}

window.selectSheetTab = function(sheetId) {
  sheetsData.activeSheetId = sheetId;
  saveLocalSheetsData(false);
  renderSheetsView();
};

window.copySheetCellText = function(text, label) {
  copyTextToClipboard(text, label);
};

window.togglePasswordVisibility = function(pwKey) {
  if (visiblePasswords.has(pwKey)) {
    visiblePasswords.delete(pwKey);
  } else {
    visiblePasswords.add(pwKey);
  }
  renderSheetsView();
};

function renderDynamicSheetRowFields(row = null) {
  const container = document.getElementById('dynamicSheetRowFields');
  if (!container) return;
  container.innerHTML = '';

  const activeSheet = getActiveSheet();
  if (!activeSheet) return;

  const baseCols = getResolvedColumns(activeSheet);
  const fields = baseCols.map(c => ({ ...c }));

  const hasTwofa = fields.some(c => c.id === 'twofa' || c.type === '2fa');
  const needsTwofa = !hasTwofa && (
    activeSheet.id === 'sheet_fb' ||
    activeSheet.id === 'sheet_gmail' ||
    activeSheet.showActions === true
  );
  if (needsTwofa) {
    fields.push({ id: 'twofa', name: 'Mã 2FA (nếu có)', type: '2fa' });
  }

  const standardStatuses = [
    { value: 'Live', label: '🟢 Live (Hoạt động tốt)' },
    { value: 'Đang dùng', label: '🔵 Đang dùng' },
    { value: 'Chờ nuôi', label: '🟡 Chờ nuôi' },
    { value: 'Checkpoint', label: '🟠 Checkpoint' },
    { value: 'Die', label: '🔴 Die (Bị khóa)' },
    { value: 'Sai Pass', label: '🟡 Sai Pass' },
    { value: 'Chờ Duyệt', label: '⚪ Chờ Duyệt' },
    { value: 'Cần Check', label: '🟠 Cần Check' },
    { value: '', label: '— Trống —' }
  ];

  fields.forEach(col => {
    const wrapper = document.createElement('div');
    const fieldId = `dynSheetField_${col.id}`;
    const labelEl = document.createElement('label');
    labelEl.className = 'block text-xs font-semibold text-slate-300 mb-1';
    labelEl.setAttribute('for', fieldId);
    labelEl.textContent = col.name || col.id;
    wrapper.appendChild(labelEl);

    const rawVal = row ? row[col.id] : undefined;
    const currentVal = (rawVal === null || rawVal === undefined) ? '' : String(rawVal);
    const colType = col.type || 'text';

    let control;
    if (colType === 'status') {
      control = document.createElement('select');
      control.className = 'w-full bg-slate-950 text-xs text-white rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500';
      const targetVal = row ? currentVal : 'Live';
      let matched = false;
      standardStatuses.forEach(optDef => {
        const opt = document.createElement('option');
        opt.value = optDef.value;
        opt.textContent = optDef.label;
        if (optDef.value === targetVal) {
          opt.selected = true;
          matched = true;
        }
        control.appendChild(opt);
      });
      if (!matched && targetVal) {
        const customOpt = document.createElement('option');
        customOpt.value = targetVal;
        customOpt.textContent = targetVal;
        customOpt.selected = true;
        control.appendChild(customOpt);
      }
    } else if (colType === 'textarea' || col.id === 'note' || col.id === 'col_note') {
      control = document.createElement('textarea');
      control.rows = 2;
      control.placeholder = `Nhập ${(col.name || col.id).toLowerCase()}...`;
      control.className = 'w-full bg-slate-950 text-xs text-white rounded-xl p-2.5 border border-white/10 focus:outline-none focus:border-emerald-500';
      control.value = currentVal;
    } else if (colType === 'number') {
      control = document.createElement('input');
      control.type = 'number';
      control.step = 'any';
      control.placeholder = '0';
      control.className = 'w-full bg-slate-950 text-xs text-white rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 font-mono';
      control.value = currentVal;
    } else if (colType === 'link') {
      control = document.createElement('input');
      control.type = 'url';
      control.placeholder = 'https://...';
      control.className = 'w-full bg-slate-950 text-xs text-cyan-300 rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500 font-mono';
      control.value = currentVal;
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.placeholder = `Nhập ${(col.name || col.id).toLowerCase()}...`;
      const isMono = colType === 'password' || colType === 'copy_text' || colType === '2fa' || col.id === 'username';
      control.className = `w-full bg-slate-950 text-xs text-white rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-emerald-500${isMono ? ' font-mono' : ''}`;
      control.value = currentVal;
    }

    control.id = fieldId;
    control.setAttribute('data-sheet-col', col.id);
    wrapper.appendChild(control);
    container.appendChild(wrapper);
  });
}

window.editSheetRow = function(rowId) {
  const activeSheet = getActiveSheet();
  if (!activeSheet) return;
  const row = (activeSheet.rows || []).find(r => r.id === rowId);
  if (!row) return;
  openSheetRowModal(row);
};

window.deleteSheetRowConfirm = function(rowId) {
  if (!confirm('Bạn có chắc muốn xóa dòng này không?')) return;
  const activeSheet = getActiveSheet();
  if (!activeSheet) return;

  activeSheet.rows = (activeSheet.rows || []).filter(r => r.id !== rowId);
  activeSheet.updatedAt = Date.now();
  triggerCloudSheetsSync();
  renderSheetsView();
  showToast('Đã xóa dòng thành công!', 'info');
};

function openSheetRowModal(row = null) {
  const rowIdInput = document.getElementById('sheetRowId');
  if (rowIdInput) rowIdInput.value = row ? row.id : '';

  renderDynamicSheetRowFields(row);

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
    const firstInput = document.querySelector('#dynamicSheetRowFields [data-sheet-col]');
    if (firstInput && typeof firstInput.focus === 'function') {
      firstInput.focus();
    }
  }
  refreshIcons();
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
  if (!container) return;
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
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  refreshIcons();

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
  loadLocalGymData();
  loadLocalSheetsData();

  // 2. Setup Checklist Sub-mode Switcher (Theo ngày vs Toàn bộ vs Nhóm tập)
  const btnModeDay = document.getElementById('btnChecklistModeDay');
  const btnModeAll = document.getElementById('btnChecklistModeAll');
  const btnModeGym = document.getElementById('btnChecklistModeGym');
  if (btnModeDay) btnModeDay.onclick = () => setChecklistViewMode('day');
  if (btnModeAll) btnModeAll.onclick = () => setChecklistViewMode('all');
  if (btnModeGym) btnModeGym.onclick = () => setChecklistViewMode('gym');

  // 2.0 Setup Gym Quick-Load Strip & Gym Section Listeners
  const btnQuickApplyGym = document.getElementById('btnQuickApplyGymGroup');
  if (btnQuickApplyGym) {
    btnQuickApplyGym.onclick = () => {
      const sel = document.getElementById('selectQuickGymGroup');
      if (sel && sel.value) {
        applyGymGroupToDate(sel.value, selectedDate, false);
      }
    };
  }
  const btnQuickClearGym = document.getElementById('btnQuickClearGymGroup');
  if (btnQuickClearGym) {
    btnQuickClearGym.onclick = () => clearGymWorkoutForDate(selectedDate);
  }

  const btnGymSubGroups = document.getElementById('btnGymSubGroups');
  const btnGymSubReview = document.getElementById('btnGymSubReview');
  if (btnGymSubGroups) btnGymSubGroups.onclick = () => setGymSubTab('groups');
  if (btnGymSubReview) btnGymSubReview.onclick = () => setGymSubTab('review');

  const btnOpenNewGroup = document.getElementById('btnOpenNewGymGroupModal');
  const panelNewGroup = document.getElementById('panelNewGymGroupForm');
  const btnCancelNewGroup = document.getElementById('btnCancelNewGymGroup');
  const formNewGroup = document.getElementById('formNewGymGroup');
  if (btnOpenNewGroup && panelNewGroup) {
    btnOpenNewGroup.onclick = () => {
      panelNewGroup.classList.toggle('hidden');
      if (!panelNewGroup.classList.contains('hidden')) {
        const nameInput = document.getElementById('inputNewGymGroupName');
        if (nameInput) nameInput.focus();
      }
      refreshIcons();
    };
  }
  if (btnCancelNewGroup && panelNewGroup) {
    btnCancelNewGroup.onclick = () => panelNewGroup.classList.add('hidden');
  }
  if (formNewGroup) {
    formNewGroup.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameEl = document.getElementById('inputNewGymGroupName');
      const focusEl = document.getElementById('inputNewGymGroupFocus');
      const dowEl = document.getElementById('selectNewGymGroupDow');
      const name = nameEl ? nameEl.value.trim() : '';
      if (!name) return;

      const now = Date.now();
      const newGroupId = `custom_group_${now}`;
      const dowRaw = dowEl ? dowEl.value : '';
      const newGroup = {
        id: newGroupId,
        name,
        shortName: name,
        shortDay: '',
        dayOfWeek: dowRaw === '' ? null : Number(dowRaw),
        dayLabel: '',
        focus: focusEl ? focusEl.value.trim() : '',
        priorityNote: '',
        isRestDay: false,
        isBuiltIn: false,
        priorityLegs: false,
        color: '#8b5cf6',
        updatedAt: now,
        exercises: []
      };

      if (!Array.isArray(gymData.workoutGroups)) gymData.workoutGroups = [];
      gymData.workoutGroups.push(newGroup);
      expandedGymGroupIds.add(newGroupId);
      if (nameEl) nameEl.value = '';
      if (focusEl) focusEl.value = '';
      if (dowEl) dowEl.value = '';
      if (panelNewGroup) panelNewGroup.classList.add('hidden');

      triggerCloudGymSync();
      renderGymQuickBar();
      renderGymGroupsView();
      refreshIcons();
      showToast(`✓ Đã tạo nhóm tập "${name}"! Hãy thêm các bài tập vào nhóm.`, 'success');
    });
  }

  // Delegated interactions inside Workout Groups list
  const groupsListEl = document.getElementById('containerGymGroupsList');
  if (groupsListEl) {
    groupsListEl.addEventListener('click', (e) => {
      const applyBtn = e.target.closest('[data-gym-apply-group]');
      if (applyBtn) {
        const gid = applyBtn.getAttribute('data-gym-apply-group');
        if (gid) applyGymGroupToDate(gid, selectedDate, true);
        return;
      }
      const delGroupBtn = e.target.closest('[data-gym-del-group]');
      if (delGroupBtn) {
        const gid = delGroupBtn.getAttribute('data-gym-del-group');
        if (!gid || !confirm('Bạn có chắc muốn xóa nhóm tập tùy chỉnh này không?')) return;
        gymData.workoutGroups = (gymData.workoutGroups || []).filter(g => g.id !== gid);
        if (!Array.isArray(gymData.deletedGroupIds)) gymData.deletedGroupIds = [];
        if (!gymData.deletedGroupIds.includes(gid)) gymData.deletedGroupIds.push(gid);
        expandedGymGroupIds.delete(gid);
        triggerCloudGymSync();
        renderGymQuickBar();
        renderGymGroupsView();
        refreshIcons();
        showToast('Đã xóa nhóm tập tùy chỉnh.', 'info');
        return;
      }
      const toggleKeyBtn = e.target.closest('[data-gym-toggle-key]');
      if (toggleKeyBtn) {
        const [gid, exId] = (toggleKeyBtn.getAttribute('data-gym-toggle-key') || '').split('::');
        const grp = (gymData.workoutGroups || []).find(g => g.id === gid);
        const ex = grp && (grp.exercises || []).find(item => item.id === exId);
        if (ex) {
          ex.isKey = !ex.isKey;
          grp.updatedAt = Date.now();
          triggerCloudGymSync();
          renderGymGroupsView();
          refreshIcons();
          showToast(ex.isKey ? `★ Đã đánh dấu chủ lực: ${ex.name}` : `Đã bỏ đánh dấu ★: ${ex.name}`, 'info');
        }
        return;
      }
      const delExBtn = e.target.closest('[data-gym-del-ex]');
      if (delExBtn) {
        const [gid, exId] = (delExBtn.getAttribute('data-gym-del-ex') || '').split('::');
        const grp = (gymData.workoutGroups || []).find(g => g.id === gid);
        if (grp && Array.isArray(grp.exercises)) {
          if (!confirm('Xóa bài tập này khỏi nhóm tập?')) return;
          grp.exercises = grp.exercises.filter(item => item.id !== exId);
          grp.updatedAt = Date.now();
          triggerCloudGymSync();
          renderGymQuickBar();
          renderGymGroupsView();
          refreshIcons();
          showToast('Đã xóa bài tập khỏi nhóm.', 'info');
        }
        return;
      }
      const toggleGroupEl = e.target.closest('[data-gym-toggle-group]');
      if (toggleGroupEl) {
        const gid = toggleGroupEl.getAttribute('data-gym-toggle-group');
        if (gid) {
          if (expandedGymGroupIds.has(gid)) expandedGymGroupIds.delete(gid);
          else expandedGymGroupIds.add(gid);
          renderGymGroupsView();
          refreshIcons();
        }
      }
    });

    groupsListEl.addEventListener('submit', (e) => {
      const form = e.target.closest('[data-gym-add-ex-form]');
      if (!form) return;
      e.preventDefault();
      const gid = form.getAttribute('data-gym-add-ex-form');
      const grp = (gymData.workoutGroups || []).find(g => g.id === gid);
      if (!grp) return;

      const name = (form.elements.exName?.value || '').trim();
      if (!name) return;
      const now = Date.now();
      const newEx = {
        id: `ex_custom_${now}_${Math.random().toString(36).slice(2, 5)}`,
        order: (grp.exercises?.length || 0) + 1,
        stt: (grp.exercises?.length || 0) + 1,
        isKey: Boolean(form.elements.exIsKey?.checked),
        keyLiftIndex: null,
        excelRow: null,
        name,
        machine: (form.elements.exMachine?.value || '').trim(),
        alt: '',
        sets: Math.max(1, Number(form.elements.exSets?.value) || 3),
        reps: (form.elements.exReps?.value || '8-12').trim(),
        rir: '1-2',
        rest: (form.elements.exRest?.value || '90s').trim()
      };
      if (!Array.isArray(grp.exercises)) grp.exercises = [];
      grp.exercises.push(newEx);
      grp.updatedAt = now;

      triggerCloudGymSync();
      renderGymQuickBar();
      renderGymGroupsView();
      refreshIcons();
      showToast(`✓ Đã thêm bài "${name}" vào ${grp.name}!`, 'success');
    });
  }

  // Review & Log Tạ ★ controls
  const btnGymSync = document.getElementById('btnGymSyncToSheets');
  if (btnGymSync) btnGymSync.onclick = () => syncGymToSheets();

  const btnGymCsv = document.getElementById('btnGymExportCsv');
  if (btnGymCsv) btnGymCsv.onclick = () => exportGymCsv();

  const weekSelectEl = document.getElementById('selectGymReviewWeek');
  if (weekSelectEl) {
    weekSelectEl.addEventListener('change', (e) => {
      selectedGymReviewWeek = Math.max(1, Math.min(12, Number(e.target.value) || 1));
      renderGymReviewView();
      refreshIcons();
    });
  }

  ['inputGymBaselineWaist', 'inputGymWeekWeight', 'inputGymWeekWaist', 'selectGymWeekFeel', 'inputGymWeekNote'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', saveSundayCheckinField);
    if (el.tagName === 'INPUT') {
      el.addEventListener('blur', saveSundayCheckinField);
    }
  });

  // Delegated inline weight edits for 12 ★ Key Lifts
  const keyLiftsEl = document.getElementById('containerGymKeyLifts');
  if (keyLiftsEl) {
    const handleKeyLiftSave = (e) => {
      const inp = e.target.closest('[data-keylift-ex]');
      if (!inp) return;
      const exId = inp.getAttribute('data-keylift-ex');
      if (exId) saveKeyLiftWeekWeight(exId, inp.value);
    };
    keyLiftsEl.addEventListener('change', handleKeyLiftSave);
    keyLiftsEl.addEventListener('focusout', handleKeyLiftSave);
  }

  // Delegated "Xem ngày" button inside Permanent Daily Gym Archive
  const gymHistoryEl = document.getElementById('containerGymDailyHistory');
  if (gymHistoryEl) {
    gymHistoryEl.addEventListener('click', (e) => {
      const jumpBtn = e.target.closest('[data-gym-jump-date]');
      if (!jumpBtn) return;
      const dStr = jumpBtn.getAttribute('data-gym-jump-date');
      if (dStr) {
        selectedDate = dStr;
        setChecklistViewMode('day');
      }
    });
  }

  // 2.1 Setup Date Step Navigation & Jump to Today
  const btnStepPrev = document.getElementById('btnDateStepPrev');
  const btnStepNext = document.getElementById('btnDateStepNext');
  const btnJumpToday = document.getElementById('btnJumpToToday');

  if (btnStepPrev) {
    btnStepPrev.onclick = () => {
      selectedDate = addDaysToDateStr(selectedDate, -1);
      renderApp();
    };
  }
  if (btnStepNext) {
    btnStepNext.onclick = () => {
      selectedDate = addDaysToDateStr(selectedDate, 1);
      renderApp();
    };
  }
  if (btnJumpToday) {
    btnJumpToday.onclick = () => {
      selectedDate = getTodayDateStr();
      renderApp();
    };
  }

  // Custom date picker input
  const datePickerInput = document.getElementById('inputCustomDatePicker');
  if (datePickerInput) {
    datePickerInput.value = selectedDate;
    datePickerInput.addEventListener('change', (e) => {
      if (e.target.value) {
        selectedDate = e.target.value;
        renderApp();
      }
    });
  }

  // 2.2 All Tasks Mode Filters & Search
  const filterMappings = [
    { id: 'btnAllFilterAll', status: 'all' },
    { id: 'btnAllFilterPending', status: 'pending' },
    { id: 'btnAllFilterOverdue', status: 'overdue' },
    { id: 'btnAllFilterDone', status: 'completed' }
  ];
  filterMappings.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.onclick = () => {
        allFilterStatus = item.status;
        renderAllTasksView();
        refreshIcons();
      };
    }
  });

  document.querySelectorAll('[data-all-range]').forEach(btn => {
    btn.addEventListener('click', () => {
      allTimeRange = btn.getAttribute('data-all-range') || 'all';
      renderAllTasksView();
      refreshIcons();
    });
  });

  const inputAllSearch = document.getElementById('inputAllTasksSearch');
  const btnClearAllSearch = document.getElementById('btnClearAllSearch');
  if (inputAllSearch) {
    inputAllSearch.addEventListener('input', (e) => {
      const val = e.target.value;
      if (btnClearAllSearch) btnClearAllSearch.classList.toggle('hidden', !val);
      if (allSearchDebounceTimer) clearTimeout(allSearchDebounceTimer);
      allSearchDebounceTimer = setTimeout(() => {
        allSearchQuery = val;
        renderAllTasksView();
        refreshIcons();
      }, 120);
    });
  }
  if (btnClearAllSearch && inputAllSearch) {
    btnClearAllSearch.onclick = () => {
      if (allSearchDebounceTimer) clearTimeout(allSearchDebounceTimer);
      inputAllSearch.value = '';
      allSearchQuery = '';
      renderAllTasksView();
      refreshIcons();
      inputAllSearch.focus();
    };
  }

  const btnAllSort = document.getElementById('btnAllTasksSort');
  if (btnAllSort) {
    btnAllSort.onclick = () => {
      allSortOrder = allSortOrder === 'desc' ? 'asc' : 'desc';
      renderAllTasksView();
      refreshIcons();
    };
  }

  const btnMoveAllOverdueFromAll = document.getElementById('btnMoveAllOverdueFromAll');
  if (btnMoveAllOverdueFromAll) {
    btnMoveAllOverdueFromAll.onclick = moveAllOverdueToToday;
  }

  const btnResetAllFilters = document.getElementById('btnResetAllFilters');
  if (btnResetAllFilters) {
    btnResetAllFilters.onclick = () => {
      if (allSearchDebounceTimer) clearTimeout(allSearchDebounceTimer);
      allFilterStatus = 'all';
      allTimeRange = 'all';
      allSearchQuery = '';
      if (inputAllSearch) inputAllSearch.value = '';
      renderAllTasksView();
      refreshIcons();
    };
  }

  // 2.3 History View Filters
  const selectHistoryMonth = document.getElementById('selectHistoryMonth');
  if (selectHistoryMonth) {
    selectHistoryMonth.addEventListener('change', (e) => {
      historyMonthFilter = e.target.value || 'all';
      renderHistoryView();
      refreshIcons();
    });
  }

  const inputHistorySearch = document.getElementById('inputHistorySearch');
  if (inputHistorySearch) {
    inputHistorySearch.addEventListener('input', (e) => {
      const val = e.target.value;
      if (historySearchDebounceTimer) clearTimeout(historySearchDebounceTimer);
      historySearchDebounceTimer = setTimeout(() => {
        historySearchQuery = val;
        renderHistoryView();
        refreshIcons();
      }, 120);
    });
  }

  // 3. Tab buttons
  document.getElementById('tabBtnChecklist').onclick = () => switchTab('checklist');
  const tabSheetsBtn = document.getElementById('tabBtnSheets');
  if (tabSheetsBtn) tabSheetsBtn.onclick = () => switchTab('sheets');
  const tabAutoFbBtn = document.getElementById('tabBtnAutoFb');
  if (tabAutoFbBtn) tabAutoFbBtn.onclick = () => switchTab('autofb');
  document.getElementById('tabBtnHistory').onclick = () => switchTab('history');

  // 3.1 Sheet listeners (debounced search + delegated tab & cell actions)
  const inputSearch = document.getElementById('inputSearchSheetRows');
  if (inputSearch) {
    inputSearch.addEventListener('input', (e) => {
      const val = e.target.value;
      if (sheetSearchDebounceTimer) clearTimeout(sheetSearchDebounceTimer);
      sheetSearchDebounceTimer = setTimeout(() => {
        sheetSearchQuery = val;
        renderSheetsView();
      }, 150);
    });
  }

  const sheetTabsList = document.getElementById('sheetTabsList');
  if (sheetTabsList) {
    sheetTabsList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sheet-id]');
      if (!btn) return;
      const sheetId = btn.getAttribute('data-sheet-id');
      if (sheetId) selectSheetTab(sheetId);
    });
  }

  const sheetTableBody = document.getElementById('sheetTableBody');
  if (sheetTableBody) {
    sheetTableBody.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy-row][data-copy-col]');
      if (copyBtn) {
        const rowId = copyBtn.getAttribute('data-copy-row');
        const colId = copyBtn.getAttribute('data-copy-col');
        const activeSheet = getActiveSheet();
        if (!activeSheet) return;
        const row = (activeSheet.rows || []).find(r => r.id === rowId);
        if (!row) return;
        const colMeta = getResolvedColumns(activeSheet).find(c => c.id === colId);
        const label = colMeta ? colMeta.name : colId;
        copyTextToClipboard(row[colId] ?? '', label);
        return;
      }

      const togglePwBtn = e.target.closest('[data-toggle-pw]');
      if (togglePwBtn) {
        const pwKey = togglePwBtn.getAttribute('data-toggle-pw');
        if (pwKey) togglePasswordVisibility(pwKey);
        return;
      }

      const editBtn = e.target.closest('[data-edit-row]');
      if (editBtn) {
        const rowId = editBtn.getAttribute('data-edit-row');
        if (rowId) editSheetRow(rowId);
        return;
      }

      const deleteBtn = e.target.closest('[data-delete-row]');
      if (deleteBtn) {
        const rowId = deleteBtn.getAttribute('data-delete-row');
        if (rowId) deleteSheetRowConfirm(rowId);
      }
    });
  }

  const btnAddRow = document.getElementById('btnAddSheetRow');
  if (btnAddRow) btnAddRow.onclick = () => openSheetRowModal(null);

  const btnSaveSheet = document.getElementById('btnManualSaveSheet');
  if (btnSaveSheet) btnSaveSheet.onclick = () => pushCloudSheetsData(true);

  const btnNewSheet = document.getElementById('btnAddNewSheet');
  if (btnNewSheet) btnNewSheet.onclick = () => openAddSheetModal();

  // Sheet Row Modal Form submit (collect dynamic fields & preserve non-column fields like profileId)
  const formSheetRow = document.getElementById('formSheetRow');
  if (formSheetRow) {
    formSheetRow.addEventListener('submit', (e) => {
      e.preventDefault();
      const activeSheet = getActiveSheet();
      if (!activeSheet) return;
      if (!Array.isArray(activeSheet.rows)) activeSheet.rows = [];

      const rowId = document.getElementById('sheetRowId').value;
      const fieldEls = document.querySelectorAll('#dynamicSheetRowFields [data-sheet-col]');
      const collectedValues = {};
      fieldEls.forEach(el => {
        const colId = el.getAttribute('data-sheet-col');
        if (colId) {
          collectedValues[colId] = typeof el.value === 'string' ? el.value.trim() : el.value;
        }
      });

      const now = Date.now();
      if (rowId) {
        const row = activeSheet.rows.find(r => r.id === rowId);
        if (row) {
          Object.assign(row, collectedValues);
          row.updatedAt = now;
        }
      } else {
        const newRow = {
          id: `row_${now}_${Math.random().toString(36).substring(2, 6)}`,
          ...collectedValues,
          createdAt: now,
          updatedAt: now
        };
        activeSheet.rows.unshift(newRow);
      }

      activeSheet.updatedAt = now;
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
      const activeSheet = getActiveSheet();
      if (!activeSheet) return;
      activeSheet.rows = (activeSheet.rows || []).filter(r => r.id !== rowId);
      activeSheet.updatedAt = Date.now();
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

      const now = Date.now();
      const newSheetId = `sheet_${now}`;
      const newSheet = {
        id: newSheetId,
        name: sheetName,
        icon: sheetIcon,
        columns: DEFAULT_SHEET_COLUMNS.map(col => ({ ...col })),
        rows: [],
        updatedAt: now
      };

      if (!Array.isArray(sheetsData.sheets)) sheetsData.sheets = [];
      sheetsData.sheets.push(newSheet);
      sheetsData.activeSheetId = newSheetId;
      sheetsData.updatedAt = now;

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

  // 5. Bulk action: dynamic handler also kept up to date by renderTasksForSelectedDate()
  document.getElementById('btnMoveAllToTomorrow').onclick = moveAllPendingToTomorrow;

  // 6. Toggle completed list view
  const btnToggleCompleted = document.getElementById('btnToggleCompletedList');
  const iconToggleCompleted = document.getElementById('iconToggleCompleted');
  btnToggleCompleted.onclick = () => {
    showCompletedList = !showCompletedList;
    const completedList = document.getElementById('listCompletedTasks');
    completedList.classList.toggle('hidden', !showCompletedList);
    iconToggleCompleted.setAttribute('data-lucide', showCompletedList ? 'chevron-down' : 'chevron-right');
    refreshIcons();
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
    refreshIcons();
  };

  // Copy 1-Click URL button
  document.getElementById('btnCopyOneClickUrl').onclick = () => {
    const input = document.getElementById('inputOneClickUrl');
    input.select();
    input.setSelectionRange(0, 99999);
    copyTextToClipboard(input.value, 'Link đăng nhập 1-click');
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

  // Mobile / Safari iOS Lifecycle: Flush pending sync immediately before app freeze or hide
  const flushPendingSync = () => {
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
      pushCloudData(false, { keepalive: true });
    }
    if (sheetDebounceTimer) {
      clearTimeout(sheetDebounceTimer);
      sheetDebounceTimer = null;
      pushCloudSheetsData(false, { keepalive: true });
    }
    if (gymDebounceTimer) {
      clearTimeout(gymDebounceTimer);
      gymDebounceTimer = null;
      pushCloudGymData(false, { keepalive: true });
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingSync();
    }
  });

  window.addEventListener('pagehide', () => {
    flushPendingSync();
  });

  window.addEventListener('resize', () => {
    if (currentActiveTab === 'sheets') {
      updateSheetScrollHint();
    } else if (currentActiveTab === 'checklist' && checklistViewMode === 'day') {
      const strip = document.getElementById('dateChipsStrip');
      const activeChip = strip ? strip.querySelector(`[data-chip-date="${selectedDate}"]`) : null;
      if (strip && activeChip) {
        const targetLeft = activeChip.offsetLeft - (strip.clientWidth - activeChip.offsetWidth) / 2;
        strip.scrollLeft = Math.max(0, targetLeft);
      }
    }
  });

  // 9. Initial Render
  setChecklistViewMode('day');

  // 10. Background initial Cloud Sync fetch
  fetchCloudData(false);
});
