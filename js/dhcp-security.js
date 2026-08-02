/* =========================================================
   DHCP Security — two simulators
   (A) DHCP Snooping: trusted/untrusted + binding table
   (B) Dynamic ARP Inspection: validate ARP vs binding
   ========================================================= */

/* -------- (A) DHCP Snooping -------- */
(function () {
  const g = (id) => document.getElementById(id);
  const toggle = g("ds-toggle");
  if (!toggle) return;

  const clientPort = g("ds-p-client");
  const roguePort  = g("ds-p-rogue");
  const bindBody   = g("ds-bind").querySelector("tbody");
  const log        = g("ds-log");
  let snooping = false;
  let leased   = 0;

  const randMac = () => "00:" + Array.from({length:2},()=>Math.floor(Math.random()*256).toString(16).padStart(2,"0")).join(":").toUpperCase();

  function line(t){ if(log.querySelector(".ph"))log.innerHTML=""; const d=document.createElement("div"); d.textContent="> "+t; log.appendChild(d); log.scrollTop=log.scrollHeight; }

  function setToggle(){
    toggle.textContent = "DHCP Snooping: " + (snooping ? "ON" : "OFF");
    toggle.classList.toggle("on", snooping);
  }

  function addBinding(mac, ip){
    if (bindBody.querySelector(".empty")) bindBody.innerHTML = "";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${mac}</td><td>${ip}</td><td>10</td><td>Fa0/2</td>`;
    bindBody.appendChild(tr);
  }

  toggle.addEventListener("click", () => { snooping = !snooping; setToggle(); line("DHCP Snooping " + (snooping?"مُفعّل — كل المنافذ Untrusted عدا Trusted":"مُعطّل")); });

  g("ds-legit").addEventListener("click", () => {
    clientPort.classList.add("active");
    setTimeout(()=>clientPort.classList.remove("active"), 600);
    const mac = randMac(), ip = "10.0.0." + (10 + leased++);
    line("Offer من السيرفر الشرعي (Trusted) → مسموح، العميل أخذ " + ip);
    if (snooping) { addBinding(mac, ip); line("أُضيف للـ Binding Table: " + mac + " ↔ " + ip); }
  });

  g("ds-rogue").addEventListener("click", () => {
    if (snooping) {
      roguePort.classList.remove("active"); roguePort.classList.add("block");
      setTimeout(()=>roguePort.classList.remove("block"), 700);
      line("✕ Offer من سيرفر مزيّف على منفذ Untrusted → مرفوض (DHCP Snooping)");
    } else {
      roguePort.classList.add("err");
      setTimeout(()=>roguePort.classList.remove("err"), 700);
      line("⚠ Offer من السيرفر المزيّف مرّ! العميل أخذ بوابة المهاجم → MITM");
    }
  });

  g("ds-reset").addEventListener("click", () => {
    snooping=false; leased=0; setToggle();
    bindBody.innerHTML = `<tr><td class="empty" colspan="4">Binding Table فاضي</td></tr>`;
    log.innerHTML = `<div class="ph">// السجل…</div>`;
    line("إعادة ضبط");
  });

  setToggle();
})();


/* -------- (B) Dynamic ARP Inspection -------- */
(function () {
  const g = (id) => document.getElementById(id);
  const toggle = g("dai-toggle");
  if (!toggle) return;

  const out   = g("dai-out");
  const state = g("dai-state");
  const log   = g("dai-log");
  let dai = false;

  function line(t){ if(log.querySelector(".ph"))log.innerHTML=""; const d=document.createElement("div"); d.textContent="> "+t; log.appendChild(d); log.scrollTop=log.scrollHeight; }
  function row(text, cls){
    if (out.querySelector('[style*="opacity"]')) out.innerHTML="";
    const d=document.createElement("div"); d.className="dev "+cls; d.innerHTML=`<span>${text}</span>`; out.appendChild(d);
  }
  function setToggle(){ toggle.textContent = "DAI: " + (dai?"ON":"OFF"); toggle.classList.toggle("on", dai); }
  function setState(txt, bad){ state.textContent = txt; state.className = bad ? "state-err" : "state-up"; }

  toggle.addEventListener("click", () => { dai=!dai; setToggle(); line("DAI " + (dai?"مُفعّل — يفحص ARP مقابل Binding Table":"مُعطّل")); });

  g("dai-legit").addEventListener("click", () => {
    row("ARP: 10.0.0.10 = 00:AA:HA ✔ مطابق", "ok");
    line(dai ? "DAI: الربط مطابق للـ Binding → مسموح" : "بدون DAI: مسموح (لكنه شرعي أصلًا)");
    setState("سليمة", false);
  });

  g("dai-poison").addEventListener("click", () => {
    if (dai) {
      row("ARP: 10.0.0.1 = 00:EE:HK ✕ مرفوض", "bad");
      line("DAI: الربط لا يطابق Binding (البوابة MAC حقيقي 00:11:GW) → رُميت الرسالة");
      setState("سليمة (تم الصدّ)", false);
    } else {
      row("ARP: 10.0.0.1 = 00:EE:HK ← قُبِل!", "bad");
      line("⚠ بدون DAI: الضحية حدّثت جدول ARP → صار ترافيك البوابة يمرّ من المهاجم (MITM)");
      setState("مُخترقة — MITM", true);
    }
  });

  g("dai-reset").addEventListener("click", () => {
    dai=false; setToggle();
    out.innerHTML = `<div class="dev" style="opacity:.5"><span>أرسل رسالة ARP للتجربة</span></div>`;
    log.innerHTML = `<div class="ph">// السجل…</div>`;
    setState("سليمة", false);
    line("إعادة ضبط");
  });

  setToggle();
})();
