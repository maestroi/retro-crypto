// Package sui provides a client for interacting with Sui blockchain
package sui

import (
	"context"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/coming-chat/go-sui/v2/account"
	"github.com/coming-chat/go-sui/v2/client"
	"github.com/coming-chat/go-sui/v2/lib"
	"github.com/coming-chat/go-sui/v2/move_types"
	"github.com/coming-chat/go-sui/v2/sui_types"
	"github.com/coming-chat/go-sui/v2/types"
	"github.com/retro-crypto/sui/internal/model"
)

// Client is a Sui blockchain client
type Client struct {
	rpcURL    string
	client    *client.Client
	account   *account.Account
	packageID string
}

// NewClient creates a new Sui client
func NewClient(rpcURL, packageID string) (*Client, error) {
	c, err := client.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Sui RPC: %w", err)
	}

	return &Client{
		rpcURL:    rpcURL,
		client:    c,
		packageID: packageID,
	}, nil
}

// SetAccountFromPrivateKey sets the account from a hex-encoded private key
func (c *Client) SetAccountFromPrivateKey(privateKeyHex string) error {
	// Remove 0x prefix if present
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")
	
	acc, err := account.NewAccountWithKeystore(privateKeyHex)
	if err != nil {
		return fmt.Errorf("failed to create account from private key: %w", err)
	}
	c.account = acc
	return nil
}

// SetAccountFromMnemonic sets the account from a mnemonic phrase
func (c *Client) SetAccountFromMnemonic(mnemonic string) error {
	acc, err := account.NewAccountWithMnemonic(mnemonic)
	if err != nil {
		return fmt.Errorf("failed to create account from mnemonic: %w", err)
	}
	c.account = acc
	return nil
}

// GetAddress returns the account address
func (c *Client) GetAddress() string {
	if c.account == nil {
		return ""
	}
	return c.account.Address
}

// CreateCatalog creates a new catalog on Sui
func (c *Client) CreateCatalog(ctx context.Context, name, description string) (string, string, error) {
	if c.account == nil {
		return "", "", fmt.Errorf("account not set")
	}

	packageID, err := sui_types.NewAddressFromHex(c.packageID)
	if err != nil {
		return "", "", fmt.Errorf("invalid package ID: %w", err)
	}

	// Build transaction
	ptb := sui_types.NewProgrammableTransactionBuilder()
	
	// Add arguments
	nameArg := ptb.MustPure(name)
	descArg := ptb.MustPure(description)

	// Call create_catalog
	ptb.MoveCall(
		*packageID,
		move_types.Identifier("catalog"),
		move_types.Identifier("create_catalog"),
		[]move_types.TypeTag{},
		[]sui_types.Argument{nameArg, descArg},
	)

	pt := ptb.Finish()

	// Get gas coin
	sender, err := sui_types.NewAddressFromHex(c.account.Address)
	if err != nil {
		return "", "", fmt.Errorf("invalid sender address: %w", err)
	}

	coins, err := c.client.GetCoins(ctx, *sender, nil, nil, 10)
	if err != nil {
		return "", "", fmt.Errorf("failed to get coins: %w", err)
	}
	if len(coins.Data) == 0 {
		return "", "", fmt.Errorf("no gas coins available")
	}

	gasCoin := coins.Data[0]
	gasPayment := []sui_types.ObjectRef{{
		ObjectId: gasCoin.CoinObjectId,
		Version:  gasCoin.Version,
		Digest:   gasCoin.Digest,
	}}

	// Build transaction data
	txData := sui_types.NewProgrammable(
		*sender,
		gasPayment,
		pt,
		50000000, // gas budget
		1000,     // gas price
	)

	// Sign transaction
	signature, err := c.account.SignSecureWithoutEncode(txData, sui_types.DefaultIntent())
	if err != nil {
		return "", "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Execute transaction
	resp, err := c.client.ExecuteTransactionBlock(
		ctx,
		lib.Base64Data(txData.Marshal()),
		[]any{signature},
		&types.SuiTransactionBlockResponseOptions{
			ShowEffects:       true,
			ShowObjectChanges: true,
			ShowEvents:        true,
		},
		types.TxnRequestTypeWaitForLocalExecution,
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to execute transaction: %w", err)
	}

	// Extract catalog ID from object changes
	var catalogID string
	if resp.ObjectChanges != nil {
		for _, change := range resp.ObjectChanges {
			if created, ok := change.(types.ObjectChangeCreated); ok {
				if strings.Contains(string(created.ObjectType), "Catalog") {
					catalogID = created.ObjectId.String()
					break
				}
			}
		}
	}

	if catalogID == "" {
		return "", "", fmt.Errorf("catalog ID not found in transaction response")
	}

	return catalogID, resp.Digest.String(), nil
}

// CreateCartridge creates a new cartridge object on Sui
func (c *Client) CreateCartridge(ctx context.Context, cart *model.Cartridge) (string, string, error) {
	if c.account == nil {
		return "", "", fmt.Errorf("account not set")
	}

	packageID, err := sui_types.NewAddressFromHex(c.packageID)
	if err != nil {
		return "", "", fmt.Errorf("invalid package ID: %w", err)
	}

	blobIDBytes, err := hex.DecodeString(cart.BlobID)
	if err != nil {
		return "", "", fmt.Errorf("invalid blob ID: %w", err)
	}

	sha256Bytes, err := hex.DecodeString(cart.SHA256)
	if err != nil {
		return "", "", fmt.Errorf("invalid SHA256: %w", err)
	}

	// Build transaction
	ptb := sui_types.NewProgrammableTransactionBuilder()
	
	// Add arguments
	slugArg := ptb.MustPure(cart.Slug)
	titleArg := ptb.MustPure(cart.Title)
	platformArg := ptb.MustPure(uint8(cart.Platform))
	emulatorArg := ptb.MustPure(cart.EmulatorCore)
	versionArg := ptb.MustPure(cart.Version)
	blobIDArg := ptb.MustPure(blobIDBytes)
	sha256Arg := ptb.MustPure(sha256Bytes)
	sizeArg := ptb.MustPure(cart.SizeBytes)
	createdAtArg := ptb.MustPure(uint64(cart.CreatedAt.UnixMilli()))

	// Call create_cartridge
	ptb.MoveCall(
		*packageID,
		move_types.Identifier("cartridge"),
		move_types.Identifier("create_cartridge"),
		[]move_types.TypeTag{},
		[]sui_types.Argument{
			slugArg, titleArg, platformArg, emulatorArg,
			versionArg, blobIDArg, sha256Arg, sizeArg, createdAtArg,
		},
	)

	pt := ptb.Finish()

	// Get gas coin
	sender, err := sui_types.NewAddressFromHex(c.account.Address)
	if err != nil {
		return "", "", fmt.Errorf("invalid sender address: %w", err)
	}

	coins, err := c.client.GetCoins(ctx, *sender, nil, nil, 10)
	if err != nil {
		return "", "", fmt.Errorf("failed to get coins: %w", err)
	}
	if len(coins.Data) == 0 {
		return "", "", fmt.Errorf("no gas coins available")
	}

	gasCoin := coins.Data[0]
	gasPayment := []sui_types.ObjectRef{{
		ObjectId: gasCoin.CoinObjectId,
		Version:  gasCoin.Version,
		Digest:   gasCoin.Digest,
	}}

	// Build transaction data
	txData := sui_types.NewProgrammable(
		*sender,
		gasPayment,
		pt,
		50000000, // gas budget
		1000,     // gas price
	)

	// Sign transaction
	signature, err := c.account.SignSecureWithoutEncode(txData, sui_types.DefaultIntent())
	if err != nil {
		return "", "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Execute transaction
	resp, err := c.client.ExecuteTransactionBlock(
		ctx,
		lib.Base64Data(txData.Marshal()),
		[]any{signature},
		&types.SuiTransactionBlockResponseOptions{
			ShowEffects:       true,
			ShowObjectChanges: true,
		},
		types.TxnRequestTypeWaitForLocalExecution,
	)
	if err != nil {
		return "", "", fmt.Errorf("failed to execute transaction: %w", err)
	}

	// Extract cartridge ID from object changes
	var cartridgeID string
	if resp.ObjectChanges != nil {
		for _, change := range resp.ObjectChanges {
			if created, ok := change.(types.ObjectChangeCreated); ok {
				if strings.Contains(string(created.ObjectType), "Cartridge") {
					cartridgeID = created.ObjectId.String()
					break
				}
			}
		}
	}

	if cartridgeID == "" {
		return "", "", fmt.Errorf("cartridge ID not found in transaction response")
	}

	return cartridgeID, resp.Digest.String(), nil
}

// AddCatalogEntry adds an entry to a catalog
func (c *Client) AddCatalogEntry(ctx context.Context, catalogID string, entry *model.CatalogEntry) (string, error) {
	if c.account == nil {
		return "", fmt.Errorf("account not set")
	}

	packageID, err := sui_types.NewAddressFromHex(c.packageID)
	if err != nil {
		return "", fmt.Errorf("invalid package ID: %w", err)
	}

	catalogObjID, err := sui_types.NewObjectIdFromHex(catalogID)
	if err != nil {
		return "", fmt.Errorf("invalid catalog ID: %w", err)
	}

	cartridgeObjID, err := sui_types.NewObjectIdFromHex(entry.CartridgeID)
	if err != nil {
		return "", fmt.Errorf("invalid cartridge ID: %w", err)
	}

	coverBlobBytes := []byte{}
	if entry.CoverBlobID != "" {
		coverBlobBytes, _ = hex.DecodeString(entry.CoverBlobID)
	}

	// Get catalog object reference
	catalogObj, err := c.client.GetObject(ctx, *catalogObjID, &types.SuiObjectDataOptions{
		ShowContent: true,
		ShowOwner:   true,
	})
	if err != nil {
		return "", fmt.Errorf("failed to get catalog object: %w", err)
	}

	// Build transaction
	ptb := sui_types.NewProgrammableTransactionBuilder()
	
	// Add catalog as mutable object input
	catalogInput := ptb.MustObj(sui_types.ObjectArg{
		SharedObject: &sui_types.SharedObjectArg{
			Id:                   *catalogObjID,
			InitialSharedVersion: catalogObj.Data.Version,
			Mutable:              true,
		},
	})

	// Add other arguments
	slugArg := ptb.MustPure(entry.Slug)
	cartridgeIDArg := ptb.MustPure(*cartridgeObjID)
	titleArg := ptb.MustPure(entry.Title)
	platformArg := ptb.MustPure(uint8(entry.Platform))
	sizeArg := ptb.MustPure(entry.SizeBytes)
	emulatorArg := ptb.MustPure(entry.EmulatorCore)
	versionArg := ptb.MustPure(entry.Version)
	coverArg := ptb.MustPure(coverBlobBytes)

	// Call add_entry
	ptb.MoveCall(
		*packageID,
		move_types.Identifier("catalog"),
		move_types.Identifier("add_entry"),
		[]move_types.TypeTag{},
		[]sui_types.Argument{
			catalogInput, slugArg, cartridgeIDArg, titleArg,
			platformArg, sizeArg, emulatorArg, versionArg, coverArg,
		},
	)

	pt := ptb.Finish()

	// Get gas coin
	sender, err := sui_types.NewAddressFromHex(c.account.Address)
	if err != nil {
		return "", fmt.Errorf("invalid sender address: %w", err)
	}

	coins, err := c.client.GetCoins(ctx, *sender, nil, nil, 10)
	if err != nil {
		return "", fmt.Errorf("failed to get coins: %w", err)
	}
	if len(coins.Data) == 0 {
		return "", fmt.Errorf("no gas coins available")
	}

	gasCoin := coins.Data[0]
	gasPayment := []sui_types.ObjectRef{{
		ObjectId: gasCoin.CoinObjectId,
		Version:  gasCoin.Version,
		Digest:   gasCoin.Digest,
	}}

	// Build transaction data
	txData := sui_types.NewProgrammable(
		*sender,
		gasPayment,
		pt,
		50000000, // gas budget
		1000,     // gas price
	)

	// Sign transaction
	signature, err := c.account.SignSecureWithoutEncode(txData, sui_types.DefaultIntent())
	if err != nil {
		return "", fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Execute transaction
	resp, err := c.client.ExecuteTransactionBlock(
		ctx,
		lib.Base64Data(txData.Marshal()),
		[]any{signature},
		&types.SuiTransactionBlockResponseOptions{
			ShowEffects: true,
		},
		types.TxnRequestTypeWaitForLocalExecution,
	)
	if err != nil {
		return "", fmt.Errorf("failed to execute transaction: %w", err)
	}

	return resp.Digest.String(), nil
}

// GetCatalog retrieves a catalog object
func (c *Client) GetCatalog(ctx context.Context, catalogID string) (*model.Catalog, error) {
	objID, err := sui_types.NewObjectIdFromHex(catalogID)
	if err != nil {
		return nil, fmt.Errorf("invalid catalog ID: %w", err)
	}

	obj, err := c.client.GetObject(ctx, *objID, &types.SuiObjectDataOptions{
		ShowContent: true,
		ShowOwner:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get catalog: %w", err)
	}

	if obj.Data == nil || obj.Data.Content == nil {
		return nil, fmt.Errorf("catalog not found")
	}

	// Parse the content
	content, ok := obj.Data.Content.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid catalog content format")
	}

	fields, ok := content["fields"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid catalog fields format")
	}

	catalog := &model.Catalog{
		ID:          catalogID,
		Name:        fields["name"].(string),
		Description: fields["description"].(string),
	}

	if owner, ok := fields["owner"].(string); ok {
		catalog.Owner = owner
	}
	if count, ok := fields["count"].(float64); ok {
		catalog.Count = uint64(count)
	}

	return catalog, nil
}

// GetCatalogEntries retrieves all entries from a catalog using dynamic field enumeration
func (c *Client) GetCatalogEntries(ctx context.Context, catalogID string) ([]model.CatalogEntry, error) {
	objID, err := sui_types.NewObjectIdFromHex(catalogID)
	if err != nil {
		return nil, fmt.Errorf("invalid catalog ID: %w", err)
	}

	var entries []model.CatalogEntry
	var cursor *sui_types.ObjectId

	for {
		// Get dynamic fields
		resp, err := c.client.GetDynamicFields(ctx, *objID, cursor, 50)
		if err != nil {
			return nil, fmt.Errorf("failed to get dynamic fields: %w", err)
		}

		for _, field := range resp.Data {
			// Get the dynamic field object
			fieldObj, err := c.client.GetDynamicFieldObject(ctx, *objID, field.Name)
			if err != nil {
				continue // Skip failed entries
			}

			if fieldObj.Data == nil || fieldObj.Data.Content == nil {
				continue
			}

			// Parse entry
			entry, err := parseCatalogEntry(field.Name, fieldObj.Data.Content)
			if err != nil {
				continue
			}

			entries = append(entries, *entry)
		}

		if !resp.HasNextPage || resp.NextCursor == nil {
			break
		}
		cursor = resp.NextCursor
	}

	return entries, nil
}

func parseCatalogEntry(name types.DynamicFieldName, content interface{}) (*model.CatalogEntry, error) {
	// Extract slug from name
	slug := ""
	if nameValue, ok := name.Value.(string); ok {
		slug = nameValue
	}

	contentMap, ok := content.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid content format")
	}

	fields, ok := contentMap["fields"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid fields format")
	}

	value, ok := fields["value"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid value format")
	}

	valueFields, ok := value["fields"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid value fields format")
	}

	entry := &model.CatalogEntry{
		Slug: slug,
	}

	if cartridgeID, ok := valueFields["cartridge_id"].(string); ok {
		entry.CartridgeID = cartridgeID
	}
	if title, ok := valueFields["title"].(string); ok {
		entry.Title = title
	}
	if platform, ok := valueFields["platform"].(float64); ok {
		entry.Platform = model.Platform(platform)
	}
	if sizeBytes, ok := valueFields["size_bytes"].(float64); ok {
		entry.SizeBytes = uint64(sizeBytes)
	}
	if emulatorCore, ok := valueFields["emulator_core"].(string); ok {
		entry.EmulatorCore = emulatorCore
	}
	if version, ok := valueFields["version"].(float64); ok {
		entry.Version = uint16(version)
	}

	return entry, nil
}

// GetCartridge retrieves a cartridge object
func (c *Client) GetCartridge(ctx context.Context, cartridgeID string) (*model.Cartridge, error) {
	objID, err := sui_types.NewObjectIdFromHex(cartridgeID)
	if err != nil {
		return nil, fmt.Errorf("invalid cartridge ID: %w", err)
	}

	obj, err := c.client.GetObject(ctx, *objID, &types.SuiObjectDataOptions{
		ShowContent: true,
		ShowOwner:   true,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to get cartridge: %w", err)
	}

	if obj.Data == nil || obj.Data.Content == nil {
		return nil, fmt.Errorf("cartridge not found")
	}

	// Parse the content
	content, ok := obj.Data.Content.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid cartridge content format")
	}

	fields, ok := content["fields"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid cartridge fields format")
	}

	cart := &model.Cartridge{
		ID: cartridgeID,
	}

	if slug, ok := fields["slug"].(string); ok {
		cart.Slug = slug
	}
	if title, ok := fields["title"].(string); ok {
		cart.Title = title
	}
	if platform, ok := fields["platform"].(float64); ok {
		cart.Platform = model.Platform(platform)
	}
	if emulatorCore, ok := fields["emulator_core"].(string); ok {
		cart.EmulatorCore = emulatorCore
	}
	if version, ok := fields["version"].(float64); ok {
		cart.Version = uint16(version)
	}
	if sizeBytes, ok := fields["size_bytes"].(float64); ok {
		cart.SizeBytes = uint64(sizeBytes)
	}
	if publisher, ok := fields["publisher"].(string); ok {
		cart.Publisher = publisher
	}
	if blobID, ok := fields["blob_id"].([]interface{}); ok {
		cart.BlobID = bytesArrayToHex(blobID)
	}
	if sha256, ok := fields["sha256"].([]interface{}); ok {
		cart.SHA256 = bytesArrayToHex(sha256)
	}

	return cart, nil
}

func bytesArrayToHex(arr []interface{}) string {
	bytes := make([]byte, len(arr))
	for i, v := range arr {
		if f, ok := v.(float64); ok {
			bytes[i] = byte(f)
		}
	}
	return hex.EncodeToString(bytes)
}

