# StockClock

StockClock is a mobile stock tracking and alert app built with Expo and React Native for CS178. It focuses on at-a-glance market monitoring, watchlist management, price alerts, stock detail charts, headline sentiment display, and presentation-friendly caching behavior.

## App Screenshots

### Home
<img src="screenshots/home.PNG" width="300" alt="Home screen" />

### Stock Detail
<img src="screenshots/stock.PNG" width="300" alt="Stock detail screen" />

### Alerts
<img src="screenshots/alerts.PNG" width="300" alt="Alerts screen" />

### News
<img src="screenshots/news.png" width="300" alt="News screen" />

### Settings
<img src="screenshots/settings.png" width="300" alt="Settings screen" />

## Current Features

- Real stock symbol search and watchlist management
- Live quote fetching with local caching
- Stock detail page with multi-range chart support
- Tap-to-read chart points for exact price and time
- Performance summary and stock-related recent news on the detail page
- Alert creation, toggling, editing, and demo trigger mode for presentations
- News page with grouped headlines, sentiment bars, and in-app article opening
- Cached news fallback when the backend is unavailable
- Theme support with light, dark, and system preference
- Settings for Smart Data Mode, cache fallback, auto refresh, default chart range, and news item count

## Recent Project Updates

This version includes several presentation-focused improvements:

- **Stock detail upgrades**
  - More chart ranges, including intraday hour-based ranges
  - Default detail chart range can be controlled from Settings
  - Related headlines now appear directly on the stock detail page

- **News experience upgrades**
  - Headlines open inside the app instead of forcing a jump to the phone's browser app
  - If a live news request fails, the app can fall back to previously cached news

- **API usage optimization**
  - Smart Data Mode reduces unnecessary market API usage during market-closed periods
  - Cache-first behavior helps reduce repeated calls during testing and demos

- **Settings page expansion**
  - Theme
  - Smart Data Mode
  - Use Cached Data When Offline
  - Auto Refresh
  - Default Chart Range
  - News Items Per Stock

## Tech Stack

- Expo
- React Native
- Expo Router
- TypeScript
- Twelve Data API
- react-native-svg
- AsyncStorage
- expo-web-browser

## Project Structure

```text
app/            Main screens and routes
components/     Shared UI components
constants/      Theme and app constants
hooks/          Custom hooks
services/       API and data logic
assets/         Images and static assets
screenshots/    README screenshots
```

## Requirements

Before running the project, make sure you have:

- Node.js
- npm
- Expo Go on your phone, or an iOS / Android simulator

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/PYwaterfriend/stockclock.git
cd stockclock
```

### 2. Install dependencies

```bash
npm install
```

### 3. Install required Expo packages

```bash
npx expo install react-native-svg @react-native-async-storage/async-storage expo-web-browser
```

### 4. Add your Twelve Data API key

Open:

```text
services/marketData.ts
```

Replace the API key placeholder with your own Twelve Data API key.

Example:

```ts
export const TWELVE_DATA_API_KEY = "YOUR_API_KEY_HERE";
```

## Running the App

Start the project with:

```bash
npx expo start
```

Then:

- Scan the QR code using Expo Go
- Or run it in a simulator

If Metro or bundling behaves strangely, clear cache:

```bash
npx expo start -c
```

## Notes About Data and Demo Behavior

### Smart Data Mode

Smart Data Mode is intended to reduce free API usage during development and presentation. When enabled, the app prefers saved market data during market-closed periods instead of repeatedly requesting fresh data.

### Cached Data Fallback

If enabled in Settings, the app can fall back to cached quote, chart, or news data when a live request fails. This helps keep the demo usable even when the backend or network is unstable.

### News Backend

The news tab depends on a local or custom backend endpoint. If the backend is unavailable, cached headlines can still be shown if they were loaded successfully before.

## Troubleshooting

### Market data does not appear

Check:

- The Twelve Data API key is set correctly in `services/marketData.ts`
- The free API limit has not been exceeded
- Smart Data Mode is not making you look at saved data when the market is closed

### News does not appear

Check:

- Your backend server is running
- The news endpoint URL in the project matches your local backend
- Cached fallback is enabled if you want offline demo protection

### Dependency issues

Try reinstalling:

```bash
rm -rf node_modules package-lock.json
npm install
```

On Windows, you may need to delete `node_modules` manually.

## Repository Usage

Do not commit:

- API keys
- local environment files
- build output
- `.expo`
- `node_modules`
- personal editor settings

## Team Project

CS178 StockClock Project  
Mobile Version