<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['material_request_id', 'supplier_order_id', 'changed_by', 'previous_status', 'new_status', 'reason'])]
class MaterialRequestStatusLog extends Model
{
    public const UPDATED_AT = null;

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(SupplierOrder::class, 'supplier_order_id');
    }
}
