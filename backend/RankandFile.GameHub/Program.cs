using Azure.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.SignalR;
using System.Threading.RateLimiting;
using RankandFile.Core.Repositories;
using RankandFile.Core.Serialization;
using RankandFile.Core.Services;
using RankandFile.GameHub;

var builder = WebApplication.CreateBuilder(args);

// Application Insights — no-ops when connection string is absent (local dev)
builder.Services.AddApplicationInsightsTelemetry();

// Health checks — used by App Service and load balancer probes
builder.Services.AddHealthChecks();

// CORS: only allow the configured frontend origin.
// AllowCredentials() is required by SignalR negotiate (credentials mode 'include').
// AllowAnyHeader() is required so the SignalR negotiate preflight passes.
// App Service env var Frontend__BaseUrl is translated to Frontend:BaseUrl by the env vars provider.
var allowedOrigin = builder.Configuration["Frontend:BaseUrl"] ?? "http://localhost:3000";
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(p =>
        p.WithOrigins(allowedOrigin)
         .AllowAnyMethod()
         .AllowAnyHeader()
         .AllowCredentials()));

// Rate limiting: max 20 SignalR negotiate requests per 30s per IP
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("signalr", limiterOptions =>
    {
        limiterOptions.PermitLimit = 20;
        limiterOptions.Window = TimeSpan.FromSeconds(30);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// Azure SignalR Service -- use MSI (DefaultAzureCredential) when an endpoint is configured;
// omitting it falls back to local in-process SignalR for development.
// App Service env var AzureSignalR__Endpoint maps to config key AzureSignalR:Endpoint
var signalREndpoint = builder.Configuration["AzureSignalR:Endpoint"];
var signalRBuilder = builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        // Ensure all Hub messages use camelCase so TypeScript interfaces match directly.
        // Do NOT set DictionaryKeyPolicy — dictionary keys are ConnectionIds and must not be transformed.
        options.PayloadSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
if (!string.IsNullOrWhiteSpace(signalREndpoint))
{
    signalRBuilder.AddAzureSignalR(options =>
    {
        options.Endpoints = new ServiceEndpoint[]
        {
            new ServiceEndpoint(new Uri(signalREndpoint), new DefaultAzureCredential())
        };
    });
}

// Cosmos DB -- MSI via DefaultAzureCredential; no connection string required.
// App Service env var Cosmos__Endpoint maps to config key Cosmos:Endpoint
var cosmosEndpoint = builder.Configuration["Cosmos:Endpoint"];
if (string.IsNullOrWhiteSpace(cosmosEndpoint))
    throw new InvalidOperationException("Cosmos:Endpoint is not configured.");

// CosmosCamelCaseSerializer uses System.Text.Json with PropertyNamingPolicy.CamelCase,
// which maps C# 'Id' → JSON 'id' and 'SessionCode' → 'sessionCode' as required.
// Crucially, STJ camelCase does NOT transform dictionary keys — preserving ConnectionIds
// stored in Rankings, Pairings, and ScoresThisRound across Cosmos read/write round-trips.
// (The built-in CosmosPropertyNamingPolicy.CamelCase uses Newtonsoft.Json which also
// lowercases dict keys since Json.NET 9, breaking TryGetValue lookups on ConnectionIds.)
var cosmosClient = new CosmosClient(cosmosEndpoint, new DefaultAzureCredential(),
    new CosmosClientOptions
    {
        Serializer = new CosmosCamelCaseSerializer()
    });
builder.Services.AddSingleton(cosmosClient);
builder.Services.AddSingleton<SessionRepository>();

// Domain services
builder.Services.AddSingleton<CardGeneratorService>();
builder.Services.AddSingleton<PairingService>();
builder.Services.AddSingleton<ScoringService>();
builder.Services.AddSingleton<ConsensusService>();

var app = builder.Build();

app.UseRateLimiter();
app.UseCors();
app.MapHealthChecks("/health");
app.MapHub<GameHub>("/gamehub").RequireRateLimiting("signalr");

app.Run();