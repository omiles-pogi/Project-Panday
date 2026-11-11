<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class NameProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            // Normalize Unicode whitespace as well as ordinary spaces before required/max checks.
            $this->merge(['name' => trim(preg_replace('/[\s\p{Z}]+/u', ' ', $this->input('name')) ?? '')]);
        }
    }

    public function rules(): array
    {
        return ['name' => ['required', 'string', 'max:255', 'regex:/[^\s\p{C}]/u']];
    }
}
