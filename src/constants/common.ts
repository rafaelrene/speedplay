type EnumOf<T> = T[keyof T];

export const MESSAGE_TYPES = {
  CHANGE_PLAYBACK_RATE: "CHANGE_PLAYBACK_RATE",
} as const;

type MESSAGE_TYPES = EnumOf<typeof MESSAGE_TYPES>;

export type Message = { type: MESSAGE_TYPES; value: number };

export const STORAGE_KEY = "speedplay_rate";
