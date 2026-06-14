# RATE LIMITER — Distributed Rate Limiter

RATE LIMITER is an interactive, full-stack application designed to demonstrate and visualize core API rate-limiting algorithms. It runs in a distributed mode using Redis (orchestrated with atomic Lua scripts) and features a seamless, fast fallback to local in-memory storage if Redis is offline.

The dashboard features a modern, sleek dark theme with high-contrast UI accents.

---

## 🛠️ Repository Architecture & Tech Stack

The workspace is divided into two main components:
- **Backend (`/backend`)**: Built using **Node.js** and **Express**. It contains the custom middleware that dynamically applies rate-limiting rules and executes them atomically via local memory or Redis.
- **Frontend (`/frontend`)**: Built using **React**, **Vite**, and **Tailwind CSS**. It provides a real-time, interactive dashboard that visualizes algorithm states, contains preset configuration profiles, and has a built-in spammer.

```text
       ┌──────────────────┐
       │  React Frontend  │
       │ (localhost:5173) │
       └────────┬─────────┘
                │ Proxy /api
                ▼
       ┌──────────────────┐
       │ Express Backend  │
       │ (localhost:3000) │
       └────────┬─────────┘
                │
         ┌───────┴───────┐
         ▼               ▼
  ┌────────────┐   ┌────────────┐
  │Redis ZSETs │   │ In-Memory  │
  │ (Default)  │   │ (Fallback) │
  └────────────┘   └────────────┘
```

---

## 🚀 Quick Start Guide

To run the full stack locally:

### 1. Run Redis (Recommended)
Ensure a local Redis server is running (e.g., using Docker):
```bash
docker run -d -p 6379:6379 --name ratelimit-redis redis
```
*Note: If Redis is offline, the backend automatically falls back to In-Memory mode within 3 seconds.*

### 2. Run the Backend
Navigate to the `/backend` folder and start the dev server:
```bash
cd backend
npm install
npm run dev
```
The server will run on `http://localhost:3000`.

### 3. Run the Frontend
Navigate to the `/frontend` folder and start the Vite development server:
```bash
cd ../frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your web browser.

---

## 📊 Core Features

- **Four Rate-Limiting Algorithms:** Token Bucket, Leaky Bucket, Fixed Window, and Sliding Window Log.
- **Headers Authentication Mode:** The frontend communicates rules (limits, window size, refill/leak rates) dynamically via custom HTTP headers, allowing parameter adjustments on the fly.
- **Real-Time Visualizations:** Observe how tokens refill, how water leaks, and how logs slide inside the window in real-time.
- **Collapsible Spammer:** An on-demand traffic generator widget that spams requests at custom rates (1-10 Req/sec) to test rate limit enforcement.
- **DDoS Status Indicator:** Displays threat levels (`normal`, `elevated`, `high`, `critical`) in real-time alongside a visual **Traffic Load** progress bar.
- **One-Click Demo Account Login:** A "Demo" button under the JWT User mode that instantly authenticates you using a pre-populated test account.
- **One-Click Reset:** Instantly flush all rates and clear both Redis database or memory stores.

---

## 📂 Documentation Links

For detailed information about each component:
- 📂 [Backend Implementation Details](./backend/README.md)
- 📂 [Frontend Dashboard Details](./frontend/README.md)
