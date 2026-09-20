# OVS-WM

### Online Verification System for Weights and Measures

> A secure digital platform for instrument verification, field inspection, certification, and lifecycle compliance under the Legal Metrology ecosystem.

**Users** | **State LMOs** | **GATCs** | **Administrators**

OVS-WM replaces fragmented manual processes with one traceable workflow for weighing and measuring instruments used in trade and consumer protection. It supports applications, allocation, scheduling, field observations, certificates, QR verification, expiry monitoring, enforcement tracking, and reporting.

---

## Contents

- [What It Covers](#what-it-covers)
        +--> First Verification / Re-verification application
- [Roles](#roles)
        +--> First Verification: Document review -> GATC allocation
        |
        +--> Re-verification: Document review -> LMO allocation
- [Run Locally](#run-locally)
- [API Overview](#api-overview)
- [Security](#security)
- [Deployment](#deployment)
- [Production Roadmap](#production-roadmap)
        +--> LMO field verification
        |       +--> Verified at Field
        |       +--> GATC Verification Required -> GATC testing
        |       +--> Verification Rejected
        |
        +--> GATC inspection/testing for First Verification

## What It Covers

| Area | Status | Delivered capability |
| --- | :---: | --- |
| Stakeholder onboarding | Done | User, State LMO, and GATC registration with Admin approval |
| Verification workflow | Done | Initial Verification and periodic Re-verification |
| Allocation and scheduling | Done | Assignment plus verifier-confirmed date and time |
| `Application Submitted` | Submitted by the owner |
| `Document Verification` | Awaiting document review |
| `LMO Assigned` / `Verification Scheduled` / `Field Verification` | Re-verification field workflow |
| `GATC Assigned` / `GATC Verification Scheduled` / `Under GATC Verification` | Centre workflow for first verification or LMO transfer |
| `GATC Verification Required` | LMO field verification completed; centre testing is required, not rejected |
| Mobile support | Done | Responsive PWA with camera, GPS, and offline retry |
| `Certificate Generated` / `Completed` | Successful verification certificate is stored |
| `Application Rejected` | Application information was improper or incomplete |
| Reporting | Done | Text and CSV exports plus certificate printing |

## Workflow

```text
Register instrument
        |
        v
Submit Verification / Re-verification application
        |
        v
Admin review and LMO / GATC allocation
        |
        v
Verifier confirms date and time
        |
        v
Field or centre inspection
        |
        +--> Record observations, readings, evidence, and GPS
        |
        v
Verified -----------------------> Digital certificate
        |
        +--> Verification Rejected with reason

Application Rejected occurs before inspection when submitted information is improper.
```

### Application states

| State | Meaning |
| --- | --- |
| `Pending` | Submitted and waiting for review |
| `Inspection Required` | Approved and ready for inspection |
| `Inspection Scheduled` | Date and time confirmed by the assigned verifier |
| `Verified` | Inspection passed and details matched |
| `Application Rejected` | Application information was improper or incomplete |
| `Verification Rejected` | Instrument details did not match during inspection |

## Roles

### User

Register instruments, upload supporting documents, submit Verification or Re-verification applications, select a preferred date, track progress, receive alerts, and view or verify certificates.

### State Legal Metrology Officer

Review assigned applications, schedule inspections, record observations and readings, capture field evidence and GPS, complete verification, issue certificates, and export reports.
        ----------------+     +-------------------------+     +------------------+

### Government Approved Test Centre

        ----------------+     +-------------------------+     +------------------+
Use the controlled verifier workspace for centre-based testing. GATC accounts are separately identified during registration and require Admin approval.

### Administrator

Approve verifier registrations, manage users and verifiers, allocate applications, monitor pendency and expiry, maintain the enforcement register, search records, and export operational reports.

## Feature Highlights

### Instrument and application management

- Instrument records with category, location, status, validity, and documents.
- Initial Verification and periodic Re-verification application types.
- Applicant-selected preferred date stored separately from the final scheduled date.
- Distinct application rejection and verification rejection reasons.
- Searchable application history.

### Mobile field inspection

The responsive inspection form records the reference standard, observed reading, permissible error, inspection observations, result, rejection reason, camera photographs or PDF evidence, GPS coordinates, verifier identity, and inspection date.

### Digital certificates and QR verification

Certificates include the application, applicant, instrument, issue date, validity date, issuing verifier, and lifecycle status. QR codes contain only the certificate ID. Verification retrieves the authoritative certificate record from the server, so edited URL data is not accepted as genuine.

### Validity and alerts

- **Active:** more than 30 days remaining
- **Expiring Soon:** 30 days or fewer remaining
- **Expired:** validity date has passed

Users receive reminders to begin Re-verification. Notification read state is stored locally in the browser.

### Enforcement register

Administrators can create and search compliance cases linked to applications. Cases record jurisdiction, action, status, notes, opening date, and the Admin who created the case.

### PWA and offline support

OVS-WM can be installed from a supported mobile browser. The service worker caches the static application shell but never caches authenticated API responses. Failed state writes are queued locally and retried when connectivity returns.

## Architecture

```text
                 HTTPS / JSON API / session cookie
                                |
                                v
+----------------+     +-------------------------+     +------------------+
| Browser / PWA  | --> | Node.js HTTP server     | --> | data/store.json  |
| Role UI        |     | Auth, API, validation   |     | Pilot persistence|
| Camera / GPS   |     | QR lookup, hashing      |     |                  |
+----------------+     +-------------------------+     +------------------+
```

### Project map

| File | Responsibility |
| --- | --- |
| `server.js` | HTTP server, authentication, authorization, API, hashing, persistence |
| `script.js` | Role-based single-page UI and workflow actions |
| `notifications.js` | Role-scoped workflow and expiry notifications |
| `qr-system.js` | QR generation and certificate verification |
| `styles.css` | Responsive visual system |
| `manifest.webmanifest` | Installable PWA metadata |
| `service-worker.js` | Static shell caching and offline fallback |
| `data/store.json` | Local pilot data store |
| `railway.json` | Railway deployment configuration |

## Run Locally

### Prerequisites

- Node.js 18 or newer
- npm

### Start

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

The Node.js server serves the frontend directly, so no build step is required.

## API Overview

| Method | Endpoint | Purpose | Access |
| :---: | --- | --- | --- |
| `POST` | `/api/register` | Register a User, State LMO, or GATC | Public |
| `POST` | `/api/login` | Authenticate a stakeholder | Public |
| `POST` | `/api/logout` | Invalidate the current session | Authenticated |
| `GET` | `/api/bootstrap` | Return role-filtered application data | Authenticated |
| `PUT` | `/api/profile` | Update the authenticated profile | Authenticated |
| `PUT` | `/api/state` | Persist validated workflow changes | Authenticated |
| `GET` | `/api/certificates/:id/public` | Public QR certificate lookup | Public |

The prototype uses a state synchronization endpoint for simple deployment. The server validates role, ownership, assignment, workflow transitions, and certificate issuance before accepting changes.

## Security

- Passwords are stored with scrypt hashes.
- Legacy plaintext records migrate on startup or successful login.
- Sessions use HttpOnly, SameSite, expiring cookies and explicit logout invalidation.
- User responses contain only the user's own records.
- LMO and GATC actions are limited to assigned applications.
- Completed verification records cannot be deleted by users.
- QR verification uses an authoritative server lookup.
- Authenticated API responses are excluded from the service-worker cache.
- User-controlled values are escaped before HTML rendering.

## Deployment

The repository includes `railway.json` for Railway.

1. Push the repository to GitHub.
2. In Railway, create a project and choose **Deploy from GitHub repo**.
3. Select the repository; Railway will use `railway.json` and `npm start`.
4. Add a Railway Volume mounted at `/app/data`.
5. Set `DATA_DIR=/app/data` and `NODE_ENV=production` in the service variables.
6. Generate a public domain and confirm the health check passes at `/health`.
7. Replace all demo credentials before exposing the service publicly.

Use HTTPS, protect the persistent volume, and back up the data regularly. Railway Volumes are available to a single service instance, so run this prototype as one replica.

## Production Roadmap

The current implementation is suitable for a demonstrator and single-instance pilot. A production deployment should additionally provide:

- PostgreSQL or another transactional database
- Object storage for photographs and large attachments
- Append-only audit events and retention policies
- Institutional SSO, MFA, and password-reset workflows
- Rate limiting, CSRF protection, security headers, and stronger validation
- Formal jurisdiction, verifier availability, and conflict rules
- Background email, SMS, or push notification delivery
- Encrypted local field storage and offline conflict resolution
- Digital signatures or PKI-backed certificate signing
- Government reporting integrations and archival policies
- Automated unit, integration, accessibility, and mobile browser tests

## Legal Notice

OVS-WM is a software prototype intended to support workflows associated with the Legal Metrology Act, 2009 and the Legal Metrology (General) Rules, 2011. It does not itself constitute a legal approval, notification, verification stamp, or regulatory interpretation. Deployment authorities must configure certificate formats, security controls, retention policies, and operational rules according to applicable Central and State Legal Metrology requirements.
