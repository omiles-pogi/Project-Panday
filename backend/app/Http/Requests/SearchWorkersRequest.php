<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SearchWorkersRequest extends FormRequest
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
            'trade' => ['nullable', 'string', 'max:100'],
            'skills' => ['nullable', 'array', 'max:20'],
            'skills.*' => ['string', 'max:50'],
        ];
    }
}
