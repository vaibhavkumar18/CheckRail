# CheckRail

### Evidence-Driven Payment Expansion Readiness for Global Marketplaces

CheckRail helps online marketplaces evaluate whether their existing payment integration and provider capabilities are suitable for expanding into new countries.

Instead of relying on static provider-country compatibility information, CheckRail analyzes actual marketplace integration code, verifies provider capabilities through Sandbox API execution, and evaluates target-country requirements to identify potential expansion gaps.

---

## The Problem

Expanding a marketplace into a new country involves more than choosing a payment provider.

Businesses need to understand:

- Whether their existing payment integration supports the required operations.
- Whether the payment provider can actually perform those operations.
- Whether the target country introduces additional payment, business, regulatory, or operational requirements.
- What gaps must be addressed before expansion.

These factors are often evaluated separately, making it difficult to establish whether a marketplace is genuinely prepared for expansion.

## Our Solution

CheckRail brings these evaluations together into one evidence-driven assessment platform.

It compares three dimensions:

1. **Marketplace Integration:** Analyzes the marketplace's source code and identifies its existing payment integration capabilities.
2. **Provider Verification:** Executes real Sandbox API operations to observe provider behavior and collect runtime evidence.
3. **Country Intelligence:** Structures target-country requirements for business, payment, regulatory, and operational readiness.

An AI-powered Gap Analysis evaluates the collected information and identifies compatibility gaps, missing capabilities, and recommended actions.

---

## Core Features

### 1. Integration Intelligence
- Upload marketplace payment integration source code.
- Analyze existing payment implementation.
- Generate a structured Integration Profile.
- Identify implemented and potentially missing capabilities.

### 2. Provider Capability Verification
- Connect payment provider Sandbox credentials.
- Execute provider-specific API operations.
- Capture API responses and execution evidence.
- Evaluate observed provider behavior instead of relying only on documentation.

### 3. Country Intelligence
- Structure target-country requirements.
- Evaluate payment-method and operational considerations.
- Organize business and regulatory requirements.
- Support country-specific configuration rather than assuming one country's rules apply everywhere.

### 4. AI Gap Analysis
- Compare marketplace integration capabilities with provider runtime evidence.
- Evaluate relevant country requirements.
- Identify missing capabilities and compatibility gaps.
- Generate evidence-based recommendations.

### 5. Expansion Readiness
- Present assessment findings.
- Highlight potential blockers and missing evidence.
- Summarize compatibility gaps.
- Provide actionable recommendations for expansion planning.

---

## Supported Payment Workflows

CheckRail currently demonstrates two distinct provider workflows.

### PayPal — Payment Processing

The PayPal workflow evaluates marketplace payment-processing integration.

**Workflow:**

```text
Source Code Upload
       |
       v
Integration Intelligence
       |
       v
PayPal Sandbox Verification
       |
       v
AI Gap Analysis
       |
       v
Assessment Results
```

PayPal Sandbox operations include order creation and capture.

Country Intelligence is not part of this demonstration workflow.

### Hyperwallet — Cross-Border Disbursement

The Hyperwallet workflow evaluates recipient management and payment disbursement capabilities for a target-country expansion scenario.

**Workflow:**

```text
Source Code Upload
       |
       v
Integration Intelligence
       |
       v
Country Intelligence
       |
       v
Hyperwallet Sandbox Verification
       |
       v
AI Gap Analysis
       |
       v
Expansion Readiness
```

Hyperwallet verification includes operations such as:

- Recipient creation
- Transfer-method configuration retrieval
- Transfer-method creation
- Transfer-method retrieval
- Payment creation
- Payment status retrieval

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| State Management | Redux Toolkit |
| HTTP Client | Axios |
| Backend | Node.js, Express.js |
| Database | PostgreSQL, Neon |
| Authentication | JWT, HttpOnly Cookies |
| Validation | Zod |
| Credential Security | AES-256-GCM |
| AI Integration | OpenRouter, Groq, Mistral |
| Payment Providers | PayPal, Hyperwallet |

## Architecture

### Frontend Architecture

The frontend follows a feature-based architecture with four layers:

```text
src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── organizations/
│   ├── projects/
│   ├── integrations/
│   ├── verifications/
│   ├── country-intelligence/
│   └── gap-analysis/
├── hooks/
├── services/
└── utils/
```

Each feature separates its UI, hooks, state management, and API logic.

### Backend Architecture

The backend follows a feature-based Node.js and Express architecture, with PostgreSQL as the primary database.

Its responsibilities include:

- Authentication and authorization
- Organization and project management
- Integration analysis
- Provider Sandbox execution
- Evidence collection
- Country requirement management
- AI Gap Analysis
- Expansion readiness assessment

### AI Architecture

The AI layer is designed to be provider-agnostic.

Key design considerations include:

- Structured response validation using Zod.
- Evidence-aware caching.
- Controlled retries and backoff.
- Provider fallback support.
- Deterministic evidence-based fallback when AI generation is unavailable.
- Clear distinction between AI-generated and non-AI results.

---

## Security Considerations

CheckRail handles payment provider credentials and integration information.

Security considerations include:

- JWT-based authentication.
- HttpOnly cookie-based session handling.
- Role-based organization access.
- AES-256-GCM encryption for provider credentials.
- Environment-based configuration.
- Sandbox credentials for demonstrations and testing.

**Never commit real API secrets, provider passwords, or private credentials to a public repository.**

---

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js
- npm
- PostgreSQL database or Neon account
- Git

Provider Sandbox credentials are required for executing provider verification workflows.

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd CheckRail
```

### 2. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file using the environment variable structure required by the backend configuration.

Configure your database connection, authentication secrets, credential-encryption key, and provider credentials.

### 3. Start the Backend

```bash
npm run dev
```

Use the actual scripts defined in your backend `package.json` if they differ.

### 4. Configure the Frontend

Open another terminal:

```bash
cd frontend
npm install
```

Configure the frontend environment variables required by the application.

### 5. Start the Frontend

```bash
npm run dev
```

Open the local URL displayed by Vite.

---

## Project Structure

The repository is organized into separate frontend and backend applications:

```text
CheckRail/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.js
│   └── package.json
│
└── README.md
```

*The structure above illustrates the intended organization; adapt directory names to match the actual repository.*

---

## What Makes CheckRail Different?

Traditional payment-provider comparison tools primarily focus on supported countries, currencies, and payment methods.

CheckRail takes a different approach by connecting three forms of evidence:

| Dimension | What CheckRail Evaluates |
|---|---|
| Implementation Evidence | What the marketplace has actually integrated |
| Runtime Evidence | What the provider can actually execute |
| Country Requirements | What the target market requires |

The result is a more practical assessment of payment integration compatibility and cross-border expansion readiness.

---

## Project Status

CheckRail is being developed as a PayPal AI Hackathon 2026 project.

The current demonstration focuses on:

- PayPal Sandbox payment-processing verification.
- Hyperwallet Sandbox disbursement verification.
- Marketplace integration analysis.
- Target-country intelligence for Hyperwallet expansion.
- Evidence-driven AI Gap Analysis.

---

## Important Disclaimer

CheckRail provides technical and operational readiness assessments based on available implementation data, provider Sandbox evidence, and configured country requirements.

Its assessments are decision-support outputs, not legal advice, regulatory certification, financial advice, or guarantees of production payment-provider approval.

Sandbox success does not guarantee production availability or approval.

---

## Vision

**Make cross-border payment expansion measurable, verifiable, and evidence-driven.**

CheckRail aims to help marketplaces understand not just which payment providers are available, but whether their actual payment implementation is ready to work with those providers in a new market.
