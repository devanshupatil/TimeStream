// src/renderer/components/ActivityFeed.jsx
import React from 'react'
import SessionCard from './SessionCard.jsx'

export default function ActivityFeed({ sessions }) {
    if (!sessions || sessions.length === 0) {
        return (
            <div className="empty-state">
                No activity recorded yet. Start a Claude or OpenCode session, or open Chrome.
            </div>
        )
    }

    return (
        <div className="activity-feed">
            {sessions.map(session => (
                <SessionCard key={session.id} session={session} />
            ))}
        </div>
    )
}
