# Releasing

github-notify releases are driven by Git tags and the Tauri release workflow.

## Flow

1. Confirm `main` is green and the version has been bumped in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Create and push a release tag.
3. GitHub Actions runs the Tauri release workflow.
4. The workflow builds platform artifacts and opens a draft GitHub Release.
5. Review the generated draft release notes and uploaded assets.
6. Publish the draft release from GitHub when the artifacts are acceptable.

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

## Current Limitations

- Windows code signing is not configured.
- macOS code signing is not configured.
- macOS notarization is not configured.
- The built-in updater is disabled.
- `createUpdaterArtifacts` is `false`.
- No updater public key is configured.

These limitations mean users may see OS trust prompts for downloaded artifacts, and automatic update metadata is not produced.
Re-enable updater configuration only after signing and update-key handling are ready.
