/**
 * Hotdog Party – Notification System
 * Drop this script into any page to get live bottom-left notifications.
 * Reads from Firebase /notifications, respects dismissed state via localStorage.
 *
 *   <script src="notifications.js"></script>
 */
(function () {
  "use strict";

  const FB_NOTIF     = "https://hotdog-party-61e77-default-rtdb.firebaseio.com/notifications";
  const POLL_MS      = 30_000;   // re-check every 30 seconds
  const AUTO_HIDE_MS = 10_000;   // auto-dismiss after 10 seconds
  const DISMISSED_KEY = "hp_dismissed_notifs";
  const SEEN_KEY      = "hp_seen_notifs";

  /* ── Inject CSS ─────────────────────────────────────────── */
  const style = document.createElement("style");
  style.textContent = `
    #hp-notif-container {
      position: fixed;
      bottom: 24px;
      left: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column-reverse;
      gap: 10px;
      pointer-events: none;
      max-width: min(380px, calc(100vw - 40px));
    }

    .hp-toast {
      pointer-events: all;
      display: flex;
      align-items: flex-start;
      gap: 0;
      background: #161618;
      border: 1px solid rgba(255,140,0,.28);
      border-left: 3px solid #ff8c00;
      border-radius: 14px;
      box-shadow:
        0 8px 40px rgba(0,0,0,.65),
        0 2px 10px rgba(0,0,0,.4),
        inset 0 1px 0 rgba(255,255,255,.04);
      overflow: hidden;
      transform: translateX(calc(-100% - 24px));
      opacity: 0;
      transition: transform .38s cubic-bezier(.22,.68,0,1.2), opacity .28s ease;
      position: relative;
      min-width: 280px;
    }

    .hp-toast.hp-in {
      transform: translateX(0);
      opacity: 1;
    }

    .hp-toast.hp-out {
      transform: translateX(calc(-100% - 24px));
      opacity: 0;
      transition: transform .3s ease-in, opacity .25s ease-in;
    }

    /* Left glow accent */
    .hp-toast::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, #ffcc00, #ff7b00);
      border-radius: 14px 0 0 14px;
    }

    .hp-toast-inner {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      padding: 14px 14px 0 16px;
    }

    .hp-toast-top {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .hp-toast-emoji {
      font-size: 22px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 1px;
      filter: drop-shadow(0 0 6px rgba(255,140,0,.5));
    }

    .hp-toast-content { flex: 1; min-width: 0; }

    .hp-toast-header {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 4px;
    }

    .hp-toast-site {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #ff8c00;
      font-family: system-ui, sans-serif;
      background: rgba(255,140,0,.1);
      border: 1px solid rgba(255,140,0,.2);
      border-radius: 4px;
      padding: 1px 5px;
    }

    .hp-toast-title {
      font-size: 13px;
      font-weight: 700;
      color: #f0f0f0;
      font-family: "Segoe UI", system-ui, sans-serif;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hp-toast-msg {
      font-size: 12px;
      color: #aaa;
      line-height: 1.5;
      font-family: "Segoe UI", system-ui, sans-serif;
      max-height: 3.5em;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      padding-bottom: 12px;
    }

    /* Progress bar */
    .hp-toast-progress {
      height: 3px;
      background: rgba(255,255,255,.06);
      border-radius: 0 0 0 0;
      overflow: hidden;
      margin-top: auto;
    }
    .hp-toast-progress-bar {
      height: 100%;
      width: 100%;
      background: linear-gradient(90deg, #ff7b00, #ffcc00);
      transform-origin: left;
      border-radius: 0;
      animation: hp-progress linear forwards;
    }
    @keyframes hp-progress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }

    /* Close btn */
    .hp-toast-close {
      flex-shrink: 0;
      background: none;
      border: none;
      color: #555;
      font-size: 16px;
      cursor: pointer;
      padding: 10px 12px 10px 4px;
      line-height: 1;
      transition: color .15s;
      align-self: flex-start;
      margin-top: 2px;
    }
    .hp-toast-close:hover { color: #ff8c00; }

    /* Pulse dot for new */
    .hp-toast-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #ff8c00;
      flex-shrink: 0;
      margin-top: 5px;
      box-shadow: 0 0 0 0 rgba(255,140,0,.6);
      animation: hp-dot-pulse 1.5s ease-out 3;
    }
    @keyframes hp-dot-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(255,140,0,.6); }
      70%  { box-shadow: 0 0 0 7px rgba(255,140,0,0); }
      100% { box-shadow: 0 0 0 0 rgba(255,140,0,0); }
    }

    /* Subtle shimmer on entry */
    .hp-toast.hp-in::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,140,0,.05) 50%, transparent 100%);
      border-radius: 14px;
      animation: hp-shimmer .6s ease-out .1s forwards;
      opacity: 0;
    }
    @keyframes hp-shimmer {
      0%   { opacity: 1; transform: translateX(-100%); }
      100% { opacity: 0; transform: translateX(100%); }
    }
  `;
  document.head.appendChild(style);

  /* ── Container ──────────────────────────────────────────── */
  const container = document.createElement("div");
  container.id    = "hp-notif-container";
  document.body.appendChild(container);

  /* ── State ──────────────────────────────────────────────── */
  function getDismissed() {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "[]"); }
    catch { return []; }
  }
  function addDismissed(id) {
    const list = getDismissed();
    if (!list.includes(id)) { list.push(id); localStorage.setItem(DISMISSED_KEY, JSON.stringify(list)); }
  }
  function getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); }
    catch { return []; }
  }
  function addSeen(id) {
    const list = getSeen();
    if (!list.includes(id)) { list.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(list)); }
  }

  /* ── Show a single toast ────────────────────────────────── */
  function showToast(notif, delay = 0) {
    const toast = document.createElement("div");
    toast.className  = "hp-toast";
    toast.dataset.id = notif.id;

    toast.innerHTML = `
      <div class="hp-toast-inner">
        <div class="hp-toast-top">
          <span class="hp-toast-emoji">${notif.emoji || "📢"}</span>
          <div class="hp-toast-content">
            <div class="hp-toast-header">
              <span class="hp-toast-site">Hotdog Party</span>
              <span class="hp-toast-dot"></span>
            </div>
            <div class="hp-toast-title">${notif.title || "Announcement"}</div>
            <div class="hp-toast-msg">${notif.message || ""}</div>
          </div>
        </div>
        <div class="hp-toast-progress">
          <div class="hp-toast-progress-bar" style="animation-duration:${AUTO_HIDE_MS}ms"></div>
        </div>
      </div>
      <button class="hp-toast-close" title="Dismiss">✕</button>
    `;

    /* Dismiss logic */
    function dismiss(markDismissed = true) {
      if (markDismissed) addDismissed(notif.id);
      toast.classList.remove("hp-in");
      toast.classList.add("hp-out");
      clearTimeout(autoTimer);
      setTimeout(() => toast.remove(), 320);
    }

    toast.querySelector(".hp-toast-close").addEventListener("click", () => dismiss(true));

    /* Auto-dismiss */
    let autoTimer;
    function startAutoTimer() {
      autoTimer = setTimeout(() => dismiss(false), AUTO_HIDE_MS + delay);
    }

    /* Pause on hover */
    toast.addEventListener("mouseenter", () => {
      clearTimeout(autoTimer);
      const bar = toast.querySelector(".hp-toast-progress-bar");
      if (bar) { bar.style.animationPlayState = "paused"; }
    });
    toast.addEventListener("mouseleave", () => {
      const bar = toast.querySelector(".hp-toast-progress-bar");
      if (bar) { bar.style.animationPlayState = "running"; }
      autoTimer = setTimeout(() => dismiss(false), 3000); // 3s after hover ends
    });

    container.appendChild(toast);

    /* Animate in */
    setTimeout(() => {
      toast.classList.add("hp-in");
      startAutoTimer();
    }, delay + 20);

    addSeen(notif.id);
  }

  /* ── Fetch & display ────────────────────────────────────── */
  let knownIds = new Set();

  async function fetchAndShow(initial = false) {
    try {
      const res  = await fetch(FB_NOTIF + ".json");
      const data = await res.json();
      if (!data) return;

      const dismissed = getDismissed();

      const notifs = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .filter(n => n.active && !dismissed.includes(n.id))
        .sort((a, b) => (a.ts || 0) - (b.ts || 0)); // oldest first so newest is on top

      if (initial) {
        /* On page load — show all active, undismissed (newest one only to avoid spam) */
        const unseen = notifs.filter(n => !getSeen().includes(n.id));
        unseen.forEach((n, i) => {
          knownIds.add(n.id);
          showToast(n, i * 400);
        });
        /* Also track seen ones so we don't re-fire them on next poll */
        notifs.forEach(n => knownIds.add(n.id));
      } else {
        /* Poll — only show brand-new notifications */
        notifs.forEach((n, i) => {
          if (!knownIds.has(n.id)) {
            knownIds.add(n.id);
            showToast(n, i * 400);
          }
        });
      }
    } catch { /* silently fail */ }
  }

  /* ── Bootstrap ──────────────────────────────────────────── */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      fetchAndShow(true);
      setInterval(() => fetchAndShow(false), POLL_MS);
    });
  } else {
    fetchAndShow(true);
    setInterval(() => fetchAndShow(false), POLL_MS);
  }

})();
