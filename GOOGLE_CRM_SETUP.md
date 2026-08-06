# Toronto Finance Company — Google CRM Setup

The website UI is installed. Complete these steps once to activate live Google Sheets, Drive uploads, client logins, admin updates and approval email alerts.

## 1. Create Google resources

1. Create a Google Sheet named **Toronto Finance Company CRM**.
2. Create a Google Drive folder named **Toronto Finance Company Applications**.
3. Copy the Sheet ID and Drive folder ID from their URLs.

## 2. Deploy the Apps Script backend

1. Open the Google Sheet.
2. Select **Extensions → Apps Script**.
3. Replace the editor contents with `google-apps-script/Code.gs` from this repository.
4. Set these values at the top of the file:
   - `SHEET_ID`
   - `ROOT_FOLDER_ID`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `CLIENT_PORTAL_URL`
5. Run `healthCheck` once and approve the requested Google Sheets, Drive and email permissions.
6. Select **Deploy → Manage deployments**.
7. Edit the existing Web App deployment and select **New version**.
8. Execute as **Me**.
9. For a public client portal, set access to **Anyone**.
10. Deploy. Editing the existing deployment normally keeps the same Web App URL.

## 3. Connect the website

Edit `crm-config.js`:

```js
window.TFC_CONFIG = {
  apiUrl: "YOUR_DEPLOYED_APPS_SCRIPT_WEB_APP_URL",
  minimumStatements: 6,
  demoMode: false
};
```

## 4. Portal addresses

- Client portal: `client-dashboard.html`
- Admin CRM: `admin.html`
- Eligibility form: `eligibility.html`

## What is automated

- One CRM row per account
- One Drive folder per application
- Bank Statements, Identification, Financial Statements and Other Documents subfolders
- Minimum six statement tracking
- Client login using application email/password
- Client information, documents and status tracking
- Central advisor message and approval terms
- Admin application list, filters and status counts
- Admin messages, approval amount, quote, advisor and internal notes
- Direct Drive-folder link from the admin file
- Email alert when a file first reaches **Conditional Approval**
- A second email alert when a file first reaches **Approved**
- Approval details remain private; the email directs the client to log in
- Duplicate alerts for the same approval status are prevented
- Notification status, date and any email error are stored in the CRM row

## Approval email behaviour

The email is sent only when the admin saves one of these statuses:

- `Conditional Approval`
- `Approved`

The email does not show the approved amount, pricing or conditions. It contains a secure client-portal login link. The Apps Script uses `MailApp`, so the Google account that owns the deployment must authorize email sending and is subject to Google's daily sending quota.

## Security note

The included Apps Script is a practical MVP. Before handling sensitive production documents, add stronger session tokens, password reset, rate limiting, admin multi-factor authentication and a formal privacy/security review. Do not leave `demoMode` enabled in production.
