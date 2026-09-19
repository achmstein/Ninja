# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution files and project files
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Finance.API/Finance.API.csproj", "Finance.API/"]
COPY ["src/Finance.Domain/Finance.Domain.csproj", "Finance.Domain/"]
COPY ["src/Finance.Infrastructure/Finance.Infrastructure.csproj", "Finance.Infrastructure/"]
COPY ["src/EventBus/EventBus.csproj", "EventBus/"]
COPY ["src/EventBusRabbitMQ/EventBusRabbitMQ.csproj", "EventBusRabbitMQ/"]
COPY ["src/IntegrationEventLogEF/IntegrationEventLogEF.csproj", "IntegrationEventLogEF/"]
COPY ["src/Ninja.ServiceDefaults/Ninja.ServiceDefaults.csproj", "Ninja.ServiceDefaults/"]
COPY ["src/Shared/", "Shared/"]

# Restore dependencies
RUN dotnet restore "Finance.API/Finance.API.csproj"

# Copy source code
COPY ["src/Finance.API/", "Finance.API/"]
COPY ["src/Finance.Domain/", "Finance.Domain/"]
COPY ["src/Finance.Infrastructure/", "Finance.Infrastructure/"]
COPY ["src/EventBus/", "EventBus/"]
COPY ["src/EventBusRabbitMQ/", "EventBusRabbitMQ/"]
COPY ["src/IntegrationEventLogEF/", "IntegrationEventLogEF/"]
COPY ["src/Ninja.ServiceDefaults/", "Ninja.ServiceDefaults/"]

# Build
WORKDIR /src/Finance.API
RUN dotnet build -c Release -o /app/build

# Publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Finance.API.dll"]

