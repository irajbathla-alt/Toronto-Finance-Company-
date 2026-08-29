# Toronto Finance Company — Current CRM Setup

This document describes the CRM architecture that is actually in use now.

## Current stack

- GitHub Pages — public website, admin CRM and client portal
- Google Apps Script — CRM/API controller
- Google Sheets — application records
- Google Drive — client folders and uploaded documents
- Gmail / Mail services — signup, client-update and client-response notifications

## Current backend reference

Use `google-apps-script/Code_SIMPLE.gs` as the repository reference for the currently deployed backend.

Important: the GitHub copy intentionally contains a placeholder `ADMIN_PASSWORD`. Do not replace the real password in the deployed Apps Script with that placeholder.

The deployed endpoint currently used by the frontend is defined in `crm-config.js`.

Frontend-only GitHub changes do not require an Apps Script deployment.

## Current frontend files

### Public website

- `index.html`
- `app.js`
- `crm-integration.js`
- `eligibility.html`

`apply.html` now redirects to the account-creation flow in `index.html?apply=1`, so there is only one signup implementation to maintain.

### Client portal

`client-dashboard.html` is the single current client portal implementation. It contains:

- client login
- Adobe Sign embed
- Step 1 signing confirmation
- Step 2 bank-statement upload
- financing decision display
- client Proceed / Request More Information response
- requested-document uploads
- automatic client refresh

`client-portal.html` remains only as a compatibility redirect.

### Admin CRM

The current admin frontend is:

- `admin.html`
- `admin.js`
- `admin-extensions.js`

`admin-extensions.js` consolidates the previous notification/session helper and Drive activity helper into one file.

Dynamic client-entered data displayed by `admin.js` is HTML-escaped before being inserted into admin CRM markup.

## Current workflow

1. Client creates an account from the public website.
2. The client is opened into `client-dashboard.html`.
3. The client reviews and signs through Adobe Acrobat Sign.
4. The client confirms the signing step in the portal.
5. The client uploads the required business bank statements.
6. Uploaded documents are stored in the application's Google Drive folder.
7. Admin reviews the file in `admin.html`.
8. Admin can update status, advisor message, financing terms and requested documents.
9. Admin can save silently or save and notify the client.
10. Client sees updated information in the portal and can respond to available financing.

## Known security limitation — future backend phase

The present backend verifies credentials at login but does not yet issue a signed, expiring token that must accompany every protected admin/client request.

As a result, browser session state is useful for the interface but is not a complete server-side authorization layer.

A future Apps Script security upgrade should be staged separately:

1. Add signed expiring admin/client tokens while temporarily retaining compatibility with the current frontend.
2. Deploy that backend version.
3. Update frontend requests to send the tokens.
4. Verify admin, client, uploads and notification workflows.
5. Enforce token validation server-side and retire the compatibility path.

Do not attempt that migration by changing only one side at a time on the live system.

## Legacy files

Other `.gs` files in `google-apps-script/` are older architecture experiments/reference copies. They are not the current deployment source and should not be copied over the working Apps Script deployment during normal frontend maintenance.

The old standalone `adobe-sign-embed.js`, `client-decision.js`, `admin-notify.js` and `admin-doc-activity.js` implementations have been removed from the current frontend to prevent duplicate logic.
