# Azure Todo List (Mono-Repo)

Proste demo: .NET 9 backend + Angular (Tailwind) frontend + Playwright E2E + Azurite + docker-compose.

## Uruchomienie

```
docker compose up --build
```
Backend: http://localhost:5000/swagger
Frontend: http://localhost:4200

## Struktura
- backend: Minimal API (Table Storage via Azurite)
- frontend: Angular standalone component + Tailwind
- tests: Playwright E2E (po starcie środowiska)

## TODO / Rozszerzenia
- Podłączenie rzeczywistego Azure Table (zmień connection string)
- Persistencja kolejności drag & drop do API
- Dodanie autoryzacji (AAD / Entra ID)
- CI/CD workflow (GitHub Actions + OIDC)
