<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An in-app notification (worker invites, project applications, decisions). Deliberately named
 * and tabled apart from Laravel's own Notifiable/"notifications" convention — see the migration
 * for why — even though both are called "notifications" conceptually.
 */
#[Fillable(['user_id', 'type', 'title', 'body', 'data', 'read_at'])]
class AppNotification extends Model
{
    /** Retain historical bidding records, but exclude them from feeds, badges, and route binding. */
    private const RETIRED_TYPES = [
        'quote_request_received',
        'quote_bid_received',
        'quote_bid_awarded',
        'quote_bid_not_selected',
        'quote_request_cancelled',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope('active_features', function (Builder $query): void {
            $query->whereNotIn($query->qualifyColumn('type'), self::RETIRED_TYPES);
        });
    }

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
