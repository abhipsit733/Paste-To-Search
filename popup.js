// Paste-To-Search — popup logic
// Image intake is clipboard paste, drag-and-drop, or the file picker only.
// No auto-search on paste/drop: this only ever shows a preview and keeps
// focus on the Ask field until the user presses Search or Enter.

const dropzone = document.getElementById("dropzone");
const dropHint = document.getElementById("dropHint");
const preview = document.getElementById("preview");
const fileInput = document.getElementById("fileInput");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const clearImgBtn = document.getElementById("clearImgBtn");
const askInput = document.getElementById("askInput");
const searchBtn = document.getElementById("searchBtn");
const errorMsg = document.getElementById("errorMsg");

let pendingImageDataUrl = null;

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/avif",
];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".svg", ".avif"];

function isAllowedImage(file) {
  if (file && file.type && ALLOWED_MIME_TYPES.includes(file.type)) {
    return true;
  }
  // Fallback for files with a missing/generic type (some clipboard paste
  // sources omit it) — check the extension instead.
  const name = (file && file.name ? file.name : "").toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function showError(msg) {
  errorMsg.textContent = msg;
}

function clearError() {
  errorMsg.textContent = "";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleImageFile(file) {
  if (!file || !isAllowedImage(file)) {
    showError("Only .jpg, .jpeg, .png, .svg, and .avif images are supported.");
    return;
  }
  clearError();
  pendingImageDataUrl = await fileToDataUrl(file);
  preview.src = pendingImageDataUrl;
  preview.hidden = false;
  dropHint.hidden = true;
  clearImgBtn.hidden = false;
  // Preview only — focus stays on Ask so the user can type, not auto-search.
  askInput.focus();
}

function clearImage() {
  pendingImageDataUrl = null;
  preview.hidden = true;
  preview.src = "";
  dropHint.hidden = false;
  clearImgBtn.hidden = true;
}

// Clipboard paste (works regardless of which element has focus)
document.addEventListener("paste", async (e) => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      e.preventDefault();
      await handleImageFile(file);
      break;
    }
  }
});

// Drag-and-drop onto the panel
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file) await handleImageFile(file);
});

// Choose-file button
chooseFileBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (file) await handleImageFile(file);
  fileInput.value = "";
});

clearImgBtn.addEventListener("click", clearImage);

async function submitSearch() {
  const ask = askInput.value.trim();
  clearError();

  if (!pendingImageDataUrl && !ask) {
    showError("Add a question or an image first.");
    return;
  }

  if (!pendingImageDataUrl) {
    // Text-only: plain Google Search
    const url = "https://www.google.com/search?q=" + encodeURIComponent(ask);
    chrome.tabs.create({ url });
    window.close();
    return;
  }

  // Image present (with or without a follow-up question):
  // store it for the content script, then open Google Images, where that
  // content script will drive Google's own upload UI. See README for why
  // this rides on Google's real form instead of posting to it directly.
  await chrome.storage.local.set({
    pendingImage: pendingImageDataUrl,
    pendingAsk: ask,
    declutterOnce: true,
  });
  chrome.tabs.create({ url: "https://images.google.com/" });
  window.close();
}

searchBtn.addEventListener("click", submitSearch);
askInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitSearch();
  }
});
