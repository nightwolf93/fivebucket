local ESX = exports.es_extended:getSharedObject()

local function playerMetadata(source)
    local player = ESX.GetPlayerFromId(source)

    if not player then
        return {
            source = source,
            framework = 'esx',
        }
    end

    return {
        source = source,
        framework = 'esx',
        identifier = player.identifier,
        name = player.getName and player.getName() or GetPlayerName(source),
        job = player.job and player.job.name or nil,
        jobGrade = player.job and player.job.grade or nil,
        group = player.getGroup and player.getGroup() or nil,
    }
end

RegisterCommand('fb_esx_audit', function(source, args)
    local command = args[1] or 'unknown'
    local metadata = playerMetadata(source)
    metadata.command = command
    metadata.args = args

    exports.fivebucket:Info('ESX admin command used', metadata, GetCurrentResourceName(), function(result)
        if not result.ok then
            print(('[fivebucket] ESX audit failed: %s'):format(result.error or 'unknown'))
        end
    end)
end, true)

RegisterNetEvent('fivebucket:examples:esxMoney', function(amount)
    local source = source
    local metadata = playerMetadata(source)
    metadata.amount = tonumber(amount) or 0
    metadata.action = 'money_changed'

    exports.fivebucket:Log({
        level = 'info',
        message = 'ESX money changed',
        resource = GetCurrentResourceName(),
        metadata = metadata,
    })
end)
