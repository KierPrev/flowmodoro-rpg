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
  tokens_spent: 0
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
      message: `¡Excelente! Llevás ${balanceMinutes} minutos por encima de tu objetivo 1:${ratio}.`,
      color: 'balance-positive',
      buff: true
    };
  } else if (balance > 10 * 60) { // > +10 min
    return {
      message: `¡Muy bien! Llevás ${balanceMinutes} minutos por encima de tu objetivo 1:${ratio}.`,
      color: 'balance-positive',
      buff: false
    };
  } else if (balance > 0) { // > 0 min
    return {
      message: `¡Bien! Estás ${balanceMinutes} minutos por encima de tu objetivo 1:${ratio}.`,
      color: 'balance-positive',
      buff: false
    };
  } else if (balance === 0) { // = 0
    return {
      message: `Perfecto equilibrio. Mantenés tu objetivo 1:${ratio}.`,
      color: 'balance-neutral',
      buff: false
    };
  } else if (balance > -10 * 60) { // > -10 min
    return {
      message: `Estás ${Math.abs(balanceMinutes)} minutos por debajo de tu equilibrio 1:${ratio}. Tomá un pequeño descanso o retomá el enfoque.`,
      color: 'balance-negative',
      buff: false
    };
  } else { // <= -10 min
    return {
      message: `Tu Balance está negativo. Vuelve al enfoque cuando te sientas lista/o.`,
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
   UI refs
============================ */
// Timer removed - only balance components remain

// New Balance System Elements
const elFocusLabel = $('#focusLabel');
const elBreakLabel = $('#breakLabel');
const elRatioProductivoLabel = $('#ratioProductivoLabel');
const elBalanceFeedback = $('#balanceFeedback');

const elBtnToggleMode = $('#btnToggleMode');
const elBtnStartPause = $('#btnStartPause');
const elBtnForget = $('#btnForget');

const elBossName = $('#bossName');
const elBossHp = $('#bossHp');
const elBossHpChunk = $('#bossHpChunk');
const elBossOverlay = $('#bossOverlay');
const elHpInfo = $('#hpInfo');

const elMore = $('#moreArea');
const elBtnMore = $('#btnMore');

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
  // EXP / Nivel (Elden Ring style - no numbers)
  const lvl = level(state);
  const expn = expInLevel(state);
  const expPct = (expn / LEVEL_SIZE) * 100;
  elExpChunk.style.width = `${Math.max(0, Math.min(100, expPct))}%`;
  elExpBar.setAttribute('aria-valuenow', String(expn));
  elExpBar.setAttribute('aria-valuemax', String(LEVEL_SIZE));
  elExpInfo.textContent = ''; // Remove numbers for Elden Ring style

  // HP / Jefe (Elden Ring style - no numbers)
  const hpMax = state.hp_total | 0;
  const hpVal = hpRestante(state) | 0;
  const hpPct = hpMax > 0 ? (hpVal / hpMax) * 100 : 0;
  elBossHpChunk.style.width = `${Math.max(0, Math.min(100, hpPct))}%`;
  overlay.setProgress(hpVal, hpMax);
  elBossHp.setAttribute('aria-valuenow', String(hpVal));
  elBossHp.setAttribute('aria-valuemax', String(hpMax));
  elHpInfo.textContent = ''; // Remove numbers for Elden Ring style
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
  elRatioProductivoLabel.textContent = `Ratio Productivo: ${fmtHMSigned(bal)}`;

  // Apply visual feedback
  const feedback = getBalanceFeedback(bal, ratio);
  elBalanceFeedback.textContent = feedback.message;
  elBalanceFeedback.className = `balance-feedback ${feedback.color}`;

  // Apply color to Ratio Productivo
  elRatioProductivoLabel.className = `balance-component ${feedback.color}`;

  // Dificultad label
  elBtnDiff.textContent = DIFF_LABEL[state.difficulty] || 'Normal 1:3';
}

function updateUI(initial = false) {
  updateCountsOnly();
  if (initial) {
    if (state.exp_total === 0 && (!state.story || state.story.length === 0)) {
      // Onboarding
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
  if (hpRestante(state) === 0) {
    alert(`¡Derrotaste a ${state.boss_name}! 🐉`);
  }
  saveState(state);
  onAfterApply(kind, false);
}

function toggleStartPause() {
  if (stopRunning) {
    clearInterval(tickHandle); tickHandle = null;
    stopRunning = false;
    elBtnStartPause.textContent = '▶️';
    beep();
  } else {
    stopRunning = true;
    elBtnStartPause.textContent = '⏸️';
    tickHandle = setInterval(onTick, 1000);
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
  } else {
    stopElapsed = (state.session_break_sec | 0);
  }

  // Autostart timer when changing modes
  stopRunning = true;
  elBtnStartPause.textContent = '⏸️';
  tickHandle = setInterval(onTick, 1000);

  elBtnToggleMode.textContent = `${stopMode} 🔄`;
  updateCountsOnly();
  beep();
}

/* ---------- Auto-registro ---------- */
let autoRegistered = state.auto_registered_focus || 'none'; // none | brief | deep
let autoLastIdx = state.auto_last_idx_focus ?? null;

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

  if (stopMode === 'Enfoque') {
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
elBtnStartPause.addEventListener('click', toggleStartPause);
elBtnToggleMode.addEventListener('click', toggleMode);

elBtnForget.addEventListener('click', () => {
  if (!confirm('¿Seguro que querés olvidar los tiempos actuales? Se pondrán en cero.')) return;
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

elBtnReset.addEventListener('click', () => {
  if (!confirm('¿Seguro que querés resetear EXP, HP, historial, gemas y tiempos?')) return;
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
  elBtnStartPause.textContent = '▶️';
  elBtnToggleMode.textContent = `${stopMode} 🔄`;
  updateUI(true);
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
dlgTipsOk.addEventListener('click', () => dlgTips.close());

/* ============================
   Init
============================ */
elBtnToggleMode.textContent = `${stopMode} 🔄`;

if (state.story && state.story.length > 0) {
  const tail = state.story.slice(-6);
  elStory.textContent = ['Crónicas:', ...tail.map(s => '• ' + s)].join('\n');
} else {
  elStory.textContent = 'Tu historia se escribirá aquí al subir de nivel.';
}

updateUI(true);

// Visibilidad: pausa partículas si pestaña oculta
document.addEventListener('visibilitychange', () => {
  overlay.setPaused(document.hidden || hpRestante(state) <= 0);
});
