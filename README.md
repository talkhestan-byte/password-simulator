# 🔐 Password Security Simulator

An **educational**, **offline** Android app that demonstrates
why short passwords are weak against brute-force attacks.

## ⚠️ Disclaimer

**FOR EDUCATIONAL PURPOSES ONLY.**
This app runs **entirely on your device** and does **not** attack
any external system. Never use these techniques against systems
you do not own — it is illegal.

## Features

- Brute-force up to **4 characters** (safe for mobile)
- Uses **Web Workers** for parallel processing
- SHA-256 via Web Crypto API
- Works completely offline

## Build APK

```bash
# 1. Install dependencies
npm install

# 2. Add Android platform
npx cap add android

# 3. Sync web assets
npx cap sync

# 4. Open in Android Studio
npx cap open android

# 5. Build APK in Android Studio:
#    Build → Build Bundle(s)/APK(s) → Build APK(s)
