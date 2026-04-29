// src/renderer/components/UpdateBanner.jsx
import React, { useState, useEffect } from 'react'

export default function UpdateBanner() {
    // null = no update | { version, downloaded: false } = downloading | { version, downloaded: true } = ready
    const [updateInfo, setUpdateInfo] = useState(null)

    useEffect(() => {
        // Register listeners for update events sent from main process via IPC
        window.timestream.onUpdateAvailable((info) => {
            setUpdateInfo({ version: info.version, downloaded: false })
        })

        window.timestream.onUpdateDownloaded((info) => {
            setUpdateInfo({ version: info.version, downloaded: true })
        })

        // Cleanup: remove listeners when component unmounts
        return () => window.timestream.offUpdate()
    }, [])

    // Hide banner completely when no update is in progress
    if (!updateInfo) return null

    return (
        <div className="update-banner" role="status">
            {updateInfo.downloaded ? (
                <>
                    <span>
                        v{updateInfo.version} is ready — restart to install
                    </span>
                    <button onClick={() => window.timestream.installUpdate()}>
                        Restart &amp; Update
                    </button>
                </>
            ) : (
                <span>Downloading update v{updateInfo.version}...</span>
            )}
        </div>
    )
}
