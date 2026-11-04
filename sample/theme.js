// Apply theme.json tokens to CSS variables and expose window.THEME.
export async function loadTheme(url = './theme.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`theme load failed: ${url} (${res.status})`);
  const t = await res.json();
  const r = document.documentElement;
  const c = t.colors || {};
  const map = {
    '--bg': c.bg, '--bg-hi': c.bg_hi, '--bg-lo': c.bg_lo,
    '--ink': c.ink, '--mute': c.mute, '--surface': c.surface, '--surface-2': c.surface_2,
    '--accent': c.accent, '--accent-2': c.accent_2, '--accent-3': c.accent_3,
    '--chip-bg': c.chip_bg, '--chip-fg': c.chip_fg, '--shadow': c.shadow,
  };
  for (const [k, v] of Object.entries(map)) if (v != null) r.style.setProperty(k, v);
  const typ = t.type || {};
  if (typ.radius_card_px != null) r.style.setProperty('--radius-card', typ.radius_card_px + 'px');
  if (typ.radius_chip_px != null) r.style.setProperty('--radius-chip', typ.radius_chip_px + 'px');
  if (typ.chip_size_px != null) r.style.setProperty('--chip-size', typ.chip_size_px + 'px');
  if (typ.headline_weight != null) r.style.setProperty('--headline-weight', String(typ.headline_weight));
  const fonts = t.fonts || {};
  if (fonts.sans) r.style.setProperty('--font-sans', `'${fonts.sans}', sans-serif`);
  if (fonts.mono) r.style.setProperty('--font-mono', `'${fonts.mono}', monospace`);
  window.THEME = t;
  return t;
}
