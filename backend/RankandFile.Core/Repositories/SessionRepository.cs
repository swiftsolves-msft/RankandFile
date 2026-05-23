using Microsoft.Azure.Cosmos;
using RankandFile.Core.Models;

namespace RankandFile.Core.Repositories;

public class SessionRepository
{
    private readonly Container _container;

    public SessionRepository(CosmosClient cosmosClient)
    {
        _container = cosmosClient.GetContainer("rankandfile", "sessions");
    }

    public async Task<Session?> GetSessionAsync(string sessionCode)
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.sessionCode = @code")
            .WithParameter("@code", sessionCode);

        // Pin to the session's partition so Cosmos uses session consistency
        // (read-your-own-writes) rather than a cross-partition scatter-gather.
        var options = new QueryRequestOptions
        {
            PartitionKey = new PartitionKey(sessionCode),
            MaxItemCount = 1,
        };

        var iterator = _container.GetItemQueryIterator<Session>(query, requestOptions: options);
        if (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync();
            return response.FirstOrDefault();
        }
        return null;
    }

    public async Task SaveSessionAsync(Session session)
    {
        await _container.UpsertItemAsync(session, new PartitionKey(session.SessionCode));
    }

    public async Task<List<Session>> GetAllActiveSessionsAsync()
    {
        var query = new QueryDefinition("SELECT * FROM c WHERE c.status = 'Lobby' OR c.status = 'Playing'");
        var results = new List<Session>();
        var iterator = _container.GetItemQueryIterator<Session>(query);

        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync();
            results.AddRange(response);
        }
        return results;
    }
}