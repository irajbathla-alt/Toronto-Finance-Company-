# Firebase Authentication setup — Toronto Finance Company

## Current architecture

The browser pages use **Firebase Authentication** for email/password and Google sign-in.
The existing **Google Apps Script + Applications Google Sheet** remain the master
client records, business logic and notifications. **Google Drive** remains the
document store. This change does **not** enable Firestore, migrate client records,
or replace the existing CRM or lender workflow.

The web app configuration is maintained in `firebase-config.js` and imported by:

- `apply.html` (live Create Account)
- `login.html` (live Client Login)
- `verify-email.html` (email verification continuation)
- `tests/apply.html` and `tests/login.html` (staging flows)

Keep the Firebase Web SDK version consistent across these pages and the shared config.
The public Firebase web `apiKey` identifies the project; it is **not** a
private service-account secret. Do not put service-account credentials in GitHub Pages.

## Console steps (require Firebase project administrator)

1. Open [Firebase Console](https://console.firebase.google.com/), choose
   `toronto-finance-company-auth`, then open **Authentication → Sign-in method**.
2. Confirm **Email/Password** and **Google** are enabled. Set the Google support
   email as required by the console.
3. Under **Authentication → Settings → Authorized domains**, confirm that
   `torontofinancecompany.com` is listed. Add `www.torontofinancecompany.com`
   only if served, plus any actual GitHub Pages preview hostname if used.
4. Confirm the signup email verification action/continue URL resolves to
   `https://torontofinancecompany.com/verify-email.html`. Do not use an
   unapproved redirect URL.
5. Check **Project settings → General → Your apps → Web app** to confirm the
   project config in `firebase-config.js`. Do not substitute a different project.
6. Confirm the browser API key is restricted appropriately to Firebase services.
   Review settings after any project-domain change.

**Important:** On GitHub Pages, `signInWithPopup` is the primary Google flow.
The current redirect fallback may fail in browsers blocking third-party storage
when `authDomain` differs from the website origin. Do not assume the redirect
fallback is reliable on every browser without a documented custom-domain or
proxy setup. See Firebase's redirect best practices.

## Apps Script bridge

`google-apps-script/Code_SIMPLE.gs` contains these Firebase bridge actions:
`firebaseTestHealth`, `createAccountFirebaseTest`,
`clientLoginFirebaseTest` and `firebaseTestRequestStatus`.

- Verify that the **existing** deployed Apps Script code includes the same
  `FIREBASE_TEST_BUILD` value used by the frontend's `EXPECTED_BUILD`.
- In the existing Apps Script project, run `authorizeFirebaseExternalRequest`
  once as an authorized owner if the script requests the `UrlFetchApp.fetch` scope.
- Redeploy the **existing** Apps Script deployment only if the deployed code
  differs. Do not create a second Apps Script or a new Applications Sheet.
- Do not create new rows or change lender/email routing merely to test Firebase;
  use a clearly identified test client.

## Smoke test before merging this PR

1. Open the staging account creation and login routes on the test branch or
   preview deployment. Ensure the shared module loads without console errors.
2. Create a test email/password account. Check verification arrives and that
   the verification page finishes with **one** existing-sheet client row.
3. Test Google sign-in from signup. Confirm the result maps to the same client
   account when the email is already verified and matches a permitted record.
4. Sign in using email/password and Google. Confirm the expected dashboard
   opens and that applications/notifications remain unchanged.
5. Attempt login with a Firebase-only identity without a matching TFC file.
   Confirm the **Create Your Account** modal is displayed, rather than granting
   access to a client's records.
6. Test mobile (including Safari) and desktop browsers, network errors,
   expired verification links, password reset, login/out, and refresh.
7. Verify Admin Portal, lender submissions, statements and Drive uploads
   still work without migration or data loss.

## Security release blocker

Firebase email/password or Google sign-in alone is **not** a complete
authorization boundary for the client dashboard. The existing client portal
still stores application/session data in browser storage and the backend does
not yet require a validated, expiring Firebase identity token on **every**
protected client/admin request. Do not claim the portal is fully secured or
move sensitive document access to Firebase until per-request backend
authorization and role checks have been implemented and reviewed.

## References

- [Add Firebase to a web project](https://firebase.google.com/docs/web/setup)
- [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Redirect sign-in best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)
- [Firebase API keys](https://firebase.google.com/docs/projects/api-keys)
