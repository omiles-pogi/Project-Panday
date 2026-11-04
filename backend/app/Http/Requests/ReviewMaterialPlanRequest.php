<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReviewMaterialPlanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Only the lines the contractor changed need sending — the rest are accepted as the AI wrote them.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'lines' => ['present', 'array', 'max:200'],
            'lines.*.index' => ['required', 'integer', 'min:0'],
            'lines.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
            // Extra to cover cutting, breakage and spillage, as a % on top of the quantity they need.
            'lines.*.waste_pct' => ['nullable', 'integer', 'min:0', 'max:50'],
        ];
    }
}
