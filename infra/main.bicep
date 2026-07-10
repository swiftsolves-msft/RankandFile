targetScope = 'resourceGroup'

@description('Name of the environment (dev, prod, etc.)')
param environmentName string = 'prod'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Azure SignalR SKU')
param signalrSku string = 'Standard_S1'

@description('Address space for the app VNet')
param vnetAddressPrefix string = '10.20.0.0/16'

@description('Subnet delegated to the App Service for regional VNet integration')
param appSubnetPrefix string = '10.20.1.0/24'

@description('Subnet that hosts the Cosmos DB private endpoint')
param privateEndpointSubnetPrefix string = '10.20.2.0/24'

var baseName = 'rankandfile-${environmentName}-${uniqueString(resourceGroup().id)}'

// Fixed subnet names so we can reference them by resourceId without a race
// against inline subnet declarations on the VNet.
var appSubnetName = 'snet-appsvc'
var privateEndpointSubnetName = 'snet-pe'

// Built-in role definition IDs (no keys required — MSI only)
// Cosmos DB Built-in Data Contributor (data-plane RBAC; not an ARM role)
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'
// SignalR App Server (ARM RBAC role that allows an app server to connect)
var signalRAppServerRoleId = '420fcaa2-552c-430f-98ca-3264be4806c7'

// ============== LOG ANALYTICS + APPLICATION INSIGHTS ==============
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${baseName}-logs'
  location: location
  tags: { environment: environmentName }
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${baseName}-ai'
  location: location
  tags: { environment: environmentName }
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ============== VIRTUAL NETWORK ==============
// One VNet with two subnets:
//   snet-appsvc — delegated to the App Service for regional VNet integration
//                 (all backend outbound traffic egresses through here)
//   snet-pe     — holds the Cosmos DB private endpoint NIC
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${baseName}-vnet'
  location: location
  tags: { environment: environmentName }
  properties: {
    addressSpace: { addressPrefixes: [vnetAddressPrefix] }
    subnets: [
      {
        name: appSubnetName
        properties: {
          addressPrefix: appSubnetPrefix
          delegations: [
            {
              name: 'webapp-delegation'
              properties: { serviceName: 'Microsoft.Web/serverFarms' }
            }
          ]
        }
      }
      {
        name: privateEndpointSubnetName
        properties: {
          addressPrefix: privateEndpointSubnetPrefix
          // Required so the private endpoint NIC can be placed in this subnet.
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

// ============== COSMOS DB ==============
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-08-15' = {
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
    // Block the public internet path entirely — the account is reachable ONLY
    // through the private endpoint below. Satisfies the policy that forbids
    // PaaS-to-Cosmos over public internet.
    publicNetworkAccess: 'Disabled'
    // Let trusted Azure control-plane services (portal, backup, RBAC) still reach
    // the account for management even with public access disabled.
    networkAclBypass: 'AzureServices'
  }
}

resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-08-15' = {
  parent: cosmosAccount
  name: 'rankandfile'
  properties: {
    resource: { id: 'rankandfile' }
  }
}

resource sessionsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-08-15' = {
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

// ============== COSMOS DB PRIVATE ENDPOINT + PRIVATE DNS ==============
// Private endpoint puts a NIC with a VNet-internal IP in snet-pe and wires it to
// the Cosmos account (SQL / Core API = group 'Sql').
resource cosmosPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${baseName}-cosmos-pe'
  location: location
  tags: { environment: environmentName }
  properties: {
    subnet: { id: '${vnet.id}/subnets/${privateEndpointSubnetName}' }
    privateLinkServiceConnections: [
      {
        name: 'cosmos-plsc'
        properties: {
          privateLinkServiceId: cosmosAccount.id
          groupIds: ['Sql']
        }
      }
    ]
  }
}

// Private DNS zone so the account's public hostname
// (*-cosmos.documents.azure.com) resolves to the private endpoint IP from
// inside the VNet.
resource cosmosDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: 'privatelink.documents.azure.com'
  location: 'global'
  tags: { environment: environmentName }
}

resource cosmosDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: cosmosDnsZone
  name: '${baseName}-cosmos-dnslink'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

// Binds the private endpoint's records into the private DNS zone automatically.
resource cosmosPeDnsGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: cosmosPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'cosmos'
        properties: { privateDnsZoneId: cosmosDnsZone.id }
      }
    ]
  }
}

// ============== AZURE SIGNALR SERVICE ==============
resource signalR 'Microsoft.SignalRService/signalR@2023-02-01' = {
  name: '${baseName}-signalr'
  location: location
  sku: {
    name: signalrSku
    capacity: 1
  }
  properties: {
    features: [{ flag: 'ServiceMode', value: 'Default' }]
  }
}

// ============== BACKEND APP SERVICE (.NET SignalR Hub) ==============
resource appServicePlan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${baseName}-plan'
  location: location
  sku: { name: 'B1' } // change to P1V3 for production scale
}

resource backendApp 'Microsoft.Web/sites@2024-04-01' = {
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
      // Route ALL outbound traffic through the VNet integration below so (a) the
      // linked private DNS zone resolves the Cosmos hostname to its private IP
      // and (b) Cosmos traffic reaches the private endpoint. SignalR and App
      // Insights still egress fine via the VNet's default internet route.
      vnetRouteAllEnabled: true
      appSettings: [
        // Endpoint URLs only — no secrets, no keys
        { name: 'Cosmos__Endpoint', value: cosmosAccount.properties.documentEndpoint }
        { name: 'AzureSignalR__Endpoint', value: 'https://${signalR.properties.hostName}' }
        { name: 'Frontend__BaseUrl', value: 'https://${staticWebApp.properties.defaultHostname}' }
        { name: 'ASPNETCORE_ENVIRONMENT', value: environmentName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'ApplicationInsightsAgent_EXTENSION_VERSION', value: '~3' }
      ]
    }
  }
}

// ============== APP SERVICE → VNET INTEGRATION ==============
// Regional (swift) VNet integration into the delegated app subnet. Supported on
// Basic (B1) and higher. This is what gives the backend a route into the VNet
// so it can reach the Cosmos private endpoint.
resource backendVnetIntegration 'Microsoft.Web/sites/networkConfig@2024-04-01' = {
  parent: backendApp
  name: 'virtualNetwork'
  properties: {
    subnetResourceId: '${vnet.id}/subnets/${appSubnetName}'
    swiftSupported: true
  }
}

// ============== RBAC: Cosmos DB Data Plane ==============
// Cosmos data-plane RBAC uses sqlRoleAssignments (not ARM roleAssignments).
// Built-in Data Contributor role allows read/write on items.
resource cosmosSqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-08-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, backendApp.id, cosmosDataContributorRoleId)
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
  name: guid(signalR.id, backendApp.id, signalRAppServerRoleId)
  scope: signalR
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', signalRAppServerRoleId)
    principalId: backendApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ============== FRONTEND - AZURE STATIC WEB APPS ==============
// provider: 'Other' avoids Azure auto-creating a GitHub Actions workflow;
// we deploy manually via the SWA API token in our own workflow.
resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${baseName}-frontend'
  location: location
  sku: { name: 'Standard' }
  properties: {
    provider: 'Other'
  }
}

// ============== OUTPUTS (shown after deploy) ==============
output frontendUrl string = staticWebApp.properties.defaultHostname
output staticWebAppName string = staticWebApp.name
output apiUrl string = backendApp.properties.defaultHostName
output appServiceName string = backendApp.name
output cosmosEndpoint string = cosmosAccount.properties.documentEndpoint
output signalRHostname string = signalR.properties.hostName
output backendIdentityPrincipalId string = backendApp.identity.principalId
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output vnetName string = vnet.name
output cosmosPrivateEndpointName string = cosmosPrivateEndpoint.name
