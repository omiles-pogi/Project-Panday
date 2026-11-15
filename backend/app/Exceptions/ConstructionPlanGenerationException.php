<?php

namespace App\Exceptions;

use Exception;

class ConstructionPlanGenerationException extends Exception
{
    public function __construct(string $message, private readonly int $statusCode, private readonly string $failureKind = 'provider_response', private readonly array $diagnostics = [])
    {
        parent::__construct($message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function failureKind(): string
    {
        return $this->failureKind;
    }

    /** Counts and allowlisted provider identifiers only; never prompts, arguments or credentials. */
    public function diagnostics(): array
    {
        return $this->diagnostics;
    }
}
