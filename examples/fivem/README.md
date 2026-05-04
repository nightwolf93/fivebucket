# FiveBucket FiveM Examples

Ready-to-adapt snippets for common FiveM framework layouts.

- `esx/server.lua`: ESX player identity and admin command audit logs.
- `qbcore/server.lua`: QBCore player identity and money/action metadata.
- `ox_core/server.lua`: ox_core character metadata and media/log patterns.

All examples assume the `fivebucket` resource is started and configured in `server.cfg`:

```cfg
ensure screenshot-basic
set fivebucket_base_url "https://fivebucket.nightwolf.fr"
set fivebucket_api_key "fbk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
ensure fivebucket
```

Keep the API key server-side. Client resources should call FiveBucket exports, not direct HTTP with the API key.
