package safego

import (
	"sync"
	"testing"
)

// A panicking task must not escape Run. If this test ever fails, it fails by
// crashing the whole test binary — which is exactly the production bug Run
// exists to prevent.
func TestRunSwallowsPanic(t *testing.T) {
	var finished sync.WaitGroup
	finished.Add(1)

	Run("test: panicking task", func() {
		defer finished.Done()
		panic("boom")
	})

	finished.Wait()
}

func TestRunExecutesTheTask(t *testing.T) {
	var finished sync.WaitGroup
	finished.Add(1)

	ran := false
	Run("test: normal task", func() {
		ran = true
		finished.Done()
	})

	finished.Wait()
	if !ran {
		t.Fatal("Run did not execute the task")
	}
}
