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

        var iterator = _container.GetItemQueryIterator<Session>(query);
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