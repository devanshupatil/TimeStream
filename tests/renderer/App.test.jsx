import { render } from '@testing-library/react'
import { describe, it, expect, jest, beforeEach } from 'bun:test'
import App from '../../src/renderer/App.jsx'

beforeEach(() => {
    globalThis.timestream = {
        getSessions: jest.fn().mockResolvedValue([]),
        onUpdateAvailable: jest.fn(),
        onUpdateDownloaded: jest.fn(),
        offUpdate: jest.fn()
    }
})

describe('App', () => {
    it('renders without crashing', () => {
        const { container } = render(<App />)
        expect(container).toBeTruthy()
    })
})
