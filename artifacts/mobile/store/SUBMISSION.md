# EDUwAI — App Store & Google Play submission pack

Everything the two stores ask for, in the order you'll be asked. Text marked
**[CONFIRM]** is a draft or a fact only you can confirm.

| | |
|---|---|
| App name | **EDUwAI** |
| Bundle ID / package | iOS `com.edwai.app` · Android `in.eduwai.app` (com.edwai.app was already taken on Google Play) |
| Version | 1.0.0 (build 1) |
| Category | Education |
| Price | Free (no in-app purchases in the store apps — see §6) |
| Support / contact email | techadmin@eduwai.in (use for App Store Connect, Play Console contact and support) |
| Website | https://eduwai.in |
| Privacy policy | https://eduwai.in/privacy-policy (live, checked 17 Nov 2026) |
| Terms | https://eduwai.in/terms |

---

## 1. Store listing text

**Subtitle (App Store, ≤30 chars):** `AI study help from your books`

**Short description (Google Play, ≤80 chars):**
`Ask questions and get answers straight from your school textbooks.`

**Promotional text (App Store, ≤170 chars):**
`Pick your board, class and textbook, then ask anything. EDUwAI answers from the book itself and explains concepts step by step.`

**Full description (both stores, ≤4000 chars):**

```
EDUwAI is a study companion for Indian school students. Choose your state board, class and textbook, then ask questions in your own words — EDUwAI finds the answer in your textbook and shows where it comes from.

ANSWERS FROM YOUR BOOK
• Select your board, class, subject and textbook
• "Answer from Book" gives you the exact answer from the chapter
• "Learn Concept" explains the idea step by step, with maths and science formatting

USE YOUR OWN MATERIAL
• Upload your own textbooks and notes as PDFs
• Add YouTube lessons and get notes or ask questions about them

STUDY TOOLS
• Flashcards to revise what you've learned
• Ask by voice — speak your question instead of typing
• History of your recent questions
• Light and dark themes, English and Hindi

Sign in with your phone number or email. Your account works on the EDUwAI website too.

AI-generated answers can contain mistakes — always check important answers against your textbook.
```

**Keywords (App Store, ≤100 chars, comma-separated):**
`textbook,homework,study,NCERT,CBSE,state board,exam,class 10,AI tutor,learning,science,maths`
**[CONFIRM board names you support]**

**What's New (v1.0.0):** `First release of EDUwAI for iPhone and Android.`

---

## 2. Screenshots

| Store | Required size | Device used |
|---|---|---|
| App Store — iPhone 6.9" | 1320 × 2868 (portrait) | iPhone 18 Pro Max simulator |
| Google Play — phone | 1080 × 1920 minimum, 9:16–2:1 | Pixel emulator |
| Google Play — feature graphic | 1024 × 500 PNG/JPG | **design needed** |

iPad screenshots are not needed (`supportsTablet: false`).
Use a demo account (not a real student) so no personal names or emails appear.
Suggested set (3–6): Textbook picker · An answer from the book · Learn Concept explanation · Own Books upload · Flashcards · Profile.

---

## 3. App Review information (Apple) / App access (Google)

Reviewers must be able to sign in. Enter these **directly in App Store Connect
(App Review Information → Sign-in required) and Play Console (App content → App access)** — do not put the password in this file.

- Demo account: **[you provide — phone/email + fixed OTP or password]**
- The account should have a board/class with textbooks available, so the reviewer sees answers (not "No classes available yet").

**Notes for the reviewer (paste into both stores):**

```
EDUwAI answers students' questions from their school textbooks.

To test:
1. Sign in with the demo account above.
2. On the Textbooks tab, the class, subject and textbook are pre-selected for this account.
3. Type a question (e.g. "What is photosynthesis?") and tap "Answer from Book" or "Learn Concept".
4. "Own Books" lets you upload a PDF or add a YouTube video.
5. Account deletion: Profile → Delete Account.

The app has no in-app purchases. Microphone is used only when the user taps the voice button to ask a question. Camera/photos are used only to set a profile picture or photograph a textbook page.
```

---

## 4. Privacy — App Store "App Privacy" labels

Data **linked to the user**, **not used for tracking** (no third-party ads or tracking SDKs found in the app):

| Apple category | Data | Purpose |
|---|---|---|
| Contact Info | Name, Email address, Phone number | App functionality, Account |
| User Content | Photos (profile photo, page photos), Audio (voice questions), Other content (questions, uploaded PDFs, YouTube links) | App functionality |
| Identifiers | User ID; Device ID (push token) | App functionality |
| Other Data | School board, class, state | App functionality, Personalisation |

**[CONFIRM]** whether the backend uses any analytics/crash reporting; if yes, add "Usage Data"/"Diagnostics".
Tracking: **No** (no App Tracking Transparency prompt needed).

## 5. Privacy — Google Play "Data safety"

- Data collected: Personal info (name, email, phone), Photos, Audio (voice), Files & docs (PDFs), App activity (questions asked), Device IDs (push token).
- Shared with third parties: **No** **[CONFIRM — say Yes if questions are sent to an external AI provider under your name; Google counts service providers as "not shared"]**
- Encrypted in transit: **Yes** (HTTPS only).
- Users can request deletion: **Yes** — in-app (Profile → Delete Account). Google also requires a **web link** for deletion requests: **[needed — the website has no /delete-account page yet; add one that tells users to email techadmin@eduwai.in or sign in and delete]**.

---

## 6. Changes made in the app for store compliance

| Rule | Problem | Fix |
|---|---|---|
| Apple 3.1.1 / Play Payments | Upgrade buttons and Profile linked to eduwai.in to buy plans | Hidden in iOS/Android builds (`constants/storePolicy.ts`). Plan usage still shows; web unchanged. Users who pay on the web keep their plan in the app. |
| Apple 4.8 | Google login offered without Sign in with Apple | Sign in with Apple added (iOS), **switched off until the backend endpoint exists**; while off, iOS hides Google login. |
| Apple 5.1.1 | "Privacy Policy" / "Terms" in Profile opened the login page | Now open `/privacy-policy` and `/terms`. |
| Play photo permissions | Requested READ_MEDIA_IMAGES / storage for a profile photo | Removed and blocked; system photo picker needs no permission. |
| Apple ITMS-90683 / Play location | Unused `expo-location` pulled in location permissions | Package removed; location permissions blocked. |
| Export compliance | — | `ITSAppUsesNonExemptEncryption = false` (HTTPS only). |
| iOS 27 | App crashed at launch (scene lifecycle) | Config plugin `plugins/with-ios-scene-lifecycle.js`. |
| Release builds | `babel-preset-expo` not resolvable → store builds would fail | Added as a direct dev dependency. |

---

## 7. Backend work needed (not in this repo)

### 7a. Sign in with Apple — `POST /api/auth/apple`
Request JSON:
```json
{ "identity_token": "<JWT from Apple>", "authorization_code": "<string|null>", "full_name": "<string|null>", "email": "<string|null>" }
```
Server must: verify `identity_token` against Apple's JWKS (`https://appleid.apple.com/auth/keys`), check `iss = https://appleid.apple.com` and `aud = com.edwai.app`; use `sub` as the stable Apple user ID; `email`/`full_name` arrive **only on the first sign-in**, so store them then.
Response: same shape as `/api/auth/phone/verify-otp` (`access_token, refresh_token, token_type, is_new_user, profile_complete, user`).
Account deletion must also revoke the Apple token (`https://appleid.apple.com/auth/revoke`) — Apple 5.1.1(v).

When live, build with `EXPO_PUBLIC_APPLE_SIGNIN_ENABLED=true` (add to the `production` profile `env` in `eas.json`). That turns on the Apple button **and** Google login on iOS.

### 7b. Google login (both platforms)
The app currently runs Google OAuth inside a WebView with a spoofed Chrome user agent. Google's OAuth policy forbids embedded WebViews and may block it at any time. Recommended: open the flow in the system browser (`expo-web-browser` `openAuthSessionAsync`) and have the backend accept a `redirect_uri=eduwai://auth` and redirect there with the token.

---

## 8. Ratings questionnaires

- **Apple age rating:** no violence, mature or gambling content. **[CONFIRM]** whether users can see other users' content (no). Recommended: **4+**, but see the note below.
- **Google content rating (IARC):** Education, no objectionable content.
- **Google target audience** **[DECIDE]**: if any target users are under 13 (classes 1–7), Google's *Families policy* applies (stricter ads/data rules, teacher-approved review). If you choose **13+**, say so on the listing and in the privacy policy.

---

## 9. Submission steps

**Apple**
1. `eas build -p ios --profile production` (you sign in with Apple ID + 2FA when prompted).
2. `eas submit -p ios --latest` → creates/uses the App Store Connect record and uploads to TestFlight.
3. App Store Connect: fill §1–§4 and §8, attach screenshots, select the build, **Submit for Review**.

**Google**
1. `eas build -p android --profile production` → `.aab` file.
2. Play Console → Create app → complete *App content* (privacy policy, app access §3, ads: No, content rating, target audience, data safety §5).
3. **First upload is manual**: Testing → Internal testing → upload the `.aab`. Google requires a closed test with testers before production for new personal developer accounts **[CONFIRM account type]**.
4. Later releases: create a Play service-account JSON key, then `eas submit -p android`.
