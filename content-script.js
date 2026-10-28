// Paste-To-Search — content script (runs on google.com and
// images.google.com)
//
// Two jobs, on two different page loads:
//   1. On images.google.com: open Google's own "search by image" panel and
//      feed it the pasted image via its real file input, instead of
//      posting to Google's upload endpoint directly. This rides on
//      Google's own form so the request looks like a normal browser
//      upload, which is why it replaces the earlier raw-POST approach.
//   2. On the results page afterward: best-effort fill the optional
//      follow-up question into Google's own box, if one is present.
//
// Google publishes no stable selectors for either of these, so both steps
// use a short list of likely candidates and a bounded wait, then quietly
// give up if nothing matches. See README > Limitations.

(async () => {
  const stored = await chrome.storage.local.get([
    "pendingImage",
    "pendingAsk",
    "lensFollowUpAsk",
    "declutterOnce",
  ]);

  // Only touch pages reached via our own extension — never a page the
  // user navigated to on their own.
  if (stored.declutterOnce) {
    await chrome.storage.local.remove("declutterOnce");
    declutter();
  }

  if (stored.pendingImage) {
    await uploadImage(stored.pendingImage, stored.pendingAsk);
    return; // this load's job is the upload, not the follow-up fill
  }

  if (stored.lensFollowUpAsk) {
    await fillFollowUp(stored.lensFollowUpAsk);
  }
})();

// Best-effort, experimental: hides Google's own AI Overview, "People also
// ask", and the floating "Ask anything" follow-up bar, so the results page
// shows closer to just what you searched for — nothing extra suggested.
// This only ever runs on a page reached via this extension (gated by the
// declutterOnce flag above), never on your regular Google browsing.
//
// Google gives these sections no stable selector, so this matches by
// visible heading text instead and hides a nearby ancestor. That's
// inherently approximate: it can occasionally hide too much or too
// little. Treat it as cosmetic best-effort, same as the rest of this
// extension's Google automation. See README > Limitations.
function declutter() {
  const HIDE_TEXT = ["AI Overview", "People also ask", "Ask anything"];
  const ANCESTOR_LEVELS = 5;

  const sweep = () => {
    const all = document.querySelectorAll("h1, h2, h3, div, span");
    for (const el of all) {
      const text = (el.textContent || "").trim();
      // startsWith, not exact match: Google's heading elements usually
      // bundle extra text (an icon label like "Listen", etc.) that an
      // exact-equality check misses entirely.
      const matches = HIDE_TEXT.some((phrase) => text.startsWith(phrase));
      if (!matches || text.length > 60) continue;
      let container = el;
      for (let i = 0; i < ANCESTOR_LEVELS && container.parentElement; i++) {
        container = container.parentElement;
      }
      container.style.display = "none";
    }
  };

  sweep();
  // These sections often load in after the initial page render, so keep
  // watching for a short, bounded window instead of a single pass.
  const observer = new MutationObserver(sweep);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 15000);
}

// Shows a brief, visible message on the page when the automation can't
// find what it's looking for — so a failure looks like "this one step
// didn't work, here's what to do" instead of a silent blank page.
function showInlineNotice(message) {
  const banner = document.createElement("div");
  banner.textContent = message;
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:2147483647;" +
    "background:#b91c1c;color:#fff;font-family:system-ui,sans-serif;" +
    "font-size:14px;padding:10px 16px;text-align:center;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.3);";
  document.body.prepend(banner);
  setTimeout(() => banner.remove(), 10000);
}

function waitFor(selectors, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) return resolve(el);
      }
      if (Date.now() - start > timeoutMs) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

async function uploadImage(dataUrl, ask) {
  // Clear immediately so a page refresh doesn't retry a stale upload.
  await chrome.storage.local.remove("pendingImage");
  if (ask) {
    await chrome.storage.local.set({ lensFollowUpAsk: ask });
  } else {
    await chrome.storage.local.remove("lensFollowUpAsk");
  }

  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], "pasted-image.png", {
      type: blob.type || "image/png",
    });

    // Step 1: open the "search by image" (camera icon) panel, if it's not
    // already open. Several label variants are tried since Google changes
    // these without notice.
    const cameraBtn = await waitFor(
      [
        'div[aria-label="Search by image"]',
        'span[aria-label="Search by image"]',
        'div[aria-label="Search by image"] svg',
      ],
      4000
    );
    if (cameraBtn) cameraBtn.click();

    // Step 2: wait for a real file input to appear and feed it our image,
    // the same way a user's own file picker would.
    const fileInput = await waitFor(['input[type="file"]'], 4000);
    if (!fileInput) {
      console.warn(
        "Paste-To-Search: couldn't find Google's upload input. " +
          "Google's page likely changed — see README > Limitations."
      );
      showInlineNotice(
        "Paste-To-Search couldn't find Google's upload button this time — " +
          "try pasting the image directly at images.google.com instead."
      );
      return;
    }

    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (err) {
    console.warn("Paste-To-Search: image upload automation failed.", err);
  }
}

async function fillFollowUp(ask) {
  await chrome.storage.local.remove("lensFollowUpAsk");

  // Lens can take a while to finish analyzing the image before this box
  // exists at all, so this waits longer than the upload-side checks do.
  const box = await waitFor(
    [
      'textarea[aria-label="Add to your search"]',
      'input[aria-label="Add to your search"]',
      'textarea[aria-label="Search"]',
    ],
    20000
  );
  if (!box) return; // documented fallback: type the question in manually

  // Fill the text and stop there. An earlier version also faked an Enter
  // keypress to auto-submit, but a synthetic keydown doesn't reliably go
  // through Google's real submit handling here — it produced a malformed
  // request that opened a broken results tab. Leaving the real Enter press
  // to the user avoids that, and matches the rest of this extension's
  // "never auto-submit" behavior.
  box.focus();
  box.value = ask;
  box.dispatchEvent(new Event("input", { bubbles: true }));

  // Setting the value fires Google's own live-suggestion dropdown, same as
  // if you'd typed it. A synthetic Escape keypress was tried here before,
  // but script-dispatched key events don't reliably carry the old-style
  // keyCode a lot of dropdown-closing logic still checks for, so Google
  // never registered it. Blurring the field is more reliable — dropdowns
  // close on blur pretty much universally, regardless of how the closing
  // logic is implemented. The typed text stays; only focus/the dropdown
  // goes away.
  box.blur();
}
