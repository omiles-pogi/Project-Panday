<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmSupplierStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->role === 'supplier' && $this->user()?->approval_status === 'approved';
    }

    public function rules(): array
    {
        return ['confirmed' => ['required', 'accepted'], 'review_token' => ['required', 'string', 'max:262144'],
            'supplier_id' => ['prohibited'], 'product_ids' => ['prohibited'], 'stock' => ['prohibited'], 'is_active' => ['prohibited']];
    }
}
