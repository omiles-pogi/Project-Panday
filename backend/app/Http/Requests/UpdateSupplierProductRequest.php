<?php

namespace App\Http\Requests;

use App\Models\SupplierProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSupplierProductRequest extends FormRequest
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
            'name' => ['sometimes', 'string', 'max:150'],
            'category' => ['sometimes', 'string', Rule::in(SupplierProduct::CATEGORIES)],
            'description' => ['sometimes', 'nullable', 'string', 'max:1000'],
            'unit' => ['sometimes', 'string', 'max:30'],
            'price' => ['sometimes', 'integer', 'min:1', 'max:100000000'],
            'stock' => ['sometimes', 'integer', 'min:0', 'max:100000000'],
            'min_order' => ['sometimes', 'integer', 'min:1', 'max:100000000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
