<?php

namespace App\Exceptions;

use Exception;

class ConstructionPlanGenerationException extends Exception
{
    public function __construct(string $message, private readonly int $statusCode)
    {
        parent::__construct($message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }
}
