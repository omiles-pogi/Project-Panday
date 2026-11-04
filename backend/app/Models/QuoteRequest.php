<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** A list of materials a homeowner (or their contractor) wants priced, open for suppliers to bid on. */
#[Fillable(['project_id', 'requested_by', 'title', 'notes', 'needed_by', 'status', 'awarded_bid_id'])]
class QuoteRequest extends Model
{
    public const OPEN = 'open';

    public const AWARDED = 'awarded';

    public const CANCELLED = 'cancelled';

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuoteRequestItem::class)->orderBy('id');
    }

    public function bids(): HasMany
    {
        return $this->hasMany(QuoteBid::class);
    }

    public function isOpen(): bool
    {
        return $this->status === self::OPEN;
    }
}
