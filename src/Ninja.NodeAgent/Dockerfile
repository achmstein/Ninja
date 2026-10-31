# The node agent: on every node but the control plane's own box. It runs the
# node's stacks with the docker CLI against the host's socket, its Postgres
# and broker through docker exec, and answers only the control plane's
# certificate on the private network (deploy/cell).

# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["Directory.Build.props", "./"]
COPY ["Directory.Packages.props", "./"]
COPY ["src/Ninja.NodeAgent/Ninja.NodeAgent.csproj", "Ninja.NodeAgent/"]
COPY ["src/Ninja.Control.NodeRuntime/Ninja.Control.NodeRuntime.csproj", "Ninja.Control.NodeRuntime/"]

RUN dotnet restore "Ninja.NodeAgent/Ninja.NodeAgent.csproj"

COPY ["src/Ninja.NodeAgent/", "Ninja.NodeAgent/"]
COPY ["src/Ninja.Control.NodeRuntime/", "Ninja.Control.NodeRuntime/"]

WORKDIR /src/Ninja.NodeAgent
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage: the docker CLI and the compose plugin, static binaries from the official image
FROM docker:cli AS dockercli

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=dockercli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
WORKDIR /app
EXPOSE 7443

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Ninja.NodeAgent.dll"]
