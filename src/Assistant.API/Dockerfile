# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution files and project files
COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Assistant.API/Assistant.API.csproj", "Assistant.API/"]
COPY ["src/Ninja.ServiceDefaults/Ninja.ServiceDefaults.csproj", "Ninja.ServiceDefaults/"]
COPY ["src/Shared/", "Shared/"]

# Restore dependencies
RUN dotnet restore "Assistant.API/Assistant.API.csproj"

# Copy source code
COPY ["src/Assistant.API/", "Assistant.API/"]
COPY ["src/Ninja.ServiceDefaults/", "Ninja.ServiceDefaults/"]

# Build
WORKDIR /src/Assistant.API
RUN dotnet build -c Release -o /app/build

# Publish
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
EXPOSE 8080
EXPOSE 8081

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Assistant.API.dll"]
