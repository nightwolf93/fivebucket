<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LogsIngested implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        private readonly int $teamId,
        private readonly array $logs,
    ) {
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('teams.'.$this->teamId.'.logs');
    }

    public function broadcastAs(): string
    {
        return 'logs.ingested';
    }

    public function broadcastWith(): array
    {
        return [
            'logs' => array_values(array_slice($this->logs, 0, 100)),
        ];
    }
}
