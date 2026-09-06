# Toronto Finance Company — Current CRM Setup

This document describes the CRM architecture that is actually in use now.

## Current stack

- GitHub Pages — public website, admin CRM and client portal
- Google Apps Script — CRM/API controller
- Google Sheets — application records
- Google Drive — client folders and uploaded documents
- Gmail / Mail services — signup, client-update and client-response notifications

## Current backend reference

Use `google-apps-script/Code_SIMPLE.gs` as the repository reference for the current backend.

Important: the GitHub copy intentionally contains a placeholder `ADMIN_PASSWORD`. Do not replace the real password in the deployed Apps Script with that placeholder.

The deployed endpoint used by the frontend is defined in `crm-config.js`.

Frontend-only GitHub changes do not require an Apps Script deployment. Any change to `Code_SIMPLE.gs` requires a new Apps Script deployment version before that backend change is live.

## Current frontend files

### Public website

- `index.html`
- `app.js`
- `crm-integration.js`
- `eligibility.html`

`apply.html` redirects to the account-creation flow in `index.html?apply=1`, so there is only one signup implementation to maintain.

Privacy and Terms are now linked directly from `app.js`; the previous runtime legal-link repair script has been removed.

### Client portal

`client-dashboard.html` is the single current client portal implementation. It contains:

- client login
- Adobe Sign embed
- Step 1 signing confirmation
- cross-device Step 1 persistence using the CRM record
- Step 2 bank-statement upload
- financing decision display
- client Proceed / Request More Information response
- requested-document uploads
- automatic client refresh

The previous standalone client workflow-state patch has been removed. Signature state, Step 2 unlocking, workflow messaging and CRM synchronization now live directly in `client-dashboard.html` so there is one source of truth.

Unused future/status placeholder cards are not rendered. Status-based sections such as financing details and additional-document requests remain hidden until the CRM record requires them.

`client-portal.html` remains only as a compatibility redirect.

### Cross-device signature state

The backend schema includes:

- `signatureConfirmed`
- `signatureConfirmedAt`

When the client presses **I Have Finished Signing**, the portal immediately retains the browser confirmation and also calls `clientConfirmSignature` to save the confirmation against the application record.

On later logins, including from a different browser or device, `clientLogin` / `getClient` returns the saved signature state. Step 1 remains complete and Step 2 remains unlocked.

Existing clients with a previous browser-only Step 1 confirmation are migrated automatically when they next open the portal. Existing bank-statement progress can also restore and synchronize the signing workflow state.

### Bank-statement uploads

Bank statements are validated as PDF files in the portal and again in the backend. Individual uploads are limited to 20 MB.

Statement uploads update the statement count. They may move early-stage files between `Statements Required` and `Ready for Review`, but they do not push a mature file such as `Under Review`, `Additional Documents Required`, `Conditional Approval`, `Approved`, `Funded` or `Declined` backward to an earlier status.

### Client-safe CRM responses

Client-facing actions return a limited field set needed by the client portal. Internal advisor notes, Drive folder IDs/URLs and notification bookkeeping are not returned in normal client account responses.

### Admin CRM

The current admin frontend is:

- `admin.html`
- `admin.js`
- `admin-extensions.js`

`admin-extensions.js` contains Save & Notify, browser-session persistence and Drive document activity.

Dynamic client-entered data displayed by `admin.js` is HTML-escaped before being inserted into admin CRM markup.

## Current workflow

1. Client creates an account from the public website.
2. The client is opened into `client-dashboard.html`.
3. The client reviews and signs through Adobe Acrobat Sign.
4. The client confirms the signing step in the portal.
5. The confirmation is saved to the application record for cross-device persistence.
6. The client uploads the required business bank statements.
7. Uploaded documents are stored in the application's Google Drive folder.
8. Admin reviews the file in `admin.html`.
9. Admin can update status, advisor message, financing terms and requested documents.
10. Admin can save silently or save and notify the client.
11. Client sees updated information in the portal and can respond to available financing.

## Known security limitation — future backend phase

The present backend verifies credentials at login but does not yet issue a signed, expiring token that must accompany every protected admin/client request.

As a result, browser session state is useful for the interface but is not a complete server-side authorization layer. Application-ID-based endpoints should not be considered fully hardened authorization.

A future Apps Script security upgrade should be staged separately:

1. Add signed expiring admin/client tokens while temporarily retaining compatibility with the current frontend.
2. Deploy that backend version.
3. Update frontend requests to send the tokens.
4. Verify admin, client, uploads and notification workflows.
5. Enforce token validation server-side and retire the compatibility path.

Do not attempt that migration by changing only one side at a time on the live system.

## Legacy files

Other `.gs` files in `google-apps-script/` are older architecture experiments/reference copies. They are not the current deployment source and should not be copied over the working Apps Script deployment during normal maintenance.

The old standalone `adobe-sign-embed.js`, `client-decision.js`, `admin-notify.js`, `admin-doc-activity.js`, `client-workflow-state.js` and `legal-links.js` implementations are not part of the current frontend.