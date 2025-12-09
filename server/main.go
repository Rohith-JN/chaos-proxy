package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net"
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

	// NEW: Bandwidth Limit (Bytes per second). 0 = Unlimited.
    // Example: 10240 = 10KB/s (Very Slow)
    ThrottleBps  int
	// --- Category 2: HTTP Protocol ---
	ErrorRate int // Percentage (0-100)
}

// Set defaults
var config = ProxyConfig{
	LagTime:    0,
	JitterTime: 0,
	ThrottleBps: 0,
	ErrorRate:  0,
}

// This allows WebSockets (and React HMR) to work through your throttler
func (w *ThrottledResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
    // Check if the underlying writer supports hijacking
    hijacker, ok := w.ResponseWriter.(http.Hijacker)
    if !ok {
        return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
    }
    // Pass the hijack request through
    return hijacker.Hijack()
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
	var err error = json.NewDecoder(r.Body).Decode(&newConfig)
	if err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	config = newConfig
	fmt.Printf("Config Updated: Lag=%dms, Jitter=%dms, Throttle=%dbps, Errors=%d%%\n", config.LagTime, config.JitterTime, config.ThrottleBps, config.ErrorRate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// A custom writer that slows down data transfer
type ThrottledResponseWriter struct {
    http.ResponseWriter // Embed the original writer so we inherit its methods
    ThrottleBps int
}

func (w *ThrottledResponseWriter) Write(b []byte) (int, error) {
    // If no limit, just write normally
    if w.ThrottleBps <= 0 {
        return w.ResponseWriter.Write(b)
    }

    // "The Slicer" Logic
    totalBytes := len(b)
    written := 0
    
    // Calculate chunk size (e.g., send 1/10th of the limit every 100ms)
    // This makes the flow smoother than sending 1 big chunk every second.
    chunkSize := w.ThrottleBps / 10 
    if chunkSize == 0 { chunkSize = 1 } // Prevent divide by zero

    for written < totalBytes {
        // Determine how much to write in this chunk
        remaining := totalBytes - written
        toWrite := chunkSize
        if remaining < toWrite {
            toWrite = remaining
        }

        // Write the chunk
        n, err := w.ResponseWriter.Write(b[written : written+toWrite])
        if err != nil {
            return written, err
        }
        written += n

        // Flush! (Force the browser to receive this chunk immediately)
        if f, ok := w.ResponseWriter.(http.Flusher); ok {
            f.Flush()
        }

        // Sleep to simulate the low bandwidth
        // Logic: 10 chunks per second = 100ms sleep
        time.Sleep(100 * time.Millisecond)
    }

    return written, nil
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
				fmt.Printf("Chaos Triggered: Killing %s\n", path)
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
		fmt.Println("Admin API running on http://localhost:9000/api/config")
		log.Fatal(http.ListenAndServe(":9000", nil))
	}()

	// --- 5. SETUP PROXIES ---
	
	// Target A: Frontend (React)
	frontendURL, _ := url.Parse("http://localhost:3000")
	frontendProxy := httputil.NewSingleHostReverseProxy(frontendURL)
	setupProxy(frontendProxy, frontendURL)

	// Target B: Backend (GraphQL/API)
	// CHANGE THIS PORT if your backend is on a different port (e.g., 4000, 5000)
	backendURL, _ := url.Parse("http://localhost:3000") 
	backendProxy := httputil.NewSingleHostReverseProxy(backendURL)
	setupProxy(backendProxy, backendURL)

	// --- 6. THE ROUTER (Main Thread) ---
    mainHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        
        // 1. Wrap the writer with our Throttler
        // We pass the global config.ThrottleBps to it.
        // Note: We only wrap if throttling is actually enabled to save CPU.
        var finalWriter http.ResponseWriter = w
        
        if config.ThrottleBps > 0 {
            finalWriter = &ThrottledResponseWriter{
                ResponseWriter: w,
                ThrottleBps: config.ThrottleBps,
            }
        }

        // 2. Routing Logic
        if strings.HasPrefix(r.URL.Path, "/graphql") || strings.HasPrefix(r.URL.Path, "/api") {
            backendProxy.ServeHTTP(finalWriter, r)
        } else {
            frontendProxy.ServeHTTP(finalWriter, r)
        }
    })

	fmt.Println("Chaos Gateway running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", mainHandler))
}