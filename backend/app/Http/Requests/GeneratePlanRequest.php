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
            'project_id' => ['sometimes', 'nullable', 'integer', Rule::exists('projects', 'id')->where('user_id', $this->user()?->id)],
            // Legacy hint to prefer a plan; clarification always remains available.
            'force_plan' => ['sometimes', 'boolean'],
            // The plan as the homeowner currently has it, including any edits they made by hand —
            // the conversation text alone only carries a one-line summary of it.
            'current_plan' => ['sometimes', 'nullable', 'array'],
            'current_plan.materials' => ['sometimes', 'array', 'max:60'],
            'current_plan.phases' => ['sometimes', 'array', 'max:20'],
            'current_plan.budgetBreakdown' => ['sometimes', 'array', 'max:12'],
            // The supplier the homeowner picked for each supplier-sourced category (see
            // SupplierProduct::PLAN_CATEGORIES); null / missing = best price from any supplier.
            'supplier_selections' => ['sometimes', 'nullable', 'array'],
            'supplier_selections.*' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where('role', 'supplier')->where('approval_status', 'approved'),
            ],
        ];
    }
}
