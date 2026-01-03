package main

import (
	"fmt"
	"time"

	"github.com/spf13/cobra"
)

func newAccountBalanceCmd() *cobra.Command {
	var (
		rpcURL  string
		address string
	)

	cmd := &cobra.Command{
		Use:   "balance",
		Short: "Check account balance",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get address from credentials file if not provided
			if address == "" {
				address = GetDefaultAddress()
			}
			
			if address == "" {
				return fmt.Errorf("address is required (--address or set in account_credentials.txt)")
			}

			rpc := NewNimiqRPC(rpcURL)
			
			// Check consensus first
			consensus, err := rpc.IsConsensusEstablished()
			if err != nil {
				return fmt.Errorf("failed to check consensus: %w", err)
			}
			if !consensus {
				return fmt.Errorf("node does not have consensus with the network - wait for sync")
			}
			
			balance, err := rpc.GetBalance(address)
			if err != nil {
				return fmt.Errorf("failed to get balance: %w", err)
			}

			// Convert Luna to NIM (1 NIM = 100,000 Luna)
			nim := float64(balance) / 100000.0
			fmt.Printf("Account: %s\n", address)
			fmt.Printf("Balance: %d Luna (%.5f NIM)\n", balance, nim)

			return nil
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&address, "address", "", "Account address (defaults to ADDRESS from account_credentials.txt)")

	return cmd
}

func newAccountWaitFundsCmd() *cobra.Command {
	var (
		rpcURL   string
		address  string
		minNIM   float64
		interval int
	)

	cmd := &cobra.Command{
		Use:   "wait-funds",
		Short: "Wait until account has minimum balance",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get RPC URL from env, credentials file, or default
			if rpcURL == "" {
				rpcURL = GetDefaultRPCURL()
			}

			// Try to get address from credentials file if not provided
			if address == "" {
				address = GetDefaultAddress()
			}
			
			if address == "" {
				return fmt.Errorf("address is required (--address or set in account_credentials.txt)")
			}

			if minNIM <= 0 {
				minNIM = 0.001 // Default: 0.001 NIM (enough for a few transactions)
			}

			if interval <= 0 {
				interval = 10 // Default: check every 10 seconds
			}

			minLuna := int64(minNIM * 100000) // Convert NIM to Luna

			rpc := NewNimiqRPC(rpcURL)
			
			// Check consensus first
			consensus, err := rpc.IsConsensusEstablished()
			if err != nil {
				return fmt.Errorf("failed to check consensus: %w", err)
			}
			if !consensus {
				return fmt.Errorf("node does not have consensus with the network - wait for sync")
			}
			
			fmt.Printf("Waiting for account %s to have at least %.5f NIM...\n", address, minNIM)
			fmt.Printf("Checking every %d seconds...\n\n", interval)

			for {
				balance, err := rpc.GetBalance(address)
				if err != nil {
					fmt.Printf("Error checking balance: %v (will retry)\n", err)
					time.Sleep(time.Duration(interval) * time.Second)
					continue
				}

				nim := float64(balance) / 100000.0
				fmt.Printf("[%s] Balance: %d Luna (%.5f NIM)", 
					time.Now().Format("15:04:05"), balance, nim)

				if balance >= minLuna {
					fmt.Printf(" ✅ Ready!\n")
					return nil
				}

				fmt.Printf(" ⏳ Waiting...\n")
				time.Sleep(time.Duration(interval) * time.Second)
			}
		},
	}

	cmd.Flags().StringVar(&rpcURL, "rpc-url", "", "Nimiq RPC URL (default: from credentials or localhost:8648)")
	cmd.Flags().StringVar(&address, "address", "", "Account address to check (required)")
	cmd.Flags().Float64Var(&minNIM, "min-nim", 0.001, "Minimum NIM balance required (default: 0.001)")
	cmd.Flags().IntVar(&interval, "interval", 10, "Check interval in seconds (default: 10)")

	cmd.MarkFlagRequired("address")

	return cmd
}
