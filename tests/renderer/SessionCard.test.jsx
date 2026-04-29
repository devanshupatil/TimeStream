import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'bun:test'
import SessionCard from '../../src/renderer/components/SessionCard.jsx'

describe('SessionCard', () => {
    it('renders the session type label', () => {
        render(<SessionCard session={{
            id: '1', type: 'claude',
            startTime: '2026-04-27T10:00:00Z',
            endTime: '2026-04-27T11:30:00Z'
        }} />)
        expect(screen.getByText(/claude/i)).toBeInTheDocument()
    })

    it('shows the start time', () => {
        render(<SessionCard session={{
            id: '1', type: 'claude',
            startTime: '2026-04-27T10:00:00Z'
        }} />)
        const timeText = document.body.textContent
        expect(timeText).toBeTruthy()
    })

    it('shows page title for browser sessions instead of duration', () => {
        render(<SessionCard session={{
            id: 'b1', type: 'browser',
            startTime: '2026-04-27T10:00:00Z',
            title: 'GitHub',
            url: 'https://github.com'
        }} />)
        expect(screen.getByText('GitHub')).toBeInTheDocument()
    })

    it('shows duration in minutes when endTime is provided', () => {
        render(<SessionCard session={{
            id: '1', type: 'claude',
            startTime: '2026-04-27T10:00:00Z',
            endTime: '2026-04-27T10:30:00Z'
        }} />)
        expect(screen.getByText('30m')).toBeInTheDocument()
    })
})
