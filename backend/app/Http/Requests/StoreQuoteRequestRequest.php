<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuoteRequestRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'needed_by' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.material_name' => ['required', 'string', 'max:120'],
            'items.*.unit' => ['required', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ];
    }
}
