type EnumOf<T> = T[keyof T];

export const PLAYBACK_PRESETS = [1, 2, 2.25, 2.5, 3] as const;
export const AD_PLAYBACK_RATE = PLAYBACK_PRESETS[PLAYBACK_PRESETS.length - 1];

export type PlaybackPreset = (typeof PLAYBACK_PRESETS)[number];
export type EditableSurface = "video" | "shorts";
export type DetectedSurface = EditableSurface | "none";

export type SpeedplaySettings = {
  rates: {
    video: number;
    shorts: number;
  };
};

export const MESSAGE_TYPES = {
  GET_POPUP_CONTEXT: "GET_POPUP_CONTEXT",
  SET_SURFACE_RATE: "SET_SURFACE_RATE",
} as const;

type MESSAGE_TYPES = EnumOf<typeof MESSAGE_TYPES>;

export type GetPopupContextMessage = {
  type: typeof MESSAGE_TYPES.GET_POPUP_CONTEXT;
};

export type SetSurfaceRateMessage = {
  type: typeof MESSAGE_TYPES.SET_SURFACE_RATE;
  surface: EditableSurface;
  value: number;
};

export type Message = GetPopupContextMessage | SetSurfaceRateMessage;

export type PopupContextResponse = {
  editableSurface: DetectedSurface;
};

export const SETTINGS_STORAGE_KEY = "speedplay_settings";
