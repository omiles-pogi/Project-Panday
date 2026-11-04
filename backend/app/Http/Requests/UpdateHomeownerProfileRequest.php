<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateHomeownerProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Every field is optional — a homeowner can clear one by saving it empty.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'location' => ['nullable', 'string', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]+$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'contact_number.regex' => 'The contact number may only contain digits, spaces, + ( ) and -.',
        ];
    }
}
