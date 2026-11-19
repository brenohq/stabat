/** geometria compartilhada entre a pauta e quem posiciona efeitos por cima dela */
export function staffGeometry({ s = 16, top = 15, bottom = -6, margin = 26, width = 340 } = {}) {
  const half = s / 2;
  return {
    s,
    width,
    height: margin * 2 + (top - bottom) * half,
    y: (step: number) => margin + (top - step) * half,
  };
}
export type StaffGeometry = ReturnType<typeof staffGeometry>;
