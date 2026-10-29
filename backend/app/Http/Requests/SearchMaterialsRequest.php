<?php

namespace App\Http\Requests;

use App\Models\SupplierProduct;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchMaterialsRequest extends FormRequest
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
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'string', Rule::in(SupplierProduct::CATEGORIES)],
            'stock' => ['nullable', 'string', Rule::in(SupplierProduct::STOCK_STATUSES)],
        ];
    }
}
