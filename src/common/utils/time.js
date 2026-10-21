export const isPast = (date) => {
  if (!date) return false;
  return new Date(date).getTime() < Date.now();
};
