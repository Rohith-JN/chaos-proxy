package proxy

import (
	"bufio"
	"fmt"
	"math/rand"
	"net"
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

func (r *StatusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
	}
	return hijacker.Hijack()
}

func (r *StatusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
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


			// A. Strip CORS (Simulate strict firewall/cross-origin errors)
			if cfg.HeaderRules.StripCORS {
				resp.Header.Del("Access-Control-Allow-Origin")
				resp.Header.Del("Access-Control-Allow-Methods")
				resp.Header.Del("Access-Control-Allow-Headers")
				resp.Header.Del("Access-Control-Allow-Credentials")
			} else {
				// Default friendly mode: Allow everything
				// Only set this if the backend didn't already set it
				if resp.Header.Get("Access-Control-Allow-Origin") == "" {
					resp.Header.Set("Access-Control-Allow-Origin", "*")
				}
			}

			if cfg.HeaderRules.StripCache {
				// Remove headers that let browsers check for "freshness"
				resp.Header.Del("ETag")
				resp.Header.Del("Last-Modified")
				// Force explicit no-cache instructions
				resp.Header.Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
				resp.Header.Set("Pragma", "no-cache")
				resp.Header.Set("Expires", "0")
			}

			if cfg.HeaderRules.CorruptContentType {
				// 50% chance to be text/plain, 50% chance to be garbage
				if rand.Intn(100) < 50 {
					resp.Header.Set("Content-Type", "text/plain")
				} else {
					resp.Header.Set("Content-Type", "application/broken-octet-stream")
				}
			}

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

		if !injected {
			reverseProxy.ServeHTTP(recorder, r)
		}

		if !injected {
			if cfg.FailureMode != "normal" && cfg.FailureMode != "" {
				wasTampered = true
				tamperType = cfg.FailureMode
			} else {
                isHeaderChaos := cfg.HeaderRules.StripCORS || 
                                 cfg.HeaderRules.StripCache || 
                                 cfg.HeaderRules.CorruptContentType

                if isHeaderChaos {
                    wasTampered = true
                    tamperType = "HEADER HAX"
                }

                if cfg.LagToResp > 0 || cfg.LagToReq > 0 {
                    wasTampered = true
                    if isHeaderChaos {
                        tamperType = "LAG + HEADERS"
                    } else {
                        tamperType = fmt.Sprintf("LAG +%dms", cfg.LagToResp+cfg.LagToReq)
                    }
                }
            }
		}

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