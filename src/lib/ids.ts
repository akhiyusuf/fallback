/** Compact unique-enough id generator for local-only data. */

let counter = 0;

export function newId(prefix = 'id'): string {
  counter = (counter + 1) % 46656; // 36^3
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  const seq = counter.toString(36).padStart(3, '0');
  return `${prefix}_${time}${seq}${rand}`;
}
