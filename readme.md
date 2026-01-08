# Chaos Proxy

A Chaos Engineering Reverse Proxy designed for testing websites. It sits between your client and server, allowing you to simulate poor network conditions, inject protocol faults, etc.

## 🚧 Work in Progress
This project is under active development. New features are being worked on.

<img width="1920" height="870" alt="{258E7F26-0566-4479-9931-65B279E4261F}" src="https://github.com/user-attachments/assets/69312f09-2ee8-426e-8029-d1a428754ad4" />

## 🚀 Features

### 1. Network Dynamics (The Pipe)
* **Latency & Jitter:** Simulate high-latency connections with randomized jitter.
* **Bandwidth Throttling:** Limit upload and download speeds to simulate 3G, EDGE, or flaky Wi-Fi.
* **Smart Presets:** One-click configurations for common scenarios ("Fast 4G", "Tunnel", "Slow 3G").

### 2. Connection Failures (The Sabotage)
* **Timeout:** Force requests to hang for 60s+ to test client timeout logic.
* **Ghost Body:** Send headers successfully, then hang indefinitely while sending the body.
* **Early Disconnect:** Terminate the TCP connection mid-stream (`io.ErrUnexpectedEOF`).

### 3. HTTP Protocol Faults
* **Status Injection:** Define rules (e.g., `/api/checkout` -> `503 Service Unavailable` @ 20% rate) to test error handling boundaries.
* **More being added**

### 4. Live Traffic Monitor
* Real-time feed of all requests passing through the proxy.
* Visual indicators for "Tampered" vs. "Clean" traffic.
* Precise timing metrics (Duration vs. Expected Lag).

---

## 🛠 Architecture

* **Backend (Go):** A high-concurrency reverse proxy using `net/http/httputil`.
    * **Stream Engine:** Custom `ThrottledReadCloser` wraps standard streams to inject lag at the byte level.
    * **State Management:** Thread-safe `sync.RWMutex` store for hot-reloading config without restarting.
* **Frontend (React + TypeScript):** A "Cockpit" style dashboard communicating via a sidecar Admin API on port `9000`.

### Project Structure
```text
/server
├── main.go                # Entry point & Wiring
├── pkg/
│   ├── chaos/             # Physics engine (Throttling/Stream manipulation)
│   ├── config/            # Thread-safe configuration store
│   ├── monitor/           # Circular log buffer for traffic analysis
│   └── proxy/             # Reverse proxy handler & injection logic
/src                       # React Dashboard (The Cockpit)
