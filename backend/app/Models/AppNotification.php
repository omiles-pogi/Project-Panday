<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
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
