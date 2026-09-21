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

# Liveness for docker and compose (the aspnet image has neither curl nor wget; bash can open a socket):
# compose brings Caddy up only once this answers, and restarts the container when it stops answering
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080 && printf "GET /alive HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && head -1 <&3 | grep -q " 200 "'

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Control.API.dll"]
