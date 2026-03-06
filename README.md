# StockClock

StockClock is a mobile stock tracking app built with Expo and React
Native for CS178. It focuses on stock watchlists, price alerts, stock
detail charts, and a placeholder AI news module for future FinBERT
integration.

------------------------------------------------------------------------

# App Screenshots

### Home

`<img src="screenshots/home.PNG" width="300"/>`{=html}

### Stock Detail

`<img src="screenshots/stock.PNG" width="300"/>`{=html}

### Alerts

`<img src="screenshots/alerts.PNG" width="300"/>`{=html}

### News

`<img src="screenshots/news.PNG" width="300"/>`{=html}

------------------------------------------------------------------------

## Current Features

-   Real stock symbol search
-   Watchlist management
-   Real stock quote fetching
-   Stock detail page with chart
-   Alert creation and management
-   Demo alert trigger mode for presentation
-   News placeholder page for future sentiment/news integration
-   Dark/light theme support

## Tech Stack

-   Expo
-   React Native
-   Expo Router
-   TypeScript
-   Twelve Data API
-   react-native-svg

## Project Structure

    app/            Main screens and routes
    components/     Shared UI components
    constants/      Theme and app constants
    hooks/          Custom hooks
    services/       API and data logic
    assets/         Images and static assets
    screenshots/    README screenshots

## Requirements

Before running the project, make sure you have:

-   Node.js installed
-   npm installed
-   Expo Go installed on your phone

Expo Go is used for quick testing and demo during development.

## Setup

### 1. Clone the repository

    git clone https://github.com/PYwaterfriend/stockclock.git
    cd stockclock

### 2. Install dependencies

    npm install

### 3. Install required Expo package

    npx expo install react-native-svg

### 4. Add your Twelve Data API key

Open:

    services/marketData.ts

Replace the API key placeholder with your own Twelve Data API key.

Example:

``` ts
export const TWELVE_DATA_API_KEY = "YOUR_API_KEY_HERE";
```

Each teammate should create their own free Twelve Data account and use
their own API key.

## Running the App

Start the project with:

    npx expo start

Then:

-   Scan the QR code using Expo Go on your phone
-   Or run in a simulator if available

## Alert Demo Mode

The Alerts page includes a demo mode so alerts can be triggered during
presentation without waiting for real market prices.

## News Module

The News tab is currently a placeholder.\
It will later connect to AI news analysis or FinBERT sentiment output
from the backend.

## Troubleshooting

### Expo does not refresh correctly

    npx expo start -c

### API data does not appear

Check:

-   API key is correctly set in `services/marketData.ts`
-   API limit has not been exceeded

### Dependency issues

Try reinstalling:

    rm -rf node_modules package-lock.json
    npm install

On Windows you may need to delete `node_modules` manually.

## Repository Usage

Do not commit:

-   API keys
-   node_modules
-   .expo
-   local editor settings

## Team Project

CS178 Mobile App Project\
StockClock
