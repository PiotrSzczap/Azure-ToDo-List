using Azure.Data.Tables;
using Azure; // for ETag
using Microsoft.AspNetCore.Mvc;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(p =>
        p.AllowAnyOrigin()
         .AllowAnyHeader()
         .AllowAnyMethod());
});

builder.Services.AddSingleton<TableClient>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var tableName = cfg.GetValue<string>("TableStorage:TableName") ?? "todos";
    var explicitConn = cfg.GetValue<string>("TableStorage:ConnectionString");
    TableServiceClient serviceClient;
    var endpointFromParts = cfg.GetValue<string>("TableStorage:TableEndpoint");
    if (!string.IsNullOrWhiteSpace(endpointFromParts))
    {
        var account = cfg.GetValue<string>("TableStorage:AccountName") ?? "devstoreaccount1";
        var key = cfg.GetValue<string>("TableStorage:AccountKey") ?? "Eby8vdM02xNOcqDo/JWn6nM2ytXJWZVEwilxhZ6gZ0I=";
        serviceClient = new TableServiceClient(new Uri(endpointFromParts), new TableSharedKeyCredential(account, key));
    }
    else if (!string.IsNullOrWhiteSpace(explicitConn))
    {
        serviceClient = new TableServiceClient(explicitConn);
    }
    else
    {
        // Fall back to dev storage (will only work if Azurite accessible at loopback)
        serviceClient = new TableServiceClient("UseDevelopmentStorage=true");
    }
    serviceClient.CreateTableIfNotExists(tableName);
    return serviceClient.GetTableClient(tableName);
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.MapGet("/api/todos", async ([FromServices] TableClient table) =>
{
    var results = new List<TodoItemDto>();
    await foreach (var e in table.QueryAsync<TodoEntity>())
    {
        results.Add(new TodoItemDto
        {
            Id = e.RowKey,
            Title = e.Title,
            Completed = e.Completed,
            Order = e.Order
        });
    }
    return results.OrderBy(t => t.Order);
});

app.MapPost("/api/todos", async ([FromServices] TableClient table, [FromBody] CreateTodoDto dto) =>
{
    var id = Guid.NewGuid().ToString("N");
    var entity = new TodoEntity("todo", id)
    {
        Title = dto.Title,
        Completed = false,
        Order = dto.Order ?? (int)DateTimeOffset.UtcNow.ToUnixTimeSeconds()
    };
    await table.AddEntityAsync(entity);
    return Results.Created($"/api/todos/{id}", new TodoItemDto
    {
        Id = id,
        Title = entity.Title,
        Completed = entity.Completed,
        Order = entity.Order
    });
});

app.MapPut("/api/todos/{id}", async ([FromServices] TableClient table, string id, [FromBody] UpdateTodoDto dto) =>
{
    var existing = await table.GetEntityAsync<TodoEntity>("todo", id);
    var e = existing.Value;
    if (dto.Title is not null) e.Title = dto.Title;
    if (dto.Completed.HasValue) e.Completed = dto.Completed.Value;
    if (dto.Order.HasValue) e.Order = dto.Order.Value;
    await table.UpdateEntityAsync(e, e.ETag, TableUpdateMode.Replace);
    return Results.Ok(new TodoItemDto { Id = id, Title = e.Title, Completed = e.Completed, Order = e.Order });
});

app.MapDelete("/api/todos/{id}", async ([FromServices] TableClient table, string id) =>
{
    await table.DeleteEntityAsync("todo", id);
    return Results.NoContent();
});

app.MapPost("/api/todos/reorder", async ([FromServices] TableClient table, [FromBody] ReorderDto dto) =>
{
    // Simple reorder: update provided items' order values
    foreach (var item in dto.Items)
    {
        var existing = await table.GetEntityAsync<TodoEntity>("todo", item.Id);
        var e = existing.Value;
        e.Order = item.Order;
        await table.UpdateEntityAsync(e, e.ETag, TableUpdateMode.Replace);
    }
    return Results.Ok();
});

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

record CreateTodoDto(string Title, int? Order);
record UpdateTodoDto(string? Title, bool? Completed, int? Order);
record ReorderDto(List<ReorderItem> Items);
record ReorderItem(string Id, int Order);
record TodoItemDto
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public int Order { get; set; }
}

class TodoEntity : ITableEntity
{
    public TodoEntity() { }
    public TodoEntity(string partitionKey, string rowKey)
    {
        PartitionKey = partitionKey;
        RowKey = rowKey;
    }
    public string PartitionKey { get; set; } = default!;
    public string RowKey { get; set; } = default!;
    public DateTimeOffset? Timestamp { get; set; }
    public ETag ETag { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool Completed { get; set; }
    public int Order { get; set; }
}
