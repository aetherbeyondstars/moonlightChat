// ============================================================================
// VoicePingIcon.jsx — indicador de calidad de conexión estilo Discord
// ============================================================================
import { cn } from '@/lib/utils';

function pingLevel(ms) {
  if (ms == null || ms <= 100) return 'good';
  if (ms <= 500) return 'medium';
  return 'bad';
}

const COLORS = {
  good:   { active: '#3ba55d', dim: '#3ba55d33' },
  medium: { active: '#faa61a', dim: '#faa61a33' },
  bad:    { active: '#ed4245', dim: '#ed424533' },
};

const BG = {
  good:   'bg-[hsl(145_40%_18%)]',
  medium: 'bg-[hsl(35_40%_18%)]',
  bad:    'bg-[hsl(0_40%_18%)]',
};

/**
 * Icono WiFi estilo Discord:
 *   - bolita abajo siempre activa
 *   - 3 arcos concéntricos (pequeño, medio, grande)
 *   - good   (0-100 ms)  → verde,          bolita + 3 arcos activos
 *   - medium (101-500ms) → amarillo-naranja, bolita + 2 arcos activos
 *   - bad    (>500ms)    → rojo,            bolita + 1 arco activo
 */
export function VoicePingIcon({ pingMs, className = '' }) {
  const level = pingLevel(pingMs);
  const { active, dim } = COLORS[level];
  const bars = level === 'good' ? 3 : level === 'medium' ? 2 : 1;

  const label =
    pingMs == null
      ? 'Ping: —'
      : `Ping: ${pingMs} ms`;

  return (
    <div
      title={label}
      className={cn(
        'flex h-8 w-8 shrink-0 cursor-default items-center justify-center rounded-lg',
        BG[level],
        className
      )}
    >
      {/* viewBox centrado en 12,12; arcos de radio 4, 7, 10 */}
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 transform rotate-45"
        fill="none"
        aria-label={label}
      >
        {/* Bolita central — siempre activa */}
        <circle cx="12" cy="19.5" r="2" fill={active} />

        {/* Arco pequeño (radio ≈ 4) */}
        <path
          d="M8.5 15.5 a5 5 0 0 1 7 0"
          stroke={bars >= 1 ? active : dim}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Arco medio (radio ≈ 7) */}
        <path
          d="M5.5 12.5 a9 9 0 0 1 13 0"
          stroke={bars >= 2 ? active : dim}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Arco grande (radio ≈ 10) */}
        <path
          d="M2.5 9.5 a13.5 13.5 0 0 1 19 0"
          stroke={bars >= 3 ? active : dim}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function formatUnreadBadge(count) {
  if (!count || count <= 0) return null;
  if (count > 99) return '+99';
  return String(count);
}

export const SIDEBAR_VOICE_PANEL_HEIGHT = 'h-[52px]';
