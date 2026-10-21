export const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
export const isInt = (n) => Number.isInteger(Number(n));
export const inRange = (n, min, max) => {
  const x = Number(n);
  if (Number.isNaN(x)) return false;
  if (min !== undefined && x < min) return false;
  if (max !== undefined && x > max) return false;
  return true;
};
