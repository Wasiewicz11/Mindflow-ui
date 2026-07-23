export function formatLoggedHours(minutes?: number | null) {
  const totalMinutes = Math.max(0, Math.round(minutes ?? 0));
  if (totalMinutes === 0) return '0 h';
  if (totalMinutes < 60) return `${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const remainder = totalMinutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}
