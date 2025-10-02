#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# --- Configuración ---
APPID="flowmodoro-rpg"                # id corto, sin espacios
APPNAME="Flowmodoro RPG"              # nombre visible
ENTRYPOINT="FlowmodoroRPG.py"         # script Python principal
ICON_SRC="flowmodoro-rpg.png"        # icono fuente (png preferido)
EXTRA_FILES=()                        # archivos extra a copiar (array bash), ej: ("flowmodoro-rpg.conf")

# --- Directorios destino ---
APPDIR="$HOME/.local/share/$APPID"
BINDIR="$HOME/.local/bin"
DESKTOPDIR="$HOME/.local/share/applications"
ICONDIR="$HOME/.local/share/icons/hicolor/256x256/apps"

# --- Funciones utilitarias ---
log() { echo -e "\033[1;32m[INFO]\033[0m $*"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $*"; }
die() { echo -e "\033[1;31m[ERROR]\033[0m $*" >&2; exit 1; }
ensure_dep() { command -v "$1" >/dev/null 2>&1 || die "Dependencia '$1' no encontrada. Instálala y reintenta."; }

# --- Flags ---
FORCE=0
RUN_AFTER=0
NO_VENV=0
UNINSTALL=0

for arg in "$@"; do
    case "$arg" in
        --force) FORCE=1 ;;
        --run) RUN_AFTER=1 ;;
        --no-venv) NO_VENV=1 ;;
        --uninstall) UNINSTALL=1 ;;
        *) die "Flag desconocido: $arg" ;;
    esac
done

# --- Desinstalación ---
if [[ "$UNINSTALL" == "1" ]]; then
    log "Desinstalando $APPNAME..."
    rm -rf "$APPDIR" && log "Eliminado $APPDIR"
    rm -f "$BINDIR/$APPID" && log "Eliminado $BINDIR/$APPID"
    rm -f "$DESKTOPDIR/$APPID.desktop" && log "Eliminado $DESKTOPDIR/$APPID.desktop"
    rm -f "$ICONDIR/$APPID.png" && log "Eliminado $ICONDIR/$APPID.png"
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$DESKTOPDIR" || warn "No se pudo actualizar la base de accesos directos."
    fi
    log "Desinstalación completa."
    exit 0
fi

# --- Dependencias obligatorias ---
ensure_dep python3
ensure_dep pip
ensure_dep bash

if [[ "$NO_VENV" == "0" ]]; then
    ensure_dep python3
    python3 -m venv --help >/dev/null 2>&1 || die "python3 -m venv no disponible."
fi

# --- Dependencias opcionales ---
if command -v xdg-open >/dev/null 2>&1; then HAVE_XDG=1; else HAVE_XDG=0; fi
if command -v update-desktop-database >/dev/null 2>&1; then HAVE_UDD=1; else HAVE_UDD=0; fi
if command -v convert >/dev/null 2>&1; then HAVE_CONVERT=1; else HAVE_CONVERT=0; fi

# --- Chequeos previos ---
[[ -f "$ENTRYPOINT" ]] || die "No se encontró el entrypoint: $ENTRYPOINT"
[[ -d "$APPDIR" ]] && [[ "$FORCE" == "0" ]] && die "Ya existe $APPDIR. Usa --force para reinstalar."
[[ -d "$APPDIR" ]] && [[ "$FORCE" == "1" ]] && log "Reinstalando: eliminando $APPDIR..." && rm -rf "$APPDIR"

# --- Crear directorios destino ---
mkdir -p "$APPDIR" "$BINDIR" "$DESKTOPDIR" "$ICONDIR"

# --- Copiar archivos principales ---
cp "$ENTRYPOINT" "$APPDIR/"
[[ -f "$ICON_SRC" ]] && cp "$ICON_SRC" "$APPDIR/" || warn "No se encontró icono fuente ($ICON_SRC), se instalará sin icono."
for f in "${EXTRA_FILES[@]}"; do
    [[ -f "$f" ]] && cp "$f" "$APPDIR/" || warn "Archivo extra '$f' no encontrado, omitido."
done

# --- Copiar requirements.txt si existe en repo raíz ---
if [[ -f "requirements.txt" ]]; then
    cp "requirements.txt" "$APPDIR/"
fi

# --- Crear entorno virtual (venv) ---
if [[ "$NO_VENV" == "0" ]]; then
    log "Creando entorno virtual en $APPDIR/venv..."
    python3 -m venv "$APPDIR/venv"
    "$APPDIR/venv/bin/pip" install --upgrade pip wheel
    if [[ -f "$APPDIR/requirements.txt" ]]; then
        "$APPDIR/venv/bin/pip" install -r "$APPDIR/requirements.txt"
    fi
else
    warn "Instalación sin venv (--no-venv): se usará python3 del sistema. Puede haber conflictos de dependencias."
fi

# --- Crear launcher ejecutable ---
log "Creando lanzador en $BINDIR/$APPID..."
cat > "$BINDIR/$APPID" <<EOF
#!/usr/bin/env bash
DIR="\$HOME/.local/share/$APPID"
EOF
if [[ "$NO_VENV" == "0" ]]; then
    echo 'exec "$DIR/venv/bin/python" "$DIR/'"$ENTRYPOINT"'" "$@"' >> "$BINDIR/$APPID"
else
    echo 'exec python3 "$DIR/'"$ENTRYPOINT"'" "$@"' >> "$BINDIR/$APPID"
fi
chmod +x "$BINDIR/$APPID"

# --- Instalar icono ---
ICON_TARGET="$ICONDIR/$APPID.png"
if [[ -f "$ICON_SRC" ]]; then
    EXT="${ICON_SRC##*.}"
    if [[ "$EXT" != "png" ]]; then
        if [[ "$HAVE_CONVERT" == "1" ]]; then
            log "Convirtiendo icono a PNG..."
            convert "$ICON_SRC" "$ICON_TARGET"
        else
            die "El icono no es PNG y 'convert' (ImageMagick) no está instalado. Instala ImageMagick o usa un PNG."
        fi
    else
        cp "$ICON_SRC" "$ICON_TARGET"
    fi
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
        gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" || warn "No se pudo actualizar la caché de iconos."
    fi
else
    warn "No se instalará icono en el menú (no se encontró $ICON_SRC)."
fi

# --- Crear archivo .desktop ---
log "Creando acceso directo en $DESKTOPDIR/$APPID.desktop..."
cat > "$DESKTOPDIR/$APPID.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=$APPNAME
Exec=$BINDIR/$APPID
Icon=$APPID
Categories=Utility;
Terminal=false
NoDisplay=false
StartupNotify=true
EOF

# --- Actualizar base de accesos directos ---
if [[ "$HAVE_UDD" == "1" ]]; then
    update-desktop-database "$DESKTOPDIR" || warn "No se pudo actualizar la base de accesos directos."
fi

# --- Mensajes finales ---
log "Instalación completa."
echo "Ruta de instalación: $APPDIR"
echo "Ejecuta: $APPID (o desde el menú de aplicaciones)"
echo "Desinstala con: bash install.sh --uninstall"
if [[ "$RUN_AFTER" == "1" ]]; then
    log "Ejecutando $APPID..."
    "$BINDIR/$APPID"
fi
