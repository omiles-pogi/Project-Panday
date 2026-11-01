<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GeneratePlanRequest extends FormRequest
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
            'messages' => ['required', 'array', 'min:1'],
            'messages.*.role' => ['required', 'string', Rule::in(['user', 'assistant'])],
            'messages.*.content' => ['required', 'string'],
            // Set once the conversation has gone back and forth on clarifying questions long enough —
            // forces a plan on this turn instead of letting the AI ask yet another question.
            'force_plan' => ['sometimes', 'boolean'],
            // The plan as the homeowner currently has it, including any edits they made by hand —
            // the conversation text alone only carries a one-line summary of it.
            'current_plan' => ['sometimes', 'nullable', 'array'],
            'current_plan.materials' => ['sometimes', 'array', 'max:60'],
            'current_plan.phases' => ['sometimes', 'array', 'max:20'],
            'current_plan.budgetBreakdown' => ['sometimes', 'array', 'max:12'],
        ];
    }
}
