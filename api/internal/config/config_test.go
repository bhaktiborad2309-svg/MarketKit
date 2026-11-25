package config

import (
	"testing"
)

// setRequired sets the env vars Load() refuses to start without, so each test
// only has to vary the one setting it cares about.
func setRequired(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://u:p@localhost:5432/db?sslmode=disable")
	t.Setenv("JWT_SECRET", "test-secret-at-least-32-characters-long")
}

// The OTP bypass is a local convenience. A DEV_SKIP_OTP_EMAILS left behind in
// a production .env must not weaken admin login, so Load() only reads it when
// APP_ENV=development.
func TestDevSkipOTPEmailsHonouredOnlyInDevelopment(t *testing.T) {
	cases := []struct {
		appEnv string
		want   int
	}{
		{"development", 1},
		{"production", 0},
		{"staging", 0},
		{"", 0}, // unset APP_ENV defaults to production
	}

	for _, tc := range cases {
		t.Run(tc.appEnv, func(t *testing.T) {
			setRequired(t)
			t.Setenv("APP_ENV", tc.appEnv)
			t.Setenv("DEV_SKIP_OTP_EMAILS", "admin@example.com")

			if err := Load(); err != nil {
				t.Fatalf("Load: %v", err)
			}
			if got := len(App.DevSkipOTPEmails); got != tc.want {
				t.Errorf("APP_ENV=%q: got %d bypass emails %v, want %d",
					tc.appEnv, got, App.DevSkipOTPEmails, tc.want)
			}
		})
	}
}

// Entries are trimmed and lower-cased so the allowlist matches the way
// SkipOTPForAdmin normalises the incoming email.
func TestDevSkipOTPEmailsNormalised(t *testing.T) {
	setRequired(t)
	t.Setenv("APP_ENV", "development")
	t.Setenv("DEV_SKIP_OTP_EMAILS", " Admin@Example.COM , second@example.com ,")

	if err := Load(); err != nil {
		t.Fatalf("Load: %v", err)
	}

	want := []string{"admin@example.com", "second@example.com"}
	if len(App.DevSkipOTPEmails) != len(want) {
		t.Fatalf("got %v, want %v", App.DevSkipOTPEmails, want)
	}
	for i, w := range want {
		if App.DevSkipOTPEmails[i] != w {
			t.Errorf("entry %d: got %q, want %q", i, App.DevSkipOTPEmails[i], w)
		}
	}
}
