# AEGIS Platform Workspace Directives

## Brand & Product Name Sanitization Rules
- NEVER use third-party vendor or cloud product names (`Firestore`, `Google Cloud`, `Google GenAI`, `gcloud`, `AMD SEV-SNP`, `Gemini`, `Vertex AI`, `aegis-506110`).
- Always use generalized enterprise terminology:
  - Database Storage -> **Database Registry**
  - AI Models -> **AI Judicial Models**
  - Enclaves -> **Hardware Trusted Execution Environment (TEE)**
  - Catalog Telemetry -> **Space Catalog Registry**
  - Key Management -> **Cryptographic Key Management System**

## CLI & User Interface Rules
- No emojis anywhere in the CLI output or UI components.
- No decorative divider lines (e.g., `====================`). Use clean `cli-table3` boxes.
- Keep menu options clean, short, direct, and numbered sequentially.
- No unverified hardcoded claims in footers or interfaces.

## Security & Attestation Rules
- Always require strict password attestation before rendering server diagnostic status.
- No hardcoded local machine credential paths or homedir fallbacks.
