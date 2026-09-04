export const motionDurations = {
  fast: 200,
  standard: 300,
  slow: 500,
} as const;

export type MotionDurationRole = keyof typeof motionDurations;
