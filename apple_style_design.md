# Diseño Minimalista Apple-Style para Flowmodoro

## Principios de Diseño Apple
- **Simplicidad**: Menos es más
- **Claridad**: Contenido sobre decoración
- **Profundidad**: Jerarquía visual clara
- **Humanismo**: Interfaz cálida y accesible

## Nueva Estructura de Interfaz

### Layout Principal
```
┌─────────────────────────────────────────┐
│           Flowmodoro RPG                │
├─────────────────────────────────────────┤
│                                         │
│           [Estado Actual]               │
│           ⏱️ Enfoque: 25:00             │
│                                         │
│           [Balance Dinámico]            │
│           ⚖️ Equilibrado 1:3.2          │
│           +12:45                        │
│                                         │
│           [Controles Principales]       │
│           [▶️]   [🔄]   [🧘]             │
│                                         │
└─────────────────────────────────────────┘
```

### Elementos Simplificados

#### 1. Header Minimalista
- Solo título "Flowmodoro RPG" en tipografía SF Pro
- Sin iconos extras, solo texto limpio

#### 2. Estado Actual
- **Modo actual**: Enfoque/Descanso
- **Tiempo de sesión actual**: Formato simple
- **Progreso visual**: Barra circular sutil

#### 3. Balance Dinámico (Nuevo)
- **Ratio actual**: "Equilibrado 1:3.2" (dinámico)
- **Balance neto**: "+12:45" con color coding
- **Feedback visual**: Indicador de estado (verde/amarillo/rojo)

#### 4. Controles Principales
- **Play/Pause**: Icono simple
- **Cambiar modo**: Icono de intercambio
- **Modo Zen**: Icono de meditación
- **Sin texto**, solo iconos reconocibles

### Paleta de Colores Apple-Style
```css
:root {
  /* Colores base */
  --system-background: #ffffff;
  --secondary-background: #f2f2f7;
  --tertiary-background: #e5e5ea;
  
  /* Colores de texto */
  --label-primary: #000000;
  --label-secondary: #3c3c4399;
  --label-tertiary: #3c3c434d;
  
  /* Colores de acento */
  --system-blue: #007aff;
  --system-green: #34c759;
  --system-orange: #ff9500;
  --system-red: #ff3b30;
  
  /* Gradientes sutiles */
  --gradient-primary: linear-gradient(135deg, #007aff, #5856d6);
}
```

### Tipografía SF Pro (Sistema)
```css
:root {
  --font-system: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-large-title: 700 34px/41px var(--font-system);
  --font-title1: 700 28px/34px var(--font-system);
  --font-title2: 700 22px/28px var(--font-system);
  --font-title3: 600 20px/25px var(--font-system);
  --font-body: 400 17px/22px var(--font-system);
  --font-callout: 400 16px/21px var(--font-system);
  --font-caption1: 400 12px/16px var(--font-system);
  --font-caption2: 400 11px/13px var(--font-system);
}
```

### Componentes Visuales

#### Barra de Progreso Circular
- **Estilo**: Circular, similar a Apple Watch
- **Animación**: Suave y fluida
- **Estados**: Enfoque (azul), Descanso (verde), Pausa (gris)

#### Botones Apple-Style
```css
.btn-apple {
  background: var(--system-background);
  border: 1px solid var(--tertiary-background);
  border-radius: 12px;
  padding: 16px;
  font: var(--font-body);
  color: var(--label-primary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-apple:active {
  background: var(--tertiary-background);
  transform: scale(0.98);
}

.btn-apple.primary {
  background: var(--system-blue);
  color: white;
  border: none;
}
```

#### Tarjetas con Sombra Sutil
```css
.card-apple {
  background: var(--system-background);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.08),
    0 1px 4px rgba(0, 0, 0, 0.04);
}
```

### Estados de Interfaz

#### Estado de Balance
- **Positivo** (+): Verde, icono de check
- **Neutral** (0): Azul, icono de equilibrio
- **Negativo** (-): Naranja, icono de advertencia

#### Estados de Modo
- **Enfoque**: Azul intenso, icono de concentración
- **Descanso**: Verde relajante, icono de pausa
- **Zen**: Morado, icono de meditación

### Animaciones y Transiciones
- **Duración**: 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- **Escalas**: 0.98 en active states
- **Opacidades**: Fade in/out suaves
- **Transformaciones**: TranslateY sutil para feedback

### Responsive Design
- **Mobile First**: Optimizado para iPhone
- **Tablet**: Layout expandido
- **Desktop**: Centrado, máximo 400px de ancho

### Accesibilidad
- **Contraste**: Mínimo 4.5:1
- **Tamaño de texto**: Mínimo 17px para lectura
- **Touch targets**: Mínimo 44px × 44px
- **VoiceOver**: Etiquetas ARIA completas