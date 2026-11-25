package database

import "strings"

// OnePurchasePerBuyerIndex is the unique index that stops a buyer owning the
// same product twice. It is named here, in one place, because two things need
// to agree on the string: the CREATE INDEX statement in Migrate, and the
// handler that turns the resulting error into a friendly "you already bought
// this" instead of a 500. Rename it here and both follow.
const OnePurchasePerBuyerIndex = "idx_product_purchases_one_success_per_buyer"

// IsUniqueViolation reports whether err is Postgres rejecting a row because it
// would duplicate an existing one.
//
// This matches on the error text rather than the SQLSTATE code (23505) so the
// kit does not need a direct dependency on the pgx driver internals. The
// trade-off is that it is text matching, so keep the checks broad.
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "duplicate key") || strings.Contains(message, "unique")
}

// IsUniqueViolationOn reports whether err is a unique violation from one
// specific index. Use it when different unique indexes on the same table need
// different error messages; use IsUniqueViolation when any duplicate means the
// same thing to the caller.
func IsUniqueViolationOn(err error, indexName string) bool {
	return err != nil && strings.Contains(err.Error(), indexName)
}
