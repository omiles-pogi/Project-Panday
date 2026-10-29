<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartConversationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Select a contractor or worker, or omit both ids as a contractor/worker to message
     * the project owner. The service verifies both participants' project assignments.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'project_id' => ['required', 'integer', 'exists:projects,id'],
            'contractor_id' => ['nullable', 'integer', 'exists:users,id', 'prohibits:worker_id'],
            'worker_id' => ['nullable', 'integer', 'exists:users,id', 'prohibits:contractor_id'],
        ];
    }
}
