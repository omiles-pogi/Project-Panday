<?php

namespace App\Http\Requests;

use App\Models\SupplierProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'category' => ['required', 'string', Rule::in(SupplierProduct::CATEGORIES)],
            'description' => ['nullable', 'string', 'max:1000'],
            'unit' => ['required', 'string', 'max:30'],
            'price' => ['required', 'integer', 'min:1', 'max:100000000'],
            'stock' => ['required', 'integer', 'min:0', 'max:100000000'],
            'min_order' => ['sometimes', 'integer', 'min:1', 'max:100000000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
