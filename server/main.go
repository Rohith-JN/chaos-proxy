package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

// --- 1. THE BRAIN (Global State) ---
type ProxyConfig struct {
	// --- Category 1: Network & Timing ---
	LagTime    int // Base delay (ms)
	JitterTime int // Random extra delay (±ms)

	
	// --- Category 2: HTTP Protocol ---
	ErrorRate int // Percentage (0-100)
}

// Set defaults
var config = ProxyConfig{
	LagTime:    0,
	JitterTime: 0,
	ErrorRate:  0,
}

// --- 2. THE REMOTE CONTROL (Admin API Handler) ---
func handleConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var newConfig ProxyConfig
	err := json.NewDecoder(r.Body).Decode(&newConfig)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	config = newConfig
	fmt.Printf("⚙️ Config Updated: Lag=%dms, Jitter=%dms, Errors=%d%%\n", config.LagTime, config.JitterTime, config.ErrorRate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// --- 3. HELPER: Apply Chaos Logic to ANY Proxy ---
func setupProxy(p *httputil.ReverseProxy, target *url.URL) {
	originalDirector := p.Director

	// A. REQUEST INTERCEPTOR (Lag & Jitter)
	p.Director = func(req *http.Request) {
		originalDirector(req)
		
		// Fix Host Header so the target server accepts it
		req.Host = target.Host
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host

		// --- CATEGORY 1: TIMING ---
		delay := 0

		// 1. Base Latency
		if config.LagTime > 0 {
			delay += config.LagTime
		}

		// 2. Jitter (Randomness)
		if config.JitterTime > 0 {
			delay += rand.Intn(config.JitterTime)
		}

		if delay > 0 {
			// fmt.Printf("⏳ Lagging request to %s for %dms\n", target.Host, delay)
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}
	}

	// B. RESPONSE INTERCEPTOR (CORS & Errors)
	p.ModifyResponse = func(resp *http.Response) error {
		path := resp.Request.URL.Path

		// 1. CORS FIX (Critical for Frontend talking to Backend via Proxy)
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Set("Access-Control-Allow-Origin", "*")
		resp.Header.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		resp.Header.Set("Access-Control-Allow-Headers", "*")

		// 2. Filter Static Files (Optional: Don't break JS/CSS)
		isStatic := false
		if strings.HasSuffix(path, ".js") || strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".png") {
			isStatic = true
		}

		// 3. Error Injection
		if !isStatic && config.ErrorRate > 0 {
			if rand.Intn(100) < config.ErrorRate {
				fmt.Printf("❌ Chaos Triggered: Killing %s\n", path)
				resp.StatusCode = http.StatusInternalServerError
				resp.Status = "500 Internal Server Error"
			}
		}
		return nil
	}
}

func main() {
	// --- 4. START ADMIN SERVER (Background Thread) ---
	go func() {
		http.HandleFunc("/api/config", handleConfig)
		fmt.Println("🎮 Admin API running on http://localhost:9000/api/config")
		log.Fatal(http.ListenAndServe(":9000", nil))
	}()

	// --- 5. SETUP PROXIES ---
	
	// Target A: Frontend (React)
	frontendURL, _ := url.Parse("http://localhost:3000")
	frontendProxy := httputil.NewSingleHostReverseProxy(frontendURL)
	setupProxy(frontendProxy, frontendURL)

	// Target B: Backend (GraphQL/API)
	// CHANGE THIS PORT if your backend is on a different port (e.g., 4000, 5000)
	backendURL, _ := url.Parse("http://localhost:4000") 
	backendProxy := httputil.NewSingleHostReverseProxy(backendURL)
	setupProxy(backendProxy, backendURL)

	// --- 6. THE ROUTER (Main Thread) ---
	mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// DECISION LOGIC:
		// If the path starts with "/graphql", send to Backend.
		// Otherwise, send to Frontend.
		if strings.HasPrefix(r.URL.Path, "/graphql") {
			backendProxy.ServeHTTP(w, r)
		} else {
			frontendProxy.ServeHTTP(w, r)
		}
	})

	fmt.Println("🔥 Chaos Gateway running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mainHandler))
}