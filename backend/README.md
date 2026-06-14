# RATE LIMITER — Backend Services

This is the Node.js + Express backend that powers the RATE LIMITER Sandbox. It receives rate-limiting configurations dynamically via HTTP headers and evaluates limits atomically using either **Redis** or an **In-Memory fallback**.

---

## ⚙️ How it Works: Dynamically Configurable Middleware

The backend uses a single Express middleware, `rateLimiter` (in [rateLimiter.js](./rateLimiter.js)), that intercepts incoming requests and extracts configuration parameters from headers sent by the client:

*   `X-Limiter-Algo`: The algorithm to evaluate (`token_bucket`, `leaky_bucket`, `fixed_window`, or `sliding_window`).
*   `X-Limiter-Limit`: The threshold number of requests.
*   `X-Limiter-Window`: The time window size (in seconds).
*   `X-Limiter-Capacity`: The maximum bucket capacity (for token/leaky bucket).
*   `X-Limiter-Refill-Rate` / `X-Limiter-Leak-Rate`: The refill/leak speed per millisecond.

### Standard Response Headers
When responding, the backend attaches standard HTTP headers:
*   `X-RateLimit-Limit`: Maximum requests permitted in the window.
*   `X-RateLimit-Remaining`: Remaining capacity/tokens/slots.
*   `X-RateLimit-Reset`: Seconds remaining until the window resets or bucket refills.
*   `X-RateLimit-Algorithm`: The evaluated algorithm name.
*   `X-RateLimit-Mode`: Whether limits are verified in `redis` or `memory`.

---

## 🧠 Supported Rate-Limiting Algorithms

### 1. Token Bucket (`token_bucket`)
*   **Concept:** Tokens accumulate in a bucket up to `capacity`. Each request consumes `1` token.
*   **Redis Implementation:** Uses a Hash to store `{ tokens, last_updated }`. On request, it calculates refilled tokens dynamically based on the time elapsed since the last request. All logic runs atomically in a Lua script.
*   **Memory Fallback:** Maps `key` to a local memory object, calculating refills based on JS timestamps.

### 2. Leaky Bucket (`leaky_bucket`)
*   **Concept:** Requests enter a bucket representing "water". The water leaks at a constant rate. If the bucket overflows (exceeds capacity), incoming requests are rejected. Smooths traffic bursts.
*   **Redis Implementation:** Uses a Hash storing `{ water, last_updated }`. It leaks water dynamically on each hit. Evaluated atomically in a Lua script.
*   **Memory Fallback:** Managed locally using JS timestamps.

### 3. Fixed Window (`fixed_window`)
*   **Concept:** Divides time into fixed windows (e.g., 60-second blocks). A counter tracks request count inside that window, resetting at boundaries.
*   **Redis Implementation:** Increments a simple key using `INCR` and sets a TTL to expire the key at the end of the window.
*   **Memory Fallback:** Maps active window IDs to counters in memory.

### 4. Sliding Window Log (`sliding_window`)
*   **Concept:** Logs timestamps of each request. On request, it deletes records older than `window_size` and counts active records. Prevents boundary spikes.
*   **Redis Implementation:** Uses Sorted Sets (ZSET) where scores are timestamps. It runs `ZREMRANGEBYSCORE` to clear old logs and `ZCARD` to count remaining ones.
*   **Memory Fallback:** Keeps arrays of timestamps in memory, filtering them dynamically.

---

## ⚡ Redis and Fast In-Memory Fallback

The backend connects to Redis at `127.0.0.1:6379`. To maintain application resilience:
1.  **Fast Connect Timeout:** Redis is configured with a short timeout (`connectTimeout: 3000`).
2.  **Dynamic Failover:** If Redis is down, the middleware falls back to local memory stores (`memoryStores`) immediately without causing request downtime.
3.  **Automatic Recovery:** Event handlers monitor Redis connection status. If Redis goes online, it switches back to distributed rate limiting automatically.

---

## 🛣️ API Endpoints

*   `GET /api/status`: Non-rate-limited status route. Returns the limiter state mode and Redis connection parameters.
*   `POST /api/reset`: Flushes all rate-limiting metrics (flushes Redis via `FLUSHDB` or clears memory).
*   `GET /api/data`: Consolidated, rate-limited data retrieval endpoint.

---

## 🏃 Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Express Server
```bash
npm run dev
```
The server will bind to port `3000` (`http://localhost:3000`).
