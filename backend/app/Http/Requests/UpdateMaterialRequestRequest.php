<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMaterialRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * `items` is the full editable list: listed items need only a listing + quantity (name, unit
     * and price come from the listing server-side); unmatched lines (e.g. AI imports) carry their
     * own name/unit/estimate until a supplier listing is chosen.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'items' => ['present', 'array', 'max:100'],
            'items.*.id' => ['nullable', 'integer'],
            'items.*.supplier_product_id' => ['nullable', 'integer'],
            'items.*.material_name' => ['required_without:items.*.supplier_product_id', 'nullable', 'string', 'max:150'],
            'items.*.unit' => ['required_without:items.*.supplier_product_id', 'nullable', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            'items.*.estimated_unit_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'items.*.source' => ['nullable', 'string', 'in:manual,ai'],
        ];
    }
}
