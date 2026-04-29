import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from 'bun:test'
import Dashboard from '../../src/renderer/components/Dashboard.jsx'

beforeEach(() => {
    globalThis.timestream = {
        getSessions: jest.fn().mockResolvedValue([
            { id: '1', type: 'claude', startTime: '2026-04-27T10:00:00Z' }
        ])
    }
})

describe('Dashboard', () => {
    it('shows loading state while sessions are being fetched', () => {
        render(<Dashboard />)
        expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('shows sessions after data loads', async () => {
        render(<Dashboard />)
        await waitFor(() =>
            expect(screen.getByText(/claude/i)).toBeInTheDocument()
        )
    })

    it('shows session count in header', async () => {
        render(<Dashboard />)
        await waitFor(() =>
            expect(screen.getByText(/1 session/i)).toBeInTheDocument()
        )
    })
})
