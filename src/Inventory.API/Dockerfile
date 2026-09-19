# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution files and project files
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Inventory.API/Inventory.API.csproj", "Inventory.API/"]
COPY ["src/Inventory.Domain/Inventory.Domain.csproj", "Inventory.Domain/"]
COPY ["src/Inventory.Infrastructure/Inventory.Infrastructure.csproj", "Inventory.Infrastructure/"]
COPY ["src/EventBus/EventBus.csproj", "EventBus/"]
COPY ["src/EventBusRabbitMQ/EventBusRabbitMQ.csproj", "EventBusRabbitMQ/"]
COPY ["src/IntegrationEventLogEF/IntegrationEventLogEF.csproj", "IntegrationEventLogEF/"]
COPY ["src/Ninja.ServiceDefaults/Ninja.ServiceDefaults.csproj", "Ninja.ServiceDefaults/"]
COPY ["src/Ninja.AI/Ninja.AI.csproj", "Ninja.AI/"]
COPY ["src/Shared/", "Shared/"]

# Restore dependencies
RUN dotnet restore "Inventory.API/Inventory.API.csproj"

# Copy source code
COPY ["src/Inventory.API/", "Inventory.API/"]
COPY ["src/Inventory.Domain/", "Inventory.Domain/"]
COPY ["src/Inventory.Infrastructure/", "Inventory.Infrastructure/"]
COPY ["src/EventBus/", "EventBus/"]
COPY ["src/EventBusRabbitMQ/", "EventBusRabbitMQ/"]
COPY ["src/IntegrationEventLogEF/", "IntegrationEventLogEF/"]
COPY ["src/Ninja.ServiceDefaults/", "Ninja.ServiceDefaults/"]
COPY ["src/Ninja.AI/", "Ninja.AI/"]

# Build
WORKDIR /src/Inventory.API
RUN dotnet build -c Release -o /app/build

# Publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Inventory.API.dll"]

