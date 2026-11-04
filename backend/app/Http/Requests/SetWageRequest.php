<?php

namespace App\Http\Requests;

use App\Support\Wage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SetWageRequest extends FormRequest
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
            'automatic' => ['sometimes', 'boolean'],
            // Null clears the wage back to "not set".
            'amount' => ['prohibited_if:automatic,true', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'unit' => ['prohibited_if:automatic,true', 'required_with:amount', 'nullable', Rule::in(Wage::UNITS)],
            // A day rate needs the number of days it covers; a fixed fee doesn't.
            'days' => [
                'prohibited_if:automatic,true',
                Rule::requiredIf(fn () => $this->input('amount') !== null && $this->input('unit') === Wage::PER_DAY),
                'nullable',
                'integer',
                'min:1',
                'max:3650',
            ],
        ];
    }
}
