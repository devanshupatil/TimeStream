import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, jest, beforeEach } from 'bun:test'
import UpdateBanner from '../../src/renderer/components/UpdateBanner.jsx'

let onAvailableCb = null
let onDownloadedCb = null
let mockInstallUpdate

beforeEach(() => {
    onAvailableCb = null
    onDownloadedCb = null
    mockInstallUpdate = jest.fn()

    globalThis.timestream = {
        onUpdateAvailable: jest.fn(cb => { onAvailableCb = cb }),
        onUpdateDownloaded: jest.fn(cb => { onDownloadedCb = cb }),
        installUpdate: mockInstallUpdate,
        offUpdate: jest.fn()
    }
})

describe('UpdateBanner', () => {
    it('renders nothing when no update is available', () => {
        const { container } = render(<UpdateBanner />)
        expect(container.firstChild).toBeNull()
    })

    it('shows downloading message when update-available fires', () => {
        render(<UpdateBanner />)
        act(() => { onAvailableCb?.({ version: '1.1.0' }) })
        expect(screen.getByText(/downloading update v1.1.0/i)).toBeInTheDocument()
    })

    it('shows restart button when update-downloaded fires', () => {
        render(<UpdateBanner />)
        act(() => { onAvailableCb?.({ version: '1.1.0' }) })
        act(() => { onDownloadedCb?.({ version: '1.1.0' }) })
        expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
    })

    it('calls installUpdate when restart button is clicked', async () => {
        render(<UpdateBanner />)
        act(() => { onAvailableCb?.({ version: '1.1.0' }) })
        act(() => { onDownloadedCb?.({ version: '1.1.0' }) })
        await userEvent.click(screen.getByRole('button', { name: /restart/i }))
        expect(mockInstallUpdate).toHaveBeenCalledTimes(1)
    })
})
