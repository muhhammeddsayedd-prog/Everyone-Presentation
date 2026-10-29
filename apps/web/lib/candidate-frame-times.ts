export function parseFrameSeconds(value: string): number[] {
  const invalid = (): never => { throw new Error('Enter one to ten distinct times in seconds, with at most three decimal places.'); };
  if (value.length > 200) invalid();
  const values = value.split(',').map(item => item.trim());
  if (!values.length || values.length > 10 || values.some(item => !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?$/u.test(item))) invalid();
  const times = values.map(item => Math.round(Number(item) * 1000));
  if (times.some(time => !Number.isSafeInteger(time) || time >= 1_800_000) || new Set(times).size !== times.length) invalid();
  return times;
}
