// src/renderer/components/SessionCard.jsx
import React from 'react'

const TYPE_COLORS = {
    claude: '#6c63ff',   // purple
    opencode: '#10b981',   // green
    browser: '#f59e0b'    // amber
}

export default function SessionCard({ session }) {
    const { type, startTime, endTime, title, url } = session

    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : null

    // Calculate duration in minutes if we have both start and end times
    const durationMinutes = end ? Math.round((end - start) / 60000) : null

    // Format time as "10:00 AM" (user's local timezone)
    const formattedTime = start.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    })

    return (
        <div
            className="session-card"
            style={{ borderLeftColor: TYPE_COLORS[type] || '#64748b' }}
        >
            <span className="session-type">{type}</span>
            <span className="session-time">{formattedTime}</span>

            {/* Browser sessions show page title; others show duration */}
            {type === 'browser' && title ? (
                <span className="session-title" title={url}>{title}</span>
            ) : durationMinutes !== null ? (
                <span className="session-duration">{durationMinutes}m</span>
            ) : null}
        </div>
    )
}
