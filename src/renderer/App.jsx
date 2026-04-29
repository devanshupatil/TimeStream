// src/renderer/App.jsx
import React from 'react'
import UpdateBanner from './components/UpdateBanner.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
    return (
        <div className="app">
            <UpdateBanner />   {/* shows only when an update is available */}
            <Dashboard />      {/* always shown — the main activity view */}
        </div>
    )
}
