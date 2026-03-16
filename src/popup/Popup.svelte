<script lang="ts">
  import {
    MESSAGE_TYPES,
    PLAYBACK_PRESETS,
    SETTINGS_STORAGE_KEY,
    type EditableSurface,
    type PopupContextResponse,
    type SpeedplaySettings,
  } from "../constants/common";

  const PLAYBACK_RATE_EPSILON = 0.01;

  const playbackRates = PLAYBACK_PRESETS.map((value) => ({
    label: `${value}x`,
    value,
  }));

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

  let activeTabId: number | null = null;
  let editableSurface: EditableSurface | "none" = "none";
  let currentRate = 1;
  let isLoading = true;

  const loadSettings = async () => {
    const items = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const settings = normalizeSettings(items[SETTINGS_STORAGE_KEY]);

    if (items[SETTINGS_STORAGE_KEY] === undefined) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
    }

    return settings;
  };

  const refreshPopupState = async () => {
    isLoading = true;

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    activeTabId = currentTab?.id ?? null;

    if (activeTabId === null) {
      editableSurface = "none";
      isLoading = false;
      return;
    }

    let popupContext: PopupContextResponse | undefined;

    try {
      popupContext = (await chrome.tabs.sendMessage(activeTabId, {
        type: MESSAGE_TYPES.GET_POPUP_CONTEXT,
      })) as PopupContextResponse | undefined;
    } catch {
      popupContext = undefined;
    }

    editableSurface = popupContext?.editableSurface ?? "none";

    if (editableSurface === "none") {
      isLoading = false;
      return;
    }

    const settings = await loadSettings();
    currentRate = settings.rates[editableSurface];
    isLoading = false;
  };

  const setPlaybackRate = async (value: number) => {
    if (editableSurface === "none") {
      return;
    }

    const settings = await loadSettings();
    const nextSettings: SpeedplaySettings =
      editableSurface === "video"
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

    currentRate = value;

    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: nextSettings });

    if (activeTabId === null) {
      return;
    }

    try {
      await chrome.tabs.sendMessage(activeTabId, {
        surface: editableSurface,
        type: MESSAGE_TYPES.SET_SURFACE_RATE,
        value,
      });
    } catch {
      // The current tab may no longer have an active content script.
    }
  };

  const isSelectedRate = (value: number) => ratesAlmostEqual(currentRate, value);
  const hasCustomRate = () => !PLAYBACK_PRESETS.some((value) => isSelectedRate(value));
  const surfaceTitle = () => (editableSurface === "shorts" ? "Shorts speed" : "Video speed");

  void refreshPopupState();
</script>

<h1 class="pb-4 text-3xl text-red-600">Speedplay</h1>

{#if isLoading}
  <p class="text-sm">Loading...</p>
{:else if editableSurface === "none"}
  <p class="max-w-64 text-sm">Open a YouTube video or Short to edit playback speed.</p>
{:else}
  <div class="space-y-3">
    <div>
      <h2 class="text-lg font-semibold">{surfaceTitle()}</h2>

      {#if hasCustomRate()}
        <p class="text-sm text-red-600">Current: {currentRate}x (set in YouTube)</p>
      {/if}
    </div>

    <div class="container flex gap-4">
      {#each playbackRates as playbackRate}
        <button
          data-value={playbackRate.value}
          class="basis-48 cursor-pointer border border-red-600 text-center hover:bg-red-600"
          class:bg-red-600={isSelectedRate(playbackRate.value)}
          on:click={() => setPlaybackRate(playbackRate.value)}
        >
          {playbackRate.label}
        </button>
      {/each}
    </div>
  </div>
{/if}
