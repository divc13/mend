import { Easing, interpolate, spring } from 'remotion';

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const EASE_OUT = Easing.out(Easing.cubic);
export const EASE_IN_OUT = Easing.inOut(Easing.cubic);

export const seconds = (value: number, fps: number): number => Math.round(value * fps);

export const fadeIn = (frame: number, start = 0, duration = 18): number =>
  interpolate(frame, [start, start + duration], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

export const fadeOut = (frame: number, start: number, duration = 18): number =>
  interpolate(frame, [start, start + duration], [1, 0], {
    ...CLAMP,
    easing: EASE_OUT,
  });

export const fadeBetween = (frame: number, start: number, end: number, pad = 12): number =>
  Math.min(fadeIn(frame, start, pad), fadeOut(frame, end - pad, pad));

export const riseIn = (
  frame: number,
  start = 0,
  duration = 26,
  distance = 34,
): { opacity: number; transform: string } => {
  const progress = fadeIn(frame, start, duration);
  return {
    opacity: progress,
    transform: `translateY(${(1 - progress) * distance}px)`,
  };
};

export const slideIn = (
  frame: number,
  start = 0,
  duration = 26,
  distance = 50,
): { opacity: number; transform: string } => {
  const progress = fadeIn(frame, start, duration);
  return {
    opacity: progress,
    transform: `translateX(${(1 - progress) * distance}px)`,
  };
};

export const popIn = (
  frame: number,
  fps: number,
  start = 0,
  damping = 200,
  stiffness = 120,
): number => {
  const local = Math.max(0, frame - start);
  return spring({
    frame: local,
    fps,
    config: { damping, stiffness, mass: 0.9 },
  });
};

export const beatOpacity = (
  frame: number,
  index: number,
  starts: number[],
  fade = 12,
): number => {
  const start = starts[index];
  const next = starts[index + 1];
  if (start === undefined) {
    return 0;
  }
  const incoming =
    index === 0 ? 1 : interpolate(frame, [start, start + fade], [0, 1], CLAMP);
  const outgoing =
    next === undefined
      ? 1
      : interpolate(frame, [next, next + fade], [1, 0], CLAMP);
  return Math.min(incoming, outgoing);
};

export const stagger = (
  frame: number,
  index: number,
  start = 0,
  step = 6,
  duration = 20,
): number => fadeIn(frame, start + index * step, duration);

export const activeIndex = (frame: number, starts: number[]): number => {
  let result = 0;
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (start !== undefined && frame >= start) {
      result = index;
    }
  }
  return result;
};
