# eShop Reference Application - "AdventureWorks"

A reference .NET application implementing an e-commerce website using a services-based architecture using [.NET Aspire](https://learn.microsoft.com/dotnet/aspire/).

![eShop Reference Application architecture diagram](img/eshop_architecture.png)

![eShop homepage screenshot](img/eshop_homepage.png)

## Getting Started

This version of eShop is based on .NET 9. 

Previous eShop versions:
* [.NET 8](https://github.com/dotnet/eShop/tree/release/8.0)

### Prerequisites

- Clone the eShop repository: https://github.com/dotnet/eshop
- [Install & start Docker Desktop](https://docs.docker.com/engine/install/)

#### Windows with Visual Studio
- Install [Visual Studio 2022 version 17.10 or newer](https://visualstudio.microsoft.com/vs/).
  - Select the following workloads:
    - `ASP.NET and web development` workload.
    - `.NET Aspire SDK` component in `Individual components`.
    - Optional: `.NET Multi-platform App UI development` to run client apps

Or

- Run the following commands in a Powershell & Terminal running as `Administrator` to automatically configure your environment with the required tools to build and run this application. (Note: A restart is required and included in the script below.)

```powershell
install-Module -Name Microsoft.WinGet.Configuration -AllowPrerelease -AcceptLicense -Force
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
get-WinGetConfiguration -file .\.configurations\vside.dsc.yaml | Invoke-WinGetConfiguration -AcceptConfigurationAgreements
```

Or

- From Dev Home go to `Machine Configuration -> Clone repositories`. Enter the URL for this repository. In the confirmation screen look for the section `Configuration File Detected` and click `Run File`.

#### Mac, Linux, & Windows without Visual Studio
- Install the latest [.NET 9 SDK](https://dot.net/download?cid=eshop)

Or

- Run the following commands in a Powershell & Terminal running as `Administrator` to automatically configuration your environment with the required tools to build and run this application. (Note: A restart is required after running the script below.)

##### Install Visual Studio Code and related extensions
```powershell
install-Module -Name Microsoft.WinGet.Configuration -AllowPrerelease -AcceptLicense  -Force
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
get-WinGetConfiguration -file .\.configurations\vscode.dsc.yaml | Invoke-WinGetConfiguration -AcceptConfigurationAgreements
```

> Note: These commands may require `sudo`

- Optional: Install [Visual Studio Code with C# Dev Kit](https://code.visualstudio.com/docs/csharp/get-started)
- Optional: Install [.NET MAUI Workload](https://learn.microsoft.com/dotnet/maui/get-started/installation?tabs=visual-studio-code)

> Note: When running on Mac with Apple Silicon (M series processor), Rosetta 2 for grpc-tools. 

### Running the solution

> [!WARNING]
> Remember to ensure that Docker is started

* (Windows only) Run the application from Visual Studio:
 - Open the `eShop.Web.slnf` file in Visual Studio
 - Ensure that `eShop.AppHost.csproj` is your startup project
 - Hit Ctrl-F5 to launch Aspire

* Or run the application from your terminal:
```powershell
dotnet run --project src/eShop.AppHost/eShop.AppHost.csproj
```
then look for lines like this in the console output in order to find the URL to open the Aspire dashboard:
```sh
Login to the dashboard at: http://localhost:19888/login?t=uniquelogincodeforyou
```

> You may need to install ASP.NET Core HTTPS development certificates first, and then close all browser tabs. Learn more at https://aka.ms/aspnet/https-trust-dev-cert

### AI assistant (Gemini, or any OpenAI-compatible provider)

The back office has an assistant for the chores of building and keeping a menu: type a new item's name in one language and one click fills in the other (English ↔ Egyptian Arabic), writes the description and picks the category; on a saved item it proposes the option groups customers pick from (size, sugar, extras) in the menu's own wording; a photo of a printed menu becomes proposed sections and priced items you review before they are created; and a photo of a supplier receipt becomes purchase lines you review before receiving them. It runs on [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) over one chat model that the AppHost declares as an Aspire resource, the way [eShop](https://github.com/dotnet/eShop) wires its models. Nothing is written by the assistant; every answer is a proposal the form or the review sheet shows you first.

The key is the AppHost's **`gemini-api-key` secret parameter**. On the first `aspire run` the dashboard shows *Unresolved parameters*: paste a free key from [Google AI Studio](https://aistudio.google.com/apikey), tick *remember*, and it is saved to the AppHost's user secrets — `catalog-api` and `inventory-api` wait for it and then start. Setting `GEMINI_API_KEY` in the environment (Google's own convention) or the user secret by hand works too:

```powershell
dotnet user-secrets set "Parameters:gemini-api-key" "AIza..." --project src/Chillax.AppHost
```

The key never lives in the repository: locally it is a user secret or an environment variable, in deployment it is a GitHub secret. A checkout that does not want the assistant at all sets `"AI": { "Enabled": false }` in the AppHost's *appsettings.Development.json* or user secrets; the endpoints then answer `503` and the admin app hides the buttons. The provider and model live in *src/Chillax.AppHost/appsettings.json*:

```json
  "AI": {
    "Endpoint": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "ChatModel": "gemini-3.8-flash"
  }
```

Any provider with an OpenAI-compatible endpoint is a matter of changing those two values and the key. For deployment the key comes from the `GEMINI_API_KEY` repository secret (see *.github/workflows/deploy.yml*).

Good to know about the Gemini free tier: it allows roughly ten requests a minute and a few hundred a day on `gemini-3.8-flash` (the services keep their own limiter under that, `AI:RequestsPerMinute` / `AI:PerUserRequestsPerMinute`), and Google may use free-tier prompts to improve its models, so do not scan anything you would not want leaving the building. Under test the AppHost runs the services with `AI:UseFake=true`, a scripted stand-in that needs no key and no network.

### Use Azure Developer CLI

You can use the [Azure Developer CLI](https://aka.ms/azd) to run this project on Azure with only a few commands. Follow the next instructions:

- Install the latest or update to the latest [Azure Developer CLI (azd)](https://aka.ms/azure-dev/install).
- Log in `azd` (if you haven't done it before) to your Azure account:
```sh
azd auth login
```
- Initialize `azd` from the root of the repo.
```sh
azd init
```
- During init:
  - Select `Use code in the current directory`. Azd will automatically detect the .NET Aspire project.
  - Confirm `.NET (Aspire)` and continue.
  - Select which services to expose to the Internet (exposing `webapp` is enough to test the sample).
  - Finalize the initialization by giving a name to your environment.

- Create Azure resources and deploy the sample by running:
```sh
azd up
```
Notes:
  - The operation takes a few minutes the first time it is ever run for an environment.
  - At the end of the process, `azd` will display the `url` for the webapp. Follow that link to test the sample.
  - You can run `azd up` after saving changes to the sample to re-deploy and update the sample.
  - Report any issues to [azure-dev](https://github.com/Azure/azure-dev/issues) repo.
  - [FAQ and troubleshoot](https://learn.microsoft.com/azure/developer/azure-developer-cli/troubleshoot?tabs=Browser) for azd.

## Contributing

For more information on contributing to this repo, read [the contribution documentation](./CONTRIBUTING.md) and [the Code of Conduct](CODE-OF-CONDUCT.md).

### Sample data

The sample catalog data is defined in [catalog.json](https://github.com/dotnet/eShop/blob/main/src/Catalog.API/Setup/catalog.json). Those product names, descriptions, and brand names are fictional and were generated using [GPT-35-Turbo](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/chatgpt), and the corresponding [product images](https://github.com/dotnet/eShop/tree/main/src/Catalog.API/Pics) were generated using [DALL·E 3](https://openai.com/dall-e-3).

## Keycloak: Social Login Token Exchange Setup

The mobile app uses native social sign-in (Google, Facebook) and exchanges the social access token for Keycloak tokens via the [Token Exchange](https://www.keycloak.org/securing-apps/token-exchange) grant. This requires one-time manual configuration in the Keycloak Admin Console after the realm is created.

### Prerequisites

- Keycloak is running with the feature flags: `token-exchange,admin-fine-grained-authz:v1`
  (configured in `Chillax.AppHost/Program.cs` via `KC_FEATURES`)
- The identity providers (Google, Facebook) are configured in the realm (via `chillax-realm.json`)

### Google Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**
2. Create an **OAuth 2.0 Web Client** — copy the Client ID and Secret
3. Create **OAuth 2.0 Android Clients** for debug and release (using SHA-1 key fingerprints)
4. Update `chillax-realm.json` Google identity provider with the Web Client ID and Secret
5. Update `client_app/lib/core/config/app_config.dart` with the Web Client ID as `googleServerClientId`

### Facebook Setup

1. Go to [Facebook Developer Console](https://developers.facebook.com/) > create an app
2. Add **Facebook Login** product
3. Under **Settings > Basic**: copy the **App ID** and **App Secret**
4. Under **Settings > Advanced > Security**: copy the **Client Token**
5. Under **Settings > Basic**: add **Android** platform with package name `com.chillax.client` and key hashes (base64-encoded SHA-1 for debug and release)
6. Update `chillax-realm.json` Facebook identity provider with the App ID and App Secret
7. Update `client_app/android/app/src/main/res/values/strings.xml` with the App ID and Client Token

### Keycloak Token Exchange Permissions

For each identity provider (Google and Facebook), enable token exchange permissions:

1. Open the Keycloak Admin Console at `http://localhost:8080/admin`
2. Select the **chillax** realm
3. Go to **Identity Providers** > select the provider (Google or Facebook)
4. Click the **Permissions** tab
5. Toggle **Permissions Enabled** to **ON**
6. Click the **token-exchange** link in the permission list
7. Click **Assign policy** > **Create policy** > select type **Client**
8. Name it `mobile-app-policy`, select **mobile-app** as the client, and save
9. If the policy already exists (from configuring the first provider), just assign the existing `mobile-app-policy`

> **Note:** This configuration is persisted in the Keycloak data volume. It only needs to be done once per environment. If the Keycloak volume is deleted, repeat these steps after the realm is re-imported.

> **Why not in realm.json?** The token exchange permission references entities by auto-generated UUIDs (identity provider ID, client ID) that differ on each fresh deployment, so it cannot be reliably pre-configured in the realm import file.

## eShop on Azure

For a version of this app configured for deployment on Azure, please view [the eShop on Azure](https://github.com/Azure-Samples/eShopOnAzure) repo.
