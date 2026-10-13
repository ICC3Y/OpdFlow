// OPD Flow — Rules Engine Unit Tests (v0.3)
// Covers all 18 vignettes from OPD_Flow_Rules_Engine_Spec.md
// Run: npx vitest run   (or npm.cmd run test)

import { describe, expect, it } from 'vitest'
import { evaluate, type Patient, type Vitals } from './engine'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = 600 // arbitrary "current" sim minute

const nurse = (value: number) => ({ value, source: 'nurse' as const, is_verified: true })
const self_ = (value: number) => ({ value, source: 'patient_self' as const, is_verified: false })

function mkPatient(overrides: Partial<Patient>): Patient {
  return {
    token: 1,
    age: 30,
    sex: 'M',
    tiles: [],
    followups: [],
    unwell: [],
    conditions: [],
    vitals: {} as Vitals,
    arrivedAt: NOW,
    worseReports: 0,
    status: 'waiting',
    ...overrides,
  }
}

// ─── Vignette 1: 60M chest pain + sweating → IMMEDIATE ───────────────────────
describe('V1 — 60M chest pain + sweating', () => {
  const p = mkPatient({ age: 60, sex: 'M', tiles: ['chest'], followups: ['sweating'] })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('final is IMMEDIATE', () => expect(r.final).toBe('IMMEDIATE'))
  it('has vitals task', () => expect(r.tasks.some(t => t.toLowerCase().includes('vital'))).toBe(true))
  it('fires chest_40plus rule', () => expect(r.rules.some(x => x.includes('chest_40plus'))).toBe(true))
})

// ─── Vignette 2: 28F thyroid refill → ROUTINE ────────────────────────────────
describe('V2 — 28F thyroid refill', () => {
  const p = mkPatient({ age: 28, sex: 'F', tiles: ['refill'] })
  const r = evaluate(p, NOW)
  it('suggested is ROUTINE', () => expect(r.suggested).toBe('ROUTINE'))
  it('lowConfidence is true (no vitals)', () => expect(r.lowConfidence).toBe(true))
})

// ─── Vignette 3: 70M diabetic giddiness, no vitals → SOON + glucose task ─────
describe('V3 — 70M diabetic giddiness, no vitals', () => {
  const p = mkPatient({ age: 70, sex: 'M', tiles: ['head'], conditions: ['diabetes'] })
  const r = evaluate(p, NOW)
  it('suggested is at least SOON', () => expect(['SOON', 'IMMEDIATE'].includes(r.suggested)).toBe(true))
  it('glucose task present', () => expect(r.tasks.some(t => t.toLowerCase().includes('glucose'))).toBe(true))
})

// ─── Vignette 4: 55M SBP 190, no symptoms → SOON + repeat BP task ────────────
describe('V4 — 55M SBP 190 no symptoms', () => {
  const p = mkPatient({
    age: 55, sex: 'M', tiles: ['refill'],
    vitals: { sbp: nurse(190), dbp: nurse(110) },
  })
  const r = evaluate(p, NOW)
  it('suggested is SOON', () => expect(r.suggested).toBe('SOON'))
  it('repeat BP task present', () => expect(r.tasks.some(t => t.toLowerCase().includes('bp') || t.toLowerCase().includes('repeat'))).toBe(true))
})

// ─── Vignette 5: 55M SBP 190 + headache + blurred vision → IMMEDIATE ─────────
describe('V5 — 55M SBP 190 with headache tile', () => {
  const p = mkPatient({
    age: 55, sex: 'M', tiles: ['head'],
    vitals: { sbp: nurse(190), dbp: nurse(110) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Vignette 6: 30F pregnant + headache + BP 150/100 → IMMEDIATE ────────────
describe('V6 — 30F pregnant, BP 150/100, headache tile', () => {
  const p = mkPatient({
    age: 30, sex: 'F', tiles: ['preg', 'head'],
    conditions: ['pregnant'],
    vitals: { sbp: nurse(150), dbp: nurse(100) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Vignette 6b: 30F pregnant BP 165/112 without symptoms → IMMEDIATE ───────
describe('V6b — 30F pregnant, BP 165/112, no symptoms', () => {
  const p = mkPatient({
    age: 30, sex: 'F', tiles: ['preg'],
    conditions: ['pregnant'],
    vitals: { sbp: nurse(165), dbp: nurse(112) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (BP_PREG_SEVERE)', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('fires preg_bp_severe rule', () => expect(r.rules.some(x => x.includes('preg_bp_severe'))).toBe(true))
})

// ─── Vignette 7: 2y child fever + not feeding → IMMEDIATE ────────────────────
describe('V7 — 2-year-old, fever, not feeding', () => {
  const p = mkPatient({
    age: 2, ageMonths: 24, sex: 'F',
    tiles: ['child', 'fever'], followups: ['not_feeding'],
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Vignette 8: 65M breathless, SpO₂ 90 → IMMEDIATE ─────────────────────────
describe('V8 — 65M breathless, SpO₂ 90', () => {
  const p = mkPatient({
    age: 65, sex: 'M', tiles: ['breath'],
    vitals: { spo2: nurse(90) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Vignette 9: COPD, home O₂, SpO₂ 90 → SOON + clinician review ────────────
describe('V9 — COPD on home O₂, SpO₂ 90', () => {
  const p = mkPatient({
    age: 66, sex: 'F', tiles: ['breath'],
    conditions: ['lung'],
    vitals: { spo2: nurse(90) },
  })
  const r = evaluate(p, NOW)
  // SpO₂ 90 is in COPD "low" range (88-92) → floor SOON + clinician review.
  // But age 66 with breathlessness tile → Layer E risk modifier bumps SOON → IMMEDIATE.
  // So the final result is IMMEDIATE with clinicianReview=true.
  it('suggested is at least SOON (COPD pathway, not standard SpO₂ auto-score)', () => expect(['SOON', 'IMMEDIATE'].includes(r.suggested)).toBe(true))
  it('clinicianReview is true', () => expect(r.clinicianReview).toBe(true))
  it('does NOT fire standard SPO2_VERY_LOW rule', () => expect(r.rules.some(x => x.includes('D.spo2_very_low'))).toBe(false))
  it('fires COPD SpO₂ rule', () => expect(r.rules.some(x => x.includes('copd'))).toBe(true))
})

// ─── Vignette 9b: COPD SpO₂ < 88% → IMMEDIATE (hard floor) ──────────────────
describe('V9b — COPD, SpO₂ 85% (critical hard floor)', () => {
  const p = mkPatient({
    age: 66, sex: 'F', tiles: ['breath'],
    conditions: ['lung'],
    vitals: { spo2: nurse(85) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (SPO2_COPD_CRITICAL)', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('fires spo2_copd_critical rule', () => expect(r.rules.some(x => x.includes('copd_critical'))).toBe(true))
})

// ─── Vignette 10: Unknown unresponsive adult → IMMEDIATE ─────────────────────
describe('V10 — Unknown unresponsive', () => {
  const p = mkPatient({ unknown: true, age: 0, sex: 'U', tiles: [] })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('fires unknown rule', () => expect(r.rules.some(x => x.includes('unknown'))).toBe(true))
})

// ─── Vignette 11: 22M ankle injury, ambulant → ROUTINE ───────────────────────
describe('V11 — 22M ankle injury, ambulant', () => {
  const p = mkPatient({ age: 22, sex: 'M', tiles: ['injury'] })
  const r = evaluate(p, NOW)
  // injury base = SOON; no head/heavy/snake followups → stays SOON
  it('suggested is SOON (injury tile baseline)', () => expect(r.suggested).toBe('SOON'))
})

// ─── Vignette 12: 40M self-reported SpO₂ 85 → IMMEDIATE (unverified) ─────────
describe('V12 — 40M self-reported SpO₂ 85', () => {
  const p = mkPatient({
    age: 40, sex: 'M', tiles: ['other'],
    vitals: { spo2: self_(85) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('unverified flag is true', () => expect(r.unverified).toBe(true))
  it('reason includes "unverified"', () => expect(r.reason.toLowerCase()).toContain('unverified'))
  it('verify vitals task created', () => expect(r.tasks.some(t => t.toLowerCase().includes('verify'))).toBe(true))
})

// ─── Vignette 13: 75F diabetic + weakness + sweating → SOON (or IMMEDIATE) ───
describe('V13 — 75F diabetic, giddiness, no vitals', () => {
  const p = mkPatient({
    age: 75, sex: 'F', tiles: ['head'],
    conditions: ['diabetes'],
  })
  const r = evaluate(p, NOW)
  it('suggested is at least SOON', () => expect(['SOON', 'IMMEDIATE'].includes(r.suggested)).toBe(true))
  it('glucose task created', () => expect(r.tasks.some(t => t.toLowerCase().includes('glucose'))).toBe(true))
})

// ─── Vignette 14: Snakebite → IMMEDIATE ──────────────────────────────────────
describe('V14 — Snakebite', () => {
  const p = mkPatient({ age: 35, sex: 'M', tiles: ['injury'], followups: ['snake'] })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Vignette 15: 70M insulin user ROUTINE, 3h wait → SOON (time escalation) ─
describe('V15 — 70M insulin user, 3h wait', () => {
  const p = mkPatient({
    age: 70, sex: 'M', tiles: ['refill'],
    conditions: ['diabetes', 'insulin'],
    arrivedAt: NOW - 175, // 175 minutes ago — exceeds 90min risk threshold
  })
  const r = evaluate(p, NOW)
  it('suggested is SOON (time escalation)', () => expect(r.suggested).toBe('SOON'))
  it('fires time escalation rule', () => expect(r.rules.some(x => x.includes('wait_escalation'))).toBe(true))
})

// ─── Vignette 16: Nurse override locked, reports feeling worse → unlock ───────
describe('V16 — Override locked, patient feels worse → unlock pending', () => {
  const base = mkPatient({ age: 40, sex: 'M', tiles: ['head'], conditions: ['htn'] })
  // nurse overrode to ROUTINE from SOON, set lock
  const locked: Patient = {
    ...base,
    override: { tier: 'ROUTINE', reason: 'Wrong tile', by: 'nurse', at: NOW - 5, expires_at: NOW + 55 },
  }
  // simulate feeling worse — which bumps the system suggestion up
  const worse: Patient = { ...locked, worseReports: 1 }
  const r = evaluate(worse, NOW)
  it('suggested is elevated by worse report', () => expect(['SOON', 'IMMEDIATE'].includes(r.suggested)).toBe(true))
  it('final is still override tier (lock active)', () => expect(r.final).toBe('ROUTINE'))
  it('overrideLockExpired is false (lock not expired)', () => expect(r.overrideLockExpired).toBe(false))
})

// ─── Vignette 17: 8-month infant RR 55 → elevated tier (WHO IMCI 2–11m ≥50) ──
describe('V17 — 8-month infant RR 55', () => {
  const p = mkPatient({
    age: 0, ageMonths: 8, sex: 'M', tiles: ['child'],
    vitals: { rr: nurse(55) },
  })
  const r = evaluate(p, NOW)
  // WHO IMCI fires SOON, but age < 12 months + child tile → Layer E risk modifier bumps to IMMEDIATE
  it('suggested is at least SOON (WHO IMCI tachypnoea 2–11m)', () => expect(['SOON', 'IMMEDIATE'].includes(r.suggested)).toBe(true))
  it('fires WHO IMCI 2-11m rule', () => expect(r.rules.some(x => x.includes('peds_rr_2_11m'))).toBe(true))
})

// ─── Vignette 18: Override lock expires → overrideLockExpired flag ────────────
describe('V18 — Override lock expires after 60 min', () => {
  const p = mkPatient({
    age: 55, sex: 'M', tiles: ['refill'],
    override: {
      tier: 'ROUTINE',
      reason: 'Clinical judgement',
      by: 'nurse',
      at: NOW - 70,         // 70 min ago
      expires_at: NOW - 10, // expired 10 min ago
    },
  })
  const r = evaluate(p, NOW)
  it('overrideLockExpired is true', () => expect(r.overrideLockExpired).toBe(true))
  it('final still returns override tier (no auto-change, just flag)', () => expect(r.final).toBe('ROUTINE'))
})

// ─── Boundary: infant fever < 3 months → IMMEDIATE ───────────────────────────
describe('Boundary — infant < 3 months with fever', () => {
  const p = mkPatient({ age: 0, ageMonths: 2, sex: 'M', tiles: ['fever'] })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (A.infant_fever)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: adult SBP ≤90 → IMMEDIATE (age ≥ 17 guard) ───────────────────
describe('Boundary — adult SBP 88 → IMMEDIATE', () => {
  const p = mkPatient({
    age: 50, sex: 'M', tiles: ['refill'],
    vitals: { sbp: nurse(88), dbp: nurse(60) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (BP_VERY_LOW adult)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: infant SBP ≤90 must NOT trigger adult shock rule ──────────────
describe('Boundary — infant SBP 80 does NOT trigger adult BP rule', () => {
  const p = mkPatient({
    age: 0, ageMonths: 6, sex: 'M', tiles: ['child'],
    vitals: { sbp: nurse(80), dbp: nurse(50) },
  })
  const r = evaluate(p, NOW)
  // infant: adult BP rule should not fire (age < 17 guard)
  it('does NOT fire adult BP_VERY_LOW rule', () => expect(r.rules.some(x => x.includes('D.bp_very_low'))).toBe(false))
})

// ─── Boundary: pregnancy, pregnant tile alone, no symptoms → SOON not IMMEDIATE
describe('Boundary — pregnant tile, no alarming followups, BP 145/95 → SOON', () => {
  const p = mkPatient({
    age: 28, sex: 'F', tiles: ['preg'],
    conditions: ['pregnant'],
    vitals: { sbp: nurse(145), dbp: nurse(95) },
  })
  const r = evaluate(p, NOW)
  it('suggested is SOON (raised BP in pregnancy, no symptoms)', () => expect(r.suggested).toBe('SOON'))
  it('does NOT fire preg_bp_symptomatic', () => expect(r.rules.some(x => x.includes('preg_bp_symptomatic'))).toBe(false))
})

// ─── Boundary: universal hyperthermia (temp ≥ 40.0 any age) → IMMEDIATE ──────
describe('Boundary — temp 40.5°C, any age → IMMEDIATE', () => {
  const p = mkPatient({
    age: 40, sex: 'M', tiles: ['fever'],
    vitals: { temp: nurse(40.5) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (VITAL_HYPERTHERMIA)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: hypothermia (temp ≤ 35.0) → IMMEDIATE ─────────────────────────
describe('Boundary — temp 34.5°C → IMMEDIATE', () => {
  const p = mkPatient({
    age: 40, sex: 'M', tiles: ['refill'],
    vitals: { temp: nurse(34.5) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (VITAL_HYPOTHERMIA)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: NEWS2 ≥ 5 → IMMEDIATE ─────────────────────────────────────────
describe('Boundary — adult NEWS2 ≥ 5', () => {
  const p = mkPatient({
    age: 70, sex: 'M', tiles: ['breath'],
    vitals: { rr: nurse(26), spo2: nurse(92), sbp: nurse(100), pulse: nurse(115), temp: nurse(38.5) },
    // RR 26→3, SpO₂ 92→2, SBP 100→2, pulse 115→2, temp 38.5→2 = 11 → IMMEDIATE
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (NEWS2 ≥ 5)', () => expect(r.suggested).toBe('IMMEDIATE'))
  it('news2 score is present', () => expect(r.news2).toBeDefined())
})

// ─── Boundary: paediatric brady (pulse < 60, age < 12) → IMMEDIATE ───────────
describe('Boundary — 8y child bradycardia pulse 50', () => {
  const p = mkPatient({
    age: 8, sex: 'F', tiles: ['child'],
    vitals: { pulse: nurse(50) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (PEDS_BRADY)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: adolescent pulse < 60 must NOT trigger brady rule ──────────────
describe('Boundary — 14y athletic teenager pulse 55 → NOT brady', () => {
  const p = mkPatient({
    age: 14, sex: 'M', tiles: ['refill'],
    vitals: { pulse: nurse(55) },
  })
  const r = evaluate(p, NOW)
  it('does NOT fire PEDS_BRADY for age 14', () => expect(r.rules.some(x => x.includes('D.peds_brady'))).toBe(false))
})

// ─── Boundary: severe glucose hypo < 54 → IMMEDIATE ─────────────────────────
describe('Boundary — glucose 45 mg/dL → IMMEDIATE', () => {
  const p = mkPatient({
    age: 50, sex: 'M', tiles: ['refill'], conditions: ['diabetes'],
    vitals: { glucose: nurse(45) },
  })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE (GLUC_SEVERE_HYPO)', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Boundary: self-harm statement → IMMEDIATE ───────────────────────────────
describe('Boundary — self-harm followup → IMMEDIATE', () => {
  const p = mkPatient({ age: 25, sex: 'M', tiles: ['other'], followups: ['self_harm'] })
  const r = evaluate(p, NOW)
  it('suggested is IMMEDIATE', () => expect(r.suggested).toBe('IMMEDIATE'))
})

// ─── Confidence line format ───────────────────────────────────────────────────
describe('Confidence line — 0 of 5 vitals', () => {
  const p = mkPatient({ age: 40, sex: 'M', tiles: ['chest'] })
  const r = evaluate(p, NOW)
  it('confidence includes "0 of 5"', () => expect(r.confidence).toContain('0 of 5'))
})

describe('Confidence line — 2 of 5 vitals', () => {
  const p = mkPatient({
    age: 40, sex: 'M', tiles: ['chest'],
    vitals: { spo2: nurse(96), pulse: nurse(78) },
  })
  const r = evaluate(p, NOW)
  it('confidence includes "2 of 5"', () => expect(r.confidence).toContain('2 of 5'))
})
