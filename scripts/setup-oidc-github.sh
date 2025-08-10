#!/usr/bin/env bash
set -euo pipefail

# Purpose: Provision Azure AD App + Federated Credential, Resource Group, ACR, Storage Account,
# and populate GitHub repo secrets/variables for OIDC-based deployment.
# Prerequisites:
#   - az CLI logged in (az login)
#   - gh CLI authenticated (gh auth login) with repo admin rights
#   - Permissions to create AAD app / role assignments

# -------- Configuration (override via env vars before running) --------
GH_OWNER="${GH_OWNER:-PiotrSzczap}"               # GitHub user/org
GH_REPO="${GH_REPO:-Azure-ToDo-List}"            # Repository name
BRANCH_REF="${BRANCH_REF:-refs/heads/main}"      # Branch for federated credential subject
APP_NAME="${APP_NAME:-aztodo-oidc}"              # Azure AD App display name
ROLE_NAME="${ROLE_NAME:-Contributor}"            # RBAC role to assign
RESOURCE_GROUP="${RESOURCE_GROUP:-todo-rg}"       # Azure resource group
LOCATION="${LOCATION:-westeurope}"               # Azure location
ACR_NAME="${ACR_NAME:-aztodoreg}"                # ACR (must be globally unique)
NAME_PREFIX="${NAME_PREFIX:-aztodo}"             # Prefix used in Bicep deployment
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-${NAME_PREFIX}store}" # Storage account (lowercase, <=24 chars)
TABLE_NAME="${TABLE_NAME:-todos}"                # Table name

# -------- Derived / Validation --------
if [[ ${#STORAGE_ACCOUNT} -gt 24 ]]; then
  echo "ERROR: STORAGE_ACCOUNT name too long (${#STORAGE_ACCOUNT}) > 24" >&2; exit 1; fi

echo "==> Azure subscription context"
SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Subscription: $SUB_ID"
echo "Tenant:       $TENANT_ID"

echo "==> Ensure required resource providers are registered"
REQUIRED_PROVIDERS=(Microsoft.ContainerRegistry Microsoft.App Microsoft.OperationalInsights)
for RP in "${REQUIRED_PROVIDERS[@]}"; do
  STATE=$(az provider show -n "$RP" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
  if [[ "$STATE" != "Registered" ]]; then
    echo "Registering $RP (current: $STATE)"
    az provider register -n "$RP" >/dev/null || true
    # Wait until registered (with timeout 5m)
    for i in {1..60}; do
      STATE=$(az provider show -n "$RP" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
      [[ "$STATE" == "Registered" ]] && break
      sleep 5
    done
    if [[ "$STATE" != "Registered" ]]; then
      echo "WARNING: Provider $RP not fully registered yet (state=$STATE). Continuing..."
    else
      echo "Provider $RP registered."
    fi
  else
    echo "Provider $RP already registered."
  fi
done

echo "==> Create / ensure resource group"
az group create -n "$RESOURCE_GROUP" -l "$LOCATION" >/dev/null

echo "==> Create / ensure ACR ($ACR_NAME)"
if ! az acr show -n "$ACR_NAME" >/dev/null 2>&1; then
  az acr create -n "$ACR_NAME" -g "$RESOURCE_GROUP" --sku Basic --admin-enabled false >/dev/null
fi

echo "==> Create / ensure Storage Account ($STORAGE_ACCOUNT)"
if ! az storage account show -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" >/dev/null 2>&1; then
  az storage account create -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 >/dev/null
fi

echo "==> Fetch storage connection string"
STORAGE_CONNECTION_STRING=$(az storage account show-connection-string -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" --query connectionString -o tsv)

echo "==> Ensure Table Storage table ($TABLE_NAME)"
az storage table create --name "$TABLE_NAME" --account-name "$STORAGE_ACCOUNT" >/dev/null || true

echo "==> Create / ensure Azure AD Application ($APP_NAME)"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [[ -z "$APP_ID" || "$APP_ID" == "null" ]]; then
  APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "Created app with id $APP_ID"
else
  echo "App already exists (appId=$APP_ID)"
fi

echo "==> Create Service Principal (if missing)"
if ! az ad sp show --id "$APP_ID" >/dev/null 2>&1; then
  az ad sp create --id "$APP_ID" >/dev/null
fi

echo "==> Assign role $ROLE_NAME at subscription scope"
az role assignment create --assignee "$APP_ID" --role "$ROLE_NAME" --subscription "$SUB_ID" >/dev/null 2>&1 || echo "(role assignment may already exist)"

echo "==> Configure federated credential for branch $BRANCH_REF"
FED_SUBJECT="repo:${GH_OWNER}/${GH_REPO}:ref:${BRANCH_REF}"
FC_NAME="github-${BRANCH_REF//\//-}"
FC_JSON=$(cat <<EOF
{
  "name": "$FC_NAME",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "$FED_SUBJECT",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
)
az ad app federated-credential create --id "$APP_ID" --parameters "$FC_JSON" >/dev/null 2>&1 || echo "(federated credential may already exist)"

echo "==> Set GitHub secrets (OIDC identifiers + storage)"
gh secret set AZURE_CLIENT_ID --repo "$GH_OWNER/$GH_REPO" --body "$APP_ID"
gh secret set AZURE_TENANT_ID --repo "$GH_OWNER/$GH_REPO" --body "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID --repo "$GH_OWNER/$GH_REPO" --body "$SUB_ID"
gh secret set STORAGE_CONNECTION_STRING --repo "$GH_OWNER/$GH_REPO" --body "$STORAGE_CONNECTION_STRING"

echo "==> Set GitHub variables (infra naming)"
gh variable set AZ_RESOURCE_GROUP --repo "$GH_OWNER/$GH_REPO" --body "$RESOURCE_GROUP"
gh variable set AZ_LOCATION --repo "$GH_OWNER/$GH_REPO" --body "$LOCATION"
gh variable set AZ_NAME_PREFIX --repo "$GH_OWNER/$GH_REPO" --body "$NAME_PREFIX"
gh variable set AZ_ACR_NAME --repo "$GH_OWNER/$GH_REPO" --body "$ACR_NAME"

echo "------------------------------------------------------------"
echo "Setup complete."
echo "App ID:            $APP_ID"
echo "Federated Subject: $FED_SUBJECT"
echo "Federated Name:    $FC_NAME"
echo "Resource Group:    $RESOURCE_GROUP"
echo "ACR:               $ACR_NAME"
echo "Storage Account:   $STORAGE_ACCOUNT"
echo "Table:             $TABLE_NAME"
echo "GitHub Repo:       $GH_OWNER/$GH_REPO"
echo "------------------------------------------------------------"
echo "Trigger a push to $BRANCH_REF to deploy."
