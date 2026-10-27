<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierProductRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string', 'max:50'],
            'unit' => ['required', 'string', 'max:30'],
            'price' => ['required', 'integer', 'min:1'],
            'stock' => ['sometimes', 'integer', 'min:0'],
            'min_order' => ['sometimes', 'integer', 'min:1'],
            'available' => ['sometimes', 'boolean'],
        ];
    }
}
