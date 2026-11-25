// Package safego runs background work in a goroutine that cannot take the
// server down with it.
//
// A bare `go doSomething()` is fine right up until doSomething panics. A panic
// in a goroutine is not recovered by the HTTP framework — there is no request
// on the stack to unwind to — so Go kills the whole process. That turns a nil
// map in one notification email into a full API outage.
//
// Every fire-and-forget call in this kit (emails, push notifications, cache
// invalidation) goes through Run instead.
package safego

import (
	"runtime/debug"

	"github.com/marketkit/api/pkg/logger"
)

// Run executes fn in a new goroutine, logging and swallowing any panic.
//
// name describes the work and shows up in the log line, so make it something
// you would want to read at 3am: "market: notify seller of sale", not "task".
//
//	safego.Run("market: notify seller", func() {
//		notifySeller(sellerID, productID, amountMinor)
//	})
func Run(name string, fn func()) {
	go func() {
		defer func() {
			if panicValue := recover(); panicValue != nil {
				logger.L.Error("background task panicked",
					"task", name,
					"panic", panicValue,
					"stack", string(debug.Stack()),
				)
			}
		}()
		fn()
	}()
}
