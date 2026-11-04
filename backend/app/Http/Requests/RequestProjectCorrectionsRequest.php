<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RequestProjectCorrectionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The contractor needs to know what to fix, so a request for corrections has to say.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['note.required' => 'Tell the contractor what needs to be corrected.'];
    }
}
