<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SaveWorkLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The date's range (today back a week) is checked against the Philippine calendar day in
     * WorkerActivityService — the server's own "today" is UTC and runs eight hours behind.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'summary' => ['required', 'string', 'min:3', 'max:2000'],
            'log_date' => ['nullable', 'date_format:Y-m-d'],
        ];
    }
}
