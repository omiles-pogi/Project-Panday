<?php

namespace App\Http\Requests;

use App\Models\SupplierOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdvanceSupplierOrderRequest extends FormRequest
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
            'status' => ['required', 'string', Rule::in(array_values(SupplierOrder::SUPPLIER_TRANSITIONS))],
        ];
    }
}
