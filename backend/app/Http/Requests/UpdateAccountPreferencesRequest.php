<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateAccountPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'push_enabled' => ['sometimes', 'required', 'boolean'],
            'project_updates' => ['sometimes', 'required', 'boolean'],
            'messages' => ['sometimes', 'required', 'boolean'],
            'user_id' => ['prohibited'],
        ];
    }
}
