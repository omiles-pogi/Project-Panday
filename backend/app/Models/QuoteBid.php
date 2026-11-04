<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A supplier's price for every item on a quote request, and how soon they can deliver. */
#[Fillable(['quote_request_id', 'supplier_id', 'total', 'delivery_days', 'note', 'status'])]
class QuoteBid extends Model
{
    public const PENDING = 'pending';

    public const ACCEPTED = 'accepted';

    public const REJECTED = 'rejected';

    public const WITHDRAWN = 'withdrawn';

    public function quoteRequest(): BelongsTo
    {
        return $this->belongsTo(QuoteRequest::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuoteBidItem::class);
    }
}
