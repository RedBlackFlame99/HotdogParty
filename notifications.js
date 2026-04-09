/**
 * notifications.js — Hotdog Party
 * Drop this script on any page and it will automatically fetch & display
 * active notifications from Firebase, regardless of which page you're on.
 */
(function () {
  const FB_NOTIFS = "https://hotdog-party-61e77-default-rtdb.firebaseio.com/notifications.json";
  const SEEN_KEY  = "hotdog_seen_notifs";

  /* ── localStorage helpers ── */
  function getSeenIds() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
  }
  function markSeen(id) {
    const s = getSeenIds();
    if (!s.includes(id)) { s.push(id); localStorage.setItem(SEEN_KEY, JSON.stringify(s)); }
  }

  /* ── inject shared styles once ── */
  function injectStyles() {
    if (document.getElementById("hp-notif-styles")) return;
    const style = document.createElement("style");
    style.id = "hp-notif-styles";
    style.textContent = `
      @keyframes hpNotifIn  { from { opacity:0; transform:translateX(-50%) translateY(-14px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      @keyframes hpNotifOut { from { opacity:1; transform:translateX(-50%) translateY(0); }    to { opacity:0; transform:translateX(-50%) translateY(-14px); } }
      .hp-notif-bar {
        position: fixed;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        max-width: 620px;
        width: calc(100% - 40px);
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 13px 18px;
        border-radius: 14px;
        font-family: "Segoe UI", system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #fff;
        box-shadow: 0 6px 30px rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
        animation: hpNotifIn .3s ease forwards;
        transition: top .3s ease;
        box-sizing: border-box;
      }
      .hp-notif-msg   { flex: 1; line-height: 1.45; }
      .hp-notif-icon  { font-size: 20px; flex-shrink: 0; }
      .hp-notif-close {
        background: rgba(255,255,255,.15);
        border: 1px solid rgba(255,255,255,.25);
        border-radius: 7px;
        color: #fff;
        width: 28px; height: 28px;
        cursor: pointer;
        font-size: 14px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        transition: background .2s;
        line-height: 1;
      }
      .hp-notif-close:hover { background: rgba(255,255,255,.28); }
    `;
    document.head.appendChild(style);
  }

  const TYPE_STYLES = {
    info:    { bg: "rgba(52,75,220,.95)",  border: "#5865F2" },
    success: { bg: "rgba(0,170,80,.92)",   border: "#00c864" },
    warning: { bg: "rgba(220,130,0,.96)",  border: "#ff8c00" },
    error:   { bg: "rgba(190,35,35,.95)",  border: "#ff4444" },
  };

  /* ── stack manager ── keeps bars from overlapping ── */
  const activeStack = []; // [{id, el}]
  const TOP_BASE    = 80; // px below top of viewport (clears the topbar)
  const BAR_GAP     = 8;

  function restack() {
    let cursor = TOP_BASE;
    activeStack.forEach(({ el }) => {
      el.style.top = cursor + "px";
      cursor += el.offsetHeight + BAR_GAP;
    });
  }

  function removeFromStack(id) {
    const idx = activeStack.findIndex(e => e.id === id);
    if (idx !== -1) activeStack.splice(idx, 1);
    restack();
  }

  /* ── show a single notification ── */
  function showNotification(notif) {
    if (getSeenIds().includes(notif.id)) return;

    injectStyles();

    const colors = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
    const bar = document.createElement("div");
    bar.className = "hp-notif-bar";
    bar.style.cssText += `background:${colors.bg};border:1px solid ${colors.border};top:${TOP_BASE}px;`;

    bar.innerHTML = `
      <span class="hp-notif-icon">${notif.icon || "🔔"}</span>
      <span class="hp-notif-msg">${notif.message || ""}</span>
      <button class="hp-notif-close" aria-label="Dismiss">✕</button>
    `;

    const closeBtn = bar.querySelector(".hp-notif-close");
    function dismiss() {
      bar.style.animation = "hpNotifOut .25s ease forwards";
      setTimeout(() => {
        bar.remove();
        removeFromStack(notif.id);
      }, 250);
    }
    closeBtn.addEventListener("click", dismiss);

    document.body.appendChild(bar);
    markSeen(notif.id);

    activeStack.push({ id: notif.id, el: bar });
    restack();

    if (notif.duration && notif.duration > 0) {
      setTimeout(dismiss, notif.duration * 1000);
    }
  }

  /* ── fetch & display ── */
  async function fetchAndShow() {
    try {
      const res  = await fetch(FB_NOTIFS);
      const data = await res.json();
      if (!data) return;

      const now   = Date.now();
      const notifs = Object.values(data)
        .filter(n => n && n.active && n.id && n.message)
        .filter(n => !n.expires || n.expires > now)
        .sort((a, b) => (a.id || 0) - (b.id || 0));

      notifs.forEach((n, i) => setTimeout(() => showNotification(n), i * 350));
    } catch { /* network error — silent */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchAndShow);
  } else {
    fetchAndShow();
  }
})();
