targetScope = 'resourceGroup'

@description('Name of the environment (dev, prod, etc.)')
param environmentName string = 'prod'

@description('Location for all resources')
param location string = resourceGroup().location

@description('GitHub repo owner')
param githubRepoOwner string = 'swiftsolves-msft'

@description('GitHub repo name')
param githubRepoName string = 'RankandFile'

@description('GitHub branch for Static Web App')
param githubBranch string = 'main'

@description('Azure SignalR SKU')
param signalrSku string = 'Standard_S1'

var baseName = 'rankandfile-${environmentName}-${uniqueString(resourceGroup().id)}'

// Built-in role definition IDs (no keys required — MSI only)
// Cosmos DB Built-in Data Contributor (data-plane RBAC; not an ARM role)
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'
// SignalR App Server (ARM RBAC role that allows an app server to connect)
var signalRAppServerRoleId = '420fcaa2-552c-430f-98ca-3264be4806c7'

// ============== COSMOS DB ==============
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-09-01' = {
  name: '${baseName}-cosmos'
  location: location
  tags: { environment: environmentName }
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: false
    enableAutomaticIdempotency: true
    // Disable key-based auth at the Azure level — MSI only
    disableLocalAuth: true
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-09-01' = {
  parent: cosmosAccount
  name: 'rankandfile'
  properties: {
    resource: { id: 'rankandfile' }
  }
}

resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-09-01' = {
  parent: cosmosDb
  name: 'sessions'
  properties: {
    resource: {
      id: 'sessions'
      partitionKey: { paths: ['/sessionCode'] }
      indexingPolicy: { indexingMode: 'consistent' }
    }
  }
}

// ============== AZURE SIGNALR SERVICE ==============
resource signalR 'Microsoft.SignalRService/signalR@2025-01-01-preview' = {
  name: '${baseName}-signalr'
  location: location
  sku: {
    name: signalrSku
    capacity: 1
  }
  properties: {
    features: [{ flag: 'ServiceMode', value: 'Default' }]
    // Disable key-based auth at the Azure level — MSI only
    disableLocalAuth: true
  }
}

// ============== BACKEND APP SERVICE (.NET SignalR Hub) ==============
resource appServicePlan 'Microsoft.Web/serverfarms@2024-03-01' = {
  name: '${baseName}-plan'
  location: location
  sku: { name: 'B1' } // change to P1V3 for production scale
}

resource backendApp 'Microsoft.Web/sites@2024-03-01' = {
  name: '${baseName}-api'
  location: location
  kind: 'app'
  // System-assigned managed identity — used by DefaultAzureCredential at runtime
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      alwaysOn: true
      appSettings: [
        // Endpoint URLs only — no secrets, no keys
        { name: 'Cosmos__Endpoint', value: cosmosAccount.properties.documentEndpoint }
        { name: 'AzureSignalR__Endpoint', value: 'https://${signalR.properties.hostName}' }
        { name: 'Frontend__BaseUrl', value: 'https://${staticWebApp.properties.defaultHostname}' }
        { name: 'ASPNETCORE_ENVIRONMENT', value: environmentName }
      ]
    }
  }
}

// ============== RBAC: Cosmos DB Data Plane ==============
// Cosmos data-plane RBAC uses sqlRoleAssignments (not ARM roleAssignments).
// Built-in Data Contributor role allows read/write on items.
resource cosmosSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-09-01' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, backendApp.identity.principalId, cosmosDataContributorRoleId)
  properties: {
    roleDefinitionId: resourceId(
      'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions',
      cosmosAccount.name,
      cosmosDataContributorRoleId
    )
    principalId: backendApp.identity.principalId
    scope: cosmosAccount.id
  }
}

// ============== RBAC: Azure SignalR App Server ==============
// ARM RBAC role that lets the app server connect to Azure SignalR Service.
resource signalRRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(signalR.id, backendApp.identity.principalId, signalRAppServerRoleId)
  scope: signalR
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', signalRAppServerRoleId)
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============== FRONTEND - AZURE STATIC WEB APPS ==============
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${baseName}-frontend'
  location: location
  sku: { name: 'Standard' }
  properties: {
    provider: 'GitHub'
    repositoryUrl: 'https://github.com/${githubRepoOwner}/${githubRepoName}'
    branch: githubBranch
    buildProperties: {
      appLocation: '/frontend'
      outputLocation: '.next' // Next.js output
      apiLocation: '' // we use separate backend
    }
  }
}

// Link backend to SWA (optional but recommended for CORS + auth)
resource swaBackendLink 'Microsoft.Web/staticSites/linkedBackends@2022-09-01' = {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: backendApp.id
  }
}

// ============== OUTPUTS (shown after azd up) ==============
output frontendUrl string = staticWebApp.properties.defaultHostname
output apiUrl string = backendApp.properties.hostName
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output signalRHostname string = signalR.properties.hostName
output backendIdentityPrincipalId string = backendApp.identity.principalId
