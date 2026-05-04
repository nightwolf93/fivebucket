<?php

namespace App\Services\Sdk;

use RuntimeException;

class RemoteActionValidationException extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Remote action parameters are invalid.');
    }
}
