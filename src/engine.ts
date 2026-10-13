// OPD Flow — Rules Engine v0.3
// Pure function, layers A–H from the v0.3 specification.
// All [CLINICIAN] thresholds are placeholders pending sign-off.

export type Tier = 'IMMEDIATE' | 'SOON' | 'ROUTINE'
export const TIER_RANK: Record<Tier, number> = { ROUTINE: 0, SOON: 1, IMMEDIATE: 2 }
export const CONFIG_VERSION = '0.3'

const BY_RANK: Tier[] = ['ROUTINE', 'SOON', 'IMMEDIATE']
const up = (t: Tier, n = 1): Tier => BY_RANK[Math.min(2, TIER_RANK[t] + n)]
const maxTier = (a: Tier, b: Tier): Tier => (TIER_RANK[a] >= TIER_RANK[b] ? a : b)

// ─── Tile definitions ───────────────────────────────────────────────────────

export type TileId =
  | 'chest' | 'breath' | 'fever' | 'injury' | 'abdo' | 'head' | 'preg'
  | 'child' | 'cough' | 'minor' | 'refill' | 'other'

export interface Tile {
  id: TileId
  en: string
  hi: string
  icon: string
  base: Tier
  followups: { id: string; en: string; hi: string; redFlag?: boolean }[]
}

export const TILES: Tile[] = [
  { id: 'chest', en: 'Chest pain', hi: 'सीने में दर्द', icon: 'heart', base: 'SOON', followups: [
    { id: 'radiating', en: 'Spreading to arm, jaw or back', hi: 'हाथ, जबड़े या पीठ तक', redFlag: true },
    { id: 'sweating', en: 'Sweating or nausea', hi: 'पसीना या मतली', redFlag: true },
  ]},
  { id: 'breath', en: 'Breathlessness', hi: 'सांस फूलना', icon: 'wind', base: 'SOON', followups: [
    { id: 'sudden', en: 'Sudden or severe', hi: 'अचानक या गंभीर', redFlag: true },
    { id: 'atrest', en: 'Breathless at rest', hi: 'आराम में भी', redFlag: true },
  ]},
  { id: 'fever', en: 'Fever', hi: 'बुखार', icon: 'thermo', base: 'ROUTINE', followups: [
    { id: 'vomiting', en: 'Persistent vomiting', hi: 'लगातार उल्टी', redFlag: true },
    { id: 'bleeding', en: 'Bleeding spots or rash', hi: 'खून के धब्बे या दाने', redFlag: true },
    { id: 'drowsy', en: 'Drowsy or confused', hi: 'सुस्त या भ्रमित', redFlag: true },
  ]},
  { id: 'injury', en: 'Injury or bleeding', hi: 'चोट / खून', icon: 'bandage', base: 'SOON', followups: [
    { id: 'head', en: 'Head injury', hi: 'सिर की चोट', redFlag: true },
    { id: 'heavy', en: 'Heavy or ongoing bleeding', hi: 'ज़्यादा या लगातार खून', redFlag: true },
    { id: 'snake', en: 'Snakebite or poisoning', hi: 'सांप का काटना / ज़हर', redFlag: true },
  ]},
  { id: 'abdo', en: 'Abdominal pain or vomiting', hi: 'पेट दर्द / उल्टी', icon: 'abdo', base: 'SOON', followups: [
    { id: 'abdo_blood', en: 'Blood in vomit or stool', hi: 'उल्टी या मल में खून', redFlag: true },
    { id: 'abdo_severe', en: 'Sudden severe pain', hi: 'अचानक तेज़ दर्द', redFlag: true },
  ]},
  { id: 'head', en: 'Headache or giddiness', hi: 'सिरदर्द / चक्कर / कमज़ोरी', icon: 'brain', base: 'SOON', followups: [
    { id: 'stroke', en: 'Face droop, arm weakness, slurred speech', hi: 'चेहरा टेढ़ा, हाथ कमज़ोर, बोली लड़खड़ाना', redFlag: true },
    { id: 'faint', en: 'Fainted or collapsed', hi: 'बेहोश हुए', redFlag: true },
    { id: 'worst_headache', en: 'Worst or most sudden headache ever', hi: 'जीवन का सबसे बड़ा सिरदर्द', redFlag: true },
  ]},
  { id: 'preg', en: 'Pregnancy-related', hi: 'गर्भावस्था', icon: 'preg', base: 'SOON', followups: [
    { id: 'pbleed', en: 'Bleeding', hi: 'खून आना', redFlag: true },
    { id: 'vision', en: 'Severe headache or vision change', hi: 'तेज़ सिरदर्द / धुंधला दिखना', redFlag: true },
    { id: 'fits', en: 'Fits or seizure', hi: 'दौरा पड़ा', redFlag: true },
    { id: 'movement', en: 'Reduced baby movements', hi: 'बच्चे की हलचल कम', redFlag: true },
    { id: 'severe_abdo', en: 'Severe abdominal pain', hi: 'पेट में तेज़ दर्द', redFlag: true },
  ]},
  { id: 'child', en: 'Child unwell', hi: 'बच्चा बीमार', icon: 'child', base: 'SOON', followups: [
    { id: 'not_feeding', en: 'NOT feeding or drinking', hi: 'खा-पी नहीं रहा', redFlag: true },
    { id: 'floppy', en: 'Lethargic or floppy', hi: 'सुस्त या ढीला', redFlag: true },
    { id: 'convulsion', en: 'Convulsion or fit', hi: 'मिरगी / दौरा', redFlag: true },
    { id: 'fast_breathing', en: 'Fast or difficult breathing', hi: 'तेज़ या मुश्किल सांस', redFlag: true },
  ]},
  { id: 'cough', en: 'Cough or cold', hi: 'खांसी / ज़ुकाम', icon: 'cough', base: 'ROUTINE', followups: [
    { id: 'diff_breathing', en: 'Difficulty breathing', hi: 'सांस लेने में दिक्कत' },
    { id: 'blood_sputum', en: 'Blood in sputum / cough', hi: 'खांसी में खून' },
  ]},
  { id: 'minor', en: 'Skin, eye or ear', hi: 'त्वचा, आंख या कान', icon: 'eye', base: 'ROUTINE', followups: [
    { id: 'vision_loss', en: 'Sudden vision loss', hi: 'अचानक दिखना बंद', redFlag: true },
    { id: 'chemical', en: 'Chemical splash in eye', hi: 'आंख में रसायन', redFlag: true },
  ]},
  { id: 'refill', en: 'Refill or follow-up', hi: 'दवा / दोबारा दिखाना', icon: 'pill', base: 'ROUTINE', followups: [
    { id: 'new_symptoms', en: 'Any new symptoms since last visit?', hi: 'पिछली बार से कोई नई तकलीफ़?' },
  ]},
  { id: 'other', en: 'Other / Cannot say', hi: 'अन्य / पता नहीं', icon: 'help', base: 'SOON', followups: [
    { id: 'self_harm', en: 'Self-harm concern', hi: 'आत्म-नुकसान की चिंता', redFlag: true },
  ]},
]

export const UNWELL = [
  { id: 'speak', en: 'Cannot speak a full sentence', hi: 'पूरा वाक्य नहीं बोल पा रहे' },
  { id: 'pale', en: 'Pale, sweaty or blue lips', hi: 'पीले, पसीना, नीले होंठ' },
  { id: 'drowsy', en: 'Drowsy or confused', hi: 'सुस्त या भ्रमित' },
  { id: 'carried', en: 'Carried or in wheelchair', hi: 'उठाकर / व्हीलचेयर में' },
  { id: 'bleed', en: 'Visible bleeding', hi: 'खून दिख रहा है' },
]

export const CONDITIONS = [
  { id: 'diabetes', en: 'Diabetes', hi: 'शुगर' },
  { id: 'insulin', en: 'On insulin', hi: 'इंसुलिन' },
  { id: 'htn', en: 'High BP', hi: 'हाई बीपी' },
  { id: 'heart', en: 'Heart disease', hi: 'दिल की बीमारी' },
  { id: 'kidney', en: 'Kidney disease', hi: 'किडनी' },
  { id: 'lung', en: 'Lung disease / Home oxygen', hi: 'फेफड़े की बीमारी' },
  { id: 'thinner', en: 'Blood thinners', hi: 'खून पतला करने की दवा' },
  { id: 'pregnant', en: 'Pregnant', hi: 'गर्भवती' },
  { id: 'cancer', en: 'Cancer treatment', hi: 'कैंसर इलाज' },
  { id: 'recent', en: 'Recent surgery / discharge', hi: 'हाल में ऑपरेशन' },
]

// ─── Vitals schema ───────────────────────────────────────────────────────────
// Each vital has value, source, and is_verified so the "unverified" tag
// has actual data to read (v0.3 fix for missing verification model).

export type VitalSource = 'nurse' | 'clerk' | 'patient_self' | 'attendant'

export interface VitalReading {
  value: number
  source: VitalSource
  is_verified: boolean
}

export interface Vitals {
  rr?: VitalReading
  spo2?: VitalReading
  sbp?: VitalReading
  dbp?: VitalReading
  pulse?: VitalReading
  temp?: VitalReading
  glucose?: VitalReading
  onOxygen?: boolean
}

// Helper: get numeric value, undefined if not set
const val = (v?: VitalReading) => v?.value

// ─── Patient ─────────────────────────────────────────────────────────────────

export interface Override {
  tier: Tier
  reason: string
  note?: string
  by: string
  at: number           // simulation minute
  expires_at: number   // at + OVERRIDE_EXPIRY_MINUTES (v0.3: lock expiry)
}

export const OVERRIDE_EXPIRY_MINUTES = 60  // [CLINICIAN] configurable

export interface Patient {
  token: number
  age: number           // years for >= 2y; 0 for infants
  ageMonths?: number    // months if < 24 months old (v0.3 age_in_months schema)
  sex: 'M' | 'F' | 'U'
  unknown?: boolean
  tiles: TileId[]
  followups: string[]
  unwell: string[]
  conditions: string[]
  vitals: Vitals
  arrivedAt: number
  override?: Override
  pendingSuggestion?: Tier
  worseReports: number
  status: 'waiting' | 'fasttrack' | 'casualty' | 'seen' | 'lwbs'
  acknowledged?: boolean
}

// Computed age in months (infants use ageMonths, everyone else age * 12)
export const ageInMonths = (p: Pick<Patient, 'age' | 'ageMonths'>) =>
  p.ageMonths ?? p.age * 12

// ─── Result ──────────────────────────────────────────────────────────────────

export interface Result {
  suggested: Tier
  final: Tier
  reason: string
  drivers: string[]
  rules: string[]
  news2?: { score: number; measured: number; anyThree: boolean }
  /** "X of 5 vitals measured" — denominator is 5 device readings only (v0.3) */
  confidence: string
  lowConfidence: boolean
  /** True if any Immediate-triggering vital has is_verified == false */
  unverified: boolean
  tasks: string[]
  clinicianReview: boolean
  /** Fires when override lock timer has expired */
  overrideLockExpired: boolean
}

// ─── Plausibility checks ─────────────────────────────────────────────────────

export function plausibility(vitals: Vitals): string[] {
  const w: string[] = []
  const sbp = val(vitals.sbp), dbp = val(vitals.dbp)
  const spo2 = val(vitals.spo2), pulse = val(vitals.pulse)
  const temp = val(vitals.temp), rr = val(vitals.rr)

  if (sbp != null && sbp < 50) w.push(`Systolic ${sbp} looks low — did you mean ${sbp * 10}?`)
  if (sbp != null && dbp != null && sbp < dbp) w.push(`Systolic (${sbp}) is lower than diastolic (${dbp}) — check entry`)
  if (temp != null && temp > 45) w.push(`Temp ${temp} looks like °F — please enter in °C`)
  if (spo2 != null && spo2 > 100) w.push('SpO₂ cannot exceed 100%')
  if (spo2 != null && spo2 < 50) w.push(`SpO₂ ${spo2}% is implausibly low — recheck`)
  if (pulse != null && pulse < 20) w.push(`Pulse ${pulse} is very low — recheck`)
  if (rr != null && rr < 5) w.push(`Breathing rate ${rr} is implausibly low — recheck`)
  if (rr != null && rr > 70) w.push(`Breathing rate ${rr} is implausibly high — recheck`)

  return w
}

// ─── NEWS2 scorer (Layer C) ──────────────────────────────────────────────────
// Applies only to adults (age >= 17), not pregnant.
// Denominator counts 5 device vitals + consciousness (always known) + onOxygen (always known).
// But we report "of 5" for confidence (only device vitals) — NEWS2 internally uses 7.

export function news2(v: Vitals, confused: boolean): { score: number; measured: number; anyThree: boolean } {
  let score = 0, measured = 0
  let anyThree = false

  const add = (s: number) => {
    score += s
    measured++
    if (s === 3) anyThree = true
  }

  const rr = val(v.rr), spo2 = val(v.spo2), sbp = val(v.sbp)
  const pulse = val(v.pulse), temp = val(v.temp)

  if (rr != null) add(rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3)
  if (spo2 != null) add(spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0)

  // onOxygen: always known from conditions (not a device reading but always counted in NEWS2)
  add(v.onOxygen ? 2 : 0)

  if (sbp != null) add(sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3)
  if (pulse != null) add(pulse <= 40 ? 3 : pulse <= 50 ? 1 : pulse <= 90 ? 0 : pulse <= 110 ? 1 : pulse <= 130 ? 2 : 3)

  // Consciousness: from clerk input (always available, doesn't need a device)
  add(confused ? 3 : 0)

  if (temp != null) add(temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2)

  return { score, measured, anyThree }
}

// Count only the 5 physical device readings (v0.3: "of 5" denominator)
const deviceVitalCount = (v: Vitals): number =>
  (['rr', 'spo2', 'sbp', 'pulse', 'temp'] as const).filter((k) => v[k] != null).length

// ─── Evaluate (main entry point) ─────────────────────────────────────────────

export function evaluate(p: Patient, now: number, waitLimitRisk = 90, waitLimitGeneral = 180): Result {
  const drivers: string[] = []
  const rules: string[] = []
  const tasks: string[] = []

  const has = (c: string) => p.conditions.includes(c)
  const hasLung = () => has('lung') || has('homeo2')
  const pregnant = has('pregnant') || p.tiles.includes('preg')
  const ageM = ageInMonths(p)        // age in months
  const child = ageM < 17 * 12       // < 17 years → paediatric rules
  const adult = ageM >= 17 * 12      // >= 17 years → NEWS2 + adult BP

  const confused = p.unwell.includes('drowsy')
  const nDevVitals = deviceVitalCount(p.vitals)

  let tier: Tier = 'ROUTINE'
  let redFlag = false
  let clinicianReview = false

  // ═══════════════════════════════════════════════════════════════
  // LAYER A — Red Flags → IMMEDIATE
  // ═══════════════════════════════════════════════════════════════

  const flag = (rule: string, driver: string) => {
    redFlag = true
    tier = 'IMMEDIATE'
    drivers.push(driver)
    rules.push(rule)
  }

  // A5. Universal
  if (p.unknown) flag('A.unknown', 'unresponsive/unknown patient')
  if (p.unwell.length) {
    const first = UNWELL.find((u) => u.id === p.unwell[0])!
    flag('A.looks_unwell', first.en.toLowerCase())
  }

  // A1. Adult follow-up red flags
  for (const f of p.followups) {
    const fu = TILES.flatMap((t) => t.followups).find((x) => x.id === f)
    if (fu?.redFlag) flag(`A.${f}`, fu.en.toLowerCase())
  }

  // A1. Chest pain at age ≥ 40 or cardiac risk factors
  if (p.tiles.includes('chest') && (p.age >= 40 || has('diabetes') || has('htn') || has('heart'))) {
    flag('A.chest_40plus', `chest pain + age ${p.age}`)
  }

  // A3. Infant fever (age < 3 months) — standardized to < 3 months (v0.3 fix)
  if (ageM < 3 && (p.tiles.includes('fever') || p.tiles.includes('child'))) {
    flag('A.infant_fever', 'infant < 3 months with fever')
  }

  // Seizure from unwell section (not a followup tile)
  if (p.unwell.includes('convulsion')) flag('A.seizure', 'seizure/convulsion')

  // Feeling worse (from walk-up reports)
  if (p.worseReports > 0) {
    drivers.push('reported feeling worse')
    rules.push('G.walkup_worse')
  }
  if (redFlag) tier = 'IMMEDIATE'

  // ═══════════════════════════════════════════════════════════════
  // LAYER B — Symptom tile baseline tiers
  // ═══════════════════════════════════════════════════════════════

  for (const id of p.tiles) {
    const t = TILES.find((x) => x.id === id)!
    if (TIER_RANK[t.base] > TIER_RANK[tier]) {
      tier = t.base
      rules.push(`B.${id}`)
    }
    if (!redFlag && t.base !== 'ROUTINE') drivers.push(t.en.toLowerCase())
  }

  // Headache in elderly
  if (p.tiles.includes('head') && p.age >= 65) {
    tier = maxTier(tier, 'SOON')
    if (!drivers.includes('giddiness in elderly')) drivers.push('giddiness in elderly')
    rules.push('B.giddy_elderly')
  }

  // No symptom info → at least SOON
  if (!p.tiles.length && !p.unknown) {
    tier = maxTier(tier, 'SOON')
    drivers.push('no symptom info')
    rules.push('F.no_symptoms')
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER C — NEWS2 (adults age >= 17, not pregnant)
  // ═══════════════════════════════════════════════════════════════

  let n: Result['news2']

  if (adult && !pregnant && nDevVitals > 0) {
    // COPD: skip SpO₂ in NEWS2, floor to SOON with clinician review
    if (hasLung() && val(p.vitals.spo2) != null) {
      clinicianReview = true
      tier = maxTier(tier, 'SOON')
      rules.push('C.copd_spo2_review')
      drivers.push('lung disease / home O₂ — SpO₂ not auto-scored')
    }

    n = news2(p.vitals, confused)

    if (n.score >= 5) {
      tier = 'IMMEDIATE'
      drivers.push(`NEWS2 ≥ ${n.score}`)
      rules.push('C.news2_ge5')
    } else if (n.anyThree) {
      tier = maxTier(tier, 'SOON')
      drivers.push('single NEWS2 parameter = 3')
      rules.push('C.news2_single3')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER D — Non-NEWS2 vitals rules
  // ═══════════════════════════════════════════════════════════════

  const sbp = val(p.vitals.sbp)
  const dbp = val(p.vitals.dbp)
  const spo2 = val(p.vitals.spo2)
  const pulse = val(p.vitals.pulse)
  const temp = val(p.vitals.temp)
  const rr = val(p.vitals.rr)
  const glucose = val(p.vitals.glucose)

  // D1. Adult BP rules — strictly age >= 17 (v0.3 fix: paediatric safety guard)
  if (adult && !pregnant) {
    if (sbp != null) {
      const bpSym = p.tiles.includes('head') || p.tiles.includes('chest') || p.tiles.includes('breath')
      if (sbp >= 180 || (dbp != null && dbp >= 120)) {
        if (bpSym) {
          tier = 'IMMEDIATE'
          drivers.push(`BP ${sbp}/${dbp ?? '?'} with symptoms`)
          rules.push('D.bp_hyper_crisis')
        } else {
          tier = maxTier(tier, 'SOON')
          drivers.push(`BP ${sbp}/${dbp ?? '?'}, no symptoms`)
          tasks.push('Repeat BP after 5 min rest')
          rules.push('D.bp_hyper_urgency')
        }
      } else if (sbp >= 160) {
        // Stage 2 hypertension: display only, no auto-bump
        drivers.push(`BP ${sbp} (stage 2, note for doctor)`)
        rules.push('D.bp_stage2')
      } else if (sbp <= 90) {
        tier = 'IMMEDIATE'
        drivers.push(`low BP (SBP ${sbp})`)
        rules.push('D.bp_very_low')
      } else if (sbp <= 100) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`low BP (SBP ${sbp})`)
        rules.push('D.bp_low')
      }
    }
  }

  // D4. Pregnancy vitals safety net (NEWS2 excluded for pregnant patients)
  if (pregnant) {
    if (sbp != null) {
      // BP_PREG_SEVERE: >= 160/110 even without symptoms (v0.3)
      if (sbp >= 160 || (dbp != null && dbp >= 110)) {
        tier = 'IMMEDIATE'
        drivers.push(`severely raised BP in pregnancy (${sbp}/${dbp ?? '?'})`)
        rules.push('D.preg_bp_severe')
      } else if (sbp >= 140 || (dbp != null && dbp >= 90)) {
        // BP_PREG_RAISED_SYMPTOMS: use actual follow-up symptoms (v0.3 bug fix)
        const hasPregnancySymptoms = p.followups.includes('vision') ||
          p.followups.includes('severe_abdo') ||
          p.followups.includes('pbleed') ||
          p.tiles.includes('head') || p.tiles.includes('abdo')
        if (hasPregnancySymptoms) {
          tier = 'IMMEDIATE'
          drivers.push(`raised BP in pregnancy (${sbp}/${dbp ?? '?'}) with symptoms`)
          rules.push('D.preg_bp_symptomatic')
        } else {
          tier = maxTier(tier, 'SOON')
          drivers.push(`raised BP in pregnancy (${sbp}/${dbp ?? '?'})`)
          rules.push('D.preg_bp_raised')
        }
      }
    }

    // Pregnancy pulse safety net
    if (pulse != null) {
      if (pulse >= 140) {
        tier = 'IMMEDIATE'
        drivers.push(`maternal tachycardia (pulse ${pulse})`)
        rules.push('D.preg_pulse_critical')
      } else if (pulse >= 120) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`maternal tachycardia (pulse ${pulse})`)
        rules.push('D.preg_pulse_high')
      } else if (pulse <= 50) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`maternal bradycardia (pulse ${pulse})`)
        rules.push('D.preg_pulse_low')
      }
    }

    // Pregnancy temperature safety net
    if (temp != null) {
      if (temp >= 39.5) {
        tier = 'IMMEDIATE'
        drivers.push(`high maternal fever (temp ${temp}°C)`)
        rules.push('D.preg_temp_critical')
      } else if (temp >= 38.5) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`maternal fever (temp ${temp}°C)`)
        rules.push('D.preg_temp_high')
      }
    }

    // Pregnancy respiratory safety net
    if (rr != null) {
      if (rr >= 30) {
        tier = 'IMMEDIATE'
        drivers.push(`maternal tachypnoea (RR ${rr})`)
        rules.push('D.preg_rr_critical')
      } else if (rr >= 24) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`maternal fast breathing (RR ${rr})`)
        rules.push('D.preg_rr_high')
      }
    }

    // Pregnancy SpO₂ safety net
    if (spo2 != null) {
      if (spo2 <= 91) {
        tier = 'IMMEDIATE'
        drivers.push(`maternal low oxygen (SpO₂ ${spo2}%)`)
        rules.push('D.preg_spo2_critical')
      } else if (spo2 <= 94) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`maternal borderline oxygen (SpO₂ ${spo2}%)`)
        rules.push('D.preg_spo2_low')
      }
    }
  }

  // D3. Standalone SpO₂ rules (non-COPD, all ages)
  if (!pregnant && spo2 != null) {
    if (!hasLung()) {
      if (spo2 <= 91) {
        tier = 'IMMEDIATE'
        drivers.unshift(`SpO₂ ${spo2}%`)
        rules.push('D.spo2_very_low')
      } else if (spo2 <= 94) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`borderline SpO₂ ${spo2}%`)
        rules.push('D.spo2_low')
      }
    } else {
      // D3. COPD hard floor: SpO₂ < 88% → IMMEDIATE [CLINICIAN]
      if (spo2 < 88) {
        tier = 'IMMEDIATE'
        drivers.push(`severe oxygen desaturation in lung disease (SpO₂ ${spo2}%)`)
        rules.push('D.spo2_copd_critical')
        clinicianReview = true
      } else if (spo2 <= 92) {
        tier = maxTier(tier, 'SOON')
        clinicianReview = true
        drivers.push(`low SpO₂ in lung disease (${spo2}%) — clinician review`)
        rules.push('D.spo2_copd_low')
      }
    }
  }

  // D2. Blood glucose rules (all ages)
  if (glucose != null) {
    if (glucose < 54) {
      tier = 'IMMEDIATE'
      drivers.push(`severe low glucose (${glucose} mg/dL)`)
      rules.push('D.glucose_severe_hypo')
    } else if (glucose <= 70) {
      tier = maxTier(tier, 'SOON')
      drivers.push(`low glucose (${glucose} mg/dL)`)
      tasks.push('Give oral glucose, recheck in 15 min')
      rules.push('D.glucose_hypo')
    } else if (glucose > 500) {
      tier = 'IMMEDIATE'
      drivers.push(`very high glucose (${glucose} mg/dL)`)
      rules.push('D.glucose_very_high')
    } else if (glucose > 300) {
      const withSymptoms = confused || p.tiles.includes('abdo') || p.tiles.includes('breath')
      if (withSymptoms) {
        tier = 'IMMEDIATE'
        drivers.push(`high glucose (${glucose}) with symptoms`)
        rules.push('D.glucose_high_symptoms')
      } else {
        tier = maxTier(tier, 'SOON')
        drivers.push(`high glucose (${glucose} mg/dL)`)
        rules.push('D.glucose_high')
      }
    }
  }

  // Diabetic suspicious: giddiness/sweating but no glucose taken
  if (has('diabetes') && (p.tiles.includes('head') || p.unwell.includes('pale') || confused) && glucose == null) {
    tier = maxTier(tier, 'SOON')
    tasks.push('Check glucose NOW')
    drivers.push('diabetic with giddiness/sweating — check glucose')
    rules.push('D.diabetic_suspicious')
  }

  // D5. Paediatric vitals safety net (age <= 16 = ageM < 17*12)
  if (child) {
    // D5a. Respiratory rate — WHO IMCI cut-offs (v0.3: corrected bands)
    if (rr != null) {
      if (ageM < 2 && rr >= 60) {
        tier = 'IMMEDIATE'
        drivers.push(`infant RR ${rr} (< 2 months, ≥60 [WHO IMCI])`)
        rules.push('D.peds_rr_0_2m')
      } else if (ageM >= 2 && ageM <= 11 && rr >= 50) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`infant RR ${rr} (2–11 months, ≥50 [WHO IMCI])`)
        rules.push('D.peds_rr_2_11m')
      } else if (ageM >= 12 && ageM <= 59 && rr >= 40) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`child RR ${rr} (1–4 years, ≥40 [WHO IMCI])`)
        rules.push('D.peds_rr_12_59m')
      } else if (p.age >= 5 && p.age <= 11 && rr >= 30) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`child RR ${rr} (5–11y, ≥30 [CLINICIAN])`)
        rules.push('D.peds_rr_5_11y')
      } else if (p.age >= 12 && p.age <= 16 && rr >= 25) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`adolescent RR ${rr} (12–16y, ≥25 [CLINICIAN])`)
        rules.push('D.peds_rr_12_16y')
      }
    }

    // D5b. Paediatric heart rate
    if (pulse != null) {
      if (ageM < 12 && pulse > 180) {
        tier = 'IMMEDIATE'
        drivers.push(`infant tachycardia (pulse ${pulse})`)
        rules.push('D.peds_tachy_infant')
      } else if (p.age >= 1 && p.age <= 4 && pulse > 160) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`child tachycardia (pulse ${pulse})`)
        rules.push('D.peds_tachy_child')
      } else if (p.age >= 5 && p.age <= 11 && pulse > 140) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`child tachycardia (pulse ${pulse})`)
        rules.push('D.peds_tachy_older')
      } else if (p.age >= 12 && p.age <= 16) {
        // Adolescent thresholds [CLINICIAN]
        if (pulse >= 150) {
          tier = 'IMMEDIATE'
          drivers.push(`adolescent tachycardia (pulse ${pulse})`)
          rules.push('D.peds_tachy_adolescent')
        } else if (pulse >= 130) {
          tier = maxTier(tier, 'SOON')
          drivers.push(`adolescent tachycardia (pulse ${pulse})`)
          rules.push('D.peds_tachy_adol_soon')
        }
      }

      // PEDS_BRADY: restricted to age < 12 (v0.3: teenagers excluded)
      if (p.age < 12 && pulse < 60) {
        tier = 'IMMEDIATE'
        drivers.push(`child bradycardia (pulse ${pulse})`)
        rules.push('D.peds_brady')
      }
    }

    // D5c. Paediatric SpO₂
    if (spo2 != null && !pregnant) {
      if (spo2 < 92) {
        tier = 'IMMEDIATE'
        drivers.push(`child low oxygen (SpO₂ ${spo2}%)`)
        rules.push('D.peds_spo2_low')
      } else if (spo2 <= 94) {
        tier = maxTier(tier, 'SOON')
        drivers.push(`child borderline oxygen (SpO₂ ${spo2}%)`)
        rules.push('D.peds_spo2_borderline')
      }
    }

    // D5c. Paediatric temperature
    if (temp != null) {
      // Infant fever (< 3 months): already handled in Layer A
      if (p.age >= 12 && p.age <= 16) {
        if (temp >= 40.0) {
          tier = 'IMMEDIATE'
          drivers.push(`high fever in adolescent (temp ${temp}°C)`)
          rules.push('D.peds_temp_high_imm')
        } else if (temp >= 39.0) {
          tier = maxTier(tier, 'SOON')
          drivers.push(`adolescent fever (temp ${temp}°C)`)
          rules.push('D.peds_temp_high_soon')
        }
      }
    }
  }

  // D6. Universal extreme temperature — all ages
  if (temp != null) {
    if (temp >= 40.0 && !rules.includes('D.peds_temp_high_imm') && !rules.includes('D.preg_temp_critical')) {
      tier = 'IMMEDIATE'
      drivers.push(`severe hyperthermia (temp ${temp}°C)`)
      rules.push('D.hyperthermia')
    }
    if (temp <= 35.0) {
      tier = 'IMMEDIATE'
      drivers.push(`hypothermia (temp ${temp}°C)`)
      rules.push('D.hypothermia')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER E — Risk modifiers (one bump max)
  // ═══════════════════════════════════════════════════════════════

  const lowRiskTiles: TileId[] = ['refill', 'minor', 'cough']
  const hasMeaningfulTile = p.tiles.some((t) => !lowRiskTiles.includes(t))

  const riskMod =
    (p.age >= 65 && hasMeaningfulTile) ||
    (ageM < 12 && hasMeaningfulTile) ||   // infant
    (pregnant && tier !== 'ROUTINE') ||
    (has('heart') && p.tiles.some((t) => ['breath', 'head', 'chest'].includes(t))) ||
    (has('thinner') && p.tiles.some((t) => ['injury', 'head'].includes(t))) ||
    (has('cancer') && p.tiles.some((t) => ['fever', 'cough'].includes(t))) ||
    has('recent')

  if (riskMod && tier !== 'IMMEDIATE') {
    tier = up(tier)
    drivers.push(p.age >= 65 ? `age ${p.age}` : ageM < 12 ? 'infant' : 'risk modifier')
    rules.push('E.risk_bump')
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER F — Missing data policy (denominator = 5 device vitals)
  // ═══════════════════════════════════════════════════════════════

  if (nDevVitals === 0) {
    if (tier === 'IMMEDIATE') {
      tasks.unshift('Vitals now (Immediate patient, no vitals recorded)')
    } else if (tier === 'SOON') {
      tasks.unshift('Vitals now')
      rules.push('F.vitals_pending')
    } else if ((child || pregnant) && p.tiles.some((t) => t !== 'refill')) {
      tier = up(tier)
      tasks.unshift('Vitals now (child/pregnancy, no vitals recorded)')
      rules.push('F.child_preg_bump')
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // LAYER G — Time escalation
  // ═══════════════════════════════════════════════════════════════

  if (tier === 'ROUTINE') {
    const wait = now - p.arrivedAt
    const riskGroup = p.age >= 65 || ageM < 12 || has('insulin') || pregnant || p.conditions.length >= 2

    if (riskGroup && wait >= waitLimitRisk) {
      tier = 'SOON'
      drivers.push(`waiting ${Math.round(wait / 60)}h+, risk group`)
      rules.push('G.wait_escalation_risk')
    } else if (wait >= waitLimitGeneral) {
      tier = 'SOON'
      drivers.push(`waiting ${Math.round(wait / 60)}h+ (general threshold)`)
      rules.push('G.wait_escalation_general')
    }
  }

  // Insulin fasting nudge (always, regardless of tier)
  if (has('insulin') && glucose == null && (now - p.arrivedAt) >= 120) {
    tasks.push('Check on patient (possibly fasting — insulin user waiting 2+ hours)')
    rules.push('G.insulin_fasting_nudge')
  }

  // Worse reports always bump tier
  if (p.worseReports > 0) {
    tier = up(tier)
    rules.push('G.worse_report_bump')
  }

  // ═══════════════════════════════════════════════════════════════
  // Unverified vitals flag (v0.3: reads actual is_verified field)
  // ═══════════════════════════════════════════════════════════════

  const hasUnverifiedImmediate = tier === 'IMMEDIATE' && !redFlag && (() => {
    const vitalKeys = ['spo2', 'sbp', 'pulse', 'temp', 'rr', 'glucose'] as const
    return vitalKeys.some((k) => {
      const vr = p.vitals[k]
      return vr != null && !vr.is_verified
    })
  })()

  if (hasUnverifiedImmediate) {
    tasks.unshift('Verify vitals now (reading is self-reported)')
    rules.push('H.unverified_immediate')
  }

  const suggested = tier

  // ═══════════════════════════════════════════════════════════════
  // LAYER H — Override lock & expiry (v0.3: lock expires after N min)
  // ═══════════════════════════════════════════════════════════════

  let overrideLockExpired = false

  const final: Tier = (() => {
    if (!p.override) return suggested

    // If a new red-flag escalation exceeds the locked tier, surface as pending
    // (handled at App level via pendingSuggestion)

    // Check lock expiry (v0.3)
    if (now >= p.override.expires_at) {
      overrideLockExpired = true
      // Don't auto-change tier — just flag for the UI to prompt reconfirmation
    }

    return p.override.tier
  })()

  // ═══════════════════════════════════════════════════════════════
  // Build output
  // ═══════════════════════════════════════════════════════════════

  const lowConfidence = nDevVitals === 0 && suggested === 'ROUTINE'

  // Confidence line uses "of 5" for device vitals (v0.3 fix)
  const copd = hasLung() && val(p.vitals.spo2) != null
  const confidence = nDevVitals === 0
    ? `Based on symptoms${p.age ? ` and age ${p.age}` : ''}; 0 of 5 vitals measured`
    : `${nDevVitals} of 5 vitals measured${copd ? ' · SpO₂ evaluated by COPD pathway' : ''}${hasUnverifiedImmediate ? ' · includes unverified readings' : ''}`

  const label = { IMMEDIATE: 'Immediate', SOON: 'Soon', ROUTINE: 'Routine' }[suggested]
  const uniqDrivers = [...new Set(drivers)].slice(0, 4)

  const reason = suggested === 'ROUTINE' && !uniqDrivers.length
    ? 'Routine: no red flags at registration.'
    : `${label}${hasUnverifiedImmediate ? ' (unverified)' : ''}: ${uniqDrivers.join(' + ') || 'symptom tier'}.${tasks.length ? ` ${tasks[0]}.` : ''}`

  return {
    suggested, final, reason,
    drivers: uniqDrivers, rules,
    news2: n,
    confidence, lowConfidence,
    unverified: hasUnverifiedImmediate,
    tasks: [...new Set(tasks)],
    clinicianReview,
    overrideLockExpired,
  }
}
