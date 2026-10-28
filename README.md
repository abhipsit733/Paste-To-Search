# Paste-To-Search

Paste-To-Search is a small Chrome extension, where you paste or drop an image, optionally
ask a question about it, and see results fetched by Google. Inspired by on-phone visual
search features, built as a learning project, not affiliated with or endorsed
by Google.

## What it does

- One image panel (paste with Ctrl+V, drag-and-drop, or choose a file) and one
  Ask field.
- Pasting or dropping an image only shows a preview. It never searches
  automatically. Focus stays on the Ask field so you can type, then press
  **Search** or **Enter**.
- No image → plain Google Search on whatever you typed.
- Image, no question → the image is sent to Google's reverse-image-search
  upload endpoint.
- Image + question → same upload, plus a best-effort attempt to drop your
  question into Google's own follow-up box on the results page (see
  Limitations — this part can silently fail).

## Install (unpacked, not on the Chrome Web Store)

1. Download or clone this repository.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this project's folder.
5. **Pin the toolbar icon**: click the puzzle-piece/extensions icon in the
   toolbar, find Paste-To-Search, and click the pin so it's always visible.
   Without pinning, the keyboard shortcut still works, but you won't see the
   icon in your toolbar.

## Keyboard shortcut

Default: **Ctrl+Shift+Space** opens the popup.

If it doesn't fire (another extension or app may already use that combo), go
to `chrome://extensions/shortcuts` and rebind it to whatever's free on your
machine.

## Related work

- **Chrome's built-in "Search image with Google Lens"** (right-click on a
  webpage image) — full Lens integration with a side panel and multisearch
  follow-up questions.
- **Google Lens on the web** (`lens.google.com`, `images.google.com`) —
  supports pasting an image directly into the search box, but is a separate
  site you have to navigate to each time, not a one-keystroke popup.

## Limitations (documented, not hidden)

- **The image upload is unofficial.** Google doesn't publish a supported API
  for third-party extensions to submit a pasted image. This extension opens
  Google Images and drives Google's own "search by image" panel, clicking
  the camera icon and feeding your pasted image into Google's real file
  input, the same way your own file picker would. It does not post directly
  to Google's upload endpoint (an earlier version tried that and Google
  rejected it as a malformed request). Driving the real UI is more reliable,
  but Google's page has no stable public selectors, so this can still break
  if Google changes its layout. If it can't find Google's upload button,
  it shows a brief on-page message saying so, rather than failing silently
  — so a break looks like "try this instead" rather than a dead end.
- **Google may show a login prompt or a CAPTCHA**, exactly as it can when you
  use Lens or reverse image search manually in a browser. This extension
  cannot bypass that.
- **The follow-up question isn't guaranteed to land.** Google's "Add to your
  search" box has no stable public selector, so the content script tries a
  short list of likely matches and gives up quietly if none fit. If your
  question doesn't appear automatically, type it into Google's own search box
  on the results page. It also doesn't auto-submit on purpose — a synthetic
  Enter keypress was tried in an earlier version and produced a malformed
  request from Google, so the text is filled in and the real Enter press is
  left to you.
- **The AI Overview / People also ask / Ask-anything declutter is cosmetic
  and experimental.** These are Google's own native results-page features,
  not something this extension creates, so they can't truly be disabled —
  only hidden after the fact via a content script that matches on visible
  heading text (Google gives no stable selector for them either). It can
  occasionally hide too much or too little depending on how Google's page is
  laid out that day. It only ever runs on a page this extension sent you to,
  never on your normal Google browsing.
- **No single-step redirect straight to combined image+text results.** This
  was considered and isn't technically possible without either image
  hosting (which this project deliberately avoids) or Google generating a
  results token in advance (which it doesn't — that token only exists after
  Google has processed an uploaded image). The images.google.com step is a
  same-tab, near-instant pass-through, not a separate page you interact
  with, but it can't be skipped outright.
- **Out of scope for this version**: screen region capture (no "circle" or
  drag-select, only clipboard/drop/file-picker), a side panel, right-click
  integration on webpage images, an image-URL field, support for search
  engines other than Google, third-party image hosting, analytics of any
  kind, and a Chrome Web Store listing.

## Ethics

- Your pasted image is sent **only to Google**, and only when you press
  Search — never automatically, never to any third-party server, and never
  stored outside your own browser's local extension storage during the
  handoff between the popup and the helper tab.
- This project automates an **unofficial, undocumented** Google endpoint.
  It's built for personal, educational use. If Google's terms of service or
  behavior around this endpoint change, this extension may stop working or
  may need to be retired.
- No analytics, tracking, or data collection of any kind is built into this
  extension.

## Credits

- UI typeface: Google Sans, licensed under the SIL Open Font License 1.1 —
  see `fonts/OFL.txt`. Only the Regular, Medium, and Bold static weights are
  bundled (the full family download includes 20 files and a variable-font
  version; trimmed here to keep the repo lean, since only those three are
  used).
- Background, "Choose File," and "Search" button artwork: custom assets
  provided for this project (`assets/`).

## License

MIT — see `LICENSE`. Google Sans is licensed separately under the OFL; see
`fonts/OFL.txt`. Published by Abhipsit Hore on October 28, 2026.
