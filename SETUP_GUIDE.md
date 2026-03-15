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

## 3. CI/CD Pipeline (GitHub Actions)
We use GitHub Actions to automate testing and releases directly on GitHub.

### How to Monitor Actions
1.  **Push Changes**: Every time you push code or open a Pull Request, GitHub automatically starts a workflow.
2.  **View Results**: 
    - Go to your repository on GitHub.
    - Click the **"Actions"** tab at the top.
    - You will see the **"Continuous Integration"** workflow running.
    - Click on a run to see the logs and download the **Extension ZIP bundle** from the "Artifacts" section.

### Automated Releases
1.  When you are ready for a new version, create and push a tag:
    ```bash
    git tag v1.0.0
    git push --tags
    ```
2.  GitHub will trigger the **"Release Extension"** workflow, which automatically creates a new GitHub Release and attaches the extension bundle.

### (Optional) Local Testing
If you ever need to test workflows without pushing to GitHub, you can use the `act` tool provided in `./bin/act` (requires Docker).

---

---

## 4. Troubleshooting
-   **Extension not syncing**: Check the "Sync status" in the extension popup. Ensure the desktop app is running, as it acts as the data receiver.
-   **Docker permissions**: If `act` fails with "permission denied", use `sudo` or add your user to the docker group: `sudo usermod -aG docker $USER`.
-   **GitHub Actions "Lock file not found"**: Ensure `package-lock.json` is committed to the repository. If it's missing from GitHub, check that it's not being ignored in `.gitignore`. (This was previously an issue but has been fixed in the latest `.gitignore`).
