export const formatDateLocal = (date: Date) => {
  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60 * 1000);
  return localDate.toISOString().split('T')[0];
};

export const getDefaultTripDates = () => {
  const today = new Date();
  const next = new Date(today);
  next.setDate(today.getDate() + 4);
  return { start: formatDateLocal(today), end: formatDateLocal(next) };
};

