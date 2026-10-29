<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Whitespace-only bodies are rejected by `required`: the global TrimStrings +
     * ConvertEmptyStringsToNull middleware turn "   " into null before validation.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:2000'],
            'client_key' => ['nullable', 'string', 'max:64'],
        ];
    }
}
