# RATE LIMITER — Frontend Dashboard

This is the React + Vite frontend dashboard for the RATE LIMITER Sandbox. It provides a visual interface to interact with, configure, and monitor different rate-limiting algorithms in real-time.

---

## 🎨 Design & Layout

The dashboard is designed with a premium, minimalist zinc-based dark interface featuring subtle radial glow elements, clean borders, and custom UI components:
*   **Left Column (Control Panel & Indicators):**
    *   **Side Settings Panel (4 Tabs):**
        *   `Algorithm`: Toggle between Token Bucket, Leaky Bucket, Fixed Window, and Sliding Window Log with tags.
        *   `Auth`: Choose between **Headers** (dynamic header configuration), **By IP** (hardcoded IP rules), and **JWT User** (authenticated Bearer sessions).
        *   `Config`: Tweak sliders for Request Limit, Time Window, and Refill/Leak speed controls.
        *   `Redis`: Connect/disconnect to a Redis instance and view real-time memory/diagnostic statistics.
    *   **DDoS Status Widget:** Pinned permanently at the bottom of the sidebar. Displays current threat level (`normal`, `elevated`, `high`, `critical`) and features:
        *   **Traffic Load Bar**: Visual progress indicator representing ratio thresholds.
        *   **Spammer Toggle**: Click to expand/collapse custom request generation sliders (1-10 Req/sec) and start/stop high-frequency traffic spamming.
*   **Right Column (Visualizations & Logs):**
    *   **GET Data Trigger:** A single high-contrast button to fire a GET request to `/api/data`.
    *   **Traffic Flow Chart:** A muted Recharts line area chart plotting allowed vs blocked counts over a rolling 30-second window.
    *   **Real-Time State Visualization:**
        *   *Token Bucket:* A progress bar representing available tokens.
        *   *Leaky Bucket:* A fluid bar representing the current water level.
        *   *Fixed Window:* A countdown timer until the window resets.
        *   *Sliding Window:* A timeline plotting active request timestamps as vertical indicator ticks in the rolling window.
    *   **Metrics Grid:** Displays live statistics including Total requests, Allowed, Blocked, and Pass Rate percentage.
    *   **Interactive Request Log:** A console showing historical request times, status codes, endpoints, and remaining limits of past requests.

---

## ⚙️ Vite Proxy Setup

The frontend development server utilizes a proxy configuration inside [vite.config.js](./vite.config.js) to resolve CORS issues during development. It routes all `/api` traffic to the backend server:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

This maps `/api/*` requests triggered in [App.jsx](./src/App.jsx) directly to the backend running on `localhost:3000`.

---

## 🏃 Setup & Execution

### 1. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 2. Start the Vite Development Server
```bash
npm run dev
```
The application will start on `http://localhost:5173`. Open this URL in your web browser.

### 3. Build for Production
To bundle the frontend application for production:
```bash
npm run build
```
This produces optimized production assets inside the `/dist` directory.
