<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddBudgetRequest extends FormRequest
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
            // How much to add to the budget, in pesos — not the new total, so two stale screens can't undo each other.
            'amount' => ['required', 'integer', 'min:1', 'max:100000000000'],
        ];
    }
}
