<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BulkSupplierProductActivationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'supplier' && $this->user()?->approval_status === 'approved';
    }

    public function rules(): array
    {
        return ['is_active' => ['required', 'boolean'], 'supplier_id' => ['prohibited'], 'product_ids' => ['prohibited']];
    }
}
