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
# the host's socket (mounted at /var/run/docker.sock). The CLI and the compose
# plugin are static binaries copied from the official image; no apt needed.
FROM docker:cli AS dockercli

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
WORKDIR /app
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Control.API.dll"]
