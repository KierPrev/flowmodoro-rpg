# Algoritmo de Ratio Dinámico para Flowmodoro

## Análisis del Sistema Actual
- **Ratios fijos**: 1:2 (Fácil), 1:3 (Normal), 1:4 (Avanzado)
- **Balance calculado**: `allowed_break = total_focus / ratio - total_break`
- **Interfaz**: Botón para cambiar entre dificultades predefinidas

## Algoritmo de Ratio Dinámico Propuesto

### Variables de Entrada
1. **Tiempo de enfoque acumulado** (total_focus_sec)
2. **Tiempo de descanso acumulado** (total_break_sec) 
3. **Patrón de sesiones** (session_history)
4. **Hora del día** (para ritmo circadiano)
5. **Duración promedio de sesiones** (avg_session_length)

### Lógica de Ratio Dinámico

```javascript
function calculateDynamicRatio(state) {
  const {
    total_focus_sec,
    total_break_sec,
    session_history,
    current_streak
  } = state;
  
  // Ratio base basado en productividad histórica
  let baseRatio = 3.0; // Default 1:3
  
  // Factor 1: Balance actual
  const currentBalance = total_focus_sec - (total_break_sec * baseRatio);
  if (currentBalance > 3600) { // +1 hora de balance positivo
    baseRatio += 0.5; // Más descanso permitido
  } else if (currentBalance < -1800) { // -30 minutos de balance negativo
    baseRatio -= 0.5; // Menos descanso permitido
  }
  
  // Factor 2: Duración promedio de sesiones
  const completedSessions = session_history.filter(s => s.completed);
  if (completedSessions.length > 0) {
    const avgSession = completedSessions.reduce((sum, s) => sum + s.focus_time, 0) / completedSessions.length;
    if (avgSession > 1800) { // Sesiones largas (>30 min)
      baseRatio += 0.3; // Más descanso para sesiones largas
    } else if (avgSession < 600) { // Sesiones cortas (<10 min)
      baseRatio -= 0.3; // Menos descanso para sesiones cortas
    }
  }
  
  // Factor 3: Hora del día (ritmo circadiano)
  const hour = new Date().getHours();
  if (hour >= 14 && hour <= 16) { // Bajón de la tarde
    baseRatio += 0.2; // Más descanso
  } else if (hour >= 9 && hour <= 11) { // Pico matutino
    baseRatio -= 0.2; // Menos descanso
  }
  
  // Factor 4: Racha actual
  if (current_streak > 3) {
    baseRatio += 0.1 * Math.min(current_streak - 3, 2); // Hasta +0.2 por racha larga
  }
  
  // Limitar ratio entre 1.5 y 5.0
  return Math.max(1.5, Math.min(5.0, baseRatio));
}
```

### Etiquetas Dinámicas
```javascript
function getDynamicRatioLabel(ratio) {
  if (ratio <= 2.0) return `Intenso 1:${ratio.toFixed(1)}`;
  if (ratio <= 3.0) return `Equilibrado 1:${ratio.toFixed(1)}`;
  if (ratio <= 4.0) return `Relajado 1:${ratio.toFixed(1)}`;
  return `Flexible 1:${ratio.toFixed(1)}`;
}
```

### Beneficios del Sistema Dinámico
- **Adaptación automática** a patrones de trabajo
- **Mejor equilibrio** entre productividad y descanso
- **Elimina necesidad** de cambiar dificultad manualmente
- **Aprendizaje continuo** basado en datos del usuario

### Integración con Interfaz Apple-Style
- **Display simplificado**: Mostrar solo ratio actual y balance
- **Feedback visual**: Color coding para estados (intenso, equilibrado, relajado)
- **Animaciones suaves**: Transiciones entre estados de ratio
- **Minimalismo**: Ocultar controles de dificultad manual