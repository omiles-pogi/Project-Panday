<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Optional scoping on the existing worker activity read endpoints. */
class WorkerActivityProjectRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['project_id' => ['nullable', 'integer', 'min:1']];
    }

    public function projectId(): ?int
    {
        return isset($this->validated()['project_id']) ? (int) $this->validated()['project_id'] : null;
    }
}
