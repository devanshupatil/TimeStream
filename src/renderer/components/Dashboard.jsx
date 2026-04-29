// src/renderer/components/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import ActivityFeed from './ActivityFeed.jsx'

export default function Dashboard() {
    // null = loading, [] = loaded but empty, [...] = loaded with data
    const [sessions, setSessions] = useState(null)

    useEffect(() => {
        // On component mount: ask main process for all sessions via IPC
        window.timestream.getSessions().then(data => {
            setSessions(data)
        })
    }, [])  // [] means run only once on mount, not on every re-render

    if (sessions === null) {
        return <div className="loading">Loading activity...</div>
    }

    const sessionWord = sessions.length === 1 ? 'session' : 'sessions'

    return (
        <main className="dashboard">
            <header className="dashboard-header">
                <h1>TimeStream</h1>
                <span className="session-count">
                    {sessions.length} {sessionWord} tracked
                </span>
            </header>
            <ActivityFeed sessions={sessions} />
        </main>
    )
}
