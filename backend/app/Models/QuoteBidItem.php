<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A supplier's unit price for one item on a quote request. */
#[Fillable(['quote_bid_id', 'quote_request_item_id', 'unit_price'])]
class QuoteBidItem extends Model
{
    public function bid(): BelongsTo
    {
        return $this->belongsTo(QuoteBid::class, 'quote_bid_id');
    }

    public function requestItem(): BelongsTo
    {
        return $this->belongsTo(QuoteRequestItem::class, 'quote_request_item_id');
    }
}
