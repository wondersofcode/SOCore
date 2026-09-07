import { useStore } from '../store'

interface Integration {
  name: string
  role: string
  stage: 'Detect' | 'Enrich' | 'Respond' | 'Track'
  connected: boolean
  detail: string
  endpoint: string
}

// Mirrors the real SOCore stack. Endpoints are placeholders until the backend lands.
const integrations: Integration[] = [
  { name: 'Wazuh', role: 'SIEM and endpoint agents', stage: 'Detect', connected: true, detail: '14 agents reporting, 3 rulesets active', endpoint: 'wazuh.socore.local:55000' },
  { name: 'MISP', role: 'Threat intelligence database', stage: 'Enrich', connected: true, detail: 'Feodo Tracker, URLhaus and Spamhaus DROP synced 4h ago', endpoint: 'misp.socore.local' },
  { name: 'Cortex', role: 'Analyzer engine', stage: 'Enrich', connected: true, detail: 'VirusTotal and AbuseIPDB analyzers enabled', endpoint: 'cortex.socore.local:9001' },
  { name: 'TheHive', role: 'Case management', stage: 'Track', connected: true, detail: 'Template SOCore-Alert, 4 custom fields mapped', endpoint: 'thehive.socore.local:9000' },
  { name: 'Shuffle', role: 'Playbook automation', stage: 'Respond', connected: true, detail: '4 playbooks, firewall actions run in simulation mode', endpoint: 'shuffle.socore.local:3001' },
  { name: 'Slack', role: 'Analyst notifications', stage: 'Respond', connected: true, detail: 'Posting to #socore-alerts', endpoint: 'hooks.slack.com/services/…' },
  { name: 'AI explanation service', role: 'Alert reasoning', stage: 'Enrich', connected: true, detail: 'Summarises correlated signals for each alert', endpoint: 'backend/api/explain' },
]

const stageColor: Record<Integration['stage'], string> = {
  Detect: '#00d4ff', Enrich: '#a855f7', Respond: '#f97316', Track: '#22c55e',
}

function Row({ i }: { i: Integration }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#21262d] last:border-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: i.connected ? '#22c55e' : '#6b7280' }}
      />
      <div className="w-44 shrink-0">
        <div className="text-sm text-[#e6edf3]">{i.name}</div>
        <div className="text-[11px] text-[#6b7280]">{i.role}</div>
      </div>
      <span
        className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
        style={{ background: `${stageColor[i.stage]}15`, color: stageColor[i.stage] }}
      >
        {i.stage}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#8b949e] truncate">{i.detail}</div>
        <div className="text-[10px] font-mono text-[#484f58] truncate">{i.endpoint}</div>
      </div>
      <span className="text-[11px] shrink-0" style={{ color: i.connected ? '#22c55e' : '#6b7280' }}>
        {i.connected ? 'Connected' : 'Not configured'}
      </span>
    </div>
  )
}

export default function Settings() {
  const { currentUser } = useStore()

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#21262d] flex items-center justify-between">
          <span className="text-xs font-semibold text-[#e6edf3]">Pipeline connections</span>
          <span className="text-[10px] font-mono text-[#484f58]">
            {integrations.filter(i => i.connected).length} of {integrations.length} connected
          </span>
        </div>
        {integrations.map(i => <Row key={i.name} i={i} />)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-5 py-4">
          <div className="text-xs font-semibold text-[#e6edf3] mb-3">Response policy</div>
          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[#e6edf3]">Approval threshold</div>
                <div className="text-[11px] text-[#6b7280]">Actions above this risk score wait for a human</div>
              </div>
              <span className="font-mono text-[#f97316] shrink-0">70</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[#e6edf3]">Firewall actions</div>
                <div className="text-[11px] text-[#6b7280]">Logged rather than executed while no firewall is attached</div>
              </div>
              <span className="font-mono text-[#8b949e] shrink-0">Simulated</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[#e6edf3]">Notifications</div>
                <div className="text-[11px] text-[#6b7280]">Sent without approval for every severity</div>
              </div>
              <span className="font-mono text-[#22c55e] shrink-0">Automatic</span>
            </div>
          </div>
        </div>

        <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-5 py-4">
          <div className="text-xs font-semibold text-[#e6edf3] mb-3">Session</div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#8b949e]">Signed in as</span>
              <span className="text-[#e6edf3]">{currentUser}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8b949e]">Role</span>
              <span className="text-[#e6edf3]">Tier 2 analyst</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8b949e]">Can approve actions</span>
              <span className="text-[#22c55e]">Yes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8b949e]">Log retention</span>
              <span className="text-[#e6edf3]">90 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
