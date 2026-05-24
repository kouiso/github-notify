# Releasing

github-notify releases are driven by Git tags and the Tauri release workflow.

## Flow

1. Confirm `main` is green and the version has been bumped in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Confirm macOS and Windows signing secrets are present in GitHub Actions.
3. Create and push a release tag.
4. GitHub Actions runs the Tauri release workflow.
5. The workflow builds platform artifacts and opens a draft GitHub Release.
6. Review the generated draft release notes and uploaded assets.
7. Publish the draft release from GitHub when the artifacts are acceptable.

## Commands

```bash
git checkout main
git pull --ff-only origin main
# Replace v0.x.x with the target release version.
git tag v0.x.x
git push origin v0.x.x
```

The tag triggers the `tauri-action` workflow in GitHub Actions.
Do not publish the release until the workflow has completed and all expected assets are attached.

## macOS signing and notarization

Production macOS artifacts must not be uploaded unsigned. The release workflow fails fast on macOS jobs unless the signing and notarization secrets are configured.

Required GitHub Actions secrets:

- `APPLE_CERTIFICATE`: base64 encoded `.p12` Developer ID Application certificate.
- `APPLE_CERTIFICATE_PASSWORD`: password for the exported `.p12`.
- `APPLE_ID`: Apple account email used for notarization.
- `APPLE_PASSWORD`: app-specific password for notarization.
- `APPLE_TEAM_ID`: Apple Developer Team ID.
- `APPLE_SIGNING_IDENTITY`: optional explicit identity. If omitted, Tauri can infer the identity from `APPLE_CERTIFICATE`.

The Tauri macOS bundle config enables hardened runtime in `src-tauri/tauri.conf.json`. Keep `bundle.macOS.signingIdentity` as `null` in source control so CI can inject the identity through `APPLE_SIGNING_IDENTITY` or infer it from the imported certificate.

After a macOS release workflow succeeds, verify the downloaded artifact on a clean macOS machine:

```bash
codesign --verify --deep --strict --verbose=2 "/Applications/github-notify.app"
spctl --assess --type execute --verbose "/Applications/github-notify.app"
xcrun stapler validate "/Applications/github-notify.app"
```

## Windows signing

Production Windows artifacts must not be uploaded unsigned. The release workflow fails fast on Windows jobs unless the signing secrets are configured.

Required GitHub Actions secrets:

- `WINDOWS_CERTIFICATE`: base64 encoded `.pfx` code-signing certificate.
- `WINDOWS_CERTIFICATE_PASSWORD`: password for the exported `.pfx`.

The current workflow only blocks unsigned production artifacts. The follow-up signing PR must import the certificate, sign the generated installer with `signtool`, and verify the signature before publishing.

## Current Limitations

- Windows code signing is blocked unless certificate secrets are configured; installer signing still needs the follow-up `signtool` implementation.
- macOS code signing and notarization are configured in CI, but require the Apple Developer secrets above.
- The built-in updater is disabled.
- `createUpdaterArtifacts` is `false`.
- No updater public key is configured.

These limitations mean users may see OS trust prompts for downloaded artifacts, and automatic update metadata is not produced.
Re-enable updater configuration only after signing and update-key handling are ready.
