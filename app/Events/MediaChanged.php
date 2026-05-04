<?php

namespace App\Events;

use App\Models\MediaFile;
use App\Models\Team;
use App\Support\ByteFormatter;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MediaChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        private readonly int $teamId,
        private readonly string $action,
        private readonly ?array $file = null,
        private readonly ?array $deleted = null,
    ) {
    }

    public static function created(MediaFile $file, Team $team): self
    {
        return new self($team->id, 'created', [
            'id' => $file->id,
            'publicId' => $file->public_id,
            'filename' => $file->filename,
            'type' => $file->type,
            'mimeType' => $file->mime_type,
            'path' => $file->path,
            'size' => ByteFormatter::human($file->size_bytes),
            'sizeBytes' => $file->size_bytes,
            'url' => $file->deliveryUrl($team),
            'metadata' => $file->metadata ?? [],
            'createdAt' => $file->created_at?->diffForHumans(),
        ]);
    }

    public static function deleted(MediaFile $file): self
    {
        return new self((int) $file->team_id, 'deleted', null, [
            'id' => $file->id,
            'publicId' => $file->public_id,
            'type' => $file->type,
            'sizeBytes' => $file->size_bytes,
        ]);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('teams.'.$this->teamId.'.media');
    }

    public function broadcastAs(): string
    {
        return 'media.'.$this->action;
    }

    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'file' => $this->file,
            'deleted' => $this->deleted,
        ];
    }
}
