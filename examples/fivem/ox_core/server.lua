local function playerMetadata(source)
    local player = exports.ox_core:GetPlayer(source)

    if not player then
        return {
            source = source,
            framework = 'ox_core',
        }
    end

    local character = player.get and player:get('char') or player.char or {}

    return {
        source = source,
        framework = 'ox_core',
        charId = character.charId or character.id,
        charName = character.fullName or character.name,
        group = player.getGroup and player:getGroup() or nil,
    }
end

RegisterCommand('fb_ox_audit', function(source, args)
    local metadata = playerMetadata(source)
    metadata.command = 'fb_ox_audit'
    metadata.args = args
    metadata.action = 'admin_command'

    exports.fivebucket:Info('ox_core admin command used', metadata, GetCurrentResourceName())
end, true)

RegisterNetEvent('fivebucket:examples:oxEvidenceScreenshot', function(caseId)
    local source = source
    local metadata = playerMetadata(source)
    metadata.caseId = caseId
    metadata.action = 'evidence_screenshot'

    exports.fivebucket:CapturePlayerScreenshot(source, {
        path = 'evidence/ox_core',
        filename = ('evidence-%s-%s.jpg'):format(source, os.time()),
        visibility = 'private',
        metadata = metadata,
        encoding = 'jpg',
        quality = 0.88,
    }, function(result)
        if not result.ok then
            print(('[fivebucket] screenshot failed: %s'):format(result.error or 'unknown'))
        end
    end)
end)
