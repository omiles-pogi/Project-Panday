<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitQuoteBidRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * That the prices cover exactly the request's items is checked against the request itself, in
     * QuoteService.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'delivery_days' => ['required', 'integer', 'min:0', 'max:90'],
            'note' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1', 'max:30'],
            'items.*.item_id' => ['required', 'integer'],
            'items.*.unit_price' => ['required', 'integer', 'min:1', 'max:100000000'],
        ];
    }
}
