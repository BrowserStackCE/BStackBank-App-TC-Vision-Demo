# BrowserStack Bank

A demo mobile banking app built with Expo (React Native).

## Features

- Email/password login and signup, with the session kept across app restarts
- Dashboard with balance, quick actions and recent transactions
- Transfers to other users, authorised with biometrics / device passcode
- Card payments through Stripe (no biometric step)
- Cards: view, freeze, create and delete
- Shop for premium watches, wallets and specs
- Chat, currency by location, network check, shake-to-report, financial news
- Admin area (users, transactions, controls)

## Project structure

```
app/            Screens (Expo Router)
  (banking)/    Tabbed customer screens
  (admin)/      Admin screens
components/     Shared UI (shimmer, auth modal, error boundary)
constants/      Theme and shop catalogue
hooks/          Shared hooks
store/          API client and app state (Zustand)
types/          Shared TypeScript types
utils/          Validation, logging, default font
plugins/        Expo config plugins
```

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the values.

3. Run the app (a development build is required — native modules such as Stripe are not available in Expo Go)

   ```bash
   npm run android   # or: npm run ios
   ```

## Notes

- Shop product images are remote stock photos listed in `constants/products.ts`.
- Card shades live in `constants/theme.ts` (`CARD_THEMES`).
