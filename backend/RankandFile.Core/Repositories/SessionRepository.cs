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

    // Returns the session AND its current ETag for optimistic concurrency.
    // After the query locates the document, ReadItemAsync fetches it with its ETag.
    public async Task<(Session? Session, string? ETag)> GetSessionWithETagAsync(string sessionCode)
    {
        var session = await GetSessionAsync(sessionCode);
        if (session == null) return (null, null);

        var response = await _container.ReadItemAsync<Session>(
            session.Id, new PartitionKey(sessionCode));
        return (response.Resource, response.ETag);
    }

    // When ifMatchETag is supplied the write is conditional: Cosmos returns 412
    // PreconditionFailed if another writer has modified the document since the
    // caller last read it. The caller should catch that and retry.
    public async Task SaveSessionAsync(Session session, string? ifMatchETag = null)
    {
        var options = ifMatchETag is not null
            ? new ItemRequestOptions { IfMatchEtag = ifMatchETag }
            : null;
        await _container.UpsertItemAsync(session, new PartitionKey(session.SessionCode), options);
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