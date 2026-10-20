# Feature context for Test Companion exploration

Edit this file in the PR that ships the feature. The next workflow (exploration) reads it
and passes it to `tc app generate` as the exploration instructions.

## App
BStack Bank (Android, package com.yash.bankingapp)

## Feature under test
Region functionality. From the dashboard, a logged-in user opens the Region quick action and
the app shows the user's region details (Region Info screen with a "Region Details" section),
fetched live from the device's public IP address.

## Where to find it in the app
1. Launch the app. On the login screen, tap the "Regular User" button to log in as a regular user.
2. On the dashboard, find the Region option in the Quick Actions. Its label shows the detected
   city name, or "Region" while the location is not known yet.
3. Tap it to open the "Region Info" screen.

(Login credentials come from your test data, never put secrets here.)

## What to verify
- Region quick action is visible on the dashboard after logging in as a Regular User.
- Tapping it opens the Region Info screen.
- Region details are fetched and shown, including the "Region / State" row, under "Region Details".
- The refresh button reloads the details.
- If the region data cannot be fetched, the screen shows "Could not fetch region data".

## What good test cases look like
- One user-visible behaviour per test case
- Numbered steps, each with one clear expected result
- Include happy path and key negative cases (for example no network, refresh, back navigation)

--