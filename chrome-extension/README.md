# TimeStream Activity Tracker (Chrome Extension)

Automatically track your browser-based developer activities and sync them with your TimeStream timeline.

## Features

- **YouTube Tracking**: Automatically logs technical videos you watch.
- **GitHub Tracking**: Records commits, PRs, and repository views.
- **Offline First**: Queues activities locally when the backend is unreachable.
- **Oceanic Breeze Theme**: Beautifully designed to match the TimeStream desktop application.
- **CI/CD Integrated**: Automated builds and glass-box testing via GitHub Actions.

## Installation (Development)

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `chrome-extension/` folder from this repository.

## Configuration

Click on the TimeStream extension icon in your toolbar to:
- Toggle tracking on/off.
- Manually sync queued data.
- View today's activity count.
- Configure backend API settings.

## Development

The extension is built with Manifest V3 and uses:
- `background.js`: Service worker for lifecycle and sync management.
- `content.js`: Domain-specific observers for activity scraping.
- `popup/`: User interface for quick controls.
- `utils/storage.js`: Promised-based Chrome storage wrapper.

## CI/CD Pipeline

We use GitHub Actions for:
- **CI**: Runs on every push to validate manifest and package the extension.
- **Release**: Automatically creates a GitHub Release with the bundled extension ZIP when a version tag (e.g., `v1.0.0`) is pushed.
