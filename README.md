# Toronto Finance Company Website

Current production frontend for Toronto Finance Company.

## Current frontend structure

- `index.html` + `app.js` — public website and account-creation flow
- `eligibility.html` — public pre-eligibility tool
- `client-dashboard.html` — single client portal implementation, including Adobe Sign, statement uploads, requested documents and financing responses
- `admin.html` + `admin.js` + `admin-extensions.js` — admin CRM, notifications, browser-session persistence and Drive activity
- `apply.html` — compatibility redirect to the main account-creation flow
- `client-portal.html` — compatibility redirect to the current client dashboard
- `crm-config.js` — current Apps Script endpoint and shared frontend configuration
- `crm-integration.js` — public account creation integration

## Backend

The currently used backend is maintained separately in Google Apps Script. The repository copy used as the current reference is:

`google-apps-script/Code_SIMPLE.gs`

Frontend-only changes do not require an Apps Script deployment.

Do not overwrite the real deployed `ADMIN_PASSWORD` with the placeholder stored in GitHub.

The other Apps Script files in `google-apps-script/` are retained only as historical/legacy references and should not be deployed over the current working backend unless intentionally migrating architectures.

## Important security limitation

The current backend does not yet issue and validate signed client/admin session tokens on every protected request. The browser login/session UI is therefore not a complete server-side authorization boundary. A future backend security phase should add expiring server-validated sessions before the portal is treated as fully hardened for sensitive production data.

## GitHub Pages

The site is served from the `main` branch and the custom domain configuration in `CNAME`.
