import "../app.css";
import Popup from "./Popup.svelte";

const target = document.getElementById("app") as HTMLElement;

async function render() {
  new Popup({ target });
}

document.addEventListener("DOMContentLoaded", render);
