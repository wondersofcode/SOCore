/**
 * Frontend behaviour of Approve & Run / Reject: the UI must only reflect what
 * the backend actually persisted, must never fake success, and must not allow
 * duplicate submissions. `api` is mocked at the network boundary only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Alert } from './data'

const mocks = vi.hoisted(() => ({ role: 'l2_analyst' as string | null }))

vi.mock('./lib/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'leyla@x.test' }, role: mocks.role, profile: { timezone: 'UTC' } }),
}))

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api')
  return {
    ...actual,
    api: {
      health: vi.fn(),
      alerts: vi.fn(),
      decisions: vi.fn(),
      cases: vi.fn(),
      approve: vi.fn(),
      retryExecution: vi.fn(),
      unblock: vi.fn(),
      alertAudit: vi.fn(),
    },
  }
})

import { api, ApiError } from './api'
import { StoreProvider, useStore } from './store'
import type { ActionOutcome } from './store'
import { DecisionControls } from './components/Decision'

const A = (over: Partial<Alert> = {}): Alert => ({
  id: 'ALT-1', timestamp: '2026-01-01 00:00:00', severity: 'High', sourceIP: '45.33.32.156', attackType: 'Brute Force',
  mitreId: 'T1110', mitreName: 'Brute Force', status: 'New', analyst: 'Unassigned', raw: '', vtScore: 90, abuseScore: 90,
  country: '', asn: '', detectedAt: '', enrichedAt: '', respondedAt: '', riskScore: 92, aiExplanation: '', aiConfidence: 80,
  proposedAction: { action: 'Block source IP at the perimeter firewall', target: '45.33.32.156', playbook: 'PB-x', dryRun: true, executor: 'fail2ban' },
  approvalStatus: 'Pending', sources: [], executionStatus: 'None', executionResult: null, executedAt: '',
  decidedBy: '', decidedByRole: '', decisionReason: '', decidedAt: '', ...over,
})

const approved = A({ approvalStatus: 'Approved', status: 'Responding', executionStatus: 'Executed', decidedBy: 'Leyla' })

// The "server": what the next list call returns.
let serverAlerts: Alert[]
const m = <T,>(f: unknown) => f as ReturnType<typeof vi.fn> & T

beforeEach(() => {
  mocks.role = 'l2_analyst'
  serverAlerts = [A()]
  m(api.health).mockResolvedValue({ status: 'ok', aiLive: false, alerts: 1, pending: 1, connections: {} })
  m(api.alerts).mockImplementation(async () => serverAlerts)
  m(api.decisions).mockResolvedValue([])
  m(api.cases).mockResolvedValue([])
  m(api.alertAudit).mockResolvedValue([])
})

let captured: ReturnType<typeof useStore>
function Probe() {
  captured = useStore()
  return <div data-testid="pending">{captured.pending.length}</div>
}

async function mountLive(children?: React.ReactNode) {
  render(<StoreProvider><Probe />{children}</StoreProvider>)
  await waitFor(() => expect(captured.live).toBe(true))
}

describe('store.decide (backend-authoritative)', () => {
  it('Approve: nothing changes until the backend answers, then alert + pending count follow the persisted result', async () => {
    let release!: (a: Alert) => void
    m(api.approve).mockImplementation(() => new Promise<Alert>(r => { release = r }))
    await mountLive()
    expect(screen.getByTestId('pending').textContent).toBe('1')

    let outcome!: Promise<ActionOutcome>
    act(() => { outcome = captured.decide('ALT-1', 'Approved', 'ok') })
    // request in flight: still Pending locally (no optimistic fake)
    expect(captured.alerts[0].approvalStatus).toBe('Pending')
    expect(api.approve).toHaveBeenCalledWith('ALT-1', 'approve', 'ok')

    serverAlerts = [approved]
    await act(async () => { release(approved); await outcome })
    expect(captured.alerts[0].approvalStatus).toBe('Approved')
    expect(captured.alerts[0].status).toBe('Responding')
    expect(captured.alerts[0].executionStatus).toBe('Executed')
    expect(screen.getByTestId('pending').textContent).toBe('0')
  })

  it('Reject sends the reject decision with the reason', async () => {
    m(api.approve).mockResolvedValue(A({ approvalStatus: 'Rejected', status: 'Resolved' }))
    await mountLive()
    await act(async () => { await captured.decide('ALT-1', 'Rejected', 'false alarm') })
    expect(api.approve).toHaveBeenCalledWith('ALT-1', 'reject', 'false alarm')
  })

  it('a 403/409 failure is returned (never swallowed) and local state is NOT changed', async () => {
    m(api.approve).mockRejectedValue(new ApiError('/api/approve/ALT-1', 409, 'Alert is not awaiting a decision (already approved)'))
    await mountLive()
    let out!: ActionOutcome
    await act(async () => { out = await captured.decide('ALT-1', 'Approved', '') })
    expect(out).toEqual({ ok: false, error: 'Alert is not awaiting a decision (already approved)' })
    expect(captured.alerts[0].approvalStatus).toBe('Pending')
  })

  it('maps failures to analyst-readable messages', async () => {
    await mountLive()
    const cases: [unknown, RegExp][] = [
      [new ApiError('p', 401, ''), /session expired/i],
      [new ApiError('p', 403, ''), /permission/i],
      [new ApiError('p', 404, ''), /no longer exists/i],
      [new ApiError('p', 500, ''), /backend failed/i],
      [new TypeError('Failed to fetch'), /could not reach/i],
      [new DOMException('t', 'TimeoutError'), /did not answer in time/i],
    ]
    for (const [err, re] of cases) {
      m(api.approve).mockRejectedValueOnce(err)
      let out!: ActionOutcome
      await act(async () => { out = await captured.decide('ALT-1', 'Approved', '') })
      expect(out.ok).toBe(false)
      if (!out.ok) expect(out.error).toMatch(re)
    }
  })

  it('after a failure (even a timeout) the view is re-read from the backend', async () => {
    m(api.approve).mockRejectedValue(new DOMException('t', 'TimeoutError'))
    await mountLive()
    serverAlerts = [approved] // the server actually processed it
    await act(async () => { await captured.decide('ALT-1', 'Approved', '') })
    expect(captured.alerts[0].approvalStatus).toBe('Approved')
  })

  it('refuses to fake a decision when the backend is not connected', async () => {
    m(api.alerts).mockRejectedValue(new Error('down'))
    render(<StoreProvider><Probe /></StoreProvider>)
    await waitFor(() => expect(captured).toBeDefined())
    let out!: ActionOutcome
    await act(async () => { out = await captured.decide('ALT-1', 'Approved', '') })
    expect(out.ok).toBe(false)
    expect(api.approve).not.toHaveBeenCalled()
  })

  it('surfaces ExecutionFailed truthfully via the returned alert', async () => {
    const failed = A({ approvalStatus: 'Approved', executionStatus: 'ExecutionFailed', executionResult: { error: 'jail sshd does not exist' } })
    m(api.approve).mockResolvedValue(failed)
    serverAlerts = [failed]
    await mountLive()
    let out!: ActionOutcome
    await act(async () => { out = await captured.decide('ALT-1', 'Approved', '') })
    expect(out.ok && out.alert.executionStatus).toBe('ExecutionFailed')
  })
})

describe('stale refresh race (regression)', () => {
  it('a refresh that was in flight cannot overwrite a newer decision with pre-decision data', async () => {
    const X = A({ id: 'ALT-X' })
    const Y = A({ id: 'ALT-Y' })
    const Xa = { ...X, approvalStatus: 'Approved' as const, status: 'Responding' as const, executionStatus: 'Simulated' as const }
    const Ya = { ...Y, approvalStatus: 'Approved' as const, status: 'Responding' as const, executionStatus: 'Simulated' as const }
    serverAlerts = [X, Y]
    await mountLive()
    expect(screen.getByTestId('pending').textContent).toBe('2')

    // From here every list fetch is held open so the test controls arrival order.
    const held: Array<(v: Alert[]) => void> = []
    m(api.alerts).mockImplementation(() => new Promise<Alert[]>(r => { held.push(r) }))
    m(api.approve).mockImplementation(async (id: string) => (id === 'ALT-X' ? Xa : Ya))

    // Decision 1 completes; its follow-up refresh (#1) starts and hangs.
    let o1!: Promise<ActionOutcome>
    act(() => { o1 = captured.decide('ALT-X', 'Approved', '') })
    await waitFor(() => expect(held.length).toBe(1))

    // Decision 2 completes while refresh #1 is still in flight; its refresh (#2) starts.
    let o2!: Promise<ActionOutcome>
    act(() => { o2 = captured.decide('ALT-Y', 'Approved', '') })
    await waitFor(() => expect(held.length).toBe(2))

    // Refresh #2 (post-decision data) lands first ...
    await act(async () => { held[1]([Xa, Ya]); await o2 })
    expect(screen.getByTestId('pending').textContent).toBe('0')

    // ... then the STALE refresh #1 lands last, still showing Y as Pending.
    await act(async () => { held[0]([Xa, Y]); await o1 })

    expect(captured.alerts.find(a => a.id === 'ALT-Y')?.approvalStatus).toBe('Approved')
    expect(screen.getByTestId('pending').textContent).toBe('0')
  })

  it('a refresh that lands while a decision request is still running is dropped', async () => {
    const X = A({ id: 'ALT-X' })
    const Xa = { ...X, approvalStatus: 'Approved' as const, executionStatus: 'Simulated' as const }
    serverAlerts = [X]
    await mountLive()
    let release!: (a: Alert) => void
    m(api.approve).mockImplementation(() => new Promise<Alert>(r => { release = r }))
    let outcome!: Promise<ActionOutcome>
    act(() => { outcome = captured.decide('ALT-X', 'Approved', '') })

    // An unrelated refresh finishes mid-request with data that predates the decision.
    m(api.alerts).mockResolvedValue([X])
    await act(async () => { await captured.refresh() })
    expect(captured.alerts[0].approvalStatus).toBe('Pending') // unchanged: still awaiting the backend

    m(api.alerts).mockResolvedValue([Xa])
    await act(async () => { release(Xa); await outcome })
    expect(captured.alerts[0].approvalStatus).toBe('Approved')
  })
})

describe('DecisionControls', () => {
  it('double click sends exactly one request and disables the buttons while it runs', async () => {
    let release!: (a: Alert) => void
    m(api.approve).mockImplementation(() => new Promise<Alert>(r => { release = r }))
    await mountLive(<DecisionControls alert={A()} />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: /approve and run/i })
    await user.dblClick(btn)
    expect(api.approve).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /running/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^reject/i })).toBeDisabled()
    serverAlerts = [approved]
    await act(async () => { release(approved) })
  })

  it('Reject needs a reason', async () => {
    await mountLive(<DecisionControls alert={A()} />)
    const reject = screen.getByRole('button', { name: /^reject$/i })
    expect(reject).toBeDisabled()
    await userEvent.setup().type(screen.getByPlaceholderText(/reason/i), 'internal scanner')
    expect(reject).toBeEnabled()
  })

  it('shows the backend error to the analyst and never a success message', async () => {
    m(api.approve).mockRejectedValue(new ApiError('p', 422, 'Refused: 10.0.0.5 is a private address and is never blocked'))
    await mountLive(<DecisionControls alert={A()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: /approve and run/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/never blocked/)
    expect(screen.queryByText(/executed|success/i)).toBeNull()
  })

  it('L1 analysts get no approve/reject buttons', async () => {
    mocks.role = 'l1_analyst'
    await mountLive(<DecisionControls alert={A()} />)
    expect(screen.queryByRole('button', { name: /approve/i })).toBeNull()
    expect(screen.getByText(/needs an L2 analyst or admin/i)).toBeInTheDocument()
  })

  it('labels actions without an executor as simulated, not as a real run', async () => {
    const sim = A({ proposedAction: { action: 'Isolate the endpoint', target: 'h', playbook: 'p', dryRun: true, executor: 'simulated' } })
    await mountLive(<DecisionControls alert={sim} />)
    expect(screen.getByRole('button', { name: /approve \(simulated\)/i })).toBeInTheDocument()
    expect(screen.getByText(/labelled Simulated/i)).toBeInTheDocument()
  })
})
