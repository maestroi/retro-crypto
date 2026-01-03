# Uploading a New Version of an Existing Cartridge

This guide explains how to upload a new version of a game that's already in the catalog.

## Automatic Version Detection

The uploader automatically detects if you're uploading a new version by matching the title:

1. **If title matches existing game**: Uses the existing app-id, auto-increments cartridge-id
2. **If title is new**: Creates a new app-id (new game)

## Simple Method (Recommended)

Just use the **same title** as the existing game, and the uploader will automatically:
- Find the existing app-id
- Generate a new cartridge-id (incremented)
- Create a new cartridge address
- Register as a new version

### Example: Upload Digger v1.1.0

```bash
./uploader upload-cartridge \
  --file digger-v1.1.0.zip \
  --title "Digger" \
  --semver "1.1.0" \
  --platform 0 \
  --generate-cartridge-addr \
  --catalog-addr test
```

**What happens:**
- Finds existing app-id for "Digger" (e.g., app-id 1)
- Auto-generates next cartridge-id (e.g., cartridge-id 2)
- Creates new cartridge address
- Uploads as version 1.1.0

## Manual Method (Specify App-ID)

If you want to explicitly specify the app-id:

```bash
./uploader upload-cartridge \
  --file digger-v1.1.0.zip \
  --app-id 1 \
  --title "Digger" \
  --semver "1.1.0" \
  --platform 0 \
  --generate-cartridge-addr \
  --catalog-addr test
```

**What happens:**
- Uses provided app-id (1)
- Auto-generates next cartridge-id for that app-id
- Creates new cartridge address
- Uploads as version 1.1.0

## Important Notes

1. **Each version needs a new cartridge address**: Always use `--generate-cartridge-addr` for new versions
2. **Semver should increment**: Use a higher version number (e.g., 1.0.0 → 1.1.0 → 2.0.0)
3. **Title must match exactly**: The title matching is case-insensitive but must match the existing title in the catalog
4. **Cartridge ID auto-increments**: You don't need to track cartridge IDs - the system handles it

## Version History Example

```
Digger v1.0.0 (app-id: 1, cartridge-id: 1) → Cartridge Address: NQ...
Digger v1.1.0 (app-id: 1, cartridge-id: 2) → Cartridge Address: NQ...
Digger v2.0.0 (app-id: 1, cartridge-id: 3) → Cartridge Address: NQ...
```

All versions will appear grouped together in the catalog under the same game entry.

