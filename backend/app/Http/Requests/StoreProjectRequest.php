<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProjectRequest extends FormRequest
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
            'projectTitle' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'budget' => ['required', 'numeric', 'min:0'],
            'totalEstimate' => ['required', 'numeric', 'min:0'],
            'timelineMonths' => ['required', 'integer', 'min:0'],
            'phases' => ['required', 'array', 'min:1'],
            'phases.*.name' => ['required', 'string', 'max:255'],
            'phases.*.percentComplete' => ['required', 'numeric', 'min:0', 'max:100'],
            'phases.*.tasks' => ['nullable', 'array'],
            'phases.*.tasks.*' => ['string', 'max:255'],
            // Optional — saved so the assigned contractor can import it into a material request.
            'materials' => ['nullable', 'array', 'max:200'],
            'materials.*.material' => ['required', 'string', 'max:255'],
            'materials.*.category' => ['nullable', 'string', 'max:100'],
            'materials.*.qty' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'materials.*.unit' => ['required', 'string', 'max:50'],
            'materials.*.unitPrice' => ['required', 'numeric', 'min:0', 'max:100000000'],
        ];
    }
}
