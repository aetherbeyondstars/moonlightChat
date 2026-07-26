// ============================================================================
// userDisplay.js
// El nombre que se muestra en la interfaz es siempre el displayName si el
// usuario tiene uno configurado; si no, se cae al username. UserAvatar usa
// este mismo string para calcular las iniciales del fallback.
// ============================================================================
export function displayNameOf(user) {
  if (!user) return '';
  return user.displayName || user.username || '';
}
