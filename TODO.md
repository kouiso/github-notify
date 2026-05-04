# Release TODO

## 1. Apple Developer Notarization
- Set GitHub Secrets: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`
- Configure `tauri.conf.json` signing identity
- Verify notarization in `release.yml` workflow

## 2. Auto-Updater Signing Key
- Run `tauri signer generate -w ~/.tauri/github-notify.key`
- Set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in GitHub Secrets
- Add public key to `tauri.conf.json` updater config

## 3. E2E Playwright Test Suite
- Cover auth flow, inbox polling, notification filter, settings dialog
- Wire into CI (`e2e/` directory already scaffolded)

## 4. Performance Baseline
- Cold start time (app launch → first render)
- Polling CPU usage (steady-state background fetch)
- Memory footprint (idle + after 1000 notifications)
- Script: `scripts/perf-baseline.sh`
