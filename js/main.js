/* =========================================================
   CCNA Interactive — Shared logic
   Progress persists in localStorage (works on GitHub Pages
   and when opened locally; degrades gracefully if blocked).
   ========================================================= */

const STORAGE_KEY = "ccna_interactive_progress_v1";

/* Roadmap module definitions (order matters for %). */
const MODULES = [
  { id: "portSecurity", label: "Port Security", ready: true },
  { id: "dhcp",         label: "DHCP Security", ready: true },
  { id: "stp",          label: "STP Security",  ready: true },
];

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {}; // storage blocked (e.g. inside a sandboxed preview)
  }
}

function saveProgress(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { /* ignore */ }
}

function markComplete(id) {
  const s = loadProgress();
  const wasDone = !!s[id];
  s[id] = true;
  saveProgress(s);
  return !wasDone; // true if this was a new completion
}

function completionPercent(state) {
  const done = MODULES.filter(m => state[m.id]).length;
  return Math.round((done / MODULES.length) * 100);
}

/* ---- Homepage: progress card ---- */
function renderProgressCard() {
  const card = document.querySelector("[data-progress-card]");
  if (!card) return;
  const state = loadProgress();
  const pct = completionPercent(state);
  const pctEl = card.querySelector("[data-pct]");
  const barEl = card.querySelector(".bar > span");
  if (pctEl) pctEl.textContent = pct + "%";
  if (barEl) requestAnimationFrame(() => { barEl.style.width = pct + "%"; });

  const list = card.querySelector(".progress-list");
  if (list) {
    list.innerHTML = MODULES.map(m =>
      `<span class="${state[m.id] ? "done" : ""}">${m.label}</span>`
    ).join("");
  }
}

/* ---- Homepage: roadmap node flags ---- */
function renderRoadmapFlags() {
  const state = loadProgress();
  document.querySelectorAll("[data-module]").forEach(node => {
    const id = node.getAttribute("data-module");
    const mod = MODULES.find(m => m.id === id);
    if (!mod) return;
    const flag = node.querySelector(".flag");
    if (!flag) return;
    if (state[id]) { flag.className = "flag done"; flag.textContent = "مكتمل ✓"; }
    else if (mod.ready) { flag.className = "flag ready"; flag.textContent = "متاح الآن"; }
    else { flag.className = "flag soon"; flag.textContent = "قريبًا"; }
  });
}

/* ---- Scroll reveal ---- */
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !items.length) {
    items.forEach(i => i.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  items.forEach(i => io.observe(i));
}

/* ---- Copy buttons for code blocks ---- */
function initCopyButtons() {
  document.querySelectorAll(".copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pre = btn.closest(".code")?.querySelector("pre");
      if (!pre) return;
      const text = pre.innerText;
      navigator.clipboard?.writeText(text).then(() => {
        const old = btn.textContent;
        btn.textContent = "تم النسخ";
        setTimeout(() => { btn.textContent = old; }, 1400);
      });
    });
  });
}

/* ---- Achievement toast ---- */
function showAchievement(title, sub) {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span class="medal">🏆</span><div><b class="t-title"></b><small class="t-sub"></small></div>`;
    document.body.appendChild(t);
  }
  t.querySelector(".t-title").textContent = title;
  t.querySelector(".t-sub").textContent = sub || "";
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => t.classList.remove("show"), 4200);
}

/* ---- Generic "mark complete" button (any section page) ---- */
const ACHIEVEMENTS = {
  portSecurity: { title: "Port Security Master", sub: "أنجزت أول قسم — التالي: DHCP" },
  dhcp:         { title: "DHCP Defender",        sub: "أمّنت توزيع العناوين — التالي: STP" },
  stp:          { title: "STP Guardian",         sub: "أكملت Layer 2 Security بالكامل 🎉" },
};

function initCompleteButton() {
  const btn = document.getElementById("btn-complete");
  if (!btn) return;
  const id = btn.getAttribute("data-module");
  if (!id) return;

  if (loadProgress()[id]) { btn.textContent = "✓ مكتمل"; btn.disabled = true; }

  btn.addEventListener("click", () => {
    const isNew = markComplete(id);
    btn.textContent = "✓ مكتمل";
    btn.disabled = true;
    const a = ACHIEVEMENTS[id];
    if (isNew && a) showAchievement(a.title, a.sub);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderProgressCard();
  renderRoadmapFlags();
  initReveal();
  initCopyButtons();
  initCompleteButton();
});

/* expose for page-level scripts */
window.CCNA = { markComplete, showAchievement, loadProgress };
