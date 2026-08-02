/* =========================================================
   STP Security — BPDU Guard simulator
   Access port (Fa0/5) with PortFast. A rogue switch sending
   a BPDU triggers err-disable only when BPDU Guard is on.
   ========================================================= */
(function () {
  const g = (id) => document.getElementById(id);
  const toggle = g("stp-toggle");
  if (!toggle) return;

  const port  = g("stp-port");
  const dev   = g("stp-dev");
  const state = g("stp-state");
  const log   = g("stp-log");
  let guard = false;
  let errDisabled = false;

  function line(t){ if(log.querySelector(".ph"))log.innerHTML=""; const d=document.createElement("div"); d.textContent="> "+t; log.appendChild(d); log.scrollTop=log.scrollHeight; }
  function showDev(text, cls){
    if (dev.querySelector('[style*="opacity"]')) dev.innerHTML="";
    const d=document.createElement("div"); d.className="dev "+cls; d.innerHTML=`<span>${text}</span>`; dev.appendChild(d);
  }
  function setToggle(){ toggle.textContent = "BPDU Guard: " + (guard?"ON":"OFF"); toggle.classList.toggle("on", guard); }
  function setState(txt, bad){ state.textContent = txt; state.className = bad ? "state-err" : "state-up"; }

  toggle.addEventListener("click", () => { guard=!guard; setToggle(); line("BPDU Guard " + (guard?"مُفعّل على منافذ PortFast":"مُعطّل")); });

  g("stp-pc").addEventListener("click", () => {
    if (errDisabled) { line("المنفذ err-disabled — أعد الضبط."); return; }
    port.classList.remove("err"); port.classList.add("active");
    showDev("🖥️ PC طرفي — ما يرسل BPDU", "ok");
    setState("forwarding", false);
    line("PC موصول: مع PortFast دخل Forwarding فورًا. لا مشكلة.");
  });

  g("stp-sw").addEventListener("click", () => {
    if (errDisabled) { line("المنفذ مطفّى بالفعل — أعد الضبط."); return; }
    showDev("🔀 Switch مارق — يرسل BPDU", "bad");
    if (guard) {
      errDisabled = true;
      port.classList.remove("active"); port.classList.add("err");
      setState("err-disabled (down)", true);
      line("BPDU وصلت على منفذ PortFast + BPDU Guard مُفعّل → المنفذ err-disabled ✓");
    } else {
      port.classList.remove("active"); port.classList.add("err");
      setTimeout(()=>{ if(!errDisabled){ port.classList.remove("err"); port.classList.add("active"); } }, 700);
      setState("forwarding — STP معاد حسابه!", true);
      line("⚠ بدون BPDU Guard: الـ Switch المارق دخل STP — يقدر يخطف الـ Root أو يبطّئ الشبكة.");
    }
  });

  g("stp-reset").addEventListener("click", () => {
    guard=false; errDisabled=false; setToggle();
    port.classList.remove("err","active");
    dev.innerHTML = `<div class="dev" style="opacity:.5"><span>لا يوجد جهاز موصول</span></div>`;
    log.innerHTML = `<div class="ph">// السجل…</div>`;
    setState("forwarding", false);
    line("إعادة ضبط");
  });

  setToggle();
})();
