# Installing TimeStream on Windows

Since a pre-built Windows executable isn't available in GitHub releases yet, you can easily build it yourself on a Windows machine. The `package.json` has been updated to include Windows build commands.

## Prerequisites
1. **Node.js**: Download and install version 20+ from [nodejs.org](https://nodejs.org/).
2. **Git**: Download and install from [git-scm.com](https://git-scm.com/).
3. **Build Tools**: Because `better-sqlite3` is a native module, you will need Visual Studio Build Tools. The easiest way is to check the option to install "Tools for Native Modules" during the Node.js setup on Windows.

## Installation & Build Steps
1. **Clone the repository** (Open Command Prompt or PowerShell on your Windows PC):
   ```cmd
   git clone https://github.com/devanshupatil/TimeStream.git
   cd TimeStream
   ```

2. **Install dependencies**:
   ```cmd
   npm install
   ```
   *(If this step fails, ensure you installed the C++ build tools correctly as mentioned in the prerequisites).*

3. **Start the App locally** (for testing):
   ```cmd
   npm run start
   ```

4. **Create a Windows Installer (.exe)**:
   ```cmd
   npm run build:win
   ```
   *Once it builds successfully, you will find a TimeStream Setup `.exe` in the `dist` or `release` folder, which you can use to install the app permanently.*
