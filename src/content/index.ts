import {
  AD_PLAYBACK_RATE,
  MESSAGE_TYPES,
  SETTINGS_STORAGE_KEY,
  type EditableSurface,
  type Message,
  type PopupContextResponse,
  type SpeedplaySettings,
} from "../constants/common";

const PLAYBACK_RATE_EPSILON = 0.01;

const createDefaultSettings = (): SpeedplaySettings => ({
  rates: {
    shorts: 1,
    video: 1,
  },
});

const normalizeSettings = (value: unknown): SpeedplaySettings => {
  const defaults = createDefaultSettings();

  if (typeof value !== "object" || value === null || !("rates" in value)) {
    return defaults;
  }

  const rates = (value as { rates?: { shorts?: unknown; video?: unknown } }).rates;

  if (typeof rates !== "object" || rates === null) {
    return defaults;
  }

  return {
    rates: {
      shorts: typeof rates.shorts === "number" ? rates.shorts : defaults.rates.shorts,
      video: typeof rates.video === "number" ? rates.video : defaults.rates.video,
    },
  };
};

const ratesAlmostEqual = (left: number, right: number) =>
  Math.abs(left - right) < PLAYBACK_RATE_EPSILON;

const getEditableSurface = (): EditableSurface | "none" => {
  if (window.location.pathname.startsWith("/shorts/")) {
    return "shorts";
  }

  if (window.location.pathname.startsWith("/watch")) {
    return "video";
  }

  return "none";
};

const getPlayerElement = () => {
  const player = document.querySelector("#movie_player");
  return player instanceof HTMLElement ? player : null;
};

const getIsAdActive = () =>
  getEditableSurface() === "video" && getPlayerElement()?.classList.contains("ad-showing") === true;

const getVideoElement = () => {
  const video = document.querySelector("video");
  return video instanceof HTMLVideoElement ? video : null;
};

const waitForVideoElement = () =>
  new Promise<HTMLVideoElement>((resolve) => {
    const existingVideo = getVideoElement();

    if (existingVideo !== null) {
      resolve(existingVideo);
      return;
    }

    const observer = new MutationObserver(() => {
      const video = getVideoElement();

      if (video === null) {
        return;
      }

      observer.disconnect();
      resolve(video);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  });

const waitForVideoMetadata = (video: HTMLVideoElement) =>
  new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const handleReady = () => {
      video.removeEventListener("error", handleReady);
      resolve();
    };

    video.addEventListener("loadedmetadata", handleReady, { once: true });
    video.addEventListener("error", handleReady, { once: true });
  });

let settings = createDefaultSettings();
let syncRequestId = 0;
let expectedAppliedRate: number | null = null;
let managedVideo: HTMLVideoElement | null = null;
let observedPlayer: HTMLElement | null = null;
let playerObserver: MutationObserver | null = null;
let isAdActive = false;

const updateSurfaceRate = (surface: EditableSurface, value: number) => {
  settings =
    surface === "video"
      ? {
          rates: {
            ...settings.rates,
            video: value,
          },
        }
      : {
          rates: {
            ...settings.rates,
            shorts: value,
          },
        };
};

const persistSettings = async () => {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
};

const loadSettings = async () => {
  const items = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
  const nextSettings = normalizeSettings(items[SETTINGS_STORAGE_KEY]);

  settings = nextSettings;

  if (items[SETTINGS_STORAGE_KEY] === undefined) {
    await persistSettings();
  }
};

const setVideoPlaybackRate = (video: HTMLVideoElement, value: number) => {
  if (!video.isConnected) {
    return;
  }

  expectedAppliedRate = value;
  video.defaultPlaybackRate = value;
  video.playbackRate = value;
};

const handleManagedVideoRateChange = async () => {
  if (managedVideo === null) {
    return;
  }

  const nextRate = managedVideo.playbackRate;

  if (expectedAppliedRate !== null && ratesAlmostEqual(nextRate, expectedAppliedRate)) {
    expectedAppliedRate = null;
    return;
  }

  expectedAppliedRate = null;

  if (getIsAdActive()) {
    isAdActive = true;
    void syncPlaybackRate();
    return;
  }

  const surface = getEditableSurface();

  if (surface === "none") {
    return;
  }

  updateSurfaceRate(surface, nextRate);
  await persistSettings();
};

const detachManagedVideo = () => {
  if (managedVideo !== null) {
    managedVideo.removeEventListener("ratechange", handleManagedVideoRateChange);
    managedVideo = null;
  }
};

const attachManagedVideo = (video: HTMLVideoElement) => {
  if (managedVideo === video) {
    return;
  }

  detachManagedVideo();
  managedVideo = video;
  managedVideo.addEventListener("ratechange", handleManagedVideoRateChange);
};

const refreshPlayerObserver = () => {
  const nextPlayer = getEditableSurface() === "video" ? getPlayerElement() : null;

  if (observedPlayer === nextPlayer) {
    return;
  }

  playerObserver?.disconnect();
  playerObserver = null;
  observedPlayer = nextPlayer;

  if (nextPlayer === null) {
    return;
  }

  playerObserver = new MutationObserver(() => {
    const nextIsAdActive = getIsAdActive();

    if (nextIsAdActive === isAdActive) {
      return;
    }

    isAdActive = nextIsAdActive;
    void syncPlaybackRate();
  });

  playerObserver.observe(nextPlayer, {
    attributeFilter: ["class"],
    attributes: true,
  });
};

const getEffectivePlaybackRate = (surface: EditableSurface | "none") => {
  if (surface === "none") {
    return null;
  }

  if (surface === "video" && isAdActive) {
    return AD_PLAYBACK_RATE;
  }

  return settings.rates[surface];
};

const syncPlaybackRate = async () => {
  const requestId = ++syncRequestId;
  const surface = getEditableSurface();

  isAdActive = getIsAdActive();
  refreshPlayerObserver();

  if (surface === "none") {
    detachManagedVideo();
    expectedAppliedRate = null;
    return;
  }

  const video = await waitForVideoElement();

  if (requestId !== syncRequestId) {
    return;
  }

  attachManagedVideo(video);

  await waitForVideoMetadata(video);

  if (requestId !== syncRequestId) {
    return;
  }

  isAdActive = getIsAdActive();
  refreshPlayerObserver();

  const effectiveRate = getEffectivePlaybackRate(surface);

  if (effectiveRate === null) {
    return;
  }

  setVideoPlaybackRate(video, effectiveRate);
};

const getPopupContext = (): PopupContextResponse => ({
  editableSurface: getEditableSurface(),
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !(SETTINGS_STORAGE_KEY in changes)) {
    return;
  }

  settings = normalizeSettings(changes[SETTINGS_STORAGE_KEY].newValue);
  void syncPlaybackRate();
});

document.addEventListener(
  "loadedmetadata",
  (event) => {
    if (!(event.target instanceof HTMLVideoElement)) {
      return;
    }

    void syncPlaybackRate();
  },
  true
);

document.addEventListener("yt-navigate-finish", () => {
  void syncPlaybackRate();
});

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.GET_POPUP_CONTEXT) {
    sendResponse(getPopupContext());
    return;
  }

  if (message.type === MESSAGE_TYPES.SET_SURFACE_RATE) {
    updateSurfaceRate(message.surface, message.value);
    void syncPlaybackRate();
  }
});

void (async () => {
  await loadSettings();
  void syncPlaybackRate();
})();
