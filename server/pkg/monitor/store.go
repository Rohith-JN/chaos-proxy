package monitor

import (
	"sync"
)

type LogEntry struct {
	ID         int64  `json:"id"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	Status     int    `json:"status"`
	DurationMs int64  `json:"duration"`
	Tampered   bool   `json:"tampered"`
	TamperType string `json:"tamperType,omitempty"`
	Timestamp  string `json:"timestamp"`
}

var (
	logMutex sync.RWMutex
	logs     []LogEntry
	maxLogs  = 50 // Keep memory usage low
)

func AddLog(entry LogEntry) {
	logMutex.Lock()
	defer logMutex.Unlock()

	// Prepend new log
	logs = append([]LogEntry{entry}, logs...)

	// Trim if too large
	if len(logs) > maxLogs {
		logs = logs[:maxLogs]
	}
}

func GetLogs() []LogEntry {
	logMutex.RLock()
	defer logMutex.RUnlock()
	// Return a copy to avoid race conditions
	copyOfLogs := make([]LogEntry, len(logs))
	copy(copyOfLogs, logs)
	return copyOfLogs
}