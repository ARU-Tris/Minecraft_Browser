(function (root, factory) {
  const pose = factory();
  if (typeof module === 'object' && module.exports) module.exports = pose;
  else root.CraftPlayerPose = pose;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
  const neutral = () => ({ bodyYaw: 0, headYaw: 0, headPitch: 0 });
  function target(x, y, bounds) {
    if (![x, y, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return neutral();
    const dx = x - (bounds.left + bounds.width / 2), dy = y - (bounds.top + bounds.height * .23);
    const gaze = clamp(Math.atan(dx / (bounds.width * 1.8)) * .72, .62);
    const bodyYaw = clamp(gaze * .28, .16);
    return { bodyYaw, headYaw: gaze - bodyYaw, headPitch: clamp(Math.atan(dy / (bounds.height * 1.5)) * .6, .24) };
  }
  function advance(current, desired, seconds) {
    const delta = Math.max(0, Math.min(.064, Number.isFinite(seconds) ? seconds : 0));
    const next = {};
    for (const [part, speed] of [['bodyYaw', 10], ['headYaw', 18], ['headPitch', 16]]) {
      const value = current[part] + (desired[part] - current[part]) * (1 - Math.exp(-speed * delta));
      next[part] = Math.abs(value - desired[part]) < .0001 ? desired[part] : value;
    }
    return next;
  }
  const settled = (current, desired) => Object.keys(neutral()).every(part => Math.abs(current[part] - desired[part]) < .0001);
  return { neutral, target, advance, settled };
});
