<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

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
            'password' => ['required', 'confirmed', Password::min(8)],
        ];
    }
}
