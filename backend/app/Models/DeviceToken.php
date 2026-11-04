<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An Expo push token for one phone a user is signed in on. */
#[Fillable(['user_id', 'token', 'platform'])]
class DeviceToken extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
