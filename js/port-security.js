/* =========================================================
   Port Security — interactive simulator
   Models a single access port (Fa0/1, max = 1) reacting to
   the three violation modes: shutdown / restrict / protect.
   ========================================================= */
(function () {
  const MAX = 1;

  const el = {
    port:     document.getElementById("port"),
    devices:  document.getElementById("devices"),
    state:    document.getElementById("st-state"),
    macs:     document.getElementById("st-macs"),
    count:    document.getElementById("st-count"),
    log:      document.getElementById("log"),
    modes:    document.getElementById("modes"),
    auth:     document.getElementById("btn-auth"),
    rogue:    document.getElementById("btn-rogue"),
    reset:    document.getElementById("btn-reset"),
  };
  if (!el.port) return; // not on this page

  let learned = [];      // authorized MAC(s)
  let violations = 0;
  let errDisabled = false;

  const randMac = () =>
    "00" + Array.from({ length: 5 }, () =>
      ":" + Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join("").toUpperCase();

  const mode = () => el.modes.querySelector("input:checked").value;

  function logLine(text) {
    const line = document.createElement("div");
    line.textContent = "> " + text;
    if (el.log.querySelector(".ph")) el.log.innerHTML = "";
    el.log.appendChild(line);
    el.log.scrollTop = el.log.scrollHeight;
  }

  function render() {
    el.macs.textContent = learned.length + " / " + MAX;
    el.count.textContent = violations;

    el.port.classList.remove("active", "err");
    if (errDisabled) {
      el.port.classList.add("err");
      el.state.textContent = "err-disabled (down)";
      el.state.className = "state-err";
    } else if (learned.length) {
      el.port.classList.add("active");
      el.state.textContent = "secure-up";
      el.state.className = "state-up";
    } else {
      el.state.textContent = "up";
      el.state.className = "state-up";
    }

    // device list
    if (!learned.length && !errDisabled) {
      el.devices.innerHTML = `<div class="dev" style="opacity:.5"><span>لا يوجد جهاز موصول بعد</span></div>`;
    }
  }

  function addDeviceRow(label, mac, cls) {
    const row = document.createElement("div");
    row.className = "dev " + cls;
    row.innerHTML = `<span>${label}</span><span class="mac">${mac}</span>`;
    if (el.devices.querySelector('[style*="opacity"]')) el.devices.innerHTML = "";
    el.devices.appendChild(row);
  }

  function connectAuthorized() {
    if (errDisabled) { logLine("المنفذ err-disabled — سوِّ إعادة ضبط أولًا."); return; }
    if (learned.length >= MAX) { logLine("وصلت الحد الأقصى — أي جهاز جديد = انتهاك."); return; }
    const mac = randMac();
    learned.push(mac);
    addDeviceRow("جهاز مصرّح ✔", mac, "ok");
    logLine("تعلّم MAC مصرّح " + mac + " على Fa0/1");
    render();
  }

  function connectRogue() {
    if (errDisabled) { logLine("المنفذ مطفّى بالفعل — إعادة ضبط للتجربة من جديد."); return; }
    if (learned.length < MAX) {
      // no violation yet: a rogue simply becomes the (only) learned mac
      const mac = randMac();
      learned.push(mac);
      addDeviceRow("جهاز غير مصرّح", mac, "bad");
      logLine("لا يوجد انتهاك بعد — المنفذ تعلّم MAC " + mac);
      render();
      return;
    }
    // violation: exceeded MAX
    const mac = randMac();
    violations++;
    addDeviceRow("MAC زائد — مرفوض ✕", mac, "bad");

    const m = mode();
    if (m === "shutdown") {
      errDisabled = true;
      logLine("VIOLATION [" + mac + "] → shutdown: المنفذ err-disabled + Syslog + counter++");
    } else if (m === "restrict") {
      logLine("VIOLATION [" + mac + "] → restrict: الفريم مرمي + Syslog + counter++ (المنفذ up)");
    } else {
      violations--; // protect does not increment
      logLine("VIOLATION [" + mac + "] → protect: الفريم مرمي بصمت (بدون Syslog/counter)");
    }
    render();
  }

  function reset() {
    learned = [];
    violations = 0;
    errDisabled = false;
    el.log.innerHTML = `<div class="ph">// السجل يظهر هنا…</div>`;
    render();
    logLine("تمت إعادة الضبط — max = 1، الوضع: " + mode());
  }

  // mode selection styling
  el.modes.querySelectorAll("label").forEach(l => {
    l.addEventListener("click", () => {
      el.modes.querySelectorAll("label").forEach(x => x.classList.remove("sel"));
      l.classList.add("sel");
    });
  });

  el.auth.addEventListener("click", connectAuthorized);
  el.rogue.addEventListener("click", connectRogue);
  el.reset.addEventListener("click", reset);

  render();
})();
