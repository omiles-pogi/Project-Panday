<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProjectTimelineRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Existing route role checks and timeline ownership/assignment checks still apply.
    }

    public function rules(): array
    {
        return ['saved_only' => ['nullable', 'boolean']];
    }
}
