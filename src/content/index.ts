import { MESSAGE_TYPES, STORAGE_KEY, type Message } from "src/constants/common";

let playbackRate = 1;

const handleVideoPlaybackRate = (value: number) => {
  const video = document.querySelector("video") as HTMLVideoElement;

  video.defaultPlaybackRate = value;
  video.playbackRate = value;
};

chrome.storage.local.get((items) => {
  if (items[STORAGE_KEY]) {
    playbackRate = items[STORAGE_KEY];
  }

  handleVideoPlaybackRate(playbackRate);
});

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === MESSAGE_TYPES.CHANGE_PLAYBACK_RATE) {
    playbackRate = message.value;

    handleVideoPlaybackRate(playbackRate);
    return;
  }
});
