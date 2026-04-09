/**
 * notifications.js — Hotdog Party
 * Shows all active Firebase notifications on every page load / refresh.
 * No localStorage persistence — notifications always reappear.
 * The close button only hides for the current browser tab session.
 */
(function () {
  const FB_NOTIFS = "https://hotdog-party-61e77-default-rtdb.firebaseio.com/notifications.json";

  function injectStyles() {
    if (document.getElementById("hp-notif-styles")) return;
    const s = document.createElement("style");
    s.id = "hp-notif-styles";
    s.textContent = `
      @keyframes hpIn  { from{opacity:0;transform:translateX(-50%) translateY(-14px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
      @keyframes hpOut { from{opacity:1;transform:translateX(-50%) translateY(0)}to{opacity:0;transform:translateX(-50%) translateY(-14px)} }
      .hp-bar{
        position:fixed;left:50%;transform:translateX(-50%);z-index:10001;
        max-width:640px;width:calc(100% - 40px);
        display:flex;align-items:center;gap:14px;padding:13px 18px;
        border-radius:14px;font-family:"Segoe UI",system-ui,sans-serif;
        font-size:14px;font-weight:600;color:#fff;
        box-shadow:0 6px 30px rgba(0,0,0,.55);backdrop-filter:blur(10px);
        animation:hpIn .3s ease forwards;box-sizing:border-box;
        transition:top .25s ease;
      }
      .hp-bar-msg{flex:1;line-height:1.45;}
      .hp-bar-icon{font-size:20px;flex-shrink:0;}
      .hp-bar-x{
        background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);
        border-radius:7px;color:#fff;width:28px;height:28px;cursor:pointer;
        font-size:14px;display:flex;align-items:center;justify-content:center;
        flex-shrink:0;transition:background .2s;line-height:1;
      }
      .hp-bar-x:hover{background:rgba(255,255,255,.28);}
    `;
    document.head.appendChild(s);
  }

  const COLORS = {
    info:    {bg:"rgba(52,75,220,.95)",  border:"#5865F2"},
    success: {bg:"rgba(0,170,80,.92)",   border:"#00c864"},
    warning: {bg:"rgba(220,130,0,.96)",  border:"#ff8c00"},
    error:   {bg:"rgba(190,35,35,.95)",  border:"#ff4444"},
  };

  const stack = [];
  const TOP_BASE = 82, GAP = 8;

  function restack() {
    let y = TOP_BASE;
    stack.forEach(({el}) => { el.style.top = y + "px"; y += el.offsetHeight + GAP; });
  }
  function pop(uid) {
    const i = stack.findIndex(e => e.uid === uid);
    if (i !== -1) stack.splice(i, 1);
    restack();
  }

  function show(n) {
    injectStyles();
    const uid = Math.random().toString(36).slice(2);
    const c   = COLORS[n.type] || COLORS.info;
    const bar = document.createElement("div");
    bar.className = "hp-bar";
    bar.style.cssText += `background:${c.bg};border:1px solid ${c.border};top:${TOP_BASE}px;`;
    bar.innerHTML = `
      <span class="hp-bar-icon">${n.icon||"🔔"}</span>
      <span class="hp-bar-msg">${n.message||""}</span>
      <button class="hp-bar-x" aria-label="Dismiss">✕</button>`;
    const dismiss = () => {
      bar.style.animation = "hpOut .25s ease forwards";
      setTimeout(() => { bar.remove(); pop(uid); }, 250);
    };
    bar.querySelector(".hp-bar-x").addEventListener("click", dismiss);
    document.body.appendChild(bar);
    stack.push({uid, el: bar});
    restack();
    if (n.duration > 0) setTimeout(dismiss, n.duration * 1000);
  }

  async function init() {
    try {
      const data = await (await fetch(FB_NOTIFS)).json();
      if (!data) return;
      const now = Date.now();
      Object.values(data)
        .filter(n => n && n.active && n.message)
        .filter(n => !n.expires || n.expires > now)
        .sort((a,b) => (a.id||0)-(b.id||0))
        .forEach((n, i) => setTimeout(() => show(n), i * 380));
    } catch {}
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();
