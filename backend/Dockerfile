############################
# Build stage
############################
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

<<<<<<< HEAD
# Copy everything (simplify to ensure restore sees all props/targets)
COPY . .

# Restore with full context (handles Directory.Build.* or props if added later)
RUN dotnet restore

# Publish (avoid trimming to keep reflection-friendly Azure SDK assemblies)
RUN dotnet publish -c Release -o /out /p:UseAppHost=false
=======
# Copy csproj separately for better layer caching
COPY backend/*.csproj ./backend/
RUN dotnet restore ./backend/*.csproj

# Copy the remaining source
COPY backend/. ./backend/
WORKDIR /src/backend

# Publish (no trimming to avoid issues with Azure.Data.Tables)
RUN dotnet publish -c Release -o /out --no-restore /p:UseAppHost=false
>>>>>>> cdcd553 (Pipeline fixes.)

############################
# Runtime stage
############################
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://0.0.0.0:8080 \
	DOTNET_EnableDiagnostics=0 \
	COMPlus_GCHeapHardLimit=0 \
	DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1
EXPOSE 8080
COPY --from=build /out .
ENTRYPOINT ["dotnet", "Todo.Api.dll"]
