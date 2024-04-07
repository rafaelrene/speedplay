<script lang="ts">
  import { MESSAGE_TYPES, STORAGE_KEY } from "../constants/common";

  const playbackRates = [
    { value: 1, label: "1x" },
    { value: 2, label: "2x" },
    { value: 2.5, label: "2.5x" },
    { value: 3, label: "3x" },
  ] as const;

  type PLAYBACK_RATES = (typeof playbackRates)[number]["value"];

  let selectedPlaybackRate: PLAYBACK_RATES;

  chrome.storage.local.get((items) => {
    selectedPlaybackRate = items[STORAGE_KEY] ?? 1;
  });

  const setPlaybackRate = async (value: PLAYBACK_RATES) => {
    selectedPlaybackRate = value;

    chrome.storage.local.set({ speedplay_rate: value });

    const [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (currentTab === undefined || currentTab.id === undefined) {
      return;
    }

    chrome.tabs.sendMessage(currentTab.id, {
      type: MESSAGE_TYPES.CHANGE_PLAYBACK_RATE,
      value,
    });
  };
</script>

<h1 class="text-red-600 text-3xl pb-4">Speedplay</h1>

<div class="container flex gap-4">
  {#each playbackRates as playbackRate}
    <button
      data-value={playbackRate.value}
      class="border border-red-600 basis-48 text-center cursor-pointer hover:bg-red-600"
      class:bg-red-600={playbackRate.value === selectedPlaybackRate}
      on:click={() => setPlaybackRate(playbackRate.value)}
    >
      {playbackRate.label}
    </button>
  {/each}
</div>
