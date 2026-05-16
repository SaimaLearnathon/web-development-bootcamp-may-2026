param(
  [string]$DockerHubUsername = $env:DOCKERHUB_USERNAME,
  [string]$ResourceGroup = "chatapp-rg",
  [string]$Location = "centralindia",
  [string]$ContainerEnv = "chatapp-env",
  [string]$ServerApp = "chat-server",
  [string]$PostgresApp = "chat-postgres",
  [string]$RedisApp = "chat-redis",
  [string]$PostgresUser = "chatuser",
  [string]$PostgresPassword = $env:AZURE_POSTGRES_PASSWORD,
  [string]$PostgresDb = "chatdb",
  [string]$ClientUrl = $env:CLIENT_URL
)

$ErrorActionPreference = "Continue"
$PSNativeCommandUseErrorActionPreference = $false

function Import-DotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) { return }
    $key, $value = $line.Split("=", 2)
    $key = $key.Trim()
    $value = $value.Trim().Trim('"').Trim("'")
    if ($key) { [Environment]::SetEnvironmentVariable($key, $value, "Process") }
  }
}

function Require-Value {
  param([string]$Name, [string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required value: $Name. Set it in .env, environment variables, or pass it as a script parameter."
  }
}

function Run {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE" }
}

function Invoke-Az {
  param([string[]]$Arguments)
  $output = & az @Arguments 2>$null
  return $output
}

# Escape a value for a YAML double-quoted scalar.
# Handles backslashes, double-quotes, and literal \n in Firebase keys.
function ConvertTo-YamlString {
  param([string]$Value)
  $escaped = $Value -replace '\\', '\\' -replace '"', '\"'
  return "`"$escaped`""
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot
Import-DotEnv "$ProjectRoot\.env"

if (-not $DockerHubUsername)  { $DockerHubUsername  = $env:DOCKERHUB_USERNAME }
if (-not $PostgresPassword)   { $PostgresPassword   = $env:AZURE_POSTGRES_PASSWORD }
if (-not $ClientUrl)          { $ClientUrl           = $env:CLIENT_URL }

$Image                  = "$DockerHubUsername/chatapp-server:latest"
$JwtSecret              = $env:JWT_SECRET
$GoogleClientId         = $env:GOOGLE_CLIENT_ID
$CloudinaryCloudName    = $env:CLOUDINARY_CLOUD_NAME
$CloudinaryApiKey       = $env:CLOUDINARY_API_KEY
$CloudinaryApiSecret    = $env:CLOUDINARY_API_SECRET
$CloudinaryUploadFolder = if ($env:CLOUDINARY_UPLOAD_FOLDER) { $env:CLOUDINARY_UPLOAD_FOLDER } else { "echoline/chat-images" }
$FirebaseProjectId      = $env:FIREBASE_PROJECT_ID
$FirebaseClientEmail    = $env:FIREBASE_CLIENT_EMAIL
$FirebasePrivateKey     = $env:FIREBASE_PRIVATE_KEY

Require-Value "DOCKERHUB_USERNAME"      $DockerHubUsername
Require-Value "AZURE_POSTGRES_PASSWORD" $PostgresPassword
Require-Value "CLIENT_URL"              $ClientUrl
Require-Value "JWT_SECRET"              $JwtSecret
Require-Value "GOOGLE_CLIENT_ID"        $GoogleClientId
Require-Value "CLOUDINARY_CLOUD_NAME"   $CloudinaryCloudName
Require-Value "CLOUDINARY_API_KEY"      $CloudinaryApiKey
Require-Value "CLOUDINARY_API_SECRET"   $CloudinaryApiSecret
Require-Value "FIREBASE_PROJECT_ID"     $FirebaseProjectId
Require-Value "FIREBASE_CLIENT_EMAIL"   $FirebaseClientEmail
Require-Value "FIREBASE_PRIVATE_KEY"    $FirebasePrivateKey

Write-Host "Deploying EchoLine Chat App with internal PostgreSQL and Redis Container Apps" -ForegroundColor Cyan
Write-Host "This is suitable for a bootcamp/demo deployment. Managed databases are safer for production." -ForegroundColor Yellow
Write-Host "Docker image: $Image"
Write-Host "Resource group: $ResourceGroup"
Write-Host "Environment: $ContainerEnv"

Write-Host "`nChecking Azure login..." -ForegroundColor Cyan
Run { az account show | Out-Null }

Write-Host "`nRegistering required Azure providers..." -ForegroundColor Cyan
Run { az provider register --namespace Microsoft.App --wait }
Run { az provider register --namespace Microsoft.OperationalInsights --wait }

Write-Host "`nBuilding backend image..." -ForegroundColor Cyan
Run { docker build -f server/Dockerfile -t $Image . }

Write-Host "`nPushing backend image..." -ForegroundColor Cyan
Run { docker push $Image }

Write-Host "`nCreating resource group..." -ForegroundColor Cyan
Run { az group create --name $ResourceGroup --location $Location | Out-Null }

Write-Host "`nCreating Container Apps environment if needed..." -ForegroundColor Cyan

$ExistingEnv = Invoke-Az @(
  "containerapp", "env", "list",
  "--resource-group", $ResourceGroup,
  "--query", "[?name=='$ContainerEnv'].name | [0]",
  "-o", "tsv"
)

if (-not $ExistingEnv) {
  Run {
    az containerapp env create `
      --name $ContainerEnv `
      --resource-group $ResourceGroup `
      --location $Location | Out-Null
  }
}

$EnvDomain = Invoke-Az @(
  "containerapp", "env", "show",
  "--name", $ContainerEnv,
  "--resource-group", $ResourceGroup,
  "--query", "properties.defaultDomain",
  "-o", "tsv"
)

Require-Value "Container Apps environment domain" $EnvDomain
Write-Host "Environment domain: $EnvDomain"

# Get the full resource ID for the managed environment (needed in the YAML)
$ManagedEnvId = Invoke-Az @(
  "containerapp", "env", "show",
  "--name", $ContainerEnv,
  "--resource-group", $ResourceGroup,
  "--query", "id",
  "-o", "tsv"
)
Require-Value "Managed environment resource ID" $ManagedEnvId

Write-Host "`nDeploying Redis as internal TCP Container App..." -ForegroundColor Cyan
Run {
  az containerapp create `
    --name $RedisApp `
    --resource-group $ResourceGroup `
    --environment $ContainerEnv `
    --image redis:7-alpine `
    --target-port 6379 `
    --ingress internal `
    --transport tcp `
    --min-replicas 1 | Out-Null
}

Write-Host "`nDeploying PostgreSQL as internal TCP Container App..." -ForegroundColor Cyan
Run {
  az containerapp create `
    --name $PostgresApp `
    --resource-group $ResourceGroup `
    --environment $ContainerEnv `
    --image postgres:16-alpine `
    --target-port 5432 `
    --ingress internal `
    --transport tcp `
    --min-replicas 1 `
    --env-vars `
      POSTGRES_USER="$PostgresUser" `
      POSTGRES_PASSWORD="$PostgresPassword" `
      POSTGRES_DB="$PostgresDb" | Out-Null
}

Write-Host "`nWaiting 60 seconds for PostgreSQL and Redis startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 60

$DatabaseUrl = "postgresql://${PostgresUser}:${PostgresPassword}@${PostgresApp}.internal.${EnvDomain}:5432/${PostgresDb}?schema=public"
$RedisUrl    = "redis://${RedisApp}.internal.${EnvDomain}:6379"

# Build the YAML using the exact schema from:
# https://github.com/Azure/azure-cli-extensions/issues/5636
# Top-level fields: kind, location, name, resourceGroup, type
# Environment goes under properties.managedEnvironmentId (full resource ID)
# ingress.external must be a bare boolean (true), NOT a quoted string ("true")
$YamlFile = [System.IO.Path]::Combine($env:TEMP, "chatapp-server.yaml")

$envVars = [ordered]@{
  PORT                     = "4000"
  DATABASE_URL             = $DatabaseUrl
  REDIS_URL                = $RedisUrl
  JWT_SECRET               = $JwtSecret
  CLIENT_URL               = $ClientUrl
  GOOGLE_CLIENT_ID         = $GoogleClientId
  CLOUDINARY_CLOUD_NAME    = $CloudinaryCloudName
  CLOUDINARY_API_KEY       = $CloudinaryApiKey
  CLOUDINARY_API_SECRET    = $CloudinaryApiSecret
  CLOUDINARY_UPLOAD_FOLDER = $CloudinaryUploadFolder
  FIREBASE_PROJECT_ID      = $FirebaseProjectId
  FIREBASE_CLIENT_EMAIL    = $FirebaseClientEmail
  FIREBASE_PRIVATE_KEY     = $FirebasePrivateKey
}

$yamlLines = [System.Collections.Generic.List[string]]::new()
$yamlLines.Add("kind: containerapp")
$yamlLines.Add("location: $Location")
$yamlLines.Add("name: $ServerApp")
$yamlLines.Add("resourceGroup: $ResourceGroup")
$yamlLines.Add("type: Microsoft.App/containerApps")
$yamlLines.Add("properties:")
$yamlLines.Add("  managedEnvironmentId: $ManagedEnvId")
$yamlLines.Add("  configuration:")
$yamlLines.Add("    ingress:")
$yamlLines.Add("      external: true")          # bare boolean — NOT "true" (quoted causes 400 error)
$yamlLines.Add("      allowInsecure: false")     # bare boolean
$yamlLines.Add("      targetPort: 4000")
$yamlLines.Add("      transport: auto")
$yamlLines.Add("      traffic:")
$yamlLines.Add("      - latestRevision: true")   # bare boolean
$yamlLines.Add("        weight: 100")
$yamlLines.Add("  template:")
$yamlLines.Add("    scale:")
$yamlLines.Add("      minReplicas: 1")
$yamlLines.Add("    containers:")
$yamlLines.Add("    - name: $ServerApp")
$yamlLines.Add("      image: $Image")
$yamlLines.Add("      env:")

foreach ($key in $envVars.Keys) {
  $yamlLines.Add("      - name: $key")
  $yamlLines.Add("        value: $(ConvertTo-YamlString $envVars[$key])")
}

# Write without BOM — az CLI YAML parser can choke on UTF-8 BOM
[System.IO.File]::WriteAllLines($YamlFile, $yamlLines, [System.Text.UTF8Encoding]::new($false))

Write-Host "YAML written to: $YamlFile"
Write-Host "--- YAML preview ---"
Get-Content $YamlFile | Select-Object -First 25 | Write-Host
Write-Host "--------------------"

try {
  Write-Host "`nDeploying backend Container App via YAML..." -ForegroundColor Cyan

  & az containerapp create `
    --name $ServerApp `
    --resource-group $ResourceGroup `
    --yaml $YamlFile 2>&1 | Where-Object { $_ -notmatch "^WARNING:" } | Write-Host

  if ($LASTEXITCODE -ne 0) {
    throw "az containerapp create --yaml failed with exit code $LASTEXITCODE"
  }
} finally {
  Remove-Item -Path $YamlFile -Force -ErrorAction SilentlyContinue
}

$ServerFqdn = Invoke-Az @(
  "containerapp", "show",
  "--name", $ServerApp,
  "--resource-group", $ResourceGroup,
  "--query", "properties.configuration.ingress.fqdn",
  "-o", "tsv"
)

Write-Host "`nDeployment complete." -ForegroundColor Green
Write-Host "Backend URL: https://$ServerFqdn"
Write-Host "Health check: https://$ServerFqdn/"
Write-Host ""
Write-Host "Use these frontend env vars in Vercel or your frontend host:" -ForegroundColor Cyan
Write-Host "VITE_API_URL=https://$ServerFqdn/api"
Write-Host "VITE_SOCKET_URL=https://$ServerFqdn"