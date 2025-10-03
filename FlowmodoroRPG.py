#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Flowmodoro RPG - Mini v12.2 (PyQt5)
Cambios vs v12.1:
- Fade in/out del panel "Más…" para transición suave.
- Color del Balance: verde (positivo), ámbar (negativo), neutro si 0.
"""

import os
import sys
import json
import math
import random
import struct
import wave
import subprocess

from PyQt5.QtCore import Qt, QPropertyAnimation, QEasingCurve, QRect, QTimer, QUrl
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QProgressBar, QPushButton, QMessageBox, QGroupBox, QGraphicsOpacityEffect,
    QScrollArea, QDialog, QDialogButtonBox
)
# --- Matplotlib imports ---
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
import matplotlib.pyplot as plt
from matplotlib.animation import FuncAnimation

try:
    from PyQt5.QtMultimedia import QSoundEffect
    HAVE_QSOUND = True
except Exception:
    HAVE_QSOUND = False

APP_NAME = "Flowmodoro RPG - Mini v12.2"
STATE_FILENAME = "flowmodoro_rpg_mini_v12_state.json"
SND_FILENAME = "notify.wav"

# ----- Parámetros base -----
BASE_DANO_DEEP = 10
BASE_DANO_MINI = 4
EXP_DEEP = 10
EXP_MINI = 4
EXP_REWARD_TOKEN = 50         # +1 token cada 50 EXP
TOKEN_COST_SMALL = 1          # Cofre chico
TOKEN_COST_BIG = 3            # Cofre grande
LEVEL_SIZE = 100

# Escalado por nivel
LEVEL_BONUS_DEEP = 2
LEVEL_BONUS_MINI = 1

# HP aleatorio del jefe según nivel
BASE_HP_MIN = 10
BASE_HP_MAX = 30
HP_PER_LEVEL_MIN = 8
HP_PER_LEVEL_MAX = 12

# Dificultad -> ratio descanso permitido por enfoque (se mantiene en "Más…")
DIFF_CYCLE = ["facil", "normal", "avanzado"]
DIFF_LABEL = {"facil": "Fácil 1:2", "normal": "Normal 1:3", "avanzado": "Avanzado 1:4"}
DIFF_RATIO = {"facil": 2, "normal": 3, "avanzado": 4}

# Nombres de jefes
BOSS_NAME_PART_A = [
    "Thala", "Eldra", "Gor", "Varyn", "Isil", "Ner", "Kael", "Mor", "Silva",
    "Auren", "Luth", "Fjor", "Arkh", "Zar", "Tarn", "Ael", "Grim", "Veld", "Myra",
    "Orin", "Syla", "Rhel", "Vel", "Nyra", "Cor", "Ilra", "Fen", "Bryn", "Sor"
]
BOSS_NAME_PART_B = [
    "rion", "wyn", "gorn", "eth", "drel", "vash", "hollow", "dor", "wynne",
    "mist", "thorn", "dûn", "mar", "hael", "thir", "veil", "brand", "wraith",
    "bane", "shade", "kall", "moor", "spear", "loom", "spire"
]

STORY_SNIPPETS = [
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
]

def fantasy_boss_name():
    return random.choice(BOSS_NAME_PART_A) + random.choice(BOSS_NAME_PART_B)

def resource_path(fname: str) -> str:
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, fname)

def ensure_sound_file(path: str):
    if os.path.exists(path):
        return
    fr = 44100
    dur = 0.18
    freq = 600.0
    amp = 0.15
    n = int(fr * dur)
    with wave.open(path, "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(fr)
        for i in range(n):
            t = i / fr
            val = int(amp * 32767.0 * math.sin(2 * math.pi * freq * t))
            wf.writeframes(struct.pack("<h", val))

DEFAULT_STATE = {
    "exp_total": 0,
    "dano_total": 0,
    "history": [],
    "hp_total": BASE_HP_MAX,
    "boss_name": "Sombras sin nombre",
    "last_level": 1,
    "story": [],
    "total_focus_sec": 0,
    "total_break_sec": 0,
    "session_focus_sec": 0,
    "session_break_sec": 0,
    "auto_registered_focus": "none",
    "auto_last_idx_focus": None,
    "difficulty": "normal",
    "tokens_spent": 0
}

# ---- Estilos (compactos) ----
QSS_LIGHT = """
* { font-family: 'Inter', 'Segoe UI', 'Noto Sans', 'Ubuntu', sans-serif; font-size: 13pt; }
QMainWindow, QWidget { background: #f7f8fb; color: #1f2430; }
QGroupBox { border: 1px solid #e2e8f0; border-radius: 10px; margin-top: 8px; padding: 8px; }
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; color: #475569; font-weight: 600; }
QLabel { color: #111827; }
QLabel#timeLabel { font-size: 35pt; font-weight: 600; letter-spacing: 0.3px; }
QLabel#subtitle { font-size: 14pt; font-weight: 600; }
QLabel#muted { color: #64748b; font-size: 13pt; }
QProgressBar { background: #e5e7eb; border: 1px solid #d1d5db; border-radius: 10px; text-align: center; height: 24px; }
QProgressBar::chunk { border-radius: 8px; background-color: #10b981; }
QPushButton { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-weight: 600; }
QPushButton:hover { background: #f1f5f9; }
QPushButton:pressed { background: #e2e8f0; }
QPushButton#primary { background: #0ea5e9; color: #ffffff; border: 1px solid #0284c7; }
QPushButton#primary:hover { background: #0284c7; }
QPushButton#danger { background: #fee2e2; color: #7f1d1d; border: 1px solid #fecaca; }
QPushButton#danger:hover { background: #fecaca; }
QProgressBar#bossHp {
    background: #1e1e1e;
    border: 1px solid #660000;
    border-radius: 10px;
    text-align: center;
    height: 24px;
}
QProgressBar#bossHp::chunk {
    border-radius: 8px;
    background-color: #b22222; /* rojo fuego tipo Elden Ring */
}
QLabel#bossName {
    font-family: 'Times New Roman', 'Georgia', serif;
    font-style: italic;
    font-size: 16pt;
    color: #334155;
}
"""

QSS_DARK = """
* { font-family: 'Inter', 'Segoe UI', 'Noto Sans', 'Ubuntu', sans-serif; font-size: 13pt; }
QMainWindow, QWidget { background: #0b1220; color: #e5e7eb; }
QGroupBox { border: 1px solid #1f2a44; border-radius: 10px; margin-top: 8px; padding: 8px; }
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; color: #9aa4c2; font-weight: 600; }
QLabel { color: #e5e7eb; }
QLabel#timeLabel { font-size: 35pt; font-weight: 600; letter-spacing: 0.3px; }
QLabel#subtitle { font-size: 14pt; font-weight: 600; }
QLabel#muted { color: #94a3b8; font-size: 13pt; }
QProgressBar { background: #1e293b; border: 1px solid #293548; border-radius: 10px; text-align: center; height: 24px; }
QProgressBar::chunk { border-radius: 8px; background-color: #0ea5e9; }
QPushButton { background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; font-weight: 600; color: #e5e7eb; }
QPushButton:hover { background: #111827; }
QPushButton:pressed { background: #0b1324; }
QPushButton#primary { background: #1d4ed8; color: #ffffff; border: 1px solid #1e40af; }
QPushButton#primary:hover { background: #1e40af; }
QPushButton#danger { background: #7f1d1d; color: #fee2e2; border: 1px solid #991b1b; }
QPushButton#danger:hover { background: #991b1b; }
QProgressBar#bossHp {
    background: #1e1e1e;
    border: 1px solid #660000;
    border-radius: 10px;
    text-align: center;
    height: 24px;
}
QProgressBar#bossHp::chunk {
    border-radius: 8px;
    background-color: #b22222; /* rojo fuego tipo Elden Ring */
}
QLabel#bossName {
    font-family: 'Times New Roman', 'Georgia', serif;
    font-style: italic;
    font-size: 16pt;
    color: #e5e5e5;
}
"""

def detect_dark_mode_linux() -> bool:
    try:
        out = subprocess.check_output(
            ["gsettings", "get", "org.gnome.desktop.interface", "color-scheme"],
            stderr=subprocess.DEVNULL, text=True
        ).strip().lower()
        if "dark" in out: return True
    except Exception:
        pass
    try:
        out = subprocess.check_output(
            ["gsettings", "get", "org.gnome.desktop.interface", "gtk-theme"],
            stderr=subprocess.DEVNULL, text=True
        ).strip().lower()
        if "dark" in out: return True
    except Exception:
        pass
    try:
        out = subprocess.check_output(
            ["kreadconfig5", "--file", "kdeglobals", "--group", "General", "--key", "ColorScheme"],
            stderr=subprocess.DEVNULL, text=True
        ).strip().lower()
        if "dark" in out: return True
    except Exception:
        pass
    for k in ("GTK_THEME", "QT_STYLE_OVERRIDE", "QT_QPA_PLATFORMTHEME"):
        v = os.environ.get(k, "").lower()
        if "dark" in v: return True
    return False

def fmt_hm(total_seconds: int) -> str:
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    return f"{h:02d}:{m:02d}"

def fmt_hms_signed(seconds: int) -> str:
    sign = "-" if seconds < 0 else ""
    seconds = abs(int(seconds))
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    if h > 0:
        return f"{sign}{h:02d}:{m:02d}:{s:02d}"
    else:
        return f"{sign}{m:02d}:{s:02d}"

class DonutChartWidget(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.fig, self.ax = plt.subplots(figsize=(2.8,2.8), subplot_kw=dict(aspect="equal"))
        self.canvas = FigureCanvas(self.fig)
        lay = QVBoxLayout(self); lay.setContentsMargins(0,0,0,0)
        lay.addWidget(self.canvas)
        self.focus = 0
        self.break_ = 0
        self.balance = 0
        self._ani = None
        self._last_data = [1,0]
        self._anim_ref = None  # Mantener referencia
        self.draw_chart([1,0], animate=False)

    def set_data(self, focus, break_, balance):
        self.focus = max(0, focus)
        self.break_ = max(0, break_)
        self.balance = balance
        total = self.focus + self.break_
        if total <= 0:
            data = [1, 0]  # Pie vacío
        else:
            data = [self.focus, self.break_]
        # --- Update chart immediately for real-time feedback ---
        self.draw_chart(data, animate=False)
        self.canvas.flush_events()
        QApplication.processEvents()
        # Animate for smooth transition
        self.animate_chart(data)

    def draw_chart(self, data, animate=True):
        self.ax.clear()
        colors = ["#10b981", "#f59e0b"]  # verde, ámbar
        # --- Evita error NaN ---
        safe_data = [max(0, d) for d in data]
        if sum(safe_data) <= 0:
            safe_data = [1, 0]
        wedges, _ = self.ax.pie(
            safe_data, colors=colors, startangle=90, wedgeprops={'width':0.4}, normalize=True
        )
        # Texto en el centro: balance
        bal_text = f"{fmt_hms_signed(self.balance)}"
        self.ax.text(0,0, bal_text, ha="center", va="center", fontsize=16, fontweight="bold")
        self.ax.set(aspect="equal")
        self.fig.tight_layout()
        self.canvas.draw_idle()
        self.canvas.flush_events()
        QApplication.processEvents()

    def animate_chart(self, new_data):
        old_data = self._last_data
        frames = 20
        def lerp(a,b,t): return a + (b-a)*t
        def update(frame):
            t = frame/frames
            data = [lerp(old_data[0], new_data[0], t), lerp(old_data[1], new_data[1], t)]
            self.draw_chart(data, animate=False)
            self.canvas.flush_events()
        # --- Fix: check event_source existence ---
        if self._ani and getattr(self._ani, "event_source", None):
            self._ani.event_source.stop()
        self._ani = FuncAnimation(self.fig, update, frames=frames+1, interval=22, repeat=False)
        self._anim_ref = self._ani
        self._last_data = new_data

class LevelUpDialog(QDialog):
    def __init__(self, level, parent=None):
        super().__init__(parent)
        self.setWindowTitle("¡Subiste de nivel!")
        self.setModal(True)
        self.setWindowFlags(self.windowFlags() | Qt.WindowStaysOnTopHint)
        self.setAccessibleName("Nivel alcanzado")
        self.setMinimumWidth(320)
        layout = QVBoxLayout(self)
        lbl = QLabel(f"🎉 ¡Felicidades!\nAlcanzaste el nivel {level}.")
        lbl.setAlignment(Qt.AlignCenter)
        lbl.setStyleSheet("font-size: 18pt; font-weight: bold;")
        layout.addWidget(lbl)
        btns = QDialogButtonBox(QDialogButtonBox.Ok)
        btns.accepted.connect(self.accept)
        layout.addWidget(btns)
        self.setFocus()
        self.setAttribute(Qt.WA_ShowWithoutActivating, False)

class MainWindow(QMainWindow):
    def __init__(self, dark_mode: bool, ui_scale: float = 1.0):
        super().__init__()
        self.setWindowTitle(APP_NAME)
        self.ui_scale = ui_scale
        self.px = lambda v: int(round(v * self.ui_scale))
        self.setMinimumWidth(self.px(760))
        self.dark_mode = dark_mode  # <- para futuros usos de color si querés afinar

        self.state_path = resource_path(STATE_FILENAME)
        self.sound_path = resource_path(SND_FILENAME)
        ensure_sound_file(self.sound_path)

        self.state = self.load_state()

        # Cronómetro
        self.stop_mode = "Enfoque"
        self.stop_elapsed = int(self.state.get("session_focus_sec", 0))
        self.stop_running = False
        self.stop_timer = QTimer(self); self.stop_timer.setInterval(1000); self.stop_timer.timeout.connect(self.on_stopwatch_tick)
        # Auto-registro Enfoque
        self.auto_registered = self.state.get("auto_registered_focus", "none")
        self.auto_last_idx = self.state.get("auto_last_idx_focus", None)

        # Sonido
        self._sound = None
        if HAVE_QSOUND:
            try:
                self._sound = QSoundEffect(self)
                self._sound.setSource(QUrl.fromLocalFile(self.sound_path))
                self._sound.setVolume(0.5)
            except Exception:
                self._sound = None

        central = QWidget(); self.setCentralWidget(central)
        root = QVBoxLayout(central); root.setContentsMargins(12,12,12,12); root.setSpacing(8)

        # --- Zen ---
        self.lbl_time = QLabel("00:00"); self.lbl_time.setObjectName("timeLabel"); self.lbl_time.setAlignment(Qt.AlignCenter)
        root.addWidget(self.lbl_time)

        # Balance en Zen
        self.lbl_balance_zen = QLabel("Balance: 00:00"); self.lbl_balance_zen.setObjectName("muted")
        self.lbl_balance_zen.setAlignment(Qt.AlignCenter)
        root.addWidget(self.lbl_balance_zen)

        row_controls = QHBoxLayout(); row_controls.setSpacing(8)
        self.btn_toggle_mode = QPushButton("Modo: Enfoque"); self.btn_toggle_mode.setObjectName("primary"); self.btn_toggle_mode.setFixedHeight(self.px(44))
        self.btn_start_pause = QPushButton("Iniciar"); self.btn_start_pause.setFixedHeight(self.px(44))
        # --- Nuevo botón Olvidar ---
        self.btn_forget_times = QPushButton("Olvidar"); self.btn_forget_times.setObjectName("danger"); self.btn_forget_times.setFixedHeight(self.px(44))
        row_controls.addStretch(1)
        row_controls.addWidget(self.btn_toggle_mode)
        row_controls.addWidget(self.btn_start_pause)
        row_controls.addWidget(self.btn_forget_times)
        row_controls.addStretch(1)
        root.addLayout(row_controls)

        gb_boss = QGroupBox("Jefe"); lay_boss = QVBoxLayout(gb_boss); lay_boss.setSpacing(6)
        self.lbl_boss = QLabel("🐉 — …"); self.lbl_boss.setObjectName("bossName")
        lay_boss.addWidget(self.lbl_boss)
        row_hp = QHBoxLayout(); row_hp.setSpacing(8)
        self.bar_hp = QProgressBar(); self.bar_hp.setTextVisible(True); self.bar_hp.setFixedHeight(self.px(24)); self.bar_hp.setObjectName("bossHp")
        self.lbl_hp_info = QLabel(""); self.lbl_hp_info.setObjectName("muted")
        row_hp.addWidget(self.bar_hp, 1); row_hp.addWidget(self.lbl_hp_info)
        lay_boss.addLayout(row_hp)
        root.addWidget(gb_boss)

        # Barra inferior: Más…
        row_more = QHBoxLayout()
        self.btn_more = QPushButton("Más…"); self.btn_more.setFixedHeight(self.px(38))
        row_more.addStretch(1); row_more.addWidget(self.btn_more)
        root.addLayout(row_more)

        # --- Panel "Más…" en scroll ---
        self.more_panel = QWidget()
        mp = QVBoxLayout(self.more_panel); mp.setContentsMargins(0,0,0,0); mp.setSpacing(8)

        # Progreso
        gb_prog = QGroupBox("Progreso ✨"); lay_prog = QVBoxLayout(gb_prog); lay_prog.setSpacing(6)
        exp_row = QHBoxLayout(); exp_row.setSpacing(8)
        self.lbl_exp_title = QLabel("Nivel / EXP"); self.lbl_exp_title.setObjectName("subtitle")
        self.bar_exp = QProgressBar(); self.bar_exp.setTextVisible(True); self.bar_exp.setFixedHeight(self.px(24))
        self.lbl_exp_info = QLabel(""); self.lbl_exp_info.setObjectName("muted")
        exp_row.addWidget(self.lbl_exp_title); exp_row.addWidget(self.bar_exp, 1); exp_row.addWidget(self.lbl_exp_info)
        lay_prog.addLayout(exp_row)
        mp.addWidget(gb_prog)

        # Tokens
        gb_tokens = QGroupBox("Recompensas (gemas) 💎"); lay_tok = QHBoxLayout(gb_tokens); lay_tok.setSpacing(8)
        self.lbl_tokens = QLabel("Gemas: 0"); self.lbl_tokens.setObjectName("subtitle")
        self.btn_token_small = QPushButton(f"🧰 Cofre chico (−{TOKEN_COST_SMALL})"); self.btn_token_small.setObjectName("primary"); self.btn_token_small.setFixedHeight(self.px(38))
        self.btn_token_big = QPushButton(f"🏆 Cofre grande (−{TOKEN_COST_BIG})"); self.btn_token_big.setObjectName("primary"); self.btn_token_big.setFixedHeight(self.px(38))
        lay_tok.addWidget(self.lbl_tokens); lay_tok.addSpacing(8); lay_tok.addWidget(self.btn_token_small); lay_tok.addWidget(self.btn_token_big); lay_tok.addStretch(1)
        mp.addWidget(gb_tokens)

        # Tiempos & Balance & Dificultad
        gb_time = QGroupBox("Tiempos ⏱️"); lay_time = QVBoxLayout(gb_time); lay_time.setSpacing(6)
        row_t = QHBoxLayout(); row_t.setSpacing(8)
        self.lbl_totals = QLabel("Enfoque total: 00:00  |  Descanso total: 00:00"); self.lbl_totals.setObjectName("muted")
        self.lbl_balance = QLabel("Balance: 00:00 disponibles"); self.lbl_balance.setObjectName("muted")
        row_t.addWidget(self.lbl_totals); row_t.addSpacing(8); row_t.addWidget(self.lbl_balance); row_t.addStretch(1)
        lay_time.addLayout(row_t)
        # --- Donut chart ---
        self.donut_chart = DonutChartWidget(self)
        lay_time.addWidget(self.donut_chart)
        row_diff = QHBoxLayout(); row_diff.setSpacing(8)
        self.btn_diff = QPushButton(DIFF_LABEL.get(self.state.get("difficulty","normal"))); self.btn_diff.setFixedHeight(self.px(36))
        row_diff.addWidget(QLabel("Ratio descanso:"))
        row_diff.addWidget(self.btn_diff)
        row_diff.addStretch(1)
        lay_time.addLayout(row_diff)
        mp.addWidget(gb_time)

        # Rituales
        gb_more = QGroupBox("Rituales 🜲"); lay_more = QHBoxLayout(gb_more); lay_more.setSpacing(8)
        self.btn_new_boss = QPushButton("Nuevo jefe 🐲"); self.btn_new_boss.setFixedHeight(self.px(36))
        self.btn_reset = QPushButton("Reset"); self.btn_reset.setObjectName("danger"); self.btn_reset.setFixedHeight(self.px(36))
        lay_more.addWidget(self.btn_new_boss); lay_more.addWidget(self.btn_reset); lay_more.addStretch(1)
        mp.addWidget(gb_more)

        # Crónicas
        gb_story = QGroupBox("Crónicas del estudio 📖"); lay_story = QVBoxLayout(gb_story); lay_story.setSpacing(4)
        self.lbl_story = QLabel("Tu historia se escribirá aquí al subir de nivel."); self.lbl_story.setWordWrap(True)
        lay_story.addWidget(self.lbl_story)
        mp.addWidget(gb_story)

        # ScrollArea conteniendo el panel
        self.more_area = QScrollArea()
        self.more_area.setWidget(self.more_panel)
        self.more_area.setWidgetResizable(True)
        self.more_area.setMinimumHeight(self.px(140))
        self.more_area.setVisible(False)
        # Efecto de opacidad para animación
        self.more_effect = QGraphicsOpacityEffect(self.more_area)
        self.more_area.setGraphicsEffect(self.more_effect)
        self.more_effect.setOpacity(0.0)

        root.addWidget(self.more_area)

        # Conexiones
        self.btn_toggle_mode.clicked.connect(self.toggle_mode)
        self.btn_start_pause.clicked.connect(self.toggle_start_pause)
        self.btn_forget_times.clicked.connect(self.forget_times)  # <-- conexión nueva
        self.btn_more.clicked.connect(self.toggle_more_panel)
        self.btn_diff.clicked.connect(self.cycle_difficulty)
        self.btn_new_boss.clicked.connect(self.new_boss_scaled_hp)
        self.btn_reset.clicked.connect(self.reset_all)
        self.btn_token_small.clicked.connect(self.claim_small_token)
        self.btn_token_big.clicked.connect(self.claim_big_token)

        self._anims = []  # mantener referencias de animaciones
        self.update_ui(initial=True)

    # ---------- Estado ----------
    def load_state(self):
        path = self.state_path
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for k, v in DEFAULT_STATE.items():
                    if k not in data:
                        data[k] = v
                if not isinstance(data.get("hp_total", None), int) or data["hp_total"] <= 0:
                    data["hp_total"] = BASE_HP_MAX
                if "boss_name" not in data or not data["boss_name"]:
                    data["boss_name"] = fantasy_boss_name()
                if "last_level" not in data:
                    data["last_level"] = 1 + (data["exp_total"] // LEVEL_SIZE)
                return data
            except Exception:
                pass
        data = json.loads(json.dumps(DEFAULT_STATE))
        data["hp_total"] = BASE_HP_MAX
        data["boss_name"] = fantasy_boss_name()
        return data

    def save_state(self):
        try:
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(self.state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            QMessageBox.warning(self, "Error", f"No se pudo guardar el estado:\n{e}")

    # ---------- Utilidades ----------
    def play_notify(self):
        if self._sound is not None:
            try:
                self._sound.play()
                return
            except Exception:
                pass
        QApplication.beep()

    def balance_seconds(self):
        ratio = DIFF_RATIO.get(self.state.get("difficulty","normal"), 3)
        allowed = int(self.state["total_focus_sec"] / ratio)
        remaining = allowed - self.state["total_break_sec"]
        return remaining  # puede ser negativo

    # ---------- Cálculos ----------
    def level(self):
        return 1 + (self.state["exp_total"] // LEVEL_SIZE)

    def exp_in_level(self):
        return self.state["exp_total"] % LEVEL_SIZE

    def hp_restante(self):
        return max(0, self.state["hp_total"] - self.state["dano_total"])

    def scaled_damage(self, kind: str):
        lvl = self.level()
        if kind == "deep":
            return BASE_DANO_DEEP + (lvl - 1) * LEVEL_BONUS_DEEP
        else:
            return BASE_DANO_MINI + (lvl - 1) * LEVEL_BONUS_MINI

    def tokens_available(self):
        generated = self.state["exp_total"] // EXP_REWARD_TOKEN
        spent = self.state.get("tokens_spent", 0)
        return max(0, generated - spent)

    # ---------- Animaciones ----------
    def animate_bar(self, bar: QProgressBar, new_value: int, duration=350):
        start = bar.value()
        anim = QPropertyAnimation(bar, b"value", self)
        anim.setDuration(duration)
        anim.setStartValue(start)
        anim.setEndValue(new_value)
        anim.setEasingCurve(QEasingCurve.InOutCubic)
        anim.start()
        self._anims.append(anim)

    def pulse_label(self, label: QLabel):
        effect = QGraphicsOpacityEffect(label)
        label.setGraphicsEffect(effect)
        anim = QPropertyAnimation(effect, b"opacity", self)
        anim.setDuration(500)
        anim.setStartValue(0.35)
        anim.setEndValue(1.0)
        anim.setEasingCurve(QEasingCurve.OutCubic)
        anim.start()
        self._anims.append(anim)

    # Nuevo: fade para el panel "Más…"
    def fade_more_panel(self, show: bool, duration=220):
        # Asegurar efecto
        if self.more_area.graphicsEffect() is None:
            self.more_effect = QGraphicsOpacityEffect(self.more_area)
            self.more_area.setGraphicsEffect(self.more_effect)

        anim = QPropertyAnimation(self.more_effect, b"opacity", self)
        anim.setDuration(duration)
        anim.setEasingCurve(QEasingCurve.InOutCubic)

        if show:
            # mostrar y animar 0→1
            self.more_area.setVisible(True)
            self.more_effect.setOpacity(0.0)
            anim.setStartValue(0.0)
            anim.setEndValue(1.0)
            self.btn_more.setText("Menos…")
        else:
            # animar 1→0 y ocultar al final
            self.more_effect.setOpacity(1.0)
            anim.setStartValue(1.0)
            anim.setEndValue(0.0)
            def _hide():
                self.more_area.setVisible(False)
                self.btn_more.setText("Más…")
            anim.finished.connect(_hide)

        anim.start()
        self._anims.append(anim)

    # ---------- Cronómetro ----------
    def cycle_difficulty(self):
        cur = self.state.get("difficulty","normal")
        idx = DIFF_CYCLE.index(cur) if cur in DIFF_CYCLE else 1
        nxt = DIFF_CYCLE[(idx + 1) % len(DIFF_CYCLE)]
        self.state["difficulty"] = nxt
        self.btn_diff.setText(DIFF_LABEL[nxt])
        self.save_state()
        self.update_counts_only()
        self.pulse_label(self.lbl_balance_zen)

    def toggle_mode(self):
        if self.stop_mode == "Enfoque":
            self.play_notify()  # <- agrega esta línea
            self.state["session_focus_sec"] = int(self.stop_elapsed)
            self.state["auto_registered_focus"] = self.auto_registered
            self.state["auto_last_idx_focus"] = self.auto_last_idx
        else:
            self.state["session_break_sec"] = int(self.stop_elapsed)
            self.play_notify()
        self.save_state()

        self.stop_timer.stop(); self.stop_running = False
        self.stop_mode = "Descanso" if self.stop_mode == "Enfoque" else "Enfoque"

        if self.stop_mode == "Enfoque":
            self.stop_elapsed = int(self.state.get("session_focus_sec", 0))
            self.auto_registered = self.state.get("auto_registered_focus", "none")
            self.auto_last_idx = self.state.get("auto_last_idx_focus", None)
        else:
            self.stop_elapsed = int(self.state.get("session_break_sec", 0))

        self.stop_timer.start(); self.stop_running = True
        self.btn_start_pause.setText("Pausar")
        self.btn_toggle_mode.setText(f"Modo: {self.stop_mode}")
        self.update_stopwatch_label()
        self.update_counts_only()

    def toggle_start_pause(self):
        if self.stop_running:
            self.stop_timer.stop(); self.stop_running = False; self.btn_start_pause.setText("Iniciar")
            self.play_notify()
        else:
            self.stop_timer.start(); self.stop_running = True; self.btn_start_pause.setText("Pausar")
            self.play_notify()  # <- agrega esta línea

    def on_stopwatch_tick(self):
        self.stop_elapsed += 1
        if self.stop_mode == "Enfoque":
            self.state["session_focus_sec"] = int(self.stop_elapsed)
            self.state["total_focus_sec"] += 1
        else:
            self.state["session_break_sec"] = int(self.stop_elapsed)
            self.state["total_break_sec"] += 1

        self.save_state()
        self.update_stopwatch_label()
        self.update_counts_only()

        # Auto-registro
        if self.stop_mode == "Enfoque":
            if self.stop_elapsed >= 25*60 and self.auto_registered != "deep":
                if self.auto_registered == "brief" and self.auto_last_idx is not None:
                    add_exp = EXP_DEEP - EXP_MINI
                    add_dano = self.scaled_damage("deep") - self.scaled_damage("mini")
                    self.state["exp_total"] += add_exp
                    self.state["dano_total"] += add_dano
                    try:
                        self.state["history"][self.auto_last_idx]["exp"] = EXP_DEEP
                        self.state["history"][self.auto_last_idx]["dano"] = self.scaled_damage("deep")
                        self.state["history"][self.auto_last_idx]["tipo"] = "deep"
                    except Exception:
                        pass
                    self.auto_registered = "deep"
                    self.state["auto_registered_focus"] = "deep"
                    self.save_state()
                    self.play_notify()
                    self.on_after_apply(kind="deep", upgraded=True)
                else:
                    self.apply_block(kind="deep", from_auto=True)
                    self.auto_registered = "deep"
                    self.state["auto_registered_focus"] = "deep"
                    self.state["auto_last_idx_focus"] = None
                    self.save_state()
                    self.play_notify()
            elif self.stop_elapsed >= 10*60 and self.auto_registered == "none":
                self.apply_block(kind="mini", from_auto=True)
                self.auto_registered = "brief"
                self.auto_last_idx = len(self.state["history"]) - 1
                self.state["auto_registered_focus"] = "brief"
                self.state["auto_last_idx_focus"] = self.auto_last_idx
                self.save_state()
                self.play_notify()

    def update_stopwatch_label(self):
        m = self.stop_elapsed // 60
        s = self.stop_elapsed % 60
        self.lbl_time.setText(f"{m:02d}:{s:02d}")

    # ---------- Acciones ----------
    def on_after_apply(self, kind: str, upgraded: bool=False):
        self.animate_bar(self.bar_exp, self.exp_in_level()); self.animate_bar(self.bar_hp, self.hp_restante())
        prev_lvl = self.state.get("last_level", 1); new_lvl = self.level()
        if new_lvl > prev_lvl:
            snippet = random.choice(STORY_SNIPPETS)
            line = f"Nivel {new_lvl}: {snippet}"
            self.state["story"].append(line)
            self.state["last_level"] = new_lvl
            self.save_state()
            self.show_level_up(new_lvl)  # <-- indicador visual de subida de nivel
        self.update_counts_only()

    def apply_block(self, kind: str, from_auto: bool=False):
        exp = EXP_DEEP if kind == "deep" else EXP_MINI
        dano = self.scaled_damage(kind)
        self.state["exp_total"] += exp
        self.state["dano_total"] += dano
        self.state["history"].append({"exp": exp, "dano": dano, "tipo": kind})
        if self.hp_restante() == 0:
            QMessageBox.information(self, "Jefe derrotado", f"¡Derrotaste a {self.state['boss_name']}! 🐉")
        self.save_state()
        self.on_after_apply(kind=kind, upgraded=False)

    def new_boss_scaled_hp(self):
        lvl = self.level()
        min_hp = BASE_HP_MIN + (lvl - 1) * HP_PER_LEVEL_MIN
        max_hp = BASE_HP_MAX + (lvl - 1) * HP_PER_LEVEL_MAX
        if max_hp < min_hp: max_hp = min_hp + 10
        self.state["hp_total"] = random.randint(min_hp, max_hp)
        self.state["dano_total"] = 0
        self.state["boss_name"] = fantasy_boss_name()
        self.save_state()
        self.bar_hp.setMaximum(self.state["hp_total"]); self.animate_bar(self.bar_hp, self.hp_restante())
        self.update_counts_only()

    def reset_all(self):
        ans = QMessageBox.question(
            self, "Reset",
            "¿Seguro que querés resetear EXP, HP, historial, tokens y tiempos (totales y sesiones)?",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        if ans == QMessageBox.Yes:
            self.state = json.loads(json.dumps(DEFAULT_STATE))
            self.state["hp_total"] = random.randint(BASE_HP_MIN, BASE_HP_MAX)
            self.state["boss_name"] = fantasy_boss_name()
            self.save_state()
            self.stop_timer.stop(); self.stop_running = False
            self.stop_mode = "Enfoque"
            self.stop_elapsed = int(self.state.get("session_focus_sec", 0))
            self.auto_registered = self.state.get("auto_registered_focus", "none")
            self.auto_last_idx = self.state.get("auto_last_idx_focus", None)
            self.btn_start_pause.setText("Iniciar"); self.btn_toggle_mode.setText(f"Modo: {self.stop_mode}")
            self.update_stopwatch_label()
            self.update_ui(initial=True)

    # ---------- Tokens ----------
    def claim_small_token(self):
        avail = self.tokens_available()
        if avail < TOKEN_COST_SMALL:
            QMessageBox.information(self, "Cofre chico", "No tenés tokens suficientes.")
            return
        self.state["tokens_spent"] = self.state.get("tokens_spent", 0) + TOKEN_COST_SMALL
        self.save_state()
        self.update_counts_only()
        self.play_notify()

    def claim_big_token(self):
        avail = self.tokens_available()
        if avail < TOKEN_COST_BIG:
            QMessageBox.information(self, "Cofre grande", "No tenés tokens suficientes.")
            return
        self.state["tokens_spent"] = self.state.get("tokens_spent", 0) + TOKEN_COST_BIG
        self.save_state()
        self.update_counts_only()
        self.play_notify()

    # ---------- UI helpers ----------
    def toggle_more_panel(self):
        vis = self.more_area.isVisible()
        # Animación en vez de setVisible directo
        self.fade_more_panel(show=not vis)

    def _apply_balance_color(self, seconds: int):
        # Verde para positivo, ámbar para negativo, neutro si 0
        if seconds > 0:
            color = "#10b981"  # green-500
        elif seconds < 0:
            color = "#f59e0b"  # amber-500
        else:
            # "muted" similar a tema
            color = "#64748b" if not self.dark_mode else "#94a3b8"

        # Aplicar a ambas labels de balance
        self.lbl_balance.setStyleSheet(f"color: {color};")
        self.lbl_balance_zen.setStyleSheet(f"color: {color};")

    def update_counts_only(self):
        # Nivel / EXP
        lvl = self.level(); exp_n = self.exp_in_level()
        self.bar_exp.setMaximum(LEVEL_SIZE); self.bar_exp.setFormat(f"Nivel {lvl} — {exp_n}/{LEVEL_SIZE}")

        # HP / Jefe
        self.bar_hp.setMaximum(self.state["hp_total"]); self.bar_hp.setFormat("HP: %v/%m")
        self.lbl_hp_info.setText(f"Daño total: {self.state['dano_total']}  |  Total jefe: {self.state['hp_total']}")
        self.lbl_boss.setText(f"🐉 — {self.state['boss_name']}")

        # Tokens
        t_avail = self.tokens_available()
        self.lbl_tokens.setText(f"Gemas: {t_avail}")
        self.btn_token_small.setEnabled(t_avail >= TOKEN_COST_SMALL)
        self.btn_token_big.setEnabled(t_avail >= TOKEN_COST_BIG)

        # Tiempos / Balance
        self.lbl_totals.setText(f"Enfoque total: {fmt_hm(self.state['total_focus_sec'])}  |  Descanso total: {fmt_hm(self.state['total_break_sec'])}")
        bal = self.balance_seconds()
        bal_text = fmt_hms_signed(bal)
        self.lbl_balance.setText(f"Balance: {bal_text} disponibles")
        self.lbl_balance_zen.setText(f"Balance: {bal_text}")
        self._apply_balance_color(bal)
        # --- Actualiza el gráfico donut ---
        self.donut_chart.set_data(self.state['total_focus_sec'], self.state['total_break_sec'], bal)
        # --- Ensure real-time update ---
        self.donut_chart.canvas.flush_events()
        QApplication.processEvents()

    def update_ui(self, initial=False):
        self.update_counts_only()
        if initial:
            self.bar_hp.setValue(self.hp_restante()); self.bar_exp.setValue(self.exp_in_level())
            if self.state["story"]:
                self.lbl_story.setText("\n• ".join(["Crónicas:"] + self.state["story"][-6:]))
            self.btn_toggle_mode.setText(f"Modo: {self.stop_mode}")
            self.btn_diff.setText(DIFF_LABEL.get(self.state.get("difficulty","normal")))
            self.update_stopwatch_label(); self.btn_start_pause.setText("Iniciar")
            # Onboarding: mostrar solo si es la primera vez (sin EXP ni historia)
            if self.state["exp_total"] == 0 and not self.state["story"]:
                QTimer.singleShot(400, self.show_onboarding_tips)
        else:
            self.animate_bar(self.bar_hp, self.hp_restante()); self.animate_bar(self.bar_exp, self.exp_in_level())

    def show_onboarding_tips(self):
        tips = (
            "<b>Bienvenido/a a Flowmodoro RPG ✨</b><br><br>"
            "Consejos para comenzar:<ul>"
            "<li><b>Enfoque</b>: Inicia el cronómetro y mantente concentrado.</li>"
            "<li><b>Descanso</b>: Cambia de modo para tomar pausas saludables.</li>"
            "<li><b>Jefe</b>: Cada sesión suma daño y experiencia para derrotar al jefe.</li>"
            "<li><b>Gemas</b>: Gana recompensas al avanzar y úsalas en cofres.</li>"
            "<li><b>Más…</b>: Explora estadísticas, dificultad y tu crónica de estudio.</li>"
            "</ul><br>"
            "¡Sube de nivel y descubre nuevas crónicas de tu progreso!"
        )
        dlg = QMessageBox(self)
        dlg.setWindowTitle("Consejos iniciales")
        dlg.setTextFormat(Qt.RichText)
        dlg.setText(tips)
        dlg.setStandardButtons(QMessageBox.Ok)
        dlg.setAccessibleName("Consejos de bienvenida")
        dlg.setModal(True)
        dlg.exec_()

    def show_level_up(self, new_lvl):
        dlg = LevelUpDialog(new_lvl, self)
        dlg.exec_()

    # ---------- Nuevo método para olvidar tiempos ----------
    def forget_times(self):
        # Pone todos los tiempos y balance en cero, sin tocar experiencia ni recompensas
        self.state["total_focus_sec"] = 0
        self.state["total_break_sec"] = 0
        self.state["session_focus_sec"] = 0
        self.state["session_break_sec"] = 0
        self.stop_elapsed = 0
        self.auto_registered = "none"
        self.state["auto_registered_focus"] = "none"
        self.auto_last_idx = None
        self.state["auto_last_idx_focus"] = None
        self.save_state()
        self.update_stopwatch_label()
        self.update_counts_only()

def main():
    # --- HiDPI (2K/4K) ---
    os.environ.setdefault('QT_ENABLE_HIGHDPI_SCALING', '1')
    os.environ.setdefault('QT_AUTO_SCREEN_SCALE_FACTOR', '1')
    os.environ.setdefault('QT_SCALE_FACTOR_ROUNDING_POLICY', 'PassThrough')
    try:
        from PyQt5.QtCore import QCoreApplication, Qt
        QCoreApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
        QCoreApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)
    except Exception:
        pass

    app = QApplication(sys.argv)
    scr = app.primaryScreen()
    dpi = scr.logicalDotsPerInch() if scr else 96
    ui_scale = max(1.0, min(2.0, dpi/96.0))  # 96→1.0, 144→1.5, 192→2.0 aprox.
    dark = detect_dark_mode_linux()
    app.setStyleSheet(QSS_DARK if dark else QSS_LIGHT)
    win = MainWindow(dark_mode=dark, ui_scale=ui_scale)
    win.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()

