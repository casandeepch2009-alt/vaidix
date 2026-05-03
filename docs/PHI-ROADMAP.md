# PHI Detection & Redaction — Roadmap

HARDENING-PLAN.md item #20.

## Phase 1 (today, shipped)

| Layer | Implementation | Status |
|---|---|---|
| Regex stopgap with Indian context | `src/server/services/phi/phi-scanner.ts` (Verhoeff Aadhaar, Luhn cards, MRN, phone, PAN, email, age-name) | ✅ |
| EXIF / image metadata strip | `src/server/services/phi/exif-strip.ts` (JPEG APPn + COM, PNG tEXt/zTXt/iTXt/tIME/eXIf) | ✅ |
| Auto-enqueue on upload | `/api/documents/[id]/classify` → `phi-scan` queue | ✅ |
| Manual rescan | `/api/documents/[id]/phi-rescan` | ✅ |
| Tag-to-session block on BLOCKED status (admin/PD override) | `tag-session` route checks `Document.phiScanStatus` | ✅ |

## Phase 2 (after first cohort feedback)

| Item | Why |
|---|---|
| Microsoft Presidio Python sidecar | ML-based name/address detection regex can't match. Sidecar runs on the same host (no network egress); Next.js calls it over a UNIX socket. |
| Tesseract OCR pre-pass for image documents | Patient name/MRN often appear inside scanned ID cards / lab reports. Today's scanner only sees binary bytes; OCR + regex catches them. |
| Pixel re-encode pass for images | Defeats steganographic / colour-hidden content survival through metadata strip. |
| Faculty redaction UI | Show offsets returned by the scanner; click-to-redact instead of block-and-mail-faculty workflow. |
| SNOMED-CT entity recogniser | Move from "is this PHI?" to "what clinical entity is this?" — feeds the Vaidix Core training pipeline. |

## Why a regex stopgap is acceptable for Phase 1

- LVPEI faculty are the only uploaders in Phase 1 (not residents, not patients) — the abuse profile is low.
- Documents are gated by `phiScanStatus !== 'BLOCKED'` before they appear to learners.
- An admin/PD can override per-document with explicit `phiOverride: true` audit trail.
- The scanner version is logged on every result row (`vaidix-regex-1.0`) so the legal posture is reproducible after the fact.

The stopgap is **not** acceptable once we open uploads to residents (or patients via consent forms). Presidio sidecar is the gate.

## Concrete trigger to start Phase 2

When the first `Document` is rejected by tag-to-session because the regex flagged a false positive that a faculty member wants overridden — that's the cue. Track via `audit_events.eventType = 'document.tagged_to_session.phi_override'` count per week. Once it crosses 5/week, build Presidio.
