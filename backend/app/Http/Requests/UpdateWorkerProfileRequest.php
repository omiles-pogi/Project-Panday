<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateWorkerProfileRequest extends FormRequest
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
            'trade' => ['required', 'string', 'max:100'],
            'years_experience' => ['required', 'integer', 'min:0', 'max:80'],
            'bio' => ['nullable', 'string', 'max:1000'],
            'skills' => ['required', 'array', 'min:1', 'max:20'],
            'skills.*' => ['required', 'string', 'max:50'],
        ];
    }
}
