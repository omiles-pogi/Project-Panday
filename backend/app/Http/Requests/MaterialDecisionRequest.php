<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** A reason for a workflow decision — required for revision/reject/decline, optional otherwise. */
class MaterialDecisionRequest extends FormRequest
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
        $required = in_array($this->route()?->getActionMethod(), ['requestRevision', 'reject', 'declinePrices', 'decline'], true);

        return [
            'reason' => [$required ? 'required' : 'nullable', 'string', 'max:1000'],
        ];
    }
}
