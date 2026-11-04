<?php

namespace App\Services;

use App\Models\User;

class SupplierProfileService
{
    /**
     * @param  array{location?: ?string, contact_number?: ?string, bio?: ?string}  $data
     * @return array<string, mixed>
     */
    public function update(User $supplier, array $data): array
    {
        $supplier->supplierProfile()->updateOrCreate(
            ['user_id' => $supplier->id],
            [
                'location' => $data['location'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
                'bio' => $data['bio'] ?? null,
            ]
        );

        return $this->show($supplier->fresh());
    }

    /**
     * The supplier's own view: the verified account details, the shop details they edit, and how much
     * of their inventory buyers can currently see.
     *
     * @return array<string, mixed>
     */
    public function show(User $supplier): array
    {
        $profile = $supplier->supplierProfile;
        $counts = $supplier->supplierProducts()
            ->selectRaw('count(*) as total')
            ->selectRaw('coalesce(sum(case when is_active = 1 then 1 else 0 end), 0) as active')
            ->selectRaw('coalesce(sum(case when is_active = 1 and stock > reserved then 1 else 0 end), 0) as in_stock')
            ->first();

        return [
            'id' => $supplier->id,
            'name' => $supplier->name,
            'email' => $supplier->email,
            'businessName' => $supplier->business_name,
            'licenseNumber' => $supplier->license_number,
            'approvalStatus' => $supplier->approval_status,
            'memberSince' => $supplier->created_at?->toDateString(),
            'location' => $profile?->location,
            'contactNumber' => $profile?->contact_number,
            'bio' => $profile?->bio,
            'listings' => [
                'total' => (int) $counts->total,
                'active' => (int) $counts->active,
                'inStock' => (int) $counts->in_stock,
            ],
        ];
    }
}
