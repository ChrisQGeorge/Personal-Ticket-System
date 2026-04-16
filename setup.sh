#!/bin/bash
# =============================================================================
# Personal Ticket System — Setup Script
# =============================================================================
# This script creates a .env file from .env.template with auto-generated
# secure passwords and keys. Run it once before your first docker-compose up.
#
# Usage:
#   bash setup.sh
#   bash setup.sh --force   # Overwrite existing .env
# =============================================================================

set -e

ENV_FILE=".env"
TEMPLATE_FILE=".env.template"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "============================================="
echo "  Personal Ticket System — Setup"
echo "============================================="
echo -e "${NC}"

# Check if .env already exists
if [ -f "$ENV_FILE" ] && [ "$1" != "--force" ]; then
    echo -e "${YELLOW}Warning: .env file already exists.${NC}"
    echo "Use 'bash setup.sh --force' to overwrite, or edit .env manually."
    exit 0
fi

# Check template exists
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}Error: $TEMPLATE_FILE not found. Are you in the project root?${NC}"
    exit 1
fi

# Generate random passwords/keys
generate_password() {
    python3 -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32)))" 2>/dev/null \
    || python -c "import secrets, string; print(''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32)))" 2>/dev/null \
    || openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32
}

generate_fernet_key() {
    # Try cryptography library first, then fall back to raw base64 generation
    # A Fernet key is just URL-safe base64 of 32 random bytes
    local key
    key=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null \
        || python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>/dev/null \
        || python3 -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())" 2>/dev/null \
        || python -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())" 2>/dev/null \
        || openssl rand -base64 32 2>/dev/null \
        || echo "")
    if [ -z "$key" ]; then
        echo -e "${RED}FATAL: Cannot generate Fernet encryption key.${NC}" >&2
        echo -e "${RED}Ensure Python 3 or openssl is available.${NC}" >&2
        exit 1
    fi
    echo "$key"
}

generate_jwt_secret() {
    python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null \
    || python -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null \
    || openssl rand -base64 48
}

echo "Generating secure passwords and keys..."

DB_PASSWORD=$(generate_password)
ROOT_PASSWORD=$(generate_password)
JWT_SECRET=$(generate_jwt_secret)
FERNET_KEY=$(generate_fernet_key)

# Validate all secrets were generated
if [ -z "$DB_PASSWORD" ] || [ -z "$ROOT_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$FERNET_KEY" ]; then
    echo -e "${RED}FATAL: Failed to generate one or more secrets.${NC}"
    echo "Ensure Python 3 or openssl is available."
    exit 1
fi

echo -e "  ${GREEN}✓${NC} Database password generated"
echo -e "  ${GREEN}✓${NC} Root password generated"
echo -e "  ${GREEN}✓${NC} JWT secret generated"
echo -e "  ${GREEN}✓${NC} Encryption key generated"

# Create .env from template, replacing placeholders
cp "$TEMPLATE_FILE" "$ENV_FILE"

# Replace all CHANGE_ME placeholders
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|CHANGE_ME_root_password|${ROOT_PASSWORD}|g" "$ENV_FILE"
    sed -i '' "s|CHANGE_ME_db_password|${DB_PASSWORD}|g" "$ENV_FILE"
    sed -i '' "s|CHANGE_ME_jwt_secret|${JWT_SECRET}|g" "$ENV_FILE"
    sed -i '' "s|CHANGE_ME_fernet_key|${FERNET_KEY}|g" "$ENV_FILE"
else
    sed -i "s|CHANGE_ME_root_password|${ROOT_PASSWORD}|g" "$ENV_FILE"
    sed -i "s|CHANGE_ME_db_password|${DB_PASSWORD}|g" "$ENV_FILE"
    sed -i "s|CHANGE_ME_jwt_secret|${JWT_SECRET}|g" "$ENV_FILE"
    sed -i "s|CHANGE_ME_fernet_key|${FERNET_KEY}|g" "$ENV_FILE"
fi

# Verify no placeholders remain
if grep -q "CHANGE_ME" "$ENV_FILE"; then
    echo -e "${RED}ERROR: Some placeholders were not replaced. Check .env manually.${NC}"
    exit 1
fi

# Restrict file permissions (owner read/write only)
chmod 600 "$ENV_FILE"

echo ""
echo -e "${GREEN}✓ .env file created successfully (permissions: 600)${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Review .env and adjust any values if needed"
echo "  2. Run: docker-compose up -d --build"
echo "  3. Open http://localhost:3000 in your browser"
echo "  4. Register your first account (it will be admin automatically)"
echo ""
echo -e "${YELLOW}Important: Never commit .env to git!${NC}"
