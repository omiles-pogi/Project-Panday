<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One material on a quote request, and how much of it is wanted. */
#[Fillable(['quote_request_id', 'material_name', 'unit', 'quantity'])]
class QuoteRequestItem extends Model
{
    public function quoteRequest(): BelongsTo
    {
        return $this->belongsTo(QuoteRequest::class);
    }
}
