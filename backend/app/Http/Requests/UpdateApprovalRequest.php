<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateApprovalRequest extends FormRequest
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
        // Admins may revoke/restore homeowner access, but cannot put them back in a review queue.
        $statuses = $this->route('user')?->role === 'homeowner'
            ? ['approved', 'rejected']
            : User::APPROVAL_STATUSES;

        return [
            'status' => ['required', 'string', Rule::in($statuses)],
        ];
    }
}
