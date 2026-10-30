/** Display a server timestamp in a datetime-local field without its seconds. */
export function reviewLinkLocalExpiry(value: string) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
