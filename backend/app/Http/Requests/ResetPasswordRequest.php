<?php

namespace App\Http\Requests;

use App\Support\AccountPasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'reset_token' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/D'],
            'password' => AccountPasswordRules::rules(),
        ];
    }

    public function messages(): array
    {
        return AccountPasswordRules::messages();
    }
}
