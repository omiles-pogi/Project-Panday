<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One material line. Name/unit/price are snapshots taken from the supplier listing. */
#[Fillable(['material_request_id', 'supplier_order_id', 'supplier_product_id', 'supplier_id', 'material_name', 'unit', 'quantity', 'estimated_unit_price', 'confirmed_unit_price', 'reserved_quantity', 'status', 'source'])]
class MaterialRequestItem extends Model
{
    public const PENDING = 'pending';

    public const CONFIRMED = 'confirmed';

    public const INSUFFICIENT = 'insufficient';

    public const UNAVAILABLE = 'unavailable';

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'estimated_unit_price' => 'integer',
            'confirmed_unit_price' => 'integer',
            'reserved_quantity' => 'integer',
        ];
    }

    public function materialRequest(): BelongsTo
    {
        return $this->belongsTo(MaterialRequest::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(SupplierOrder::class, 'supplier_order_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(SupplierProduct::class, 'supplier_product_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }

    /** Editable by the contractor: not yet routed to a supplier, or its order ended unfulfilled. */
    public function isEditable(): bool
    {
        return $this->supplier_order_id === null || ($this->order !== null && $this->order->isDead());
    }
}
