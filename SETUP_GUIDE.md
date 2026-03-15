# TimeStream: Detailed Setup & Usage Guide

This guide provides step-by-step instructions for setting up the TimeStream desktop app, the Activity Tracker Chrome Extension, and the CI/CD pipeline.

## 1. Desktop Application Setup (Electron)
The desktop app is the central hub for your activity timeline.

### Installation
1.  **Open Terminal** in the project root: `/home/devanshu/TimeStream`.
2.  **Install Dependencies**:
    ```bash
    npm install
    ```

### Running the App
-   **Start in Development Mode**:
    ```bash
    npm start
    ```
    *This will launch the app with the Oceanic Breeze theme and your activity dashboard.*

---

## 2. Chrome Extension Setup (Activity Tracker)
The extension captures your browser activity and sends it to the desktop app.

### Installation
1.  Open **Google Chrome**.
2.  Go to `chrome://extensions/`.
3.  Turn on **Developer mode** (toggle in the top right).
4.  Click **Load unpacked**.
5.  Select the folder: `/home/devanshu/TimeStream/chrome-extension/`.

### Configuration
1.  Click the TimeStream icon in your Chrome toolbar.
2.  Ensure **Tracking Active** is enabled.
3.  **Permissions**: The extension will automatically start tracking once you visit:
    -   `youtube.com` (Detects video titles and channel names)
    -   `github.com` (Detects repo names, commits, PRs, and issues)

---

## 3. CI/CD Pipeline Setup (GitHub Actions)
We use GitHub Actions to automate testing and releases.

### Running Actions Locally (for testing)
We use a tool called `act` to run workflows on your local machine.

1.  **Prerequisite**: Ensure **Docker** is installed and running.
2.  **Run the Pipeline**:
    ```bash
    sudo ./bin/act
    ```
    *Note: This will validate your `manifest.json`, lint your code, and generate a `dist/timestream-extension.zip`.*

### Workflow Files
-   `.github/workflows/ci.yml`: Runs on every push/PR to check code quality.
-   `.github/workflows/release.yml`: Runs when you create a version tag (e.g., `git tag v1.0.0`) to create a GitHub Release.

---

## 4. Troubleshooting
-   **Extension not syncing**: Check the "Sync status" in the extension popup. Ensure the desktop app is running, as it acts as the data receiver.
-   **Docker permissions**: If `act` fails with "permission denied", use `sudo` or add your user to the docker group: `sudo usermod -aG docker $USER`.
