<?php

namespace App\Http\Requests;

use App\Models\Project;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'timelineValue' => ['required', 'integer', 'min:0'],
            'timelineUnit' => ['required', 'string', Rule::in(Project::TIMELINE_UNITS)],
            // Optional for older clients; preserve the approved scope and breakdown on the server.
            // 0 is valid for both: a repair/repainting/fixture job has no floor area or storey of its own.
            'areaSqm' => ['sometimes', 'numeric', 'min:0'],
            'floors' => ['sometimes', 'integer', 'min:0'],
            'bedrooms' => ['sometimes', 'integer', 'min:0'],
            'bathrooms' => ['sometimes', 'integer', 'min:0'],
            'garageCars' => ['sometimes', 'integer', 'min:0', 'max:10'],
            // Descriptive text that may legitimately be blank. Laravel turns "" into null before validating,
            // so without `nullable` an empty design style failed with "must be a string" and the plan wasn't saved.
            'designStyle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'exteriorConcept' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'interiorConcept' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'budgetBreakdown' => ['sometimes', 'array', 'max:12'],
            'budgetBreakdown.*.category' => ['required', 'string', 'max:100', 'distinct'],
            'budgetBreakdown.*.amount' => ['required', 'numeric', 'min:0'],
            'supplierSelections' => ['sometimes', 'nullable', 'array'],
            'supplierSelections.*' => ['nullable', 'integer', 'min:1'],
            'phases' => ['required', 'array', 'min:1'],
            'phases.*.name' => ['required', 'string', 'max:255'],
            'phases.*.percentComplete' => ['required', 'numeric', 'min:0', 'max:100'],
            // The AI's estimated working duration — optional so plans saved before the calendar existed still work.
            'phases.*.durationWeeks' => ['nullable', 'integer', 'min:1', 'max:520'],
            'phases.*.tasks' => ['nullable', 'array'],
            'phases.*.tasks.*' => ['string', 'max:255'],
            // Optional — saved so the assigned contractor can import it into a material request.
            'materials' => ['nullable', 'array', 'max:200'],
            'materials.*.material' => ['required', 'string', 'max:255'],
            'materials.*.category' => ['nullable', 'string', 'max:100'],
            'materials.*.qty' => ['required', 'numeric', 'min:0', 'max:100000000'],
            'materials.*.unit' => ['required', 'string', 'max:50'],
            'materials.*.unitPrice' => ['required', 'numeric', 'min:0', 'max:100000000'],
            // The supplier listing the AI priced this material from (0 / absent = an AI estimate).
            'materials.*.supplierProductId' => ['nullable', 'integer', 'min:0'],
            'materials.*.supplierName' => ['nullable', 'string', 'max:255'],
            // The phase it's first needed in — null/'' for plans made before materials were scheduled by phase.
            'materials.*.phase' => ['nullable', 'string', 'max:255'],
        ];
    }
}
