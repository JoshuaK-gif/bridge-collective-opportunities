<#
.SYNOPSIS
  Deploy Bridge Jobs to OCI using only Always Free Tier resources (lifetime free).
.DESCRIPTION
  Creates VCN, subnet, security list, and a single compute instance using
  the Ampere A1.Flex shape (ARM, up to 4 OCPUs / 24 GB RAM — all free).
  No load balancers, no paid block volumes, no paid shapes.

  OCI Always Free Tier limits used:
  - 1x VM.Standard.A1.Flex (1 OCPU, 6 GB RAM) — free
  - 50 GB boot volume (of 200 GB free tier allowance)
  - VCN with 1 public subnet — free
  - 10 TB/month outbound data — free
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$CompartmentId,

  [Parameter(Mandatory = $true)]
  [string]$SshPublicKeyPath,

  [string]$Region = "us-ashburn-1",
  [string]$VcnCidr = "10.0.0.0/16",
  [string]$SubnetCidr = "10.0.1.0/24",
  [string]$AdminCidr = "0.0.0.0/0",
  [string]$Domain = "bridgejobs.ug",
  [string]$JwtSecret = $(Write-Host "Enter JWT secret" -ForegroundColor Yellow; Read-Host -AsSecureString),
  [string]$DbPassword = $(Write-Host "Enter DB password" -ForegroundColor Yellow; Read-Host -AsSecureString)
)

$ErrorActionPreference = "Stop"

# --- Prerequisites ---
if (-not (Get-Command oci -ErrorAction SilentlyContinue)) {
  Write-Error "OCI CLI is not installed. Install: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm"
  exit 1
}

if (-not (Test-Path $SshPublicKeyPath)) {
  Write-Error "SSH public key not found at: $SshPublicKeyPath"
  exit 1
}

$SshKey = Get-Content $SshPublicKeyPath -Raw

Write-Host "=== Deploying Bridge Jobs to OCI Free Tier ===" -ForegroundColor Cyan
Write-Host "Region    : $Region" -ForegroundColor Gray
Write-Host "Shape     : VM.Standard.A1.Flex (1 OCPU, 6 GB) — Always Free" -ForegroundColor Gray
Write-Host "Boot Vol  : 50 GB (200 GB free tier remaining)" -ForegroundColor Gray
Write-Host ""

# --- Step 1: Create VCN ---
Write-Host "[1/7] Creating VCN..." -ForegroundColor Yellow
$Vcn = oci network vcn create `
  --compartment-id $CompartmentId `
  --display-name "bridge-vcn" `
  --cidr-block $VcnCidr `
  --dns-label "bridgevcn" `
  --query "data" `
  --raw-output
$VcnId = ($Vcn | ConvertFrom-Json).id
Write-Host "  VCN: $VcnId" -ForegroundColor Green

# --- Step 2: Create Internet Gateway ---
Write-Host "[2/7] Creating Internet Gateway..." -ForegroundColor Yellow
$Igw = oci network internet-gateway create `
  --compartment-id $CompartmentId `
  --display-name "bridge-igw" `
  --vcn-id $VcnId `
  --is-enabled $true `
  --query "data" `
  --raw-output
$IgwId = ($Igw | ConvertFrom-Json).id
Write-Host "  IGW: $IgwId" -ForegroundColor Green

# --- Step 3: Create Route Table ---
Write-Host "[3/7] Creating Route Table..." -ForegroundColor Yellow
$Rt = oci network route-table create `
  --compartment-id $CompartmentId `
  --display-name "bridge-public-rt" `
  --vcn-id $VcnId `
  --route-rules "[{""networkEntityId"":""$IgwId"",""destination"":""0.0.0.0/0"",""description"":""Default route""}]" `
  --query "data" `
  --raw-output
$RtId = ($Rt | ConvertFrom-Json).id
Write-Host "  Route Table: $RtId" -ForegroundColor Green

# --- Step 4: Create Security List ---
Write-Host "[4/7] Creating Security List (ports 22, 80, 443)..." -ForegroundColor Yellow
$Rules = @"
{
  "ingressSecurityRules": [
    {"protocol":"6","source":"$AdminCidr","description":"SSH","tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
    {"protocol":"6","source":"0.0.0.0/0","description":"HTTP","tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},
    {"protocol":"6","source":"0.0.0.0/0","description":"HTTPS","tcpOptions":{"destinationPortRange":{"min":443,"max":443}}},
    {"protocol":"1","source":"$VcnCidr","description":"ICMP","tcpOptions":null}
  ],
  "egressSecurityRules": [
    {"destination":"0.0.0.0/0","protocol":"all","description":"All outbound","tcpOptions":null}
  ]
}
"@

$Sl = oci network security-list create `
  --compartment-id $CompartmentId `
  --display-name "bridge-security-list" `
  --vcn-id $VcnId `
  --ingress-security-rules ($Rules | ConvertFrom-Json).ingressSecurityRules `
  --egress-security-rules ($Rules | ConvertFrom-Json).egressSecurityRules `
  --query "data" `
  --raw-output
$SlId = ($Sl | ConvertFrom-Json).id
Write-Host "  Security List: $SlId" -ForegroundColor Green

# --- Step 5: Create Subnet ---
Write-Host "[5/7] Creating public subnet..." -ForegroundColor Yellow
$Subnet = oci network subnet create `
  --compartment-id $CompartmentId `
  --display-name "bridge-public-subnet" `
  --vcn-id $VcnId `
  --cidr-block $SubnetCidr `
  --dns-label "bridgepub" `
  --route-table-id $RtId `
  --security-list-ids "[`"$SlId`"]" `
  --prohibit-public-ip-on-vnic $false `
  --query "data" `
  --raw-output
$SubnetId = ($Subnet | ConvertFrom-Json).id
Write-Host "  Subnet: $SubnetId" -ForegroundColor Green

# --- Step 6: Find Ubuntu 24.04 ARM image ---
Write-Host "[6/7] Finding Ubuntu 24.04 (ARM64) image..." -ForegroundColor Yellow
$Image = oci compute image list `
  --compartment-id $CompartmentId `
  --operating-system "Canonical Ubuntu" `
  --operating-system-version "24.04" `
  --shape "VM.Standard.A1.Flex" `
  --sort-by "TIMECREATED" `
  --sort-order "DESC" `
  --query "data[0]" `
  --raw-output
$ImageId = ($Image | ConvertFrom-Json).id
Write-Host "  Image: $ImageId" -ForegroundColor Green

# --- Step 7: Create Compute Instance ---
Write-Host "[7/7] Launching compute instance (Free Tier A1.Flex)..." -ForegroundColor Yellow
$Ad = oci iam availability-domain list `
  --compartment-id $CompartmentId `
  --query "data[0].name" `
  --raw-output

$CloudInit = @"
#cloud-config
package_update: true
packages:
  - docker.io
  - docker-compose-v2
  - git
  - ufw
runcmd:
  - usermod -aG docker ubuntu
  - systemctl enable docker; systemctl start docker
  - cd /home/ubuntu
  - git clone https://github.com/your-org/bridge-collective-opportunities.git app
  - chown -R ubuntu:ubuntu /home/ubuntu/app
  - |
    cat > /home/ubuntu/app/server/.env << EOENV
    JWT_SECRET=$JwtSecret
    DB_PASSWORD=$DbPassword
    CORS_ORIGIN=https://$Domain
    FRONTEND_URL=https://$Domain
    DOMAIN=$Domain
    NODE_ENV=production
    LOG_LEVEL=info
    USE_PGLITE=false
    EOENV
  - ufw --force enable
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - cd /home/ubuntu/app/server
  - docker compose up -d
"@

$UserData = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($CloudInit))

$Instance = oci compute instance launch `
  --compartment-id $CompartmentId `
  --availability-domain $Ad `
  --display-name "bridge-app-server" `
  --shape "VM.Standard.A1.Flex" `
  --shape-config '{"ocpus":1,"memoryInGBs":6}' `
  --subnet-id $SubnetId `
  --image-id $ImageId `
  --assign-public-ip $true `
  --boot-volume-size-in-gbs 50 `
  --metadata $(ConvertTo-Json @{ssh_authorized_keys=$SshKey;user_data=$UserData} -Compress) `
  --query "data" `
  --raw-output

$InstanceId = ($Instance | ConvertFrom-Json).id
Write-Host "  Instance: $InstanceId" -ForegroundColor Green

# --- Wait for IP ---
Write-Host "Waiting for public IP..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

$Vnic = oci compute instance list-vnics `
  --instance-id $InstanceId `
  --query "data[0]" `
  --raw-output
$PublicIp = ($Vnic | ConvertFrom-Json).\"public-ip\"

Write-Host ""
Write-Host "=== DEPLOYED (Always Free) ===" -ForegroundColor Cyan
Write-Host "Public IP  : $PublicIp" -ForegroundColor Green
Write-Host "SSH        : ssh -i $(Split-Path $SshPublicKeyPath -LeafBase) ubuntu@$PublicIp" -ForegroundColor Green
Write-Host "App (HTTP) : http://$PublicIp" -ForegroundColor Green
Write-Host "App (HTTPS): https://$Domain (point DNS here)" -ForegroundColor Green
Write-Host ""
Write-Host "Ports open:" -ForegroundColor Cyan
Write-Host "  22 (SSH)   -> $AdminCidr" -ForegroundColor White
Write-Host "  80 (HTTP)  -> 0.0.0.0/0" -ForegroundColor White
Write-Host "  443 (HTTPS) -> 0.0.0.0/0" -ForegroundColor White
Write-Host ""
Write-Host "Free tier remaining: 3 OCPUs / 18 GB RAM / 150 GB storage" -ForegroundColor Magenta
