local QBCore = exports['qb-core']:GetCoreObject()

local function playerMetadata(source)
    local player = QBCore.Functions.GetPlayer(source)

    if not player then
        return {
            source = source,
            framework = 'qbcore',
        }
    end

    local charinfo = player.PlayerData.charinfo or {}
    local job = player.PlayerData.job or {}

    return {
        source = source,
        framework = 'qbcore',
        citizenid = player.PlayerData.citizenid,
        license = player.PlayerData.license,
        charName = ((charinfo.firstname or '') .. ' ' .. (charinfo.lastname or '')):gsub('^%s+', ''):gsub('%s+$', ''),
        job = job.name,
        jobGrade = job.grade and job.grade.level or nil,
        money = player.PlayerData.money,
    }
end

QBCore.Commands.Add('fb_qb_audit', 'Send an admin audit log to FiveBucket', {}, false, function(source, args)
    local metadata = playerMetadata(source)
    metadata.command = 'fb_qb_audit'
    metadata.args = args

    exports.fivebucket:Warn('QBCore admin audit command used', metadata, GetCurrentResourceName())
end, 'admin')

RegisterNetEvent('fivebucket:examples:qbInventoryAction', function(action, item, amount)
    local source = source
    local metadata = playerMetadata(source)
    metadata.action = action or 'inventory_action'
    metadata.item = item
    metadata.amount = tonumber(amount) or 1

    exports.fivebucket:Log({
        level = 'info',
        message = 'QBCore inventory action',
        resource = GetCurrentResourceName(),
        metadata = metadata,
    })
end)
