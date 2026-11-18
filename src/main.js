// ============================================
// Password Simulator (Educational)
// ============================================
// منطق: حمله brute-force روی رمزهای کوتاه (1-4 کاراکتر)
// با استفاده از Web Workers برای موازی‌سازی
// ============================================

const MAX_LENGTH = 4;
const NUM_WORKERS = Math.min(navigator.hardwareConcurrency || 2, 4);

const $ = (id) => document.getElementById(id);

let workers = [];
let running = false;
let totalAttempts = 0;
let globalStartTime = 0;

function log(msg) {
  const logEl = $("log");
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(msg) {
  $("status").textContent = msg;
}

function clearLog() {
  $("log").textContent = "";
}

// ============================================
// SHA-256
// ============================================
async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================
// توقف همه workerها
// ============================================
function stopAll() {
  workers.forEach((w) => w.terminate());
  workers = [];
  running = false;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
}

// ============================================
// اجرای brute-force برای یک طول مشخص
// ============================================
function crackLength(length, charset, targetHash) {
  return new Promise((resolve) => {
    const total = Math.pow(charset.length, length);
    const chunk = Math.ceil(total / NUM_WORKERS);

    let finished = 0;
    let found = null;
    let lengthAttempts = 0;

    log(`🔍 Length ${length}: ${total.toLocaleString()} combos`);

    for (let w = 0; w < NUM_WORKERS; w++) {
      const startIdx = w * chunk;
      const endIdx = Math.min(startIdx + chunk, total);
      if (startIdx >= endIdx) continue;

      const worker = new Worker("src/cracker.worker.js");
      workers.push(worker);

      worker.onmessage = (e) => {
        const data = e.data;

        if (data.progress) {
          lengthAttempts += data.attempts;
          totalAttempts += data.attempts;
          const elapsed = (performance.now() - globalStartTime) / 1000;
          const rate = Math.round(totalAttempts / elapsed);
          setStatus(
            `Running... ${totalAttempts.toLocaleString()} attempts ` +
            `(${rate.toLocaleString()}/s)`
          );
        }

        if (data.found && !found) {
          found = data.found;
          stopAll();
          resolve(found);
        }

        if (data.done) {
          finished++;
          if (finished === NUM_WORKERS && !found) {
            stopAll();
            resolve(null);
          }
        }
      };

      worker.onerror = (err) => {
        log(`❌ Worker error: ${err.message}`);
      };

      worker.postMessage({
        charset,
        length,
        targetHash,
        startIdx,
        endIdx,
      });
    }
  });
}

// ============================================
// شروع شبیه‌سازی
// ============================================
async function startSimulation() {
  if (running) return;

  const password = $("password").value.trim();
  const charset = $("charset").value.trim();

  clearLog();

  // اعتبارسنجی
  if (!password) {
    log("❌ Error: password is empty");
    return;
  }
  if (password.length > MAX_LENGTH) {
    log(`❌ Error: password too long (max ${MAX_LENGTH})`);
    return;
  }
  if (!charset) {
    log("❌ Error: charset is empty");
    return;
  }
  if (password.split("").some((c) => !charset.includes(c))) {
    log(`⚠️ Warning: some characters in password are not in charset`);
  }

  running = true;
  totalAttempts = 0;
  globalStartTime = performance.now();
  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;

  const targetHash = await sha256(password);

  log(`[Target] ${password}`);
  log(`[Hash]   ${targetHash.slice(0, 32)}...`);
  log(`[Charset] ${charset.length} chars`);
  log(`[Workers] ${NUM_WORKERS}`);
  log("─".repeat(30));

  let found = null;

  for (let length = 1; length <= password.length; length++) {
    found = await crackLength(length, charset, targetHash);
    if (found) break;
  }

  const elapsed = (performance.now() - globalStartTime) / 1000;
  const rate = Math.round(totalAttempts / elapsed);

  log("─".repeat(30));

  if (found) {
    log(`✅ CRACKED!`);
    log(`[Password] ${found}`);
    log(`[Time]     ${elapsed.toFixed(2)}s`);
    log(`[Rate]     ${rate.toLocaleString()} tries/sec`);
    setStatus(`✅ Found: ${found} in ${elapsed.toFixed(2)}s`);
  } else {
    log(`❌ NOT FOUND within ${MAX_LENGTH} chars`);
    log(`[Time]     ${elapsed.toFixed(2)}s`);
    log(`[Rate]     ${rate.toLocaleString()} tries/sec`);
    setStatus(`❌ Not found in ${elapsed.toFixed(2)}s`);
  }

  running = false;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
}

// ============================================
// رویدادها
// ============================================
$("startBtn").addEventListener("click", startSimulation);
$("stopBtn").addEventListener("click", () => {
  stopAll();
  setStatus("⏹ Stopped by user");
  log("⏹ Stopped by user");
});
