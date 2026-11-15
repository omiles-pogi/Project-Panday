<?php

namespace App\Http\Requests;

use App\Models\User;
use App\Support\AccountPasswordRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'password' => AccountPasswordRules::rules(),
            'role' => ['required', Rule::in(User::SELF_REGISTERABLE_ROLES)],
            'business_name' => ['required_if:role,contractor,supplier', 'nullable', 'string', 'max:255'],
            'license_number' => ['required_if:role,contractor,supplier,worker', 'nullable', 'string', 'min:4', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return array_merge(AccountPasswordRules::messages(), [
            'business_name.required_if' => 'Please enter your business name.',
            'license_number.required_if' => 'Please enter your license / ID number for verification.',
            'email.email' => 'Please enter a valid, real email address (e.g. you@gmail.com).',
            'email.indisposable' => 'Temporary/disposable email addresses are not allowed. Please use a real email address.',
        ]);
    }
}
