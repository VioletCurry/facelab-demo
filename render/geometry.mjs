export function mixPoints(a, b, amount) {
  const weight = clamp(amount, 0, 1);
  return {
    x: a.x * (1 - weight) + b.x * weight,
    y: a.y * (1 - weight) + b.y * weight,
  };
}

export function movePoint(source, offset) {
  return { x: source.x + offset.x, y: source.y + offset.y };
}

export function raise(point, amount) {
  return { x: point.x, y: point.y + amount };
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angleBetween(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  const progress = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * progress;
}

export function similarity(value, target, range) {
  return clamp(1 - Math.abs(value - target) / range, 0, 1);
}

export function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
