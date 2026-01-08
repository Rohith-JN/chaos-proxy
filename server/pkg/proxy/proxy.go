package proxy

import (
	"fmt"
	"math/rand"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"chaos-proxy/pkg/chaos"
	"chaos-proxy/pkg/config"
	"chaos-proxy/pkg/monitor"
)

func parseToUrl(addr string) *url.URL {
	u, _ := url.Parse(addr)
	return u
}

type StatusRecorder struct {
	http.ResponseWriter
	StatusCode int
}

func (r *StatusRecorder) WriteHeader(statusCode int) {
	r.StatusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func ChaosHandler(isBackendRoute bool, store *config.Store) http.HandlerFunc {
	reverseProxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			cfg := store.Get()

			var targetStr string
			if cfg.Mode == config.ModeUnified {
				targetStr = cfg.TargetUnified
			} else {
				if isBackendRoute {
					targetStr = cfg.TargetBackend
				} else {
					targetStr = cfg.TargetFrontend
				}
			}

			if targetStr == "" {
				return
			}
			target := parseToUrl(targetStr)

			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.Host = target.Host

			if req.Body != nil {
				req.Body = &chaos.ThrottledReadCloser{
					RC: req.Body,
					BytesPerSec: cfg.BandwidthUp * 1024,
					BaseDelay: time.Duration(cfg.LagToReq) * time.Millisecond,
					Jitter: time.Duration(cfg.Jitter) * time.Millisecond,
				}
			}
		},
		ModifyResponse: func(resp *http.Response) error {
			
			if resp.StatusCode == http.StatusSwitchingProtocols {
				return nil
			}

			upgrade := strings.ToLower(resp.Header.Get("Upgrade"))
			if upgrade == "websocket" {
				return nil
			}
			cfg := store.Get();
			resp.Header.Set("Access-Control-Allow-Origin", "*")
			lag := cfg.LagToResp
			if cfg.FailureMode == "timeout" {
				lag = 60000 
			}
			if resp.Body != nil {
				resp.Body = &chaos.ThrottledReadCloser{
					RC: resp.Body,
					BytesPerSec: cfg.BandwidthDown * 1024,
					BaseDelay: time.Duration(lag) * time.Millisecond,
					Jitter: time.Duration(cfg.Jitter) * time.Millisecond,
					FailureMode: cfg.FailureMode,
				}
			}
			return nil
		},
	}
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		cfg := store.Get()

		recorder := &StatusRecorder{ResponseWriter: w, StatusCode: 200}
		wasTampered := false
		tamperType := ""
		injected := false;

		for _, rule := range cfg.StatusRules {
			if strings.HasPrefix(r.URL.Path, rule.PathPattern) {
				if rule.ErrorRate > 0 && rand.Intn(100) < rule.ErrorRate {
					recorder.WriteHeader(rule.StatusCode)
					fmt.Fprintf(w, `{"error": "Injection", "code": %d}`, rule.StatusCode)
					injected = true
					wasTampered = true
					tamperType = fmt.Sprintf("INJECT %d", rule.StatusCode)
					w.WriteHeader(rule.StatusCode)
					msg := fmt.Sprintf(`{"error": "Status Code Injection", "code": %d}`, rule.StatusCode)
					w.Write([]byte(msg))
					
					break
				}
			}
		}

		// 2. IF NOT INJECTED, PROXY IT
		if !injected {
			reverseProxy.ServeHTTP(recorder, r)
		}

		// 3. DETECT OTHER TAMPERING (Post-Calculation)
		// If we didn't inject, but config has global chaos, mark it
		if !injected {
			if cfg.FailureMode != "normal" {
				wasTampered = true
				tamperType = cfg.FailureMode
			} else if cfg.LagToResp > 0 {
				wasTampered = true
				tamperType = fmt.Sprintf("LAG +%dms", cfg.LagToResp)
			}
		}

		// 4. LOG IT
		monitor.AddLog(monitor.LogEntry{
			ID:         time.Now().UnixNano(),
			Method:     r.Method,
			Path:       r.URL.Path,
			Status:     recorder.StatusCode,
			DurationMs: time.Since(start).Milliseconds(),
			Tampered:   wasTampered,
			TamperType: tamperType,
			Timestamp:  time.Now().Format("15:04:05"),
		})
	}
}	