@description('Location for all resources')
param location string = resourceGroup().location

@description('Prefix for resource names (lowercase, concise)')
param namePrefix string

@description('Backend container image (e.g. myacr.azurecr.io/backend:sha)')
param backendImage string

@description('Frontend container image (e.g. myacr.azurecr.io/frontend:sha)')
param frontendImage string

@description('Azure Table Storage connection string (Storage Account)')
@secure()
param storageConn string

@description('Table name to use')
param tableName string = 'todos'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${namePrefix}-law'
  location: location
  properties: {
    retentionInDays: 30
  }
}

resource cae 'Microsoft.App/managedEnvironments@2023-11-02-preview' = {
  name: '${namePrefix}-cae'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey
      }
    }
  }
}

resource app 'Microsoft.App/containerApps@2023-11-02-preview' = {
  name: '${namePrefix}-app'
  location: location
  properties: {
    environmentId: cae.id
    configuration: {
      ingress: {
        external: true
        targetPort: 80
        transport: 'auto'
      }
      secrets: [
        {
          name: 'storage-conn'
          value: storageConn
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: frontendImage
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/'
                port: 80
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
          ]
        }
        {
          name: 'backend'
          image: backendImage
          env: [
            {
              name: 'TableStorage__ConnectionString'
              secretRef: 'storage-conn'
            }
            {
              name: 'TableStorage__TableName'
              value: tableName
            }
            {
              name: 'ASPNETCORE_URLS'
              value: 'http://0.0.0.0:8080'
            }
          ]
          probes: [
            {
              type: 'liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 30
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 3
      }
    }
  }
}

output frontendUrl string = app.properties.configuration.ingress.fqdn
