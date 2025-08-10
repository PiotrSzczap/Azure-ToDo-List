# Azure Todo List (Mono-Repo)

Proste demo: .NET 9 backend + Angular (Tailwind) frontend + Playwright E2E + Azurite + docker-compose.

## Uruchomienie lokalne
```bash
docker compose up --build
```
Backend: http://localhost:5050/swagger  
Frontend: http://localhost:4200

## Struktura
- backend: Minimal API (Azure Table Storage)
- frontend: Angular standalone + Tailwind + CDK DragDrop
- tests: Playwright E2E

## Azure Deployment
Repo zawiera Bicep + GitHub Actions do automatycznego build/test/push/deploy na Azure Container Apps.

### Sekrety / Zmienne GitHub (OIDC)
Używamy Azure AD federated credentials (GitHub OIDC) zamiast statycznego sekretnika SP.

Sekrety:
- `AZURE_CLIENT_ID` – AAD Application (Service Principal) Client ID
- `AZURE_TENANT_ID` – AAD Tenant ID
- `AZURE_SUBSCRIPTION_ID` – Subscription ID
- `STORAGE_CONNECTION_STRING` – Storage Account connection string (Table)

Tworzenie aplikacji + federated credential (przykład):
```bash
APP_NAME=aztodo-oidc
az ad app create --display-name $APP_NAME --query appId -o tsv
APP_ID=$(az ad app list --display-name $APP_NAME --query [0].appId -o tsv)
az ad sp create --id $APP_ID
# Nadaj uprawnienia Contributor (lub precyzyjniejsze) na sub / RG
SUB_ID=$(az account show --query id -o tsv)
az role assignment create --assignee $APP_ID --role Contributor --subscription $SUB_ID

# Federated credential powiązana z gałęzią main
az ad app federated-credential create --id $APP_ID --parameters '{
	"name": "github-main",
	"issuer": "https://token.actions.githubusercontent.com",
	"subject": "repo:PiotrSzczap/Azure-ToDo-List:ref:refs/heads/main",
	"audiences": ["api://AzureADTokenExchange"]
}'
```
Następnie ustaw sekrety `AZURE_CLIENT_ID=$APP_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.

### Zmienne Opcjonalne
`AZ_RESOURCE_GROUP`, `AZ_LOCATION`, `AZ_NAME_PREFIX`, `AZ_ACR_NAME` (fallback w workflow env).

### Przebieg Pipeline
PR/push: build + E2E (docker compose).  
main: dodatkowo ACR build/push, Bicep deploy do Container Apps (multi-container app: frontend+backend).  
Wynik: URL w podsumowaniu joba.

### Ręczne wdrożenie (skrót)
```bash
az login
az group create -n todo-rg -l westeurope
az acr create -n aztodoreg -g todo-rg --sku Basic
ACR=$(az acr show -n aztodoreg --query loginServer -o tsv)
docker build -t $ACR/backend:manual backend
docker build -t $ACR/frontend:manual frontend
az acr login -n aztodoreg
docker push $ACR/backend:manual
docker push $ACR/frontend:manual
az deployment group create -g todo-rg -f infra/bicep/main.bicep -p namePrefix=aztodo backendImage=$ACR/backend:manual frontendImage=$ACR/frontend:manual storageConn='<STORAGE_CONNECTION_STRING>'
az storage table create --name todos --connection-string '<STORAGE_CONNECTION_STRING>'
FQDN=$(az containerapp show -n aztodo-app -g todo-rg --query properties.configuration.ingress.fqdn -o tsv)
echo https://$FQDN
```

## TODO / Rozszerzenia
- Walidacja reorder w E2E
- Autoryzacja (Entra ID)
- Monitoring / alerty
- Skalowanie (KEDA / CPU / HTTP)
