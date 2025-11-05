// Flowmodoro RPG — Web port (core)
// Replica lógica principal del PyQt: modos, auto-registro 10'/25', EXP/HP, tokens, dificultad, etc.

import { BossHpParticles } from './particles.js';

/* ============================
   Constantes (del original)
============================ */
const APP_KEY = 'flowmodoro_rpg_mini_v12_state';
const LEVEL_SIZE = 100;

const BASE_DANO_DEEP = 10;
const BASE_DANO_MINI = 4;
const EXP_DEEP = 10;
const EXP_MINI = 4;
const EXP_REWARD_TOKEN = 50;
const TOKEN_COST_SMALL = 1;
const TOKEN_COST_BIG = 3;
const LEVEL_BONUS_DEEP = 2;
const LEVEL_BONUS_MINI = 1;

const BASE_HP_MIN = 10;
const BASE_HP_MAX = 30;
const HP_PER_LEVEL_MIN = 8;
const HP_PER_LEVEL_MAX = 12;

const DIFF_CYCLE = ['facil', 'normal', 'avanzado'];
const DIFF_LABEL = { facil: 'Fácil 1:2', normal: 'Normal 1:3', avanzado: 'Avanzado 1:4' };
const DIFF_RATIO = { facil: 2, normal: 3, avanzado: 4 };

const BOSS_A = [
  "Thala", "Eldra", "Gor", "Varyn", "Isil", "Ner", "Kael", "Mor", "Silva", "Auren", "Luth",
  "Fjor", "Arkh", "Zar", "Tarn", "Ael", "Grim", "Veld", "Myra", "Orin", "Syla", "Rhel",
  "Vel", "Nyra", "Cor", "Ilra", "Fen", "Bryn", "Sor"
];
const BOSS_B = [
  "rion", "wyn", "gorn", "eth", "drel", "vash", "hollow", "dor", "wynne", "mist", "thorn",
  "dûn", "mar", "hael", "thir", "veil", "brand", "wraith", "bane", "shade", "kall", "moor",
  "spear", "loom", "spire"
];

const STORY_SNIPPETS = [
  "El maná fluye más fuerte en tu báculo.",
  "Las runas del aire responden a tu llamado.",
  "Tu concentración atraviesa el velo de las dudas.",
  "La luz del taller revela nuevos patrones en el Tejido.",
  "Sientes el pulso de la materia obedecer un compás secreto.",
  "El dragón del flujo te observa, complacido, desde lejos.",
  "Las calles de Aurora susurran tu nombre entre estudiosas.",
  "Tu sombra aprende a moverse un segundo antes que tú.",
  "En tus dedos, la Qualia canta con una voz más clara.",
  "La madera del báculo guarda el calor de tu última hazaña.",
  "Las constelaciones reorganizan su mapa, apenas perceptible.",
  "Un soplo de pan caliente te recuerda que lo pequeño sostiene lo grande.",
  "El río murmura respuestas que ayer no escuchabas.",
  "Pequeñas chispas azules trenzan tus pensamientos.",
  "Aparece un foco de calma: allí cabe una idea difícil.",
  "Tu respiración marca el tempo del conjuro.",
  "Los torreones de estudio prenden su vigilia para ti.",
  "Un sello antiguo se ilumina al pasar tus ojos por la página.",
  "En el filo del error encontrás un atajo honesto.",
  "Las dudas se sientan contigo; hoy no estorban, observan.",
  "El mundo se ordena en hexágonos por un instante.",
  "La noche te presta un silencio de biblioteca.",
  "Un recuerdo amable hace de escudo.",
  "Una punzada de curiosidad abre la puerta correcta.",
  "El tiempo se hace hueco y cabe tu atención entera.",
  "La ciudad respira; vos también."
];

/* ============================
   Utilidades
============================ */
const $ = sel => document.querySelector(sel);

function fantasyBossName() {
  return BOSS_A[Math.floor(Math.random() * BOSS_A.length)]
    + BOSS_B[Math.floor(Math.random() * BOSS_B.length)];
}

function fmtHMSigned(seconds) {
  const sign = seconds < 0 ? '-' : '';
  seconds = Math.abs(seconds | 0);
  const h = (seconds / 3600) | 0;
  const m = ((seconds % 3600) / 60) | 0;
  const s = seconds % 60;
  return h > 0 ? `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function beep() {
  // Solo reproducir si los sonidos de botón están habilitados
  if (!state.sound_enabled || !state.button_sound_enabled) return;

  // WebAudio beep corto (fallback universal)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.value = 0.1;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 180);
  } catch { }
}

function playNotificationSound() {
  // Solo reproducir si los sonidos están habilitados
  if (!state.sound_enabled || !state.notification_sound_enabled) return;

  // Reproducir el archivo de sonido notify.wav
  try {
    const audio = new Audio('notify.wav');
    audio.play().catch(e => {
      console.warn('No se pudo reproducir el sonido de notificación:', e);
      // Fallback al beep si el archivo de sonido falla
      beep();
    });
  } catch (e) {
    console.warn('Error al reproducir sonido de notificación:', e);
    beep();
  }
}

function showSystemNotification(title, message) {
  // Intentar notificación del sistema nativa primero
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: 'flowmodoro-rpg.png',
        tag: 'flowmodoro-notification', // Evita duplicados
        requireInteraction: true,
        silent: false
      });
    } catch (e) {
      console.warn('Error creando notificación nativa:', e);
      // Fallback al service worker
      sendNotificationToSW(title, message);
    }
  } else if ('Notification' in window && Notification.permission === 'default') {
    // Solicitar permiso si no se ha hecho antes
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: 'flowmodoro-rpg.png',
          tag: 'flowmodoro-notification',
          requireInteraction: true,
          silent: false
        });
      } else {
        // Si se deniega, usar service worker como fallback
        sendNotificationToSW(title, message);
      }
    });
  } else {
    // Si no hay soporte nativo o permiso denegado, usar service worker
    sendNotificationToSW(title, message);
  }

  // Notificación visual en la página como fallback adicional
  const notification = document.createElement('div');
  notification.className = 'break-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <h3>${title}</h3>
      <p>${message}</p>
    </div>
  `;
  document.body.appendChild(notification);

  // Animación de entrada
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Remover después de 5 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 5000);
}

/* ============================
   Estado
============================ */
const DEFAULT_STATE = {
  exp_total: 0,
  dano_total: 0,
  history: [],
  hp_total: BASE_HP_MAX,
  boss_name: "Sombras sin nombre",
  last_level: 1,
  story: [],
  total_focus_sec: 0,
  total_break_sec: 0,
  session_focus_sec: 0,
  session_break_sec: 0,
  auto_registered_focus: "none", // none | brief | deep
  auto_last_idx_focus: null,
  difficulty: "normal",
  tokens_spent: 0,
  has_seen_tips: false,
  zen_mode: false,
  // Configuración de sonido
  sound_enabled: true,
  notification_sound_enabled: true,
  button_sound_enabled: true,
  // Modo oscuro automático
  auto_dark_mode: true,
  // Estadísticas
  session_history: [], // {date: string, focus_time: number, completed: boolean}
  daily_sessions: 0,
  best_streak: 0,
  current_streak: 0,
  last_session_date: null,
  // Logros
  achievements: [], // Array de IDs de logros desbloqueados
  // Alarma
  alarm_enabled: false,
  alarm_minutes: 5,
  alarm_start_time: null
};

function loadState() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return seedState();
    const data = JSON.parse(raw);
    // backfill
    for (const [k, v] of Object.entries(DEFAULT_STATE)) {
      if (!(k in data)) data[k] = v;
    }
    if (!Number.isInteger(data.hp_total) || data.hp_total <= 0) data.hp_total = BASE_HP_MAX;
    if (!data.boss_name) data.boss_name = fantasyBossName();
    if (!('last_level' in data)) data.last_level = 1 + Math.floor(data.exp_total / LEVEL_SIZE);
    return data;
  } catch {
    return seedState();
  }
}
function seedState() {
  const s = structuredClone(DEFAULT_STATE);
  s.hp_total = BASE_HP_MAX;
  s.boss_name = fantasyBossName();
  saveState(s);
  return s;
}
function saveState(s) {
  /* ============================
      Service Worker Registration
  =========================== */
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registrado con éxito:', registration.scope);

          // Solicitar permiso para notificaciones si aún no se ha hecho
          if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then((permission) => {
              if (permission === 'granted') {
                console.log('Permiso de notificaciones concedido');
              }
            });
          }
        })
        .catch((error) => {
          console.log('Error al registrar Service Worker:', error);
        });
    }
  }

  // Función para enviar notificaciones a través del service worker
  function sendNotificationToSW(title, body, icon = 'flowmodoro-rpg.png') {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'NOTIFICATION_REQUEST',
        title: title,
        body: body,
        icon: icon
      });
    }
  }
  localStorage.setItem(APP_KEY, JSON.stringify(s));
}

/* ============================
   Cálculos
============================ */
function level(s) { return 1 + Math.floor(s.exp_total / LEVEL_SIZE); }
function expInLevel(s) { return s.exp_total % LEVEL_SIZE; }
function hpRestante(s) { return Math.max(0, s.hp_total - s.dano_total); }
function scaledDamage(s, kind) {
  const lvl = level(s);
  return kind === 'deep'
    ? BASE_DANO_DEEP + (lvl - 1) * LEVEL_BONUS_DEEP
    : BASE_DANO_MINI + (lvl - 1) * LEVEL_BONUS_MINI;
}
function tokensAvailable(s) {
  const generated = Math.floor(s.exp_total / EXP_REWARD_TOKEN);
  const spent = s.tokens_spent || 0;
  return Math.max(0, generated - spent);
}
function balanceSeconds(s) {
  const ratio = DIFF_RATIO[s.difficulty] ?? 3;
  const allowed = Math.floor(s.total_focus_sec / ratio);
  return allowed - s.total_break_sec;
}

// New Balance System Functions
function fmtHM(seconds) {
  seconds = Math.abs(seconds | 0);
  const h = (seconds / 3600) | 0;
  const m = ((seconds % 3600) / 60) | 0;
  return h > 0 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function getBalanceFeedback(balance, ratio) {
  const balanceMinutes = Math.floor(balance / 60);

  if (balance > 20 * 60) { // > +20 min
    return {
      message: `+${balanceMinutes} min`,
      color: 'balance-positive',
      buff: true
    };
  } else if (balance > 10 * 60) { // > +10 min
    return {
      message: `+${balanceMinutes} min`,
      color: 'balance-positive',
      buff: false
    };
  } else if (balance > 0) { // > 0 min
    return {
      message: `+${balanceMinutes} min`,
      color: 'balance-positive',
      buff: false
    };
  } else if (balance === 0) { // = 0
    return {
      message: `Equilibrio`,
      color: 'balance-neutral',
      buff: false
    };
  } else if (balance > -10 * 60) { // > -10 min
    return {
      message: `${balanceMinutes} min`,
      color: 'balance-negative',
      buff: false
    };
  } else { // <= -10 min
    return {
      message: `${balanceMinutes} min`,
      color: 'balance-negative',
      buff: false
    };
  }
}

function getActiveBuffs(balance) {
  const buffs = [];
  if (balance > 20 * 60) { // > +20 min threshold
    buffs.push({ name: 'Daño +2', description: '+2 daño por sesión' });
    buffs.push({ name: 'XP +5%', description: '+5% experiencia' });
  }
  return buffs;
}

/* ============================
    Estadísticas
=========================== */
function updateStats() {
  const today = new Date().toDateString();
  const todaySessions = state.session_history.filter(s => s.date === today && s.completed).length;
  const todayTotalTime = state.session_history
    .filter(s => s.date === today)
    .reduce((sum, s) => sum + s.focus_time, 0);

  // Calcular tiempo promedio de sesión
  const completedSessions = state.session_history.filter(s => s.completed);
  const avgSessionTime = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + s.focus_time, 0) / completedSessions.length)
    : 0;

  // Calcular tiempo semanal (últimos 7 días)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyTime = state.session_history
    .filter(s => new Date(s.date) >= weekAgo)
    .reduce((sum, s) => sum + s.focus_time, 0);

  // Actualizar UI
  elStatsSessionsToday.textContent = todaySessions;
  elStatsAvgSession.textContent = fmtHM(avgSessionTime);
  elStatsBestStreak.textContent = state.best_streak;
  elStatsWeeklyTime.textContent = fmtHM(weeklyTime);
}

function recordSession(completed = false) {
  const today = new Date().toDateString();
  const sessionTime = state.session_focus_sec;

  // Añadir sesión al historial
  state.session_history.push({
    date: today,
    focus_time: sessionTime,
    completed: completed
  });

  // Mantener solo últimas 100 sesiones
  if (state.session_history.length > 100) {
    state.session_history = state.session_history.slice(-100);
  }

  // Actualizar rachas
  if (completed) {
    if (state.last_session_date === today) {
      // Ya completó una sesión hoy, no incrementar racha
    } else {
      state.current_streak++;
      state.best_streak = Math.max(state.best_streak, state.current_streak);
    }
  } else {
    // Sesión no completada, reiniciar racha
    state.current_streak = 0;
  }

  state.last_session_date = today;

  // Verificar logros después de grabar la sesión
  checkAchievements();

  saveState(state);
  updateStats();
}

/* ============================
    Sistema de Logros
=========================== */
const ACHIEVEMENTS = {
  first_session: {
    id: 'first_session',
    name: 'Primer Paso',
    description: 'Completa tu primera sesión de enfoque',
    icon: '🎯',
    condition: (s) => s.session_history.filter(sess => sess.completed).length >= 1
  },
  five_sessions_day: {
    id: 'five_sessions_day',
    name: 'Día Productivo',
    description: 'Completa 5 sesiones en un día',
    icon: '🔥',
    condition: (s) => {
      const today = new Date().toDateString();
      return s.session_history.filter(sess => sess.date === today && sess.completed).length >= 5;
    }
  },
  first_boss_defeated: {
    id: 'first_boss_defeated',
    name: 'Victoria Inicial',
    description: 'Derrota a tu primer jefe',
    icon: '🐉',
    condition: (s) => s.history.length >= 1
  },
  level_five: {
    id: 'level_five',
    name: 'Ascendido',
    description: 'Alcanza el nivel 5',
    icon: '⭐',
    condition: (s) => level(s) >= 5
  },
  ten_sessions: {
    id: 'ten_sessions',
    name: 'Hábitos Fuertes',
    description: 'Completa 10 sesiones en total',
    icon: '💪',
    condition: (s) => s.session_history.filter(sess => sess.completed).length >= 10
  },
  zen_master: {
    id: 'zen_master',
    name: 'Maestro Zen',
    description: 'Usa el modo zen por primera vez',
    icon: '🧘',
    condition: (s) => s.zen_mode === true
  }
};

function checkAchievements() {
  const newAchievements = [];

  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    if (!state.achievements.includes(id) && achievement.condition(state)) {
      state.achievements.push(id);
      newAchievements.push(achievement);
    }
  }

  // Mostrar notificaciones para logros nuevos
  newAchievements.forEach(achievement => {
    showAchievementNotification(achievement);
  });
}

function showAchievementNotification(achievement) {
  const notification = document.createElement('div');
  notification.className = 'achievement-notification';
  notification.innerHTML = `
    <div class="achievement-content">
      <div class="achievement-icon">${achievement.icon}</div>
      <div class="achievement-text">
        <div class="achievement-name">¡Logro desbloqueado!</div>
        <div class="achievement-title">${achievement.name}</div>
        <div class="achievement-desc">${achievement.description}</div>
      </div>
    </div>
  `;

  document.body.appendChild(notification);

  // Animación de entrada
  setTimeout(() => notification.classList.add('show'), 10);

  // Remover después de 4 segundos
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);

  // Reproducir sonido de logro
  playNotificationSound();
}

function updateAchievementsDisplay() {
  elAchievementsList.innerHTML = '';

  Object.values(ACHIEVEMENTS).forEach(achievement => {
    const isUnlocked = state.achievements.includes(achievement.id);
    const item = document.createElement('div');
    item.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;

    item.innerHTML = `
      <div class="achievement-item-icon">${achievement.icon}</div>
      <div class="achievement-item-text">
        <div class="achievement-item-name">${achievement.name}</div>
        <div class="achievement-item-desc">${achievement.description}</div>
      </div>
    `;

    elAchievementsList.appendChild(item);
  });
}

/* ============================
    Modo Oscuro Automático
=========================== */
function shouldUseDarkMode() {
  if (!state.auto_dark_mode) return false;

  const now = new Date();
  const hour = now.getHours();

  // Modo oscuro de 8 PM (20:00) a 6 AM (06:00)
  return hour >= 20 || hour < 6;
}

function applyTheme() {
  const shouldBeDark = shouldUseDarkMode();
  document.documentElement.style.setProperty('--theme-mode', shouldBeDark ? 'dark' : 'light');

  // Aplicar clase al body para CSS
  document.body.classList.toggle('force-dark-mode', shouldBeDark);
  document.body.classList.toggle('force-light-mode', !shouldBeDark);
}

function checkAndApplyTheme() {
  applyTheme();
}

/* ============================
   UI refs
============================ */
// Timer removed - only balance components remain

// New Balance System Elements
const elFocusLabel = $('#focusLabel');
const elBreakLabel = $('#breakLabel');
const elRatioProductivoLabel = $('#ratioProductivoLabel');
const elBalanceFeedback = $('#balanceFeedback');

const elBtnZenMode = $('#btnZenMode');
const elBtnForget = $('#btnForget');

const elBossName = $('#bossName');
const elBossHp = $('#bossHp');
const elBossHpChunk = $('#bossHpChunk');
const elBossOverlay = $('#bossOverlay');
const elHpInfo = $('#hpInfo');

const elMore = $('#moreArea');
const elBtnMore = $('#btnMore');
const elBtnSettings = $('#btnSettings');
const elDlgSettings = $('#dlgSettings');
const elDlgSettingsOk = $('#dlgSettingsOk');

const elExpBar = $('#expBar');
const elExpChunk = $('#expChunk');
const elExpInfo = $('#expInfo');

const elTokensLabel = $('#tokensLabel');
const elBtnTokSmall = $('#btnTokenSmall');
const elBtnTokBig = $('#btnTokenBig');

const elBtnNewBoss = $('#btnNewBoss');
const elBtnDiff = $('#btnDiff');
const elBtnReset = $('#btnReset');

const elStory = $('#storyText');

// Estadísticas
const elStatsSessionsToday = $('#statsSessionsToday');
const elStatsAvgSession = $('#statsAvgSession');
const elStatsBestStreak = $('#statsBestStreak');
const elStatsWeeklyTime = $('#statsWeeklyTime');

// Indicador de progreso de sesión
const elSessionProgressFill = $('#sessionProgressFill');

// Configuración de sonido
const elSoundMaster = $('#soundMaster');
const elSoundNotifications = $('#soundNotifications');
const elSoundButtons = $('#soundButtons');

// Modo automático
const elAutoDarkMode = $('#autoDarkMode');

// Logros
const elAchievementsList = $('#achievementsList');

// Alarma
const elBtnAlarm = $('#btnAlarm');
const elAlarmPopover = $('#alarmPopover');
const elAlarmSlider = $('#alarmSlider');
const elAlarmValue = $('#alarmValue');
const elAlarmSet = $('#alarmSet');
const elAlarmCancel = $('#alarmCancel');
const elAlarmPresets = document.querySelectorAll('.alarm-preset');

const dlgLevel = $('#dlgLevel');
const dlgLevelText = $('#dlgLevelText');
const dlgLevelOk = $('#dlgLevelOk');

const dlgTips = $('#dlgTips');
const dlgTipsOk = $('#dlgTipsOk');

/* ============================
   Cronómetro & runtime
============================ */
let state = loadState();

let stopMode = 'Enfoque';
let stopElapsed = state.session_focus_sec | 0;
let stopRunning = false;
let tickHandle = null;

// Partículas/overlay
const overlay = new BossHpParticles(elBossHp, elBossHpChunk, elBossOverlay);

// Timer removed - no setTimeLabel function needed anymore

function updateCountsOnly() {
  // EXP / Nivel - Show percentage inside bar
  const lvl = level(state);
  const expn = expInLevel(state);
  const expPct = (expn / LEVEL_SIZE) * 100;
  elExpChunk.style.width = `${Math.max(0, Math.min(100, expPct))}%`;
  elExpBar.setAttribute('aria-valuenow', String(expn));
  elExpBar.setAttribute('aria-valuemax', String(LEVEL_SIZE));
  elExpInfo.textContent = `${Math.round(expPct)}%`; // Show percentage

  // HP / Jefe - Show percentage inside bar with proper contrast
  const hpMax = state.hp_total | 0;
  const hpVal = hpRestante(state) | 0;
  const hpPct = hpMax > 0 ? (hpVal / hpMax) * 100 : 0;
  elBossHpChunk.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;
  overlay.setProgress(hpVal, hpMax);
  elBossHp.setAttribute('aria-valuenow', String(hpVal));
  elBossHp.setAttribute('aria-valuemax', String(hpMax));
  elHpInfo.textContent = `${Math.round(hpPct)}%`; // Show percentage
  elBossName.textContent = `🐉 — ${state.boss_name}`;

  // Tokens
  const tAvail = tokensAvailable(state);
  elTokensLabel.textContent = `Gemas: ${tAvail}`;
  elBtnTokSmall.disabled = tAvail < TOKEN_COST_SMALL;
  elBtnTokBig.disabled = tAvail < TOKEN_COST_BIG;

  // New Balance System Display
  const bal = balanceSeconds(state);
  const ratio = DIFF_RATIO[state.difficulty] ?? 3;

  // Update component labels
  elFocusLabel.textContent = `Enfoque: ${fmtHM(state.total_focus_sec)}`;
  elBreakLabel.textContent = `Descanso: ${fmtHM(state.total_break_sec)}`;

  // Update active state for balance labels
  elFocusLabel.classList.toggle('active', stopMode === 'Enfoque' && stopRunning);
  elBreakLabel.classList.toggle('active', stopMode === 'Descanso' && stopRunning);

  // Update Neto label with time value
  const netoTime = fmtHMSigned(bal);
  // Keep the popover trigger and update only the time part
  const timeSpan = elRatioProductivoLabel.querySelector('.neto-time');
  if (timeSpan) {
    timeSpan.textContent = netoTime;
  } else {
    elRatioProductivoLabel.innerHTML = `<span class="popover-trigger">?</span> Neto: <span class="neto-time">${netoTime}</span>`;
  }

  // Apply visual feedback
  const feedback = getBalanceFeedback(bal, ratio);
  elBalanceFeedback.textContent = feedback.message;
  elBalanceFeedback.className = `balance-feedback ${feedback.color}`;

  // Apply color to Ratio Productivo
  elRatioProductivoLabel.className = `balance-component ${feedback.color}`;

  // Dificultad label
  elBtnDiff.textContent = DIFF_LABEL[state.difficulty] || 'Normal 1:3';

  // Actualizar indicador de progreso de sesión
  updateSessionProgress();
}

function updateSessionProgress() {
  const sessionTime = stopMode === 'Enfoque' ? state.session_focus_sec : state.session_break_sec;

  if (stopMode === 'Enfoque') {
    // Update single progress bar with phase transitions for focus mode
    updateFocusPhase(sessionTime);
  } else {
    // For break mode, use simple progress
    const targetTime = 5 * 60; // 5 min descanso típico
    const progress = Math.min(100, (sessionTime / targetTime) * 100);

    // Reset progress bar for break mode
    resetProgressBar();
  }
}

function updateFocusPhase(sessionTime) {
  const phases = [
    { startTime: 0, endTime: 10, className: 'phase-1' },        // 0-10 segundos (Green)
    { startTime: 10, endTime: 10 * 60, className: 'phase-2' },  // 10s-10min (Blue)
    { startTime: 10 * 60, endTime: 20 * 60, className: 'phase-3' } // 10min-20min (Purple)
  ];

  // Determine current phase
  let currentPhase = null;
  let progress = 0;

  for (const phase of phases) {
    if (sessionTime >= phase.startTime && sessionTime <= phase.endTime) {
      currentPhase = phase;
      const phaseDuration = phase.endTime - phase.startTime;
      progress = Math.min(100, ((sessionTime - phase.startTime) / phaseDuration) * 100);
      break;
    }
  }

  // If session time exceeds all phases, show full progress
  if (!currentPhase && sessionTime > phases[phases.length - 1].endTime) {
    currentPhase = phases[phases.length - 1];
    progress = 100;
  }

  // Update progress bar
  if (currentPhase) {
    // Remove all phase classes
    elSessionProgressFill.classList.remove('phase-1', 'phase-2', 'phase-3');
    // Add current phase class
    elSessionProgressFill.classList.add(currentPhase.className);
    // Update progress width
    elSessionProgressFill.style.width = `${progress}%`;
  } else {
    // Reset if no phase (shouldn't happen, but safety)
    resetProgressBar();
  }
}

function resetProgressBar() {
  elSessionProgressFill.classList.remove('phase-1', 'phase-2', 'phase-3');
  elSessionProgressFill.style.width = '0%';
}

function updateUI(initial = false) {
  updateCountsOnly();

  // Aplicar modo zen
  document.body.classList.toggle('zen-mode', state.zen_mode);

  if (initial) {
    if (!state.has_seen_tips) {
      // Show tips only once
      try { dlgTips.showModal(); } catch { }
    }
  }
}

function onAfterApply(kind, upgraded = false) {
  // Check level up
  const prev = state.last_level | 0;
  const now = level(state);
  if (now > prev) {
    const snippet = STORY_SNIPPETS[(Math.random() * STORY_SNIPPETS.length) | 0];
    state.story.push(`Nivel ${now}: ${snippet}`);
    state.last_level = now;
    saveState(state);
    dlgLevelText.textContent = `Alcanzaste el nivel ${now}.`;
    try { dlgLevel.showModal(); } catch { }
  }
  updateCountsOnly();
}

function applyBlock(kind) {
  const exp = (kind === 'deep') ? EXP_DEEP : EXP_MINI;
  const dano = scaledDamage(state, kind);
  state.exp_total += exp;
  state.dano_total += dano;
  state.history.push({ exp, dano, tipo: kind });

  // Registrar sesión completada para estadísticas
  recordSession(kind === 'deep');

  if (hpRestante(state) === 0) {
    showSystemNotification(
      '¡Jefe derrotado! 🐉',
      `¡Derrotaste a ${state.boss_name}!`
    );
  }
  saveState(state);
  onAfterApply(kind, false);
}

function startTimer() {
  if (!stopRunning) {
    stopRunning = true;
    tickHandle = setInterval(onTick, 1000);
    beep();
  }
}

function stopTimer() {
  if (stopRunning) {
    clearInterval(tickHandle); tickHandle = null;
    stopRunning = false;
    beep();
  }
}

function toggleMode() {
  // Guardar sesiones
  if (stopMode === 'Enfoque') {
    state.session_focus_sec = stopElapsed | 0;
    state.auto_registered_focus = autoRegistered;
    state.auto_last_idx_focus = autoLastIdx;
  } else {
    state.session_break_sec = stopElapsed | 0;
  }
  saveState(state);

  // Cambiar modo
  clearInterval(tickHandle); tickHandle = null;
  stopRunning = false;
  stopMode = (stopMode === 'Enfoque') ? 'Descanso' : 'Enfoque';

  if (stopMode === 'Enfoque') {
    stopElapsed = (state.session_focus_sec | 0);
    autoRegistered = state.auto_registered_focus || 'none';
    autoLastIdx = state.auto_last_idx_focus ?? null;
    lastFocusNotificationTime = 0; // Reset notification tracker when starting focus
  } else {
    stopElapsed = (state.session_break_sec | 0);
  }

  // Autostart timer when changing modes
  stopRunning = true;
  tickHandle = setInterval(onTick, 1000);

  updateCountsOnly();
  beep();
}

/* ---------- Auto-registro ---------- */
let autoRegistered = state.auto_registered_focus || 'none'; // none | brief | deep
let autoLastIdx = state.auto_last_idx_focus ?? null;
let lastFocusNotificationTime = 0; // Track last 10-min notification

function onTick() {
  stopElapsed += 1;
  if (stopMode === 'Enfoque') {
    state.session_focus_sec = stopElapsed | 0;
    state.total_focus_sec += 1;
  } else {
    state.session_break_sec = stopElapsed | 0;
    state.total_break_sec += 1;
  }
  saveState(state);
  updateCountsOnly();

  // Detectar cuando el tiempo de descanso llega a cero
  if (stopMode === 'Descanso') {
    const balance = balanceSeconds(state);
    if (balance >= 0 && balance <= 5) { // Cuando el balance está entre 0 y 5 segundos
      // Solo activar la notificación una vez cuando cruza a positivo
      if (balance === 0) {
        playNotificationSound();
        showSystemNotification(
          '¡Descanso completado! 🎉',
          'Tu tiempo de descanso ha llegado a cero. ¡Es hora de volver al enfoque!'
        );
      }
    }
  }

  if (stopMode === 'Enfoque') {
    // Notificación cada 10 minutos de enfoque
    const currentFocusMinutes = Math.floor(stopElapsed / 60);
    if (currentFocusMinutes >= 10 && currentFocusMinutes % 10 === 0 && currentFocusMinutes !== lastFocusNotificationTime) {
      lastFocusNotificationTime = currentFocusMinutes;
      showSystemNotification(
        '🎯 ¡Gran concentración!',
        `¡Llevás ${currentFocusMinutes} minutos enfocados!`
      );
    }

    // upgrade a deep a los 25' (si venía de brief)
    if (stopElapsed >= 25 * 60 && autoRegistered !== 'deep') {
      if (autoRegistered === 'brief' && autoLastIdx != null) {
        const add_exp = EXP_DEEP - EXP_MINI;
        const add_dano = scaledDamage(state, 'deep') - scaledDamage(state, 'mini');
        state.exp_total += add_exp;
        state.dano_total += add_dano;
        try {
          state.history[autoLastIdx].exp = EXP_DEEP;
          state.history[autoLastIdx].dano = scaledDamage(state, 'deep');
          state.history[autoLastIdx].tipo = 'deep';
        } catch { }
        autoRegistered = 'deep';
        state.auto_registered_focus = 'deep';
        saveState(state);
        beep();
        onAfterApply('deep', true);
      } else {
        applyBlock('deep');
        autoRegistered = 'deep';
        state.auto_registered_focus = 'deep';
        state.auto_last_idx_focus = null;
        saveState(state);
        beep();
      }
    } else if (stopElapsed >= 10 * 60 && autoRegistered === 'none') {
      applyBlock('mini');
      autoRegistered = 'brief';
      autoLastIdx = state.history.length - 1;
      state.auto_registered_focus = 'brief';
      state.auto_last_idx_focus = autoLastIdx;
      saveState(state);
      beep();
    }
  }
}

/* ============================
   Acciones / botones
============================ */

function toggleZenMode() {
  state.zen_mode = !state.zen_mode;
  saveState(state);
  updateUI();
  checkAchievements(); // Verificar logro de modo zen
  beep();
}

elBtnZenMode.addEventListener('click', toggleZenMode);

function showConfirmationDialog(message, onConfirm) {
  // Crear diálogo de confirmación personalizado
  const dialog = document.createElement('div');
  dialog.className = 'confirmation-dialog';
  dialog.innerHTML = `
    <div class="confirmation-content">
      <div class="confirmation-icon">⚠️</div>
      <div class="confirmation-message">${message}</div>
      <div class="confirmation-actions">
        <button class="btn confirmation-cancel">Cancelar</button>
        <button class="btn danger confirmation-confirm">Confirmar</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Animación de entrada
  setTimeout(() => dialog.classList.add('show'), 10);

  return new Promise((resolve) => {
    const cancelBtn = dialog.querySelector('.confirmation-cancel');
    const confirmBtn = dialog.querySelector('.confirmation-confirm');

    const cleanup = () => {
      dialog.classList.remove('show');
      setTimeout(() => {
        if (dialog.parentNode) {
          dialog.parentNode.removeChild(dialog);
        }
      }, 300);
    };

    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    confirmBtn.addEventListener('click', () => {
      cleanup();
      onConfirm();
      resolve(true);
    });
  });
}

elBtnForget.addEventListener('click', async () => {
  const confirmed = await showConfirmationDialog(
    '¿Seguro que querés olvidar los tiempos actuales? Se pondrán en cero.',
    () => {
      stopTimer();

      // Calculate session summary before resetting
      const focusMinutes = Math.floor(state.session_focus_sec / 60);
      const ratio = DIFF_RATIO[state.difficulty] ?? 3;
      const expectedBreakMinutes = Math.floor(state.session_focus_sec / ratio / 60);
      const actualBreakMinutes = Math.floor(state.session_break_sec / 60);
      const balanceMinutes = Math.floor(balanceSeconds(state) / 60);

      // Show session summary notification
      showSystemNotification(
        '🏁 Sesión finalizada',
        `Enfoque: ${focusMinutes} min\nDescanso esperado: ${expectedBreakMinutes} min\nDescanso usado: ${actualBreakMinutes} min\nBalance: ${balanceMinutes >= 0 ? '+' : ''}${balanceMinutes} min`
      );

      state.total_focus_sec = 0;
      state.total_break_sec = 0;
      state.session_focus_sec = 0;
      state.session_break_sec = 0;
      stopElapsed = 0;
      autoRegistered = 'none';
      state.auto_registered_focus = 'none';
      autoLastIdx = null;
      state.auto_last_idx_focus = null;
      saveState(state);
      updateCountsOnly();
    }
  );
});

elBtnMore.addEventListener('click', () => {
  const open = elMore.classList.toggle('open');
  elBtnMore.textContent = open ? 'Menos…' : 'Más…';
});


elBtnDiff.addEventListener('click', () => {
  const cur = state.difficulty || 'normal';
  const idx = DIFF_CYCLE.indexOf(cur);
  const next = DIFF_CYCLE[(idx >= 0 ? idx : 1) + 1 === DIFF_CYCLE.length ? 0 : (idx + 1)];
  state.difficulty = next;
  saveState(state);
  updateCountsOnly();
  // pequeño "pulse" visual en el feedback
  elBalanceFeedback.style.transition = 'opacity 500ms ease';
  elBalanceFeedback.style.opacity = '0.35';
  setTimeout(() => elBalanceFeedback.style.opacity = '1', 10);
});

elBtnNewBoss.addEventListener('click', () => {
  const lvl = level(state);
  let min_hp = BASE_HP_MIN + (lvl - 1) * HP_PER_LEVEL_MIN;
  let max_hp = BASE_HP_MAX + (lvl - 1) * HP_PER_LEVEL_MAX;
  if (max_hp < min_hp) max_hp = min_hp + 10;
  state.hp_total = Math.floor(min_hp + Math.random() * (max_hp - min_hp + 1));
  state.dano_total = 0;
  state.boss_name = fantasyBossName();
  saveState(state);
  updateCountsOnly();
});

elBtnReset.addEventListener('click', async () => {
  const confirmed = await showConfirmationDialog(
    '¿Seguro que querés resetear EXP, HP, historial, gemas y tiempos? Esta acción no se puede deshacer.',
    () => {
      state = structuredClone(DEFAULT_STATE);
      state.hp_total = Math.floor(BASE_HP_MIN + Math.random() * (BASE_HP_MAX - BASE_HP_MIN + 1));
      state.boss_name = fantasyBossName();
      saveState(state);

      clearInterval(tickHandle); tickHandle = null;
      stopRunning = false;
      stopMode = 'Enfoque';
      stopElapsed = state.session_focus_sec | 0;
      autoRegistered = 'none';
      autoLastIdx = null;
      updateUI(true);
      updateStats();
      updateAchievementsDisplay();
      checkAchievements();
      checkAndApplyTheme();

      // Verificar cambio de tema cada 5 minutos
      setInterval(checkAndApplyTheme, 5 * 60 * 1000);

      // Inicializar configuración de sonido
      elSoundMaster.checked = state.sound_enabled;
      elSoundNotifications.checked = state.notification_sound_enabled;
      elSoundButtons.checked = state.button_sound_enabled;

      // Inicializar modo automático
      elAutoDarkMode.checked = state.auto_dark_mode;

      // Event listeners para configuración de sonido
      elSoundMaster.addEventListener('change', (e) => {
        state.sound_enabled = e.target.checked;
        saveState(state);
      });

      elSoundNotifications.addEventListener('change', (e) => {
        state.notification_sound_enabled = e.target.checked;
        saveState(state);
      });

      elSoundButtons.addEventListener('change', (e) => {
        state.button_sound_enabled = e.target.checked;
        saveState(state);
      });

      elAutoDarkMode.addEventListener('change', (e) => {
        state.auto_dark_mode = e.target.checked;
        saveState(state);
        checkAndApplyTheme();
      });
    }
  );
});

elBtnTokSmall.addEventListener('click', () => {
  const avail = tokensAvailable(state);
  if (avail < TOKEN_COST_SMALL) { alert('No tenés tokens suficientes.'); return; }
  state.tokens_spent = (state.tokens_spent | 0) + TOKEN_COST_SMALL;
  saveState(state);
  updateCountsOnly();
  beep();
});
elBtnTokBig.addEventListener('click', () => {
  const avail = tokensAvailable(state);
  if (avail < TOKEN_COST_BIG) { alert('No tenés tokens suficientes.'); return; }
  state.tokens_spent = (state.tokens_spent | 0) + TOKEN_COST_BIG;
  saveState(state);
  updateCountsOnly();
  beep();
});

// Dialogs
dlgLevelOk.addEventListener('click', () => dlgLevel.close());
dlgTipsOk.addEventListener('click', () => {
  state.has_seen_tips = true;
  saveState(state);
  dlgTips.close();
});

/* ============================
   Init
============================ */

if (state.story && state.story.length > 0) {
  const tail = state.story.slice(-6);
  elStory.textContent = ['Crónicas:', ...tail.map(s => '• ' + s)].join('\n');
} else {
  elStory.textContent = 'Tu historia se escribirá aquí al subir de nivel.';
}

// Add popover to Neto label
const popoverHTML = `
  <div class="popover">
    <div class="popover-content">
      <strong>¿Qué es el tiempo neto?</strong><br><br>
      Es el tiempo que te queda para descansar después de trabajar.<br><br>
      <strong>Fórmula simple:</strong><br>
      Tiempo neto = (Tiempo de trabajo ÷ 3) - Tiempo de descanso<br><br>
      <strong>Ejemplo fácil:</strong><br>
      Si trabajas 60 minutos, puedes descansar 20 minutos (60 ÷ 3 = 20)<br>
      Si ya descansaste 15 minutos, te quedan 5 minutos netos (20 - 15 = 5)<br><br>
      <strong>¿Para qué sirve?</strong><br>
      Te ayuda a mantener un equilibrio saludable entre trabajo y descanso.
    </div>
  </div>
`;
elRatioProductivoLabel.insertAdjacentHTML('beforeend', popoverHTML);

updateUI(true);
updateStats();

// Visibilidad: pausa partículas si pestaña oculta
document.addEventListener('visibilitychange', () => {
  overlay.setPaused(document.hidden || hpRestante(state) <= 0);
});

/* ============================
    Accesibilidad por teclado
=========================== */
document.addEventListener('keydown', (e) => {
  // Evitar shortcuts cuando se está escribiendo en inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch (e.key) {
    case 'Enter': // Enter - Toggle modo Enfoque/Descanso
      e.preventDefault();
      toggleMode();
      break;
    case 'z': // Z - Toggle modo Zen
    case 'Z':
      e.preventDefault();
      toggleZenMode();
      break;
    case 'Escape': // Escape - Cerrar diálogos
      e.preventDefault();
      // Cerrar cualquier diálogo abierto
      const dialogs = document.querySelectorAll('dialog[open]');
      dialogs.forEach(dialog => dialog.close());
      // Cerrar popover de configuración
      if (settingsPopoverOpen) {
        settingsPopoverOpen = false;
        elSettingsPopover.classList.remove('show');
      }
      break;
  }
});

/* ============================
   Settings Dialog Functionality
============================ */
elBtnSettings.addEventListener('click', () => {
  try { elDlgSettings.showModal(); } catch { }
});

elDlgSettingsOk.addEventListener('click', () => {
  elDlgSettings.close();
});

/* ============================
   Clickable Balance Labels
============================ */
function activateFocusTimer() {
  // If already in focus mode and timer running, do nothing
  if (stopMode === 'Enfoque' && stopRunning) return;

  // If in break mode, switch to focus mode
  if (stopMode === 'Descanso') {
    toggleMode();
  } else {
    // If in focus mode but timer not running, start it
    if (!stopRunning) {
      startTimer();
    }
  }
}

function activateBreakTimer() {
  // If already in break mode and timer running, do nothing
  if (stopMode === 'Descanso' && stopRunning) return;

  // If in focus mode, switch to break mode
  if (stopMode === 'Enfoque') {
    toggleMode();
  } else {
    // If in break mode but timer not running, start it
    if (!stopRunning) {
      startTimer();
    }
  }
}

// Add click event listeners to balance labels
elFocusLabel.addEventListener('click', activateFocusTimer);
elBreakLabel.addEventListener('click', activateBreakTimer);

// Add cursor pointer style to indicate clickability
elFocusLabel.style.cursor = 'pointer';
elBreakLabel.style.cursor = 'pointer';

/* ============================
    Alarm Functionality
=========================== */
let alarmTimeout = null;

function showAlarmPopover() {
  elAlarmPopover.classList.add('show');
  // Update slider value display
  updateAlarmValue();
}

function hideAlarmPopover() {
  elAlarmPopover.classList.remove('show');
}

function updateAlarmValue() {
  const minutes = elAlarmSlider.value;
  elAlarmValue.textContent = `${minutes} min`;
}

function setAlarm(minutes) {
  state.alarm_enabled = true;
  state.alarm_minutes = minutes;
  state.alarm_start_time = Date.now();
  saveState(state);

  // Clear any existing alarm
  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
  }

  // Set new alarm
  alarmTimeout = setTimeout(() => {
    triggerAlarm();
  }, minutes * 60 * 1000);

  hideAlarmPopover();
  beep();
}

function triggerAlarm() {
  state.alarm_enabled = false;
  state.alarm_start_time = null;
  saveState(state);

  showSystemNotification(
    '⏰ ¡Alarma!',
    `Han pasado ${state.alarm_minutes} minutos. ¡Es hora de una pausa!`
  );

  playNotificationSound();
  alarmTimeout = null;
}

function cancelAlarm() {
  state.alarm_enabled = false;
  state.alarm_start_time = null;
  saveState(state);

  if (alarmTimeout) {
    clearTimeout(alarmTimeout);
    alarmTimeout = null;
  }

  hideAlarmPopover();
  beep();
}

// Event listeners for alarm
elBtnAlarm.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (elAlarmPopover.classList.contains('show')) {
    hideAlarmPopover();
  } else {
    // Registrar service worker al iniciar la app
    registerServiceWorker();
    showAlarmPopover();
  }
});

elAlarmSlider.addEventListener('input', updateAlarmValue);

elAlarmPresets.forEach(preset => {
  preset.addEventListener('click', () => {
    const minutes = parseInt(preset.dataset.minutes);
    setAlarm(minutes);
  });
});

elAlarmSet.addEventListener('click', () => {
  const minutes = parseInt(elAlarmSlider.value);
  setAlarm(minutes);
});

elAlarmCancel.addEventListener('click', cancelAlarm);

// Close popover when clicking outside
document.addEventListener('click', (e) => {
  if (!elAlarmPopover.contains(e.target) && e.target !== elBtnAlarm) {
    hideAlarmPopover();
  }
});

// Touch event support for mobile
elBtnAlarm.addEventListener('touchstart', (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (elAlarmPopover.classList.contains('show')) {
    hideAlarmPopover();
  } else {
    showAlarmPopover();
  }
}, { passive: false });

// Initialize alarm slider
elAlarmSlider.value = state.alarm_minutes || 5;
updateAlarmValue();
