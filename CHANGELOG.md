# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

### Security

## [0.1.2] - 2026-05-17

### Added

- Added test strategy and manual QA documentation from PR #21.
- Added UX/UI audit documentation from PR #20.
- Added a P1 UX sprint for visual hierarchy and filter UX in PR #23.

### Changed

- Bumped Tauri from 2.10 to 2.11 and app version to 0.1.2.
- Updated accessibility and UI behavior through the P0 sprint in PR #22.

### Fixed

- Fixed WCAG AA blockers, touch target issues, and reduced-motion handling in PR #22.
- Fixed project notification tab scoping in PR #19.
- Kept dependency review and license check CI behavior aligned with supported GitHub contexts.

### Security

- Kept dependency review blocking where supported.

## [0.1.0] - 2026-05-04

### Added

- Initial public release of the Tauri 2 GitHub notification desktop app.
- Added React 19 + TypeScript frontend and Rust backend.
- Added GitHub OAuth Device Flow authentication.
- Added inbox, notification filters, dashboard views, tray integration, and sound notifications.

### Changed

- Established baseline project structure, CI, and release workflow.

### Fixed

- No notable fixes recorded for the initial release.

### Security

- Added OS Keychain-backed token storage with store fallback.
