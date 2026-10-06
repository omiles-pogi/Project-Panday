<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'bail', 'email:rfc,dns', 'max:255', 'unique:users,email', 'indisposable:mx'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::in(User::SELF_REGISTERABLE_ROLES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.email' => 'Please enter a valid, real email address (e.g. you@gmail.com).',
            'email.indisposable' => 'Temporary/disposable email addresses are not allowed. Please use a real email address.',
        ];
    }
}
