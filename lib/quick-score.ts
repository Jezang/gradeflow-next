export type QuickScore = {ok: true; value: number | null} | {ok: false};

export function parseQuickScore(raw: string, maximum: number): QuickScore {
  if (!Number.isFinite(maximum) || maximum <= 0) return {ok: false};
  const text = raw.trim();
  if (!text) return {ok: true, value: null};
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return {ok: false};
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > maximum) return {ok: false};
  return {ok: true, value};
}
