const MAX_LENGTH = 6;
const NUM_WORKERS = Math.min(navigator.hardwareConcurrency || 2, 6);
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

// تابع هش برای مقایسه اولیه
function sha256Sync(ascii) {
    // این تابع فقط برای گرفتن هش پسورد اصلی در ابتدای کار است
    // و همان کد ورکر است
    function rightRotate(value, amount) { return (value>>>amount) | (value<<(32-amount)); }
    var mathPow = Math.pow; var maxWord = mathPow(2, 32);
    var lengthProperty = 'length'; var i, j; var result = ''; var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = sha256Sync.h = sha256Sync.h || []; var k = sha256Sync.k = sha256Sync.k || [];
    var primeCounter = k[lengthProperty]; var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
      }
    }
    ascii += '\x80'; while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i); if (j >> 8) return null;
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16); var oldHash = hash; hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var i2 = i + j; var w15 = w[i - 15], w2 = w[i - 2]; var a = hash[0], e = hash[4];
        var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i]
          + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
          + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash); hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
    }
    for (i = 0; i < 8; i++) { for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16);
    }}
    return result;
}

function stopAll() {
  workers.forEach((w) => w.terminate());
  workers = [];
  running = false;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
}

function crackLength(length, charset, targetHash) {
  return new Promise((resolve) => {
    const total = Math.pow(charset.length, length);
    const chunk = Math.ceil(total / NUM_WORKERS);

    let finished = 0;
    let found = null;
    let currentWorkers = []; // لیست ورکرهای این مرحله

    log(`🔍 Length ${length}: ${total.toLocaleString()} combos`);

    for (let w = 0; w < NUM_WORKERS; w++) {
      const startIdx = w * chunk;
      const endIdx = Math.min(startIdx + chunk, total);
      if (startIdx >= endIdx) continue;

      const worker = new Worker("src/cracker.worker.js");
      currentWorkers.push(worker); // اضافه کردن به لیست محلی
      workers.push(worker); // اضافه کردن به لیست کلی

      worker.onmessage = (e) => {
        const data = e.data;

        if (data.progress) {
          totalAttempts += data.attempts;
          const elapsed = (performance.now() - globalStartTime) / 1000;
          const rate = Math.round(totalAttempts / elapsed);
          setStatus(`Running... ${totalAttempts.toLocaleString()} attempts (${rate.toLocaleString()}/s)`);
        }

        if (data.found && !found) {
          found = data.found;
          // فقط ورکرهای همین مرحله را متوقف کن
          currentWorkers.forEach(worker => worker.terminate());
          resolve(found);
        }

        if (data.done) {
          finished++;
          // فقط زمانی متوقف کن که تمام ورکرهای این مرحله تمام شده باشند
          if (finished === currentWorkers.length && !found) {
            resolve(null);
          }
        }
      };

      worker.postMessage({ charset, length, targetHash, startIdx, endIdx });
    }
  });
} 
async function startSimulation() {
  if (running) return;

  const password = $("password").value.trim();
  const charset = $("charset").value.trim();

  clearLog();

  if (!password || password.length > MAX_LENGTH) {
    log(`❌ Error: password invalid (1-${MAX_LENGTH} chars)`);
    return;
  }

  running = true;
  totalAttempts = 0;
  globalStartTime = performance.now();
  $("startBtn").disabled = true;
  $("stopBtn").disabled = false;

  const targetHash = sha256Sync(password);

  log(`[Target] ${password}`);
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
    setStatus(`✅ Found: ${found}`);
  } else {
    log(`❌ NOT FOUND within ${MAX_LENGTH} chars`);
    log(`[Time]     ${elapsed.toFixed(2)}s`);
    setStatus(`❌ Not found`);
  }

  running = false;
  $("startBtn").disabled = false;
  $("stopBtn").disabled = true;
}

$("startBtn").addEventListener("click", startSimulation);
$("stopBtn").addEventListener("click", () => {
  stopAll();
  setStatus("⏹ Stopped");
  log("⏹ Stopped by user");
});
