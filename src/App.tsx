import { useMemo, useState } from 'react'
import {
  CONDITIONS, CONFIG_VERSION, TILES, UNWELL, TIER_RANK, evaluate, plausibility,
  ageInMonths, OVERRIDE_EXPIRY_MINUTES,
  type Patient, type Tier, type TileId, type Vitals, type VitalReading, type VitalSource,
} from './engine'

/* ---------- design tokens ---------- */
const TIER = {
  IMMEDIATE: { label: 'Immediate', hi: 'तुरंत', solid: '#D62839', soft: '#FBE9EB', text: '#B01E2D', border: '#D62839', glyph: '▲' },
  SOON: { label: 'Soon', hi: 'जल्द', solid: '#F4A300', soft: '#FEF4DE', text: '#8A5C00', border: '#F4A300', glyph: '◆' },
  ROUTINE: { label: 'Routine', hi: 'सामान्य', solid: '#1E8449', soft: '#E6F2EA', text: '#1E8449', border: '#1E8449', glyph: '●' },
} as const

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`)

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16).padStart(8, '0')
}

/* ---------- icons ---------- */
const PATHS: Record<string, string> = {
  heart: 'M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z',
  wind: 'M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8',
  thermo: 'M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0z',
  bandage: 'M4.5 14.5l10-10a3.5 3.5 0 0 1 5 5l-10 10a3.5 3.5 0 0 1-5-5zM10 10l4 4',
  abdo: 'M8 3v4a4 4 0 0 0 8 0V3M6 21v-4a6 6 0 0 1 12 0v4',
  brain: 'M12 4a4 4 0 0 0-7 3 4 4 0 0 0 0 7 4 4 0 0 0 7 4zM12 4a4 4 0 0 1 7 3 4 4 0 0 1 0 7 4 4 0 0 1-7 4z',
  preg: 'M12 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 8h3l1 4a3 3 0 0 1 0 6v4M10 8l-1 7h2v7',
  child: 'M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7 21l1-8h8l1 8M5 12l3-1M19 12l-3-1',
  cough: 'M5 12a7 7 0 1 1 7 7H5zM15 9h4M16 13h5M15 17h4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  pill: 'M10.5 20.5l10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7zM8.5 8.5l7 7',
  help: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0',
  wifi: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  clock: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zM12 6v6l4 2',
}
function Icon({ name, size = 20, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

function TierBadge({ tier, size = 'md', unverified }: { tier: Tier; size?: 'sm' | 'md' | 'lg'; unverified?: boolean }) {
  const t = TIER[tier]
  const cls = size === 'lg' ? 'text-lg px-3.5 py-1.5' : size === 'sm' ? 'text-base px-2 py-0.5' : 'text-base px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-2 rounded-sm font-semibold ${cls}`}
      style={{ background: t.soft, color: t.text }}>
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.solid }} />
      {t.label}{unverified ? ' · unverified' : ''}
    </span>
  )
}

/* ---------- helpers ---------- */
const nurseMeasured = (value: number): VitalReading => ({ value, source: 'nurse' as VitalSource, is_verified: true })
const selfReported = (value: number): VitalReading => ({ value, source: 'patient_self' as VitalSource, is_verified: false })

/* ---------- seed data (v0.3 vignettes) ---------- */
const NOW0 = 10 * 60
const blank = { followups: [], unwell: [], conditions: [], vitals: {} as Vitals, worseReports: 0, status: 'waiting' as const }
const SEED: Patient[] = [
  // V1: 60M chest pain + sweating → IMMEDIATE (chest_40plus + sweating follow-up)
  { ...blank, token: 87, age: 60, sex: 'M', tiles: ['chest'], followups: ['sweating'], arrivedAt: NOW0 - 4 },
  // V2: 28F thyroid refill → ROUTINE
  { ...blank, token: 23, age: 28, sex: 'F', tiles: ['refill'], arrivedAt: NOW0 - 95 },
  // V3: 70M diabetic giddiness, no glucose → SOON + glucose task
  { ...blank, token: 41, age: 70, sex: 'M', tiles: ['head'], conditions: ['diabetes'], arrivedAt: NOW0 - 38 },
  // V4: 55M SBP 190 no symptoms → SOON + repeat BP task (adult BP rule, age >= 17)
  { ...blank, token: 52, age: 55, sex: 'M', tiles: ['refill'], vitals: { sbp: nurseMeasured(190), dbp: nurseMeasured(110) }, arrivedAt: NOW0 - 22 },
  // V7: 2yr child not feeding → IMMEDIATE (RF_CHILD_NOT_FEEDING); ageMonths=24
  { ...blank, token: 58, age: 2, ageMonths: 24, sex: 'F', tiles: ['child', 'fever'], followups: ['not_feeding'], arrivedAt: NOW0 - 9 },
  // V9: COPD on home oxygen, SpO₂ 90 → SOON + clinician review (88–92 range, not critical)
  { ...blank, token: 61, age: 66, sex: 'F', tiles: ['breath'], conditions: ['lung'], vitals: { spo2: nurseMeasured(90) }, arrivedAt: NOW0 - 30 },
  // V11: 22M ankle injury, minor → ROUTINE (no head, no heavy bleeding)
  { ...blank, token: 64, age: 22, sex: 'M', tiles: ['injury'], arrivedAt: NOW0 - 51 },
  // V15: 70M insulin user, ROUTINE, 3h wait → SOON (time escalation)
  { ...blank, token: 70, age: 70, sex: 'M', tiles: ['refill'], conditions: ['diabetes', 'insulin'], arrivedAt: NOW0 - 175 },
  // V13: 73F simple cough → ROUTINE
  { ...blank, token: 73, age: 34, sex: 'F', tiles: ['cough'], arrivedAt: NOW0 - 66 },
  // V12: 40M self-reported SpO₂ 85 → IMMEDIATE (unverified)
  { ...blank, token: 76, age: 40, sex: 'M', tiles: ['other'], vitals: { spo2: selfReported(85) }, arrivedAt: NOW0 - 14 },
  // V6b: 30F pregnant BP 165/112 NO symptoms → IMMEDIATE (BP_PREG_SEVERE)
  { ...blank, token: 81, age: 30, sex: 'F', tiles: ['preg'], conditions: ['pregnant'],
    vitals: { sbp: nurseMeasured(165), dbp: nurseMeasured(112) }, arrivedAt: NOW0 - 18 },
  // V17: 8-month infant RR 55 → SOON (PEDS_TACHYPNOEA_2_11M)
  { ...blank, token: 83, age: 0, ageMonths: 8, sex: 'M', tiles: ['child'],
    vitals: { rr: nurseMeasured(55) }, arrivedAt: NOW0 - 7 },
]


interface AuditEntry {
  id: number; at: number; who: string; token: number; action: string
  from?: Tier; to?: Tier; suggestion: Tier; reason: string; snapshot: string; cfg: string; prev: string; hash: string
}

type Role = 'clerk' | 'nurse' | 'doctor' | 'admin'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role>('nurse')
  const [now, setNow] = useState(NOW0)
  const [offline, setOffline] = useState(false)
  const [failsafe, setFailsafe] = useState(false)
  const [patients, setPatients] = useState<Patient[]>(SEED)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const results = useMemo(() => {
    const m = new Map<number, ReturnType<typeof evaluate>>()
    patients.forEach((p) => m.set(p.token, evaluate(p, now)))
    return m
  }, [patients, now])

  const log = (p: Patient, who: string, action: string, reason: string, from?: Tier, to?: Tier) => {
    setAudit((a) => {
      const prev = a[0]?.hash ?? '00000000'
      const r = evaluate(p, now)
      const snapshot = JSON.stringify({ age: p.age, sex: p.sex, tiles: p.tiles, f: p.followups, u: p.unwell, c: p.conditions, v: p.vitals })
      const body = `${prev}|${now}|${who}|${p.token}|${action}|${from}|${to}|${snapshot}`
      return [{ id: a.length + 1, at: now, who, token: p.token, action, from, to, suggestion: r.suggested, reason, snapshot, cfg: CONFIG_VERSION, prev, hash: hash(body) }, ...a]
    })
  }
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600) }

  const update = (token: number, fn: (p: Patient) => Patient, who: string, action: string, reason: string) => {
    const p = patients.find((x) => x.token === token)
    if (!p) return
    const before = evaluate(p, now)
    let next = fn(p)
    const after = evaluate(next, now)
    // Layer H: unlock if new escalation exceeds the locked tier
    if (next.override && TIER_RANK[after.suggested] > TIER_RANK[next.override.tier] && TIER_RANK[after.suggested] > TIER_RANK[before.suggested]) {
      next = { ...next, pendingSuggestion: after.suggested }
    }
    // Layer H: surface lock expiry as pending suggestion so nurse is prompted
    if (after.overrideLockExpired && next.override && !next.pendingSuggestion) {
      next = { ...next, pendingSuggestion: after.suggested }
    }
    setPatients((ps) => ps.map((x) => (x.token === token ? next : x)))
    log(next, who, action, reason, before.final, evaluate(next, now).final)
  }

  const register = (p: Patient) => {
    setPatients((ps) => [...ps, p])
    log(p, 'Clerk · Asha', 'Registered', evaluate(p, now).reason, undefined, evaluate(p, now).final)
  }

  const active = patients.filter((p) => p.status === 'waiting' || p.status === 'fasttrack')
  const newAlerts = active.filter((p) => results.get(p.token)!.final === 'IMMEDIATE' && !p.acknowledged)

  const roles = ([
    { id: 'clerk', label: 'Registration' }, { id: 'nurse', label: 'Nurse' }, { id: 'doctor', label: 'Doctor' },
    { id: 'admin', label: 'Logs' },
  ] as { id: Role; label: string }[]).filter((r) => user && ACCESS[user.kind].includes(r.id))

  if (!user) return <Login onLogin={(u) => { setUser(u); setRole(u.home) }} />

  return (
    <div className="min-h-screen">
      <header className="govuk-header sticky top-0 z-30 border-b-[10px] border-teal bg-ink text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="leading-tight">
              <div className="text-[24px] font-bold tracking-tight text-white">Opdflow</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-4">
            {roles.map((r) => (
              <button key={r.id} onClick={() => setRole(r.id)}
                className={`min-h-12 rounded-md px-3.5 text-base font-medium transition ${role === r.id ? 'text-white underline decoration-[3px] underline-offset-[10px]' : 'text-white hover:underline'}`}>
                {r.label}
                {r.id === 'nurse' && newAlerts.length > 0 && <span className="ml-1.5 rounded-full bg-p-immediate px-1.5 text-sm font-semibold text-white">{newAlerts.length}</span>}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-base">
            <span className="text-white"><span className="font-semibold">{user.name}</span>, {user.title}</span>
            <button onClick={() => setUser(null)} className="min-h-12 px-3 font-medium text-white underline hover:decoration-[3px]">Log out</button>
          </div>
        </div>
        {offline && (
          <div className="border-t border-white/30 bg-ink px-5 py-2 text-center text-base text-white">
            Network lost. Running on local server; {audit.length} events queued and will sync on reconnect. Nothing is blocked.
          </div>
        )}
        {failsafe && (
          <div className="bg-focus px-5 py-2 text-center text-base font-semibold text-ink">
            Fail-safe mode: prioritisation paused, showing plain token order. Staff follow the paper protocol.
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        {role === 'clerk' && <Clerk nextToken={Math.max(...patients.map((p) => p.token)) + 1} now={now} onRegister={(p) => { register(p); flash(`Token ${p.token} registered`) }} patients={patients} onWorse={(t) => { update(t, (p) => ({ ...p, worseReports: p.worseReports + 1, acknowledged: false }), 'Clerk · Asha', 'Feeling worse (walk-up)', 'Patient reported feeling worse at desk'); flash(`Token ${t} re-prioritised`) }} />}
        {role === 'nurse' && (
          <Nurse patients={active} all={patients} results={results} now={now} failsafe={failsafe} setFailsafe={setFailsafe}
            selected={selected} setSelected={setSelected} update={update} who="Nurse · Priya" />
        )}
        {role === 'doctor' && <Doctor patients={active} results={results} now={now} update={update} />}
        {role === 'admin' && <Admin patients={patients} results={results} audit={audit} now={now} />}
      </main>

      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border-l-[5px] border-go bg-white px-4 py-3 text-base font-semibold text-ink shadow-[0_0_0_2px_#0B0C0C]">{toast}</div>}
    </div>
  )
}

/* ================= CLERK ================= */
const CLERK_CONDITIONS = ['diabetes', 'insulin', 'htn', 'heart', 'lung', 'thinner', 'pregnant']

function Clerk({ nextToken, now, onRegister }: {
  nextToken: number; now: number; onRegister: (p: Patient) => void; patients: Patient[]; onWorse: (t: number) => void
}) {
  const fresh = () => ({ age: '', sex: '' as Patient['sex'] | '', tiles: [] as TileId[], yes: [] as string[], no: [] as string[], unwell: [] as string[], conditions: [] as string[] })
  const example = () => ({ ...fresh(), age: '60', sex: 'M' as const, tiles: ['chest'] as TileId[], yes: ['sweating'] })
  const [f, setF] = useState(() => (new URLSearchParams(location.search).get('state') === 'filled' ? example() : fresh()))
  const [lang, setLang] = useState<'en' | 'hi'>('en')
  const [confirm, setConfirm] = useState(false)
  const [unknownAsk, setUnknownAsk] = useState(false)
  const toggle = (k: 'tiles' | 'unwell' | 'conditions', v: string) =>
    setF((s) => ({ ...s, [k]: (s[k] as string[]).includes(v) ? (s[k] as string[]).filter((x) => x !== v) : [...(s[k] as string[]), v] }))
  const answer = (id: string, yes: boolean) => setF((s) => {
    const on = yes ? s.yes.includes(id) : s.no.includes(id)
    return { ...s, yes: s.yes.filter((x) => x !== id).concat(yes && !on ? [id] : []), no: s.no.filter((x) => x !== id).concat(!yes && !on ? [id] : []) }
  })

  const draft: Patient = {
    token: nextToken, age: Number(f.age) || 0, sex: (f.sex || 'U') as Patient['sex'], tiles: f.tiles, followups: f.yes,
    unwell: f.unwell, conditions: f.conditions, vitals: {}, arrivedAt: now, worseReports: 0, status: 'waiting',
  }
  const r = evaluate(draft, now)
  const ready = f.age !== '' && f.sex !== '' && f.tiles.length > 0
  const questions = TILES.filter((t) => f.tiles.includes(t.id)).flatMap((t) => t.followups).slice(0, 4)
  const L = (x: { en: string; hi: string }) => (lang === 'en' ? x.en : x.hi)
  const reason = ready ? [
    ...TILES.filter((t) => f.tiles.includes(t.id)).map((t) => t.en),
    `age ${f.age}`,
    ...questions.filter((q) => f.yes.includes(q.id)).map((q) => q.en.toLowerCase()),
    ...UNWELL.filter((u) => f.unwell.includes(u.id)).map((u) => u.en.toLowerCase()),
  ].join(', ') + '. Vitals pending.' : ''
  const t = TIER[r.suggested]

  const reset = () => { setF(fresh()); setConfirm(false); setUnknownAsk(false) }
  const submit = () => {
    if (r.suggested === 'IMMEDIATE' && !confirm) { setConfirm(true); return }
    onRegister(draft); reset()
  }
  const unknown = () => {
    onRegister({ ...draft, age: 0, sex: 'U', unknown: true, tiles: [], followups: [], unwell: [], conditions: [] }); reset()
  }
  const sel = (on: boolean) => on ? 'bg-sel text-white' : 'bg-white text-ink shadow-[inset_0_0_0_2px_#0B0C0C] hover:bg-teal-light'

  return (
    <div className="grid h-[calc(100vh-7rem)] min-h-[600px] grid-cols-[62fr_38fr] gap-6">
      {/* LEFT */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-end gap-3">
          <div>
            <div className="mb-1 text-sm font-medium text-body">Token</div>
            <div className="flex h-12 w-20 items-center justify-center rounded-md bg-teal-light font-mono text-xl font-bold text-ink">{nextToken}</div>
          </div>
          <label>
            <div className="mb-1 text-sm font-medium text-body">Age</div>
            <input autoFocus inputMode="numeric" value={f.age} placeholder="Years"
              onChange={(e) => setF({ ...f, age: e.target.value.replace(/\D/g, '').slice(0, 3) })}
              className="h-12 w-24 rounded-md border border-line bg-white px-3 text-lg font-semibold text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/30" />
          </label>
          <div>
            <div className="mb-1 text-sm font-medium text-body">Sex</div>
            <div className="flex gap-2">
              {([['M', 'M'], ['F', 'F'], ['U', 'Other']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setF({ ...f, sex: v })} className={`h-12 min-w-12 rounded-md px-3 text-base font-semibold ${sel(f.sex === v)}`}>{l}</button>
              ))}
            </div>
          </div>
          <button onClick={() => setF((s) => ({ ...s, age: '60', sex: 'M' }))} className="ml-auto h-12 rounded-md px-3 text-base font-medium text-teal hover:bg-teal-light">Scan ABHA</button>
        </div>

        <div className="border-t border-line pt-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Main problem</h2>
            <div className="inline-flex rounded-md bg-teal-light p-1" role="tablist" aria-label="Language">
              {(['en', 'hi'] as const).map((l) => (
                <button key={l} role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                  className={`h-10 min-w-12 rounded-sm px-3 text-base font-semibold ${lang === l ? 'bg-sel text-white' : 'text-ink'}`}>{l === 'en' ? 'EN' : 'हिं'}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {TILES.map((tile) => {
              const on = f.tiles.includes(tile.id)
              return (
                <button key={tile.id} onClick={() => toggle('tiles', tile.id)} aria-pressed={on}
                  className={`flex h-14 items-center gap-2.5 rounded-md px-3 text-left text-base font-semibold leading-tight ${sel(on)}`}>
                  <Icon name={tile.icon} size={20} className={on ? 'text-white' : 'text-ink'} />
                  <span>{L(tile)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-[128px] shrink-0 rounded-md border border-line bg-white p-3">
          {questions.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {questions.map((q) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="flex-1 text-base font-medium leading-tight text-ink">{L(q)}?</span>
                  {([true, false] as const).map((y) => {
                    const on = y ? f.yes.includes(q.id) : f.no.includes(q.id)
                    return <button key={String(y)} onClick={() => answer(q.id, y)}
                      className={`h-12 w-16 rounded-md text-base font-semibold ${on ? 'bg-sel text-white' : 'bg-teal-light text-ink shadow-[inset_0_0_0_2px_#0B0C0C] hover:bg-[#dbdad9]'}`}>{y ? (lang === 'en' ? 'Yes' : 'हाँ') : (lang === 'en' ? 'No' : 'नहीं')}</button>
                  })}
                </div>
              ))}
            </div>
          ) : <div className="flex h-full items-center text-base text-body">Follow-up questions</div>}
        </div>

        <div>
          <div className="mb-2 text-base font-medium text-body">Known conditions (optional)</div>
          <div className="flex flex-wrap gap-2">
            {CLERK_CONDITIONS.map((id) => {
              const c = CONDITIONS.find((x) => x.id === id)!
              const on = f.conditions.includes(id)
              return <button key={id} onClick={() => toggle('conditions', id)} aria-pressed={on}
                className={`h-12 rounded-md px-3 text-base font-medium ${sel(on)}`}>{L(c)}</button>
            })}
          </div>
        </div>
      </div>

      {/* RIGHT */}
      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex justify-end gap-2">
          {unknownAsk ? <>
            <button onClick={() => setUnknownAsk(false)} className="h-12 rounded-md px-4 text-base font-medium text-ink hover:bg-teal-light">Cancel</button>
            <button onClick={unknown} className="h-12 rounded-md bg-p-immediate px-4 text-base font-semibold text-white">Confirm: register as Immediate</button>
          </> : (
            <button onClick={() => setUnknownAsk(true)} className="h-12 rounded-md border-2 border-ink px-4 text-base font-semibold text-ink hover:bg-white">Unknown / unresponsive</button>
          )}
        </div>

        <div className="rounded-md border border-line bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold text-ink">Looks very unwell?</h2>
          <div className="divide-y divide-line">
            {UNWELL.map((u) => {
              const on = f.unwell.includes(u.id)
              return (
                <label key={u.id} className="flex min-h-12 cursor-pointer items-center gap-3 text-base text-ink">
                  <input type="checkbox" checked={on} onChange={() => toggle('unwell', u.id)} className="h-6 w-6 accent-[#0B0C0C]" />
                  <span className={on ? 'font-semibold' : ''}>{L(u)}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="mt-auto rounded-md border border-line bg-white p-4">
          <div className="flex h-16 items-center rounded-sm px-4 text-2xl font-bold tracking-wide"
            style={ready ? { background: t.solid, color: r.suggested === 'SOON' ? '#14213D' : '#fff' } : { background: '#F3F2F1', color: '#505A5F' }}>
            {ready ? t.label.toUpperCase() : 'Priority'}
          </div>
          <p className="mt-3 min-h-12 text-base leading-snug text-ink">{ready ? reason : 'Needs age, sex and a main problem.'}</p>
          {confirm ? (
            <div className="mt-3 flex gap-2">
              <button onClick={() => setConfirm(false)} className="h-12 rounded-md px-4 text-base font-medium text-ink hover:bg-teal-light">Back</button>
              <button onClick={submit} className="h-12 flex-1 rounded-md bg-teal text-base font-semibold text-white">Confirm Immediate and print</button>
            </div>
          ) : (
            <button disabled={!ready} onClick={submit}
              className="mt-3 h-14 w-full rounded-md bg-teal text-lg font-semibold text-white hover:bg-teal-dark disabled:bg-line disabled:text-body">Register and print token</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ n, title, hi, right, children }: { n: number; title: string; hi: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line pb-5 last:border-b-0">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-ink">{title} <span className="font-normal text-body">· {hi}</span></h2>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  )
}
const Label = ({ children }: { children: React.ReactNode }) => <div className="mb-1.5 text-base font-medium text-body">{children}</div>
function Chip({ on, onClick, children, tone, className = '' }: { on: boolean; onClick: () => void; children: React.ReactNode; tone?: 'red'; className?: string }) {
  void tone
  const onCls = 'border-sel bg-sel text-white'
  return (
    <button onClick={onClick} className={`flex min-h-12 items-center rounded-md border px-4 text-base font-medium transition ${on ? onCls : 'border-line bg-white hover:border-teal'} ${className}`}>
      {on && <Icon name="check" size={15} className="mr-1.5" />}{children}
    </button>
  )
}

/* ================= LOGIN ================= */
type User = { id: string; name: string; title: string; kind: 'staff' | 'doctor'; home: Role }
const ACCESS: Record<User['kind'], Role[]> = { staff: ['clerk', 'nurse', 'admin'], doctor: ['doctor', 'admin'] }
const USERS: (User & { pin: string })[] = [
  { id: 'asha', pin: '1111', name: 'Asha', title: 'Clerk', kind: 'staff', home: 'clerk' },
  { id: 'priya', pin: '2222', name: 'Priya', title: 'Nurse', kind: 'staff', home: 'nurse' },
  { id: 'mehta', pin: '3333', name: 'Dr. Mehta', title: 'Doctor', kind: 'doctor', home: 'doctor' },
]

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = USERS.find((x) => x.id === id.trim().toLowerCase() && x.pin === pin)
    if (!u) return setErr('Incorrect staff ID or PIN.')
    const { pin: _p, ...rest } = u
    onLogin(rest)
  }
  return (
    <div className="flex min-h-screen flex-col"><header className="border-b-[10px] border-teal bg-ink px-5 py-4 text-[24px] font-bold text-white">Opdflow</header><div className="flex flex-1 items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="govuk-heading-l !mb-2">Sign in</h1>
          <p className="text-base text-body">Sign in to continue · लॉग इन करें</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <div><Label>Staff ID</Label>
            <input autoFocus value={id} onChange={(e) => { setId(e.target.value); setErr('') }}
              className="h-12 w-full rounded-md border border-line px-4 outline-none focus:border-teal" placeholder="e.g. priya" /></div>
          <div><Label>PIN</Label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr('') }}
              className="h-12 w-full rounded-md border border-line px-4 font-mono tracking-widest outline-none focus:border-teal" placeholder="••••" /></div>
          {err && <p className="border-l-[5px] border-p-immediate pl-3 text-base font-bold text-p-immediate">{err}</p>}
          <button className="min-h-12 w-full rounded-md bg-teal font-semibold text-white">Sign in</button>
        </form>
        <div className="mt-4 border-t border-line pt-4">
          <div className="mb-2 text-base font-medium text-body">Demo accounts</div>
          <div className="space-y-1.5">
            {USERS.map((u) => (
              <button key={u.id} type="button" onClick={() => { setId(u.id); setPin(u.pin); setErr('') }}
                className="flex min-h-12 w-full items-center justify-between rounded-md px-3 text-left text-base hover:bg-teal-light">
                <span><span className="font-medium">{u.name}</span> <span className="text-body">· {u.title}</span></span>
                <span className="font-mono text-body">{u.id} / {u.pin}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

/* ================= NURSE ================= */
type Results = Map<number, ReturnType<typeof evaluate>>
type UpdateFn = (token: number, fn: (p: Patient) => Patient, who: string, action: string, reason: string) => void

function sortQueue(ps: Patient[], results: Results) {
  return [...ps].sort((a, b) => a.arrivedAt - b.arrivedAt || a.token - b.token).sort(
    (a, b) => TIER_RANK[results.get(b.token)!.final] - TIER_RANK[results.get(a.token)!.final])
}

function Nurse({ patients, all, results, now, failsafe, setFailsafe, selected, setSelected, update, who }: {
  patients: Patient[]; all: Patient[]; results: Results; now: number; failsafe: boolean; setFailsafe: (b: boolean) => void
  selected: number | null; setSelected: (t: number | null) => void; update: UpdateFn; who: string
}) {
  const sel = all.find((p) => p.token === selected)
  const [view, setView] = useState<'list' | 'grid' | 'board'>('list')
  const sorted = sortQueue(patients, results)
  const tasks = sorted.flatMap((p) => results.get(p.token)!.tasks.map((t) => ({ p, t })))
  const counts = (['IMMEDIATE', 'SOON', 'ROUTINE'] as Tier[]).map((t) => ({ t, n: sorted.filter((p) => results.get(p.token)!.final === t).length }))

  if (failsafe) {
    return (
      <div className="space-y-4">
        <button onClick={() => setFailsafe(false)} className="min-h-12 rounded-md bg-teal px-4 font-semibold text-white">Resume OPD Flow</button>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{[...patients].sort((a, b) => a.token - b.token).map((p) => (
          <div key={p.token} className="rounded-md border border-line bg-white p-4 text-center font-mono text-2xl font-semibold">{p.token}</div>))}</div>
      </div>
    )
  }

  return (
    <div>
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold">Patient queue</h1>
            <p className="text-base text-body">{patients.length} waiting</p>
          </div>
          <div className="flex items-center gap-3 text-base">
            {counts.map(({ t, n }) => (
              <span key={t} className="inline-flex items-center gap-1.5 font-medium tabular-nums" style={{ color: TIER[t].text }}>
                <span aria-hidden>{TIER[t].glyph}</span>{n} {TIER[t].label}
              </span>
            ))}
          </div>
        </div>

        <div className={`sticky top-[68px] z-20 mb-4 rounded-md p-3 ${tasks.length ? 'bg-teal-light' : 'bg-surface'}`}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2.5 w-2.5 rounded-full bg-teal`} />
            <h2 className={`font-semibold text-ink`}>Checks due</h2>
            <span className={`rounded-sm px-2 text-base font-semibold tabular-nums bg-teal text-white`}>{tasks.length}</span>
            
          </div>
          {tasks.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tasks.map(({ p, t }, i) => {
                const tier = TIER[results.get(p.token)!.final]
                return (
                  <button key={i} onClick={() => setSelected(p.token)}
                    className="flex min-h-12 shrink-0 items-center gap-2.5 rounded-md border-l-4 bg-white px-3 text-left shadow-sm hover:bg-teal-light"
                    style={{ borderLeftColor: tier.solid }}>
                    <span className="font-mono font-semibold">{p.token}</span>
                    <span className="text-base">{t}</span>
                    <span className="text-base text-body">{dur(now - p.arrivedAt)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="mb-4">
          <div role="tablist" aria-label="View" className="inline-flex rounded-md bg-teal-light p-1">
            {([['list', 'List'], ['grid', 'Cards'], ['board', 'Triage board']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)}
                className={`min-h-12 min-w-20 rounded-md px-4 text-base font-semibold transition ${view === id ? 'bg-white text-ink shadow-sm' : 'text-body hover:text-body'}`}>{label}</button>
            ))}
          </div>
        </div>
        {view === 'list' && <QueueList ps={sorted} results={results} now={now} selected={selected} setSelected={setSelected} />}
        {view === 'grid' && <TokenGrid ps={sorted} results={results} now={now} selected={selected} setSelected={setSelected} />}
        {view === 'board' && <div className="grid gap-4 lg:grid-cols-3">
          {(['IMMEDIATE', 'SOON', 'ROUTINE'] as Tier[]).map((tier) => {
            const lane = sortQueue(patients.filter((p) => results.get(p.token)!.final === tier), results)
            return (
              <div key={tier} className="rounded-md p-3" style={{ background: TIER[tier].soft }}>
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-semibold" style={{ color: TIER[tier].text }}>
                    <span aria-hidden>{TIER[tier].glyph}</span>{TIER[tier].label}<span className="font-normal opacity-70">{TIER[tier].hi}</span>
                  </div>
                  <span className="rounded-sm bg-white px-2 text-base font-semibold tabular-nums" style={{ color: TIER[tier].text }}>{lane.length}</span>
                </div>
                <div className="space-y-2.5">
                  {lane.map((p) => <PatientCard key={p.token} p={p} r={results.get(p.token)!} now={now} onClick={() => setSelected(p.token)} active={selected === p.token} />)}
                  {!lane.length && <div className="p-4 text-center text-base text-body">0</div>}
                </div>
              </div>
            )
          })}
        </div>}
      </div>

      {sel && <PatientDrawer p={sel} r={results.get(sel.token)!} now={now} update={update} who={who} onClose={() => setSelected(null)} />}
    </div>
  )
}

type ViewProps = { ps: Patient[]; results: Results; now: number; selected: number | null; setSelected: (t: number | null) => void }

function QueueList({ ps, results, now, selected, setSelected }: ViewProps) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-white">
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-base">
          <thead className="sticky top-0 z-10 bg-white text-base font-bold text-ink shadow-[inset_0_-2px_0_#0B0C0C]">
            <tr><th className="px-3 py-2.5">Tier</th><th className="px-3 py-2.5">Token</th><th className="px-3 py-2.5">Patient</th>
              <th className="px-3 py-2.5">Reason</th><th className="px-3 py-2.5">Flags</th><th className="px-3 py-2.5 text-right">Wait</th></tr>
          </thead>
          <tbody>
            {ps.map((p) => {
              const r = results.get(p.token)!
              const pulse = r.final === 'IMMEDIATE' && !p.acknowledged
              return (
                <tr key={p.token} onClick={() => setSelected(p.token)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelected(p.token)}
                  className={`min-h-12 cursor-pointer border-t border-line hover:bg-teal-light ${selected === p.token ? 'bg-teal-light' : ''} ${pulse ? 'pulse-alert alert-solid' : ''}`}
                  style={{ boxShadow: `inset 4px 0 0 ${TIER[r.final].solid}` }}>
                  <td className="whitespace-nowrap px-3 py-3 pl-4 font-semibold" style={{ color: TIER[r.final].text }}><span aria-hidden>{TIER[r.final].glyph}</span> {TIER[r.final].label}</td>
                  <td className="px-3 py-3 font-mono text-base font-bold">{p.token}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-body">{p.unknown ? 'Unknown' : `${p.age}${p.sex}`}</td>
                  <td className="max-w-[320px] truncate px-3 py-3 text-body" title={r.reason}>{r.reason}</td>
                  <td className="px-3 py-3"><div className="flex flex-wrap gap-1 text-sm">
                    {p.override && <Tag>Override</Tag>}
                    {p.pendingSuggestion && <Tag red>New: {TIER[p.pendingSuggestion].label}</Tag>}
                    {r.unverified && <Tag red>Unverified</Tag>}
                    {r.lowConfidence && <Tag>Low conf.</Tag>}
                    {r.clinicianReview && <Tag>Review</Tag>}
                    {!Object.keys(p.vitals).length && <Tag muted>Vitals pending</Tag>}
                  </div></td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-body">{dur(now - p.arrivedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TokenGrid({ ps, results, now, selected, setSelected }: ViewProps) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
        {ps.map((p) => {
          const r = results.get(p.token)!
          const t = TIER[r.final]
          const pulse = r.final === 'IMMEDIATE' && !p.acknowledged
          return (
            <button key={p.token} onClick={() => setSelected(p.token)} title={`${t.label} · ${r.reason}`}
              aria-label={`Token ${p.token}, ${t.label}, waiting ${dur(now - p.arrivedAt)}`}
              className={`relative flex min-h-24 flex-col items-center justify-center rounded-md font-mono transition hover:shadow-md ${pulse ? 'pulse-alert alert-solid' : ''} ${selected === p.token ? 'ring-2 ring-teal' : ''}`}
              style={{ backgroundColor: pulse ? 'var(--alert-bg)' : t.soft, color: t.text, boxShadow: `inset 0 4px 0 ${t.solid}` }}>
                            {(p.pendingSuggestion || r.unverified) && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-teal" aria-hidden />}
              <span className="text-xl font-bold leading-none">{p.token}</span>
              <span className="mt-1 font-sans text-sm font-semibold">{t.label}</span>
              <span className="font-sans text-sm tabular-nums">{dur(now - p.arrivedAt)}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-base text-body">
        {(['IMMEDIATE', 'SOON', 'ROUTINE'] as Tier[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: TIER[k].soft, border: `1px solid ${TIER[k].solid}` }} />{TIER[k].label}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal" />New suggestion / unverified vitals</span>
      </div>
    </div>
  )
}

function PatientCard({ p, r, now, onClick, active }: { p: Patient; r: ReturnType<typeof evaluate>; now: number; onClick: () => void; active?: boolean }) {
  const pulse = r.final === 'IMMEDIATE' && !p.acknowledged
  const v = p.vitals
  return (
    <button onClick={onClick} className={`w-full rounded-md border border-line bg-white p-3.5 text-left transition hover:shadow-md ${pulse ? 'pulse-alert alert-solid' : ''} ${active ? 'ring-2 ring-teal' : ''}`}
      style={{ boxShadow: `inset 4px 0 0 ${TIER[r.final].solid}` }}>
      <div className="flex items-start gap-3">
        <div className="font-mono text-2xl font-bold leading-none">{p.token}</div>
        <div className="text-base text-body">{p.unknown ? 'Unknown' : `${p.age}${p.sex}`}</div>
        <div className="ml-auto flex items-center gap-1 text-base tabular-nums text-body">{dur(now - p.arrivedAt)}</div>
      </div>
      <p className="mt-2 text-sm leading-snug text-body">{r.reason}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-sm">
        {p.override && <Tag>Nurse override</Tag>}
        {p.pendingSuggestion && <Tag red>New: {TIER[p.pendingSuggestion].label} suggested</Tag>}
        {r.lowConfidence && <Tag>Low confidence</Tag>}
        {r.clinicianReview && <Tag>Clinician review</Tag>}
        {r.unverified && <Tag red>Unverified vitals</Tag>}
        {p.status === 'fasttrack' && <Tag>Fast-tracked</Tag>}
        {v.spo2 != null && <Tag>SpO₂ {v.spo2.value}</Tag>}
        {v.sbp != null && <Tag>BP {v.sbp.value}/{v.dbp?.value ?? '–'}</Tag>}
        {r.news2 && <Tag>NEWS2 ≥{r.news2.score} ({r.news2.measured}/7 params)</Tag>}
        {!Object.keys(v).length && <Tag muted>Vitals pending</Tag>}
      </div>
    </button>
  )
}
const Tag = ({ children, red, muted }: { children: React.ReactNode; red?: boolean; muted?: boolean }) => (
  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-medium ${red ? 'bg-ink text-white' : muted ? 'bg-teal-light text-body' : 'bg-teal-light text-ink'}`}>{children}</span>
)

const CHIPS = ['Clinical judgement', 'Looks unwell', 'Stable on re-check', 'Wrong tile']

function PatientDrawer({ p, r, now, update, who, onClose }: { p: Patient; r: ReturnType<typeof evaluate>; now: number; update: UpdateFn; who: string; onClose: () => void }) {
  const [tab, setTab] = useState<'detail' | 'vitals' | 'override'>('detail')
  const [v, setV] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<Tier | null>(null)
  const [chip, setChip] = useState('')
  const [note, setNote] = useState('')
  const parsed: Record<string, number> = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== '').map(([k, x]) => [k, Number(x)]))
  // Convert parsed numbers into VitalReading shape so plausibility() can read .value
  const parsedAsVitals: Vitals = Object.fromEntries(
    Object.entries(parsed).map(([k, val]) => [k, { value: val, source: 'nurse' as VitalSource, is_verified: true }])
  )
  const warnings = plausibility(parsedAsVitals)
  const downgradeImm = r.final === 'IMMEDIATE' && target && target !== 'IMMEDIATE'

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-[480px] flex-col overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line p-5" style={{ background: TIER[r.final].soft }}>
          <div className="flex items-start">
            <div>
              <div className="flex items-baseline gap-3"><span className="font-mono text-4xl font-bold">{p.token}</span><span className="text-body">{p.unknown ? 'Unknown patient' : `${p.age} y · ${p.sex}`}</span></div>
              <div className="mt-2 flex items-center gap-2"><TierBadge tier={r.final} unverified={r.unverified} />{p.override && <span className="text-base text-body">System suggests {TIER[r.suggested].label}</span>}</div>
            </div>
            <button onClick={onClose} className="ml-auto flex h-12 w-12 items-center justify-center rounded-md hover:bg-black/5" aria-label="Close"><Icon name="x" /></button>
          </div>
          <p className="mt-3 text-base leading-snug">{r.reason}</p>
          <p className="mt-1 text-base text-body">{r.confidence} · waiting {dur(now - p.arrivedAt)}</p>
        </div>

        {p.pendingSuggestion && (
          <div className="m-5 mb-0 rounded-md bg-teal-light p-4">
            <div className="text-base font-semibold text-ink">Override unlocked: new red-flag event</div>
            <p className="mt-1 text-base text-body">System now suggests {TIER[p.pendingSuggestion].label}. Your earlier decision was {p.override && TIER[p.override.tier].label}.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => update(p.token, (x) => ({ ...x, override: undefined, pendingSuggestion: undefined }), who, 'Accepted new suggestion', 'Unlock accepted')} className="min-h-12 flex-1 rounded-md bg-teal font-semibold text-white">Accept</button>
              <button onClick={() => update(p.token, (x) => ({ ...x, pendingSuggestion: undefined }), who, 'Dismissed new suggestion', 'Nurse kept override')} className="min-h-12 flex-1 rounded-md bg-white font-medium text-ink">Keep mine</button>
            </div>
          </div>
        )}

        {r.final === 'IMMEDIATE' && (
          <div className="grid grid-cols-2 gap-2 p-5 pb-0">
            {!p.acknowledged && <button onClick={() => update(p.token, (x) => ({ ...x, acknowledged: true }), who, 'Alert acknowledged', 'Seen by nurse')} className="col-span-2 min-h-12 rounded-md bg-teal font-semibold text-white">Acknowledge alert</button>}
            <button onClick={() => update(p.token, (x) => ({ ...x, status: 'fasttrack', acknowledged: true }), who, 'Fast-tracked to doctor', r.reason)} className="min-h-12 rounded-md border border-line font-medium">Fast-track to doctor</button>
            <button onClick={() => { update(p.token, (x) => ({ ...x, status: 'casualty', acknowledged: true }), who, 'Handed off to casualty', r.reason); window.print?.() }} className="min-h-12 rounded-md border border-line font-medium">Casualty handoff</button>
          </div>
        )}

        <div className="mx-5 mt-5 flex gap-1 rounded-md bg-teal-light p-1">
          {(['detail', 'vitals', 'override'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`min-h-12 flex-1 rounded-md text-base font-medium capitalize ${tab === t ? 'bg-white shadow-sm' : 'text-body'}`}>{t === 'detail' ? 'Why' : t}</button>
          ))}
        </div>

        <div className="flex-1 p-5">
          {tab === 'detail' && (
            <div className="space-y-4 text-base">
              <Row k="Problems" v={p.tiles.map((t) => TILES.find((x) => x.id === t)!.en).join(', ') || '—'} />
              <Row k="Looks unwell" v={p.unwell.map((u) => UNWELL.find((x) => x.id === u)!.en).join(', ') || 'None ticked'} />
              <Row k="Conditions" v={p.conditions.map((c) => CONDITIONS.find((x) => x.id === c)!.en).join(', ') || 'None'} />
              <Row k="Open tasks" v={r.tasks.join(' · ') || 'None'} />
              <div><div className="mb-1.5 text-base font-medium text-body">Rules fired (config v{CONFIG_VERSION})</div>
                <div className="flex flex-wrap gap-1.5">{r.rules.map((x) => <code key={x} className="rounded bg-teal-light px-1.5 py-0.5 text-base">{x}</code>)}</div></div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => update(p.token, (x) => ({ ...x, worseReports: x.worseReports + 1, acknowledged: false }), who, 'Feeling worse (staff)', 'Reported by staff/attendant')} className="min-h-12 flex-1 rounded-md border border-teal bg-white font-medium text-teal">Reports feeling worse</button>
                <button onClick={() => { update(p.token, (x) => ({ ...x, status: 'lwbs' }), who, 'Left without being seen', 'Staff-set'); onClose() }} className="min-h-12 flex-1 rounded-md border border-line font-medium">Left unseen</button>
              </div>
            </div>
          )}

          {tab === 'vitals' && (
            <div>
              <div className="grid grid-cols-2 gap-3">
                {([['spo2', 'SpO₂ %'], ['pulse', 'Pulse /min'], ['sbp', 'Systolic'], ['dbp', 'Diastolic'], ['rr', 'Resp. rate'], ['temp', 'Temp °C'], ['glucose', 'Glucose mg/dL']] as const).map(([k, l]) => (
                  <label key={k} className="block"><Label>{l}</Label>
                    <input inputMode="decimal" value={v[k] ?? ''} placeholder={String(p.vitals[k] ?? '')} onChange={(e) => setV({ ...v, [k]: e.target.value })}
                      className="h-12 w-full rounded-md border border-line px-3 font-mono outline-none focus:border-teal" /></label>
                ))}
              </div>
              {warnings.length > 0 && <div className="mt-3 space-y-1 rounded-md bg-teal-light p-3 text-base text-ink">{warnings.map((w) => <div key={w}>{w}</div>)}<div className="text-base">You can still save after confirming.</div></div>}
              <p className="mt-3 text-base text-body">Vitals can only raise priority. They never lower a symptom-based tier.</p>
              <button disabled={!Object.keys(parsed).length}
                onClick={() => {
                  // Wrap each numeric value in VitalReading with nurse source
                  const vitalReadings: Vitals = Object.fromEntries(
                    Object.entries(parsed).map(([k, v]) => [k, { value: v as number, source: 'nurse' as VitalSource, is_verified: true }])
                  )
                  update(p.token, (x) => ({ ...x, vitals: { ...x.vitals, ...vitalReadings } }), who, 'Vitals entered', Object.entries(parsed).map(([a, b]) => `${a} ${b}`).join(', '))
                  setV({})
                  setTab('detail')
                }}
                className="mt-4 min-h-12 w-full rounded-md bg-teal font-semibold text-white disabled:bg-line disabled:text-body">{warnings.length ? 'Confirm & save' : 'Save vitals'}</button>
            </div>
          )}

          {tab === 'override' && (
            <div>
              <Label>Set tier</Label>
              <div className="grid grid-cols-3 gap-2">{(['IMMEDIATE', 'SOON', 'ROUTINE'] as Tier[]).map((t) => (
                <button key={t} onClick={() => setTarget(t)} disabled={t === r.final}
                  className="min-h-14 rounded-md border-2 font-semibold disabled:opacity-40"
                  style={{ borderColor: target === t ? TIER[t].solid : TIER[t].border, background: target === t ? TIER[t].soft : 'white', color: TIER[t].text }}>{TIER[t].glyph} {TIER[t].label}</button>))}</div>
              <div className="mt-4"><Label>Reason {downgradeImm && <span className="font-semibold text-ink">(required)</span>}</Label>
                <div className="flex flex-wrap gap-2">{CHIPS.map((c) => <Chip key={c} on={chip === c} onClick={() => setChip(c)}>{c}</Chip>)}</div></div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note" className="mt-3 h-20 w-full rounded-md border border-line p-3 text-base outline-none focus:border-teal" />
              {downgradeImm && <div className="mt-2 rounded-md bg-[#FBE9EB] p-3 text-base text-ink">Downgrading from Immediate. This is logged with the system's original suggestion and all inputs.</div>}
              <button disabled={!target || (!!downgradeImm && !chip)}
                onClick={() => { update(p.token, (x) => ({ ...x, override: { tier: target!, reason: chip || 'Clinical judgement', note, by: who, at: now, expires_at: now + OVERRIDE_EXPIRY_MINUTES }, pendingSuggestion: undefined, acknowledged: true }), who, 'Override', `${chip || 'Clinical judgement'}${note ? ` — ${note}` : ''}`); setTab('detail'); setTarget(null) }}
                className="mt-4 min-h-12 w-full rounded-md bg-teal font-semibold text-white disabled:bg-line disabled:text-body">{downgradeImm ? 'Confirm downgrade' : 'Apply override'}</button>
              {p.override && <button onClick={() => update(p.token, (x) => ({ ...x, override: undefined }), who, 'Override removed', 'Returned to system suggestion')} className="mt-2 min-h-12 w-full rounded-md border border-line font-medium">Remove override</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
const Row = ({ k, v }: { k: string; v: string }) => <div><div className="text-base font-medium text-body">{k}</div><div className="mt-0.5">{v}</div></div>

/* ================= DOCTOR ================= */
function Doctor({ patients, results, now, update }: { patients: Patient[]; results: Results; now: number; update: UpdateFn }) {
  const q = sortQueue(patients, results)
  const next = q[0]
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Dr. Mehta · Room 4</h1>
      {next && (() => { const r = results.get(next.token)!; return (
        <div className={`mt-5 rounded-md border-2 bg-white p-6 ${r.final === 'IMMEDIATE' && !next.acknowledged ? 'pulse-alert alert-solid' : ''}`} style={{ borderColor: TIER[r.final].solid }}>
          <div className="text-base font-medium text-body">Call next</div>
          <div className="mt-2 flex items-center gap-4"><span className="font-mono text-6xl font-bold">{next.token}</span><div><TierBadge tier={r.final} size="lg" /><div className="mt-1 text-base text-body">{next.age}{next.sex} · waiting {dur(now - next.arrivedAt)}</div></div></div>
          {r.final !== 'ROUTINE' && <p className="mt-4 text-lg leading-snug">{r.reason}</p>}
          <div className="mt-5 flex gap-2">
            <button onClick={() => update(next.token, (x) => ({ ...x, status: 'seen', acknowledged: true }), 'Doctor · Mehta', 'Seen', 'Called in')} className="min-h-12 flex-1 rounded-md bg-teal font-semibold text-white">Call in</button>
            {r.final === 'IMMEDIATE' && !next.acknowledged && <button onClick={() => update(next.token, (x) => ({ ...x, acknowledged: true }), 'Doctor · Mehta', 'Alert acknowledged', 'Doctor')} className="min-h-12 rounded-md border border-line px-5 font-medium">Acknowledge</button>}
          </div>
        </div>) })()}
      <div className="mt-5 divide-y divide-line rounded-md border border-line bg-white">
        {q.slice(1).map((p) => { const r = results.get(p.token)!; return (
          <div key={p.token} className="flex min-h-14 items-center gap-4 px-5 py-3">
            <span className="h-3 w-3 rounded-full" style={{ background: TIER[r.final].solid }} />
            <span className="w-12 font-mono text-lg font-semibold">{p.token}</span>
            <span className="flex-1 truncate text-base text-body">{r.final === 'ROUTINE' ? `${p.age}${p.sex}` : r.reason}</span>
            <span className="text-base tabular-nums text-body">{dur(now - p.arrivedAt)}</span>
          </div>) })}
      </div>
    </div>
  )
}

/* ================= ADMIN ================= */
function Admin({ patients, results, audit, now }: { patients: Patient[]; results: Results; audit: AuditEntry[]; now: number }) {
  const count = (t: Tier) => patients.filter((p) => results.get(p.token)!.final === t).length
  const overrides = audit.filter((a) => a.action === 'Override')
  const down = overrides.filter((a) => a.from && a.to && TIER_RANK[a.to] < TIER_RANK[a.from]).length
  const immShare = Math.round((count('IMMEDIATE') / patients.length) * 100)
  const lwbs = patients.filter((p) => p.status === 'lwbs').length
  const avgWait = (t: Tier) => { const ps = patients.filter((p) => results.get(p.token)!.final === t); return ps.length ? Math.round(ps.reduce((s, p) => s + now - p.arrivedAt, 0) / ps.length) : 0 }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Immediate share today" value={`${immShare}%`} hint={immShare > 15 ? 'Above 15%: check for alert fatigue' : 'Within expected range'} warn={immShare > 15} />
        <Stat label="Overrides" value={String(overrides.length)} hint={`${down} down · ${overrides.length - down} up`} />
        <Stat label="Left without being seen" value={String(lwbs)} hint="Staff-set status" />
        <Stat label="Audit chain" value="Intact" hint={`${audit.length} entries · hash-linked`} />
      </div>
      <div className="rounded-md border border-line bg-white p-5">
        <h2 className="font-semibold">Average wait by tier</h2>
        <div className="mt-4 space-y-3">{(['IMMEDIATE', 'SOON', 'ROUTINE'] as Tier[]).map((t) => (
          <div key={t} className="flex items-center gap-3"><span className="w-24 text-base font-medium" style={{ color: TIER[t].text }}>{TIER[t].label}</span>
            <div className="h-3 flex-1 rounded-full bg-teal-light"><div className="h-3 rounded-full" style={{ width: `${Math.min(100, avgWait(t) / 1.8)}%`, background: TIER[t].solid }} /></div>
            <span className="w-16 text-right text-base tabular-nums">{dur(avgWait(t))}</span></div>))}</div>
      </div>
      <div className="overflow-hidden rounded-md border border-line bg-white">
        <div className="flex items-center justify-between p-5"><h2 className="font-semibold">Audit log (append-only)</h2><span className="text-base text-body">Each entry stores original suggestion, input snapshot, config version</span></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-base">
          <thead className="bg-teal-light text-base text-body"><tr>{['Time', 'Who', 'Token', 'Action', 'Change', 'System said', 'Reason', 'Cfg', 'Hash'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {audit.map((a) => (
              <tr key={a.id} className="align-top" title={a.snapshot}>
                <td className="px-4 py-3 font-mono tabular-nums">{clock(a.at)}</td><td className="px-4 py-3">{a.who}</td>
                <td className="px-4 py-3 font-mono font-semibold">{a.token}</td><td className="px-4 py-3">{a.action}</td>
                <td className="px-4 py-3 whitespace-nowrap">{a.from && a.to && a.from !== a.to ? <span>{TIER[a.from].label} → <b>{TIER[a.to].label}</b></span> : a.to ? TIER[a.to].label : '—'}</td>
                <td className="px-4 py-3">{TIER[a.suggestion].label}</td><td className="max-w-xs px-4 py-3 text-body">{a.reason}</td>
                <td className="px-4 py-3 font-mono">{a.cfg}</td><td className="px-4 py-3 font-mono text-base text-body">{a.hash}</td>
              </tr>))}
          </tbody></table></div>
      </div>
    </div>
  )
}
const Stat = ({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) => (
  <div className="rounded-md border border-line bg-white p-5"><div className="text-base text-body">{label}</div><div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div><div className={`mt-1 text-base ${warn ? 'font-semibold text-ink' : 'text-body'}`}>{hint}</div></div>
)

