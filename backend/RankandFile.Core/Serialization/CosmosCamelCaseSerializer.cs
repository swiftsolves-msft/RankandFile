using System.Text.Json;
using Microsoft.Azure.Cosmos;

namespace RankandFile.Core.Serialization;

/// <summary>
/// Cosmos serializer using System.Text.Json with camelCase property names but WITHOUT
/// transforming dictionary keys. The built-in CosmosPropertyNamingPolicy.CamelCase uses
/// Newtonsoft.Json's CamelCasePropertyNamesContractResolver which (since Json.NET 9)
/// also lowercases dictionary keys — breaking ConnectionId lookups stored in
/// Rankings, Pairings, and ScoresThisRound dictionaries.
/// System.Text.Json PropertyNamingPolicy only affects declared property names, not keys.
/// </summary>
public sealed class CosmosCamelCaseSerializer : CosmosSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        // DictionaryKeyPolicy deliberately NOT set — dict keys are raw ConnectionIds
        // and must survive round-trips without case transformation.
    };

    public override T FromStream<T>(Stream stream)
    {
        using (stream)
        {
            if (typeof(Stream).IsAssignableFrom(typeof(T)))
                return (T)(object)stream;
            return JsonSerializer.Deserialize<T>(stream, Options)!;
        }
    }

    public override Stream ToStream<T>(T input)
    {
        var ms = new MemoryStream();
        JsonSerializer.Serialize(ms, input, Options);
        ms.Position = 0;
        return ms;
    }
}
