// Package base58 provides Base58 encoding/decoding with full alphabet support
// This includes lowercase 'l' which is excluded from standard Base58 but used by Walrus
package base58

import (
	"errors"
	"math/big"
)

// FullBase58Alphabet includes all alphanumeric characters except 0, O, I
// This is the alphabet used by Walrus blob IDs (includes lowercase 'l')
const FullBase58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

var (
	alphabet = []byte(FullBase58Alphabet)
	bigRadix = big.NewInt(58)
	zero     = big.NewInt(0)
)

// Decode decodes a base58 string to bytes using the full alphabet
func Decode(s string) ([]byte, error) {
	if len(s) == 0 {
		return nil, errors.New("empty string")
	}

	// Convert string to big integer
	bigInt := big.NewInt(0)
	for i := 0; i < len(s); i++ {
		char := s[i]
		idx := -1
		for j, b := range alphabet {
			if b == char {
				idx = j
				break
			}
		}
		if idx == -1 {
			return nil, errors.New("invalid base58 character: " + string(char))
		}
		bigInt.Mul(bigInt, bigRadix)
		bigInt.Add(bigInt, big.NewInt(int64(idx)))
	}

	// Convert big integer to bytes
	bytes := bigInt.Bytes()

	// Handle leading zeros
	leadingZeros := 0
	for i := 0; i < len(s) && s[i] == alphabet[0]; i++ {
		leadingZeros++
	}

	result := make([]byte, leadingZeros+len(bytes))
	copy(result[leadingZeros:], bytes)

	return result, nil
}

// Encode encodes bytes to a base58 string using the full alphabet
func Encode(b []byte) string {
	if len(b) == 0 {
		return ""
	}

	// Convert bytes to big integer
	bigInt := new(big.Int).SetBytes(b)

	// Count leading zeros
	leadingZeros := 0
	for leadingZeros < len(b) && b[leadingZeros] == 0 {
		leadingZeros++
	}

	// Encode
	var result []byte
	for bigInt.Cmp(zero) > 0 {
		mod := new(big.Int)
		bigInt.DivMod(bigInt, bigRadix, mod)
		result = append(result, alphabet[mod.Int64()])
	}

	// Add leading zeros
	for i := 0; i < leadingZeros; i++ {
		result = append(result, alphabet[0])
	}

	// Reverse
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}

	return string(result)
}
