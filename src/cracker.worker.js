// Web Worker: در thread جداگانه اجرا می‌شود
// چون JS تک‌رشته‌ای است، این تنها راه استفاده از چند هسته است.

self.onmessage = async (event) => {
  const { charset, length, targetHash, startIdx, endIdx } = event.data;
  const csLen = charset.length;

  let idx = startIdx;
  let count = 0;
  const startTime = performance.now();

  while (idx < endIdx) {
    // ساخت رشته از idx (تبدیل پایه)
    let n = idx;
    let candidate = "";
    for (let i = 0; i < length; i++) {
      candidate = charset[n % csLen] + candidate;
      n = Math.floor(n / csLen);
    }

    const hash = await sha256(candidate);
    if (hash === targetHash) {
      self.postMessage({ found: candidate, attempts: count });
      return;
    }

    idx++;
    count++;

    // هر 5000 تلاش، پیشرفت گزارش بده
    if (count % 5000 === 0) {
      self.postMessage({ progress: true, attempts: count });
    }
  }

  self.postMessage({ done: true, attempts: count });
};

// SHA-256 با Web Crypto API
async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
