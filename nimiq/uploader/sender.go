package main

import (
	"encoding/hex"
	"fmt"
)

// TxSender interface for sending transactions
// This allows different implementations (RPC, dry-run, etc.)
type TxSender interface {
	SendTransaction(payload []byte) (string, error) // Returns transaction hash
}

// DryRunSender implements TxSender but doesn't actually send transactions
type DryRunSender struct{}

func (d *DryRunSender) SendTransaction(payload []byte) (string, error) {
	// Dry-run: return empty hash
	return "", nil
}

// RPCSender implements TxSender using Nimiq RPC
type RPCSender struct {
	rpc             *NimiqRPC
	senderAddress   string
	receiverAddress string
	fee             int64
}

// NewRPCSender creates a new RPC sender and verifies account status
func NewRPCSender(rpcURL, senderAddress, receiverAddress string, fee int64) (*RPCSender, error) {
	rpc := NewNimiqRPC(rpcURL)

	// Default receiver address if not provided
	if receiverAddress == "" {
		receiverAddress = "NQ27 21G6 9BG1 JBHJ NUFA YVJS 1R6C D2X0 QAES"
	}

	sender := &RPCSender{
		rpc:             rpc,
		senderAddress:   senderAddress,
		receiverAddress: receiverAddress,
		fee:             fee,
	}

	// Check if account is imported
	imported, err := rpc.IsAccountImported(senderAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to check if account is imported: %w", err)
	}
	if !imported {
		return nil, fmt.Errorf("account %s is not imported. Use 'account import' command first", senderAddress)
	}

	// Check if account is unlocked
	unlocked, err := rpc.IsAccountUnlocked(senderAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to check if account is unlocked: %w", err)
	}
	if !unlocked {
		return nil, fmt.Errorf("account %s is locked. Please unlock it first", senderAddress)
	}

	return sender, nil
}

func (r *RPCSender) SendTransaction(payload []byte) (string, error) {
	// Check consensus before sending transaction
	consensus, err := r.rpc.IsConsensusEstablished()
	if err != nil {
		return "", fmt.Errorf("failed to check consensus: %w", err)
	}
	if !consensus {
		return "", fmt.Errorf("node does not have consensus with the network - cannot send transaction")
	}

	// Get current block height for validityStartHeight
	blockHeight, err := r.rpc.GetBlockNumber()
	if err != nil {
		return "", fmt.Errorf("failed to get block height: %w", err)
	}

	// Encode payload as hex string
	dataHex := hex.EncodeToString(payload)

	// Send transaction with data
	// Value must be > 0 for transactions with data (RPC requirement: "value must be zero for signaling transactions and cannot be zero for others")
	// Use 1 Luna (smallest unit) as the value
	txHash, err := r.rpc.SendBasicTransactionWithData(
		r.senderAddress,   // wallet (sender)
		r.receiverAddress, // recipient (receiver address)
		dataHex,           // data (hex-encoded payload)
		1,                 // value (1 Luna - minimum required for data transactions)
		r.fee,             // fee (configurable)
		blockHeight,       // validityStartHeight
	)
	if err != nil {
		return "", fmt.Errorf("failed to send transaction: %w", err)
	}

	// Transaction sent successfully
	fmt.Printf("Transaction sent to %s: %s\n", r.receiverAddress, txHash)
	return txHash, nil
}
