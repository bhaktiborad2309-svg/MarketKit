package wallet

import (
	"errors"
	"strconv"

	"github.com/marketkit/api/internal/database"
	"github.com/marketkit/api/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrInsufficientBalance = errors.New("insufficient wallet balance")

// Apply mutates a user's wallet by amountMinor (credits positive, debits
// negative) and appends the matching ledger row. It row-locks the user record
// so concurrent debits serialize and the balance can never go negative.
//
// Must be called inside a caller-provided transaction; a rollback undoes the
// balance change and the ledger row together. When one transaction touches
// two wallets (a wallet purchase), always debit the buyer before crediting
// the seller — a single fixed lock order prevents deadlocks.
func Apply(tx *gorm.DB, userID, txType string, amountMinor int64, referenceID *string, meta models.JSONMap) (int64, error) {
	var user models.User
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("id", "wallet_balance_minor").
		First(&user, "id = ?", userID).Error; err != nil {
		return 0, err
	}

	newBalance := user.WalletBalanceMinor + amountMinor
	if newBalance < 0 {
		return 0, ErrInsufficientBalance
	}

	if err := tx.Model(&models.User{}).Where("id = ?", userID).
		UpdateColumn("wallet_balance_minor", newBalance).Error; err != nil {
		return 0, err
	}

	if err := tx.Create(&models.WalletTransaction{
		UserID:            userID,
		Type:              txType,
		AmountMinor:       amountMinor,
		BalanceAfterMinor: newBalance,
		ReferenceID:       referenceID,
		Metadata:          meta,
	}).Error; err != nil {
		return 0, err
	}

	return newBalance, nil
}

// platformSettingInt reads one admin-tunable integer setting, falling back to
// the given default when the row is missing or unparseable.
//
// db is explicit rather than reaching for the global database.DB, because
// reading a setting from *outside* the transaction that is about to use it is
// how you charge one fee and record another. Callers inside a transaction must
// pass their tx.
func platformSettingInt(db *gorm.DB, key string, fallback int64) int64 {
	var setting models.PlatformSetting
	if err := db.First(&setting, "key = ?", key).Error; err != nil {
		return fallback
	}
	value, err := strconv.ParseInt(setting.Value, 10, 64)
	if err != nil {
		return fallback
	}
	return value
}

// FeePercent is the platform's cut on each product sale (admin-tunable).
// Read it before opening a transaction, or use FeePercentTx inside one.
func FeePercent() int64 {
	return platformSettingInt(database.DB, models.SettingMarketFeePercent, 10)
}

// FeePercentTx is FeePercent read inside an open transaction, so the fee that
// gets charged is the fee that gets recorded even if an admin changes it
// mid-purchase.
func FeePercentTx(tx *gorm.DB) int64 {
	return platformSettingInt(tx, models.SettingMarketFeePercent, 10)
}

// MinWithdrawal is the smallest allowed withdrawal, in minor units (admin-tunable).
func MinWithdrawal() int64 {
	return platformSettingInt(database.DB, models.SettingMinWithdrawalMinor, 10000)
}

// SplitFee floors the fee in integer minor units; the app's display-only breakdown
// uses the same math so the numbers always match.
func SplitFee(amountMinor, percent int64) (fee, net int64) {
	fee = amountMinor * percent / 100
	return fee, amountMinor - fee
}
