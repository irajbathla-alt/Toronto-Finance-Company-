# Toronto Finance Company — Apps Script CRM v2

This project runs on the existing stack only:

- GitHub Pages — website, admin CRM and client portal
- Google Apps Script — secure API/controller
- Google Sheets — application database, documents metadata, activity and notification queue
- Google Drive — client folders and uploaded documents
- MailApp — approval alert emails

## 1. Apps Script configuration

The repository `google-apps-script/Code.gs` already contains:

- Spreadsheet ID: `1pRN82iNCVpU31DJQA3xUrMVkMcPRPv1Rl69WH3VRco4`
- Root Drive folder ID: `1ao4Tlk65yxtr8yHGJaNGqyKPOHYFfXjb`
- Admin email: `admin@torontofinance.ca`
- Client portal URL

Do not store the real admin password in GitHub.

After replacing `Code.gs`, run this once from the Apps Script editor with your preferred admin password:

```javascript
setAdminPassword('YOUR-PRIVATE-ADMIN-PASSWORD')
```

The password is saved in Apps Script Script Properties rather than the public repository.

## 2. Initialize the CRM

Run this once from Apps Script:

```javascript
setupSystem()
```

It automatically:

- adds any missing Applications columns without deleting existing data
- creates the `Documents` sheet
- creates the `Activity` sheet
- creates the `Notifications` sheet
- initializes the application number sequence
- creates a private session-signing secret in Script Properties
- installs one time-driven trigger for `processNotificationQueue`

The notification trigger runs every minute. Approval emails are therefore separated from admin saves, so the admin receives an immediate save result instead of waiting for MailApp.

## 3. Deploy the web app

Apps Script → **Deploy → Manage deployments → Edit**

Choose:

- **New version**
- **Execute as:** Me
- **Who has access:** Anyone

Deploy the new version.

The website is currently configured to use:

`https://script.google.com/macros/s/AKfycby6bmKACh-ddzZ9_Qy20pZgIhr-xJkxtH8q3Y0X9TxX3OVbXUeIkpGsiL6Jya4fwClX/exec`

If a future Apps Script deployment produces a different `/exec` URL, update only `crm-config.js`.

## 4. Architecture

### Applications

One row per financing application. Important fields include:

- status
- statements
- advisor
- messageTitle / messageBody
- approvedAmount / quote
- notes
- driveFolderId / driveUrl
- revision
- nextAction
- stageUpdatedAt
- signatureConfirmed / signatureConfirmedAt
- approval notification tracking

### Documents

Document metadata is stored separately so the CRM does not recursively scan Google Drive during every page load.

Existing Drive folders are indexed automatically the first time their documents are requested.

### Activity

Records meaningful events such as:

- account creation
- signature confirmation
- document upload
- stage change
- client-facing update
- Drive folder creation
- approval email sent

### Notifications

Approval alerts are queued instead of being sent inside `adminUpdate`.

`processNotificationQueue()` handles pending alerts through MailApp and retries failed sends up to three times.

## 5. Performance principles

The CRM v2 intentionally:

- batches Sheet reads/writes
- caches application and admin-list reads briefly
- reads only one application row for client requests
- does not crawl Drive during `adminList`
- creates Drive folders only when required
- stores document metadata separately
- uses revision numbers to prevent accidental overwrite from two admin sessions
- uses signed, expiring sessions instead of trusting cached application IDs
- returns admin saves before email delivery

## 6. Health check

After deployment, open the Apps Script `/exec` URL directly or add `?action=health`.

A healthy response should show:

- `ok: true`
- `service: Toronto Finance Company CRM v2`
- `sheetWritable: true`
- `driveWritable: true`
- `notificationTriggerInstalled: true`
- `sessionSecretConfigured: true`
- `adminPasswordConfigured: true`

## 7. Client workflow

1. Client creates an account.
2. Apps Script returns a signed client session and the website opens the dashboard.
3. Client completes Adobe Sign and confirms completion.
4. Signature completion is stored in Google Sheets, not browser local storage.
5. Client uploads PDF statements.
6. Files are stored in the application Drive folder and metadata is added to `Documents`.
7. The file automatically moves to `Ready for Review` after the required statements are received, unless it has already progressed to a later stage.
8. Admin changes the stage and client message.
9. Client dashboard sees the updated stage, next action, advisor message and approval information.
10. Conditional Approval / Approved queues an email alert without slowing the admin save.

## 8. Admin workflow

The admin CRM now uses one implementation only:

- `crm-api.js` — communication/session layer
- `admin-app.js` — admin workflow
- `client-app.js` — client workflow
- `google-apps-script/Code.gs` — backend

The previous admin patch/save-fix scripts are intentionally removed.