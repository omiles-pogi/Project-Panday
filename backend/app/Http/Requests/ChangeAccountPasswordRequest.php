<?php

namespace App\Http\Requests;

use App\Support\AccountPasswordRules;
use Illuminate\Foundation\Http\FormRequest;

class ChangeAccountPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['current_password' => ['required', 'string'], 'password' => AccountPasswordRules::rules()];
    }

    public function messages(): array
    {
        return AccountPasswordRules::messages();
    }
}
