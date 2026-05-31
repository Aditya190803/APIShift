# Same-Provider Key Pool Routing

APIShift's core routing model is same-provider first:

```text
request → provider pool → API keys/accounts → fallback provider pool
```

The intended use is to register multiple API keys/accounts you control for the same provider. APIShift then coordinates requests across those keys, respects provider retry hints, and preserves conversation context when a key or provider changes.

## Default Behavior

1. Sort provider pools by `free` and `priority`.
2. Pick the first provider pool with at least one available key.
3. Select a key using `key_strategy`.
4. If the key is rate-limited or quota-limited, cool down only that key.
5. Retry another key in the same provider pool.
6. Move to the next provider pool only when the current pool has no available keys.

## Strategies

- `adaptive`: least-used healthy key first. This is the default.
- `round_robin`: rotate through healthy keys after each successful request.
- `sticky`: keep a key until it fails or cools down.

## Telemetry

Both Python and TypeScript expose safe route metadata through `last_route` / `lastRoute`:

- provider/pool name
- safe key index/label
- attempt count
- available key count
- total key count
- cooldown duration on failures

Raw API keys are never returned.

## Compliance Note

APIShift is for coordinating keys and accounts you are authorized to use. It does not guarantee quota increases and should be configured in line with each provider's terms and rate-limit policies.
