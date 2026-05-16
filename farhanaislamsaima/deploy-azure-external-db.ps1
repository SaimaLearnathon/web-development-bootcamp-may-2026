param(
  [string]$DockerHubUsername = $env:DOCKERHUB_USERNAME,
  [string]$ResourceGroup = "chatapp-rg",
  [string]$Location = "centralindia",
  [string]$ContainerApp = "chatapp-server",
  [string]$ContainerEnv = "chatapp-env",
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

if (-not $ClientUrl) {
  $ClientUrl = $env:CLIENT_URL
}

$Image = "$DockerHubUsername/chatapp-server:latest"
$DatabaseUrl = $env:DATABASE_URL
$RedisUrl = $env:REDIS_URL
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
Require-Value "DATABASE_URL" $DatabaseUrl
Require-Value "REDIS_URL" $RedisUrl
Require-Value "CLIENT_URL" $ClientUrl
Require-Value "JWT_SECRET" $JwtSecret
Require-Value "GOOGLE_CLIENT_ID" $GoogleClientId
Require-Value "CLOUDINARY_CLOUD_NAME" $CloudinaryCloudName
Require-Value "CLOUDINARY_API_KEY" $CloudinaryApiKey
Require-Value "CLOUDINARY_API_SECRET" $CloudinaryApiSecret
Require-Value "FIREBASE_PROJECT_ID" $FirebaseProjectId
Require-Value "FIREBASE_CLIENT_EMAIL" $FirebaseClientEmail
Require-Value "FIREBASE_PRIVATE_KEY" $FirebasePrivateKey

Write-Host "Deploying EchoLine backend to Azure Container Apps with external PostgreSQL/Redis" -ForegroundColor Cyan
Write-Host "Docker image: $Image"
Write-Host "Resource group: $ResourceGroup"
Write-Host "Container app: $ContainerApp"

Write-Host "`nChecking Azure login..." -ForegroundColor Cyan
Run { az account show | Out-Null }

Write-Host "`nBuilding backend image..." -ForegroundColor Cyan
Run { docker build -f server/Dockerfile -t $Image . }

Write-Host "`nPushing backend image..." -ForegroundColor Cyan
Run { docker push $Image }

Write-Host "`nCreating resource group if needed..." -ForegroundColor Cyan
Run { az group create --name $ResourceGroup --location $Location | Out-Null }

Write-Host "`nCreating Container Apps environment if needed..." -ForegroundColor Cyan
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

Write-Host "`nPushing Prisma schema to external PostgreSQL..." -ForegroundColor Cyan
Push-Location "$ProjectRoot\server"
$env:DATABASE_URL = $DatabaseUrl
Run { npm run db:push }
Pop-Location

Write-Host "`nDeploying Azure Container App..." -ForegroundColor Cyan
Run {
  az containerapp up `
    --name $ContainerApp `
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

$Fqdn = az containerapp show `
  --name $ContainerApp `
  --resource-group $ResourceGroup `
  --query properties.configuration.ingress.fqdn `
  -o tsv

Write-Host "`nDeployment complete." -ForegroundColor Green
Write-Host "Backend URL: https://$Fqdn"
Write-Host "Health check: https://$Fqdn/"
Write-Host ""
Write-Host "Use these frontend env vars in Vercel or your frontend host:" -ForegroundColor Cyan
Write-Host "VITE_API_URL=https://$Fqdn/api"
Write-Host "VITE_SOCKET_URL=https://$Fqdn"
