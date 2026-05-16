param(
  [string]$DockerHubUsername = $env:DOCKERHUB_USERNAME,
  [string]$ResourceGroup = "SeliseChat-India-RG",
  [string]$Location = "centralindia",
  [string]$ContainerEnv = "selise-chat-env",
  [string]$ServerApp = "chat-server",
  [string]$PostgresApp = "postgres",
  [string]$RedisApp = "redis",
  [string]$PostgresUser = "chatuser",
  [string]$PostgresPassword = $env:AZURE_POSTGRES_PASSWORD,
  [string]$PostgresDb = "chatdb",
  [string]$ClientUrl = $env:CLIENT_URL
)

$ErrorActionPreference = "Stop"

function Import-DotEnv {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
      return
    }

    $key, $value = $line.Split("=", 2)
    $key = $key.Trim()
    $value = $value.Trim().Trim('"').Trim("'")

    if ($key) {
      [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
  }
}

function Require-Value {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required value: $Name. Set it in .env, environment variables, or pass it as a script parameter."
  }
}

function Run {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot
Import-DotEnv "$ProjectRoot\.env"

if (-not $DockerHubUsername) {
  $DockerHubUsername = $env:DOCKERHUB_USERNAME
}

if (-not $PostgresPassword) {
  $PostgresPassword = $env:AZURE_POSTGRES_PASSWORD
}

if (-not $ClientUrl) {
  $ClientUrl = $env:CLIENT_URL
}

$Image = "$DockerHubUsername/chatapp-server:latest"
$JwtSecret = $env:JWT_SECRET
$GoogleClientId = $env:GOOGLE_CLIENT_ID
$CloudinaryCloudName = $env:CLOUDINARY_CLOUD_NAME
$CloudinaryApiKey = $env:CLOUDINARY_API_KEY
$CloudinaryApiSecret = $env:CLOUDINARY_API_SECRET
$CloudinaryUploadFolder = if ($env:CLOUDINARY_UPLOAD_FOLDER) { $env:CLOUDINARY_UPLOAD_FOLDER } else { "echoline/chat-images" }
$FirebaseProjectId = $env:FIREBASE_PROJECT_ID
$FirebaseClientEmail = $env:FIREBASE_CLIENT_EMAIL
$FirebasePrivateKey = $env:FIREBASE_PRIVATE_KEY

Require-Value "DOCKERHUB_USERNAME" $DockerHubUsername
Require-Value "AZURE_POSTGRES_PASSWORD" $PostgresPassword
Require-Value "CLIENT_URL" $ClientUrl
Require-Value "JWT_SECRET" $JwtSecret
Require-Value "GOOGLE_CLIENT_ID" $GoogleClientId
Require-Value "CLOUDINARY_CLOUD_NAME" $CloudinaryCloudName
Require-Value "CLOUDINARY_API_KEY" $CloudinaryApiKey
Require-Value "CLOUDINARY_API_SECRET" $CloudinaryApiSecret
Require-Value "FIREBASE_PROJECT_ID" $FirebaseProjectId
Require-Value "FIREBASE_CLIENT_EMAIL" $FirebaseClientEmail
Require-Value "FIREBASE_PRIVATE_KEY" $FirebasePrivateKey

Write-Host "Deploying EchoLine with PostgreSQL and Redis as internal Container Apps" -ForegroundColor Cyan
Write-Host "This is suitable for a demo. Managed databases are safer for production." -ForegroundColor Yellow

Write-Host "`nRegistering required Azure providers..." -ForegroundColor Cyan
Run { az provider register --namespace Microsoft.App --wait }
Run { az provider register --namespace Microsoft.OperationalInsights --wait }

Write-Host "`nBuilding backend image..." -ForegroundColor Cyan
Run { docker build -f server/Dockerfile -t $Image . }

Write-Host "`nPushing backend image..." -ForegroundColor Cyan
Run { docker push $Image }

Write-Host "`nCreating resource group..." -ForegroundColor Cyan
Run { az group create --name $ResourceGroup --location $Location | Out-Null }

Write-Host "`nCreating Container Apps environment..." -ForegroundColor Cyan
$ExistingEnv = az containerapp env show `
  --name $ContainerEnv `
  --resource-group $ResourceGroup `
  --query name `
  -o tsv 2>$null

if (-not $ExistingEnv) {
  Run {
    az containerapp env create `
      --name $ContainerEnv `
      --resource-group $ResourceGroup `
      --location $Location `
      | Out-Null
  }
}

$EnvDomain = az containerapp env show `
  --name $ContainerEnv `
  --resource-group $ResourceGroup `
  --query "properties.defaultDomain" `
  -o tsv

Require-Value "Container Apps environment domain" $EnvDomain
Write-Host "Environment domain: $EnvDomain"

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
    --min-replicas 1 `
    | Out-Null
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
      POSTGRES_DB="$PostgresDb" `
    | Out-Null
}

Write-Host "`nWaiting 60 seconds for PostgreSQL and Redis startup..." -ForegroundColor Cyan
Start-Sleep -Seconds 60

$DatabaseUrl = "postgresql://${PostgresUser}:${PostgresPassword}@${PostgresApp}.internal.${EnvDomain}:5432/${PostgresDb}?schema=public"
$RedisUrl = "redis://${RedisApp}.internal.${EnvDomain}:6379"

Write-Host "`nDeploying backend Container App..." -ForegroundColor Cyan
Run {
  az containerapp up `
    --name $ServerApp `
    --resource-group $ResourceGroup `
    --environment $ContainerEnv `
    --image $Image `
    --target-port 4000 `
    --ingress external `
    --env-vars `
      PORT=4000 `
      DATABASE_URL="$DatabaseUrl" `
      REDIS_URL="$RedisUrl" `
      JWT_SECRET="$JwtSecret" `
      CLIENT_URL="$ClientUrl" `
      GOOGLE_CLIENT_ID="$GoogleClientId" `
      CLOUDINARY_CLOUD_NAME="$CloudinaryCloudName" `
      CLOUDINARY_API_KEY="$CloudinaryApiKey" `
      CLOUDINARY_API_SECRET="$CloudinaryApiSecret" `
      CLOUDINARY_UPLOAD_FOLDER="$CloudinaryUploadFolder" `
      FIREBASE_PROJECT_ID="$FirebaseProjectId" `
      FIREBASE_CLIENT_EMAIL="$FirebaseClientEmail" `
      FIREBASE_PRIVATE_KEY="$FirebasePrivateKey" `
    | Out-Null
}

$ServerFqdn = az containerapp show `
  --name $ServerApp `
  --resource-group $ResourceGroup `
  --query properties.configuration.ingress.fqdn `
  -o tsv

Write-Host "Backend URL: https://$ServerFqdn" -ForegroundColor Green
Write-Host "Frontend env:"
Write-Host "VITE_API_URL=https://$ServerFqdn/api"
Write-Host "VITE_SOCKET_URL=https://$ServerFqdn"
