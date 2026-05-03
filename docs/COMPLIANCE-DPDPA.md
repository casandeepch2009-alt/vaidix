# Vaidix — DPDPA Compliance Posture

HARDENING-PLAN.md item #17.

| Field | Value |
|---|---|
| Owner | Symbiosys Technologies (Data Processor) on behalf of LV Prasad Eye Institute (Data Fiduciary) |
| Scope | All personal data of LVPEI residents, faculty, program directors, admins, and any patient data uploaded as case material. |
| Reviewed by | _pending LVPEI legal review_ |

## Lawful basis

| Activity | Basis (DPDPA §7) |
|---|---|
| Resident / faculty platform usage | Performance of contract (training agreement) |
| Recording live sessions | Consent (`ConsentType.PATIENT_RECORDING` / `RESIDENT_PLATFORM`) |
| WhatsApp pearls | Explicit consent (`ConsentType.WHATSAPP_NOTIFICATIONS`) |
| Patient case materials uploaded by faculty | Public interest in education + PHI scan + role-restricted access |
| AI training on aggregated transcripts | Explicit opt-in only (`ConsentType.AI_TRAINING_OPTIN`); withdrawable |

## Data residency

All primary data resides on LVPEI Hyderabad on-prem infrastructure:

- Postgres primary + replica
- Redis (cache only — never source-of-truth)
- MinIO object store (recordings, transcripts, documents, dsr-exports)

**Backups** stay on LVPEI infrastructure (off-host NAS / secondary VM, not third-party cloud).

**Cross-border transfer:** none for personal data. The only outbound calls today:

| Service | What leaves the country | Mitigation |
|---|---|---|
| Sarvam AI (transcription) | Audio chunks in dev only | Production env-gate refuses to boot with `TRANSCRIPTION_PROVIDER=sarvam` (see `src/lib/env.ts`); prod uses self-hosted Whisper. |
| Google Gemini (coach + analyse) | Resident-typed questions; document text | Phase 2 will replace with Vaidix Core (local SLM). Until then, no PHI is sent — coach prompts are general clinical questions; document analyse uses post-PHI-scan text. |
| Gmail SMTP (transactional email) | Email subject/body | Outbound mail only; no patient identifiers in templates. |

## Data subject rights (DSR)

| Right (DPDPA §11–§14) | Endpoint | Notes |
|---|---|---|
| Access (§11) — see what data we hold | `POST /api/me/data-export` | Auto-approved; tarball within 24h SLA. Worker: `dsr-export-worker.ts`. |
| Correction (§12) | Existing profile edit pages | No special endpoint required. |
| Erasure (§14) | `POST /api/me/erasure-request` → admin approves at `POST /api/admin/dpdpa/:id/decide` | Anonymises identifying fields; audit log preserved (regulatory retention). 30-day SLA. Worker: `erasure-worker.ts`. |
| Withdraw consent | `POST /api/me/consent/:type/withdraw` (existing) | WhatsApp send is blocked the moment consent is withdrawn. |

## Retention

Defined in `RetentionPolicy` table (HARDENING-PLAN #16). Defaults:

- Recording / transcript: 365d (purge)
- Case conversation content: 90d (anonymise; keep stats)
- Engagement signals: 90d (purge)
- Recording-share access logs: 180d (purge)
- DLQ jobs: 30d (purge)
- Audit events: 7y (purge — regulatory minimum)
- Presigned-URL audit: 30d (purge)

Sweeps run daily 03:00 server time via the retention worker. Operator can flip `enabled=false` per kind to delay purge for ongoing investigations.

## Breach notification

If a personal-data breach is detected, follow [RUNBOOK-INCIDENT.md](RUNBOOK-INCIDENT.md). DPDPA §8(6) requires notifying the Data Protection Board and affected data principals "as soon as practicable." Vaidix's audit log + DLQ + structured logs (HARDENING-PLAN #7/#8/#14) give the forensic trail to scope the breach.

## Open items (legal review needed)

- [ ] Confirm 7-year audit retention satisfies LVPEI's regulatory obligations.
- [ ] Confirm the wording of consent prompts in the UI for `PATIENT_RECORDING` and `AI_TRAINING_OPTIN`.
- [ ] Confirm 30-day erasure SLA vs DPDPA's "as soon as practicable" guidance.
- [ ] Decide whether transcripts qualify as PHI for purposes of cross-border processing — current posture: yes, hence prod env-gate forbids Sarvam.
