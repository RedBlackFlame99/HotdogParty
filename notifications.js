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
      @keyframes hpNotifIn  { 
        from { 
          opacity: 0; 
          transform: translateY(20px) translateX(-20px) scale(0.95); 
        } 
        to { 
          opacity: 1; 
          transform: translateY(0) translateX(0) scale(1); 
        } 
      }
      @keyframes hpNotifOut { 
        from { 
          opacity: 1; 
          transform: translateY(0) translateX(0) scale(1); 
        }    
        to { 
          opacity: 0; 
          transform: translateY(20px) translateX(-20px) scale(0.95); 
        } 
      }
      .hp-notif-container {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 10000;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 420px;
      }
      .hp-notif-bar {
        position: relative;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", system-ui, sans-serif;
        font-size: 13px;
        font-weight: 500;
        line-height: 1.5;
        color: #fff;
        box-shadow: 0 10px 40px rgba(0,0,0,.3), 0 0 1px rgba(0,0,0,.5);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        animation: hpNotifIn .35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        box-sizing: border-box;
        pointer-events: all;
        border: 1px solid rgba(255,255,255,.1);
      }
      .hp-notif-bar.removing {
        animation: hpNotifOut .25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
      .hp-notif-msg   { 
        flex: 1; 
        line-height: 1.5;
        word-wrap: break-word;
      }
      .hp-notif-icon  { 
        font-size: 18px; 
        flex-shrink: 0;
        margin-top: 2px;
      }
      .hp-notif-close {
        background: rgba(255,255,255,.1);
        border: 1px solid rgba(255,255,255,.15);
        border-radius: 5px;
        color: rgba(255,255,255,.7);
        width: 24px; 
        height: 24px;
        min-width: 24px;
        cursor: pointer;
        font-size: 12px;
        display: flex; 
        align-items: center; 
        justify-content: center;
        flex-shrink: 0;
        transition: all .2s ease;
        line-height: 1;
        padding: 0;
        margin: 2px 0 0 0;
      }
      .hp-notif-close:hover { 
        background: rgba(255,255,255,.2);
        color: rgba(255,255,255,.95);
        transform: scale(1.1);
      }
      .hp-notif-close:active {
        transform: scale(0.95);
      }
    `;
    document.head.appendChild(style);
  }

  const TYPE_STYLES = {
    info:    { bg: "rgba(59, 130, 246, 0.92)",  border: "rgba(59, 130, 246, 0.5)" },
    success: { bg: "rgba(16, 185, 129, 0.92)",  border: "rgba(16, 185, 129, 0.5)" },
    warning: { bg: "rgba(245, 158, 11, 0.92)",  border: "rgba(245, 158, 11, 0.5)" },
    error:   { bg: "rgba(239, 68, 68, 0.92)",   border: "rgba(239, 68, 68, 0.5)" },
  };

  /* ── container management ── */
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement("div");
      container.className = "hp-notif-container";
      document.body.appendChild(container);
    }
    return container;
  }

  /* ── show a single notification ── */
  function showNotification(notif) {
    if (getSeenIds().includes(notif.id)) return;

    injectStyles();

    const colors = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
    const bar = document.createElement("div");
    bar.className = "hp-notif-bar";
    bar.style.cssText = `background: ${colors.bg}; border-color: ${colors.border};`;

    bar.innerHTML = `
      <span class="hp-notif-icon">${notif.icon || "🔔"}</span>
      <span class="hp-notif-msg">${notif.message || ""}</span>
      <button class="hp-notif-close" aria-label="Dismiss" type="button">✕</button>
    `;

    const closeBtn = bar.querySelector(".hp-notif-close");
    function dismiss() {
      bar.classList.add("removing");
      setTimeout(() => {
        bar.remove();
        if (container && container.children.length === 0) {
          container.remove();
          container = null;
        }
      }, 250);
    }
    closeBtn.addEventListener("click", dismiss);

    const cont = getContainer();
    cont.appendChild(bar);
    markSeen(notif.id);

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

      notifs.forEach((n, i) => setTimeout(() => showNotification(n), i * 300));
    } catch { /* network error — silent */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fetchAndShow);
  } else {
    fetchAndShow();
  }
})();