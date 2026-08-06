# Toronto Finance Company — Google CRM Setup

The website UI is installed. Complete these steps once to activate live Google Sheets, Drive uploads, client logins and admin updates.

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
5. Run any function once and approve Google Sheets and Drive permissions.
6. Select **Deploy → New deployment → Web app**.
7. Execute as **Me**.
8. Access: choose the appropriate option for your organization. For a public client portal, use **Anyone**.
9. Copy the deployed Web App URL.

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

- Client portal: `client-portal.html`
- Admin CRM: `admin.html`
- Eligibility form: `eligibility.html`

## What is automated

- One CRM row per account
- One Drive folder per application
- Bank Statements, Identification, Financial Statements and Other Documents subfolders
- Minimum six statement tracking
- Client login using application email/password
- Client profile, business information, documents and status tabs
- Central advisor message and approval/decline quote
- Admin application list, filters and status counts
- Admin messages, approval amount, quote, advisor and internal notes
- Direct Drive-folder link from the admin file

## Security note

The included Apps Script is a practical MVP. Before handling sensitive production documents, add stronger session tokens, password reset, rate limiting, admin multi-factor authentication and a formal privacy/security review. Do not leave `demoMode` enabled in production.
