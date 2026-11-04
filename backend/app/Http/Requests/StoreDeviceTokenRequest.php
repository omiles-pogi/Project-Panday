<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDeviceTokenRequest extends FormRequest
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
            'token' => ['required', 'string', 'max:255', 'regex:/^Expo(nent)?PushToken\[[^\]]+\]$/'],
            'platform' => ['nullable', 'string', 'in:ios,android,web'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['token.regex' => 'That is not an Expo push token.'];
    }
}
