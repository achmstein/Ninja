# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Control.API/Control.API.csproj", "Control.API/"]
COPY ["src/Ninja.ServiceDefaults/Ninja.ServiceDefaults.csproj", "Ninja.ServiceDefaults/"]
COPY ["src/Shared/", "Shared/"]

RUN dotnet restore "Control.API/Control.API.csproj"

COPY ["src/Control.API/", "Control.API/"]
COPY ["src/Ninja.ServiceDefaults/", "Ninja.ServiceDefaults/"]

WORKDIR /src/Control.API
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage: the control plane stamps stacks with the docker CLI against
# the host's socket (mounted at /var/run/docker.sock), so the CLI and the
# compose plugin ride along.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
    && install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Control.API.dll"]
