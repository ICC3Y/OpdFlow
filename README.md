# OPD Flow 🏥
> **Smart, explainable patient queue prioritisation and clinical decision support for chaotic, crowded Indian OPDs.**

Live Demo: Hosted on GitHub Pages  
Presentation & Docs: AAYU Hackathon

---

## 🌟 The Problem
In an Indian district hospital Outpatient Department (OPD), walk-in tokens follow a rigid First-Come, First-Served order. A patient with severe ischemic chest pain sits on a bench behind a routine thyroid prescription refill. Overburdened doctors (seeing 80–300 patients a day) cannot be the real-time monitoring layer.

## 🚀 The Solution
**OPD Flow** is a zero-equipment safety layer that streams patients into three operational priority tiers:
- 🔴 **IMMEDIATE** (Target: seen within $\le 5$ min)
- 🟡 **SOON** (Target: seen within $\le 30$ min)
- 🟢 **ROUTINE** (Normal token queue order)

### Core Clinical Principles
1. **100% Deterministic (No Black-Box ML):** Every decision is traceable to clinical guidelines (WHO IMCI, Royal College of Physicians NEWS2).
2. **One-Way Upward Mobility:** Normal vitals can **never lower** a red-flag symptom priority.
3. **Human-in-the-Loop Override:** Only a human (Nurse/Doctor) can downgrade a tier, with mandatory audit logging and reason chips.
4. **Decision Support, Not Diagnosis:** Plain-language explainability (e.g., *"Chest tightness + age 60 + sweating, urgent cardiac assessment needed"*).

---

## 🔑 Demo Staff Accounts

| Role | Staff ID | PIN | Purpose |
|---|---|---|---|
| **Clerk** | `asha` | `1111` | 15-second registration intake with ABHA prefill |
| **Nurse** | `priya` | `2222` | Triage dashboard, vitals entry, override controls |
| **Doctor** | `mehta` | `3333` | Single-card "Call Next" queue with clinical reasons |
| **Admin** | Any account | — | Hash-chained audit logs & wait time analytics |

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/ICC3Y/OpdFlow.git
cd OpdFlow

# Install dependencies
npm install

# Start local development server
npm run dev

# Run unit tests (Vitest)
npm run test

# Build for production
npm run build
```

---

## 📜 License & Compliance
Built for the AAYU Hackathon. Designed to comply with DPDP Rules 2025 and Ayushman Bharat Digital Mission (ABDM) guidelines.
