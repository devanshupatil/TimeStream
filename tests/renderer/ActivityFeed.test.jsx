import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import ActivityFeed from '../../src/renderer/components/ActivityFeed.jsx'

const mockSessions = [
    { id: '1', type: 'claude',   startTime: '2026-04-27T10:00:00Z' },
    { id: '2', type: 'opencode', startTime: '2026-04-27T09:00:00Z' },
    { id: '3', type: 'browser',  startTime: '2026-04-27T08:00:00Z', title: 'GitHub', url: 'https://github.com' }
]

describe('ActivityFeed', () => {
    it('renders a SessionCard for each session', () => {
        render(<ActivityFeed sessions={mockSessions} />)
        expect(screen.getByText('claude')).toBeInTheDocument()
        expect(screen.getByText('opencode')).toBeInTheDocument()
        expect(screen.getByText('browser')).toBeInTheDocument()
    })

    it('shows empty state message when sessions array is empty', () => {
        render(<ActivityFeed sessions={[]} />)
        expect(screen.getByText(/no activity/i)).toBeInTheDocument()
    })
})
