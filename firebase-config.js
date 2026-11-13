/**
 * Shared Firebase Web configuration for Toronto Finance Company.
 *
 * Firebase Authentication only. Google Apps Script and the existing
 * Applications sheet remain the system of record. Never place service
 * account credentials or private server keys in this browser module.
 *
 * The Firebase web config is a public project identifier, not an
 * authorization mechanism. Backend requests must verify identity.
 */
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";

export const firebaseConfig=Object.freeze({
  apiKey:"AIzaSyAXIObBDa-i8W_wAUtt43FXracH7ezPhlA",
  authDomain:"toronto-finance-company-auth.firebaseapp.com",
  projectId:"toronto-finance-company-auth",
  storageBucket:"toronto-finance-company-auth.firebasestorage.app",
  messagingSenderId:"494379883061",
  appId:"1:494379883061:web:54acfe2bc5b27f8fa36f7c"
});
export const firebaseApp=getApps().length ? getApp() : initializeApp(firebaseConfig);
