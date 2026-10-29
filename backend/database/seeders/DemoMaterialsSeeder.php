<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo inventory for testing the supplier catalog and material request workflow:
 *
 *   php artisan db:seed --class=DemoMaterialsSeeder
 *
 * Adds listings to SUPPLIER_EMAIL (or the first approved supplier). Safe to re-run: listings are
 * matched by name, so it updates them instead of duplicating. A few are deliberately out of
 * stock or low on stock to exercise the In Stock / Out of Stock / Insufficient Stock states.
 */
class DemoMaterialsSeeder extends Seeder
{
    private const SUPPLIER_EMAIL = 'supplier.test@gmail.com';

    /** [name, category, unit, price ₱, stock, min order, description] */
    private const MATERIALS = [
        ['Portland Cement Type I (40kg)', 'Cement', 'bag', 265, 500, 10, 'General-purpose cement for foundations, columns and slabs.'],
        ['Masonry Cement (40kg)', 'Cement', 'bag', 235, 120, 10, 'For CHB laying, plastering and finishing.'],
        ['Washed Sand', 'Sand', 'cu.m', 1350, 40, 1, 'Clean, screened sand for concrete and plaster.'],
        ['White Sand (Fine)', 'Sand', 'cu.m', 1600, 0, 1, 'Fine sand for smooth plaster finish.'],
        ['Gravel 3/4"', 'Gravel', 'cu.m', 1500, 35, 1, 'Crushed aggregate for structural concrete.'],
        ['Gravel 3/8" (Pea Gravel)', 'Gravel', 'cu.m', 1450, 15, 1, 'Smaller aggregate for slabs and topping.'],
        ['Deformed Steel Bar 10mm x 6m', 'Steel', 'piece', 195, 800, 10, 'Grade 40 rebar for slabs and beams.'],
        ['Deformed Steel Bar 12mm x 6m', 'Steel', 'piece', 280, 600, 10, 'Grade 40 rebar for columns and footings.'],
        ['Deformed Steel Bar 16mm x 6m', 'Steel', 'piece', 495, 8, 5, 'Grade 60 rebar for heavy structural members. Low stock.'],
        ['G.I. Tie Wire #16', 'Hardware', 'kg', 95, 200, 5, 'Galvanized wire for tying rebar.'],
        ['CHB 4" Hollow Block', 'Masonry', 'piece', 16, 5000, 100, 'Load-bearing concrete hollow block for interior walls.'],
        ['CHB 6" Hollow Block', 'Masonry', 'piece', 22, 3000, 100, 'For exterior and load-bearing walls.'],
        ['Coco Lumber 2" x 3" x 10ft', 'Lumber', 'piece', 145, 300, 10, 'Formworks and temporary framing.'],
        ['Marine Plywood 3/4" (4x8)', 'Lumber', 'sheet', 1350, 60, 1, 'Water-resistant plywood for formworks and cabinetry.'],
        ['Ordinary Plywood 1/4" (4x8)', 'Lumber', 'sheet', 420, 0, 1, 'For ceilings and partitions.'],
        ['Common Wire Nails 3"', 'Hardware', 'kg', 85, 150, 1, 'For formworks and general carpentry.'],
        ['Long Span Pre-Painted Roofing (0.4mm)', 'Roofing', 'meter', 380, 400, 10, 'Rib-type colored roofing sheet, cut to length.'],
        ['C-Purlins 2" x 4" x 6m (1.5mm)', 'Roofing', 'piece', 980, 90, 4, 'Steel purlins for roof framing.'],
        ['PVC Pipe 4" x 3m (Sanitary)', 'Plumbing', 'piece', 520, 70, 1, 'For drainage and sewer lines.'],
        ['PPR Pipe 1/2" x 4m', 'Plumbing', 'piece', 210, 0, 5, 'Heat-fused pipe for hot and cold water lines.'],
        ['THHN Wire 3.5mm² (75m roll)', 'Electrical', 'roll', 3450, 25, 1, 'Copper building wire for convenience outlets.'],
        ['PVC Electrical Conduit 1/2" x 3m', 'Electrical', 'piece', 65, 400, 10, 'For concealed wiring runs.'],
        ['Latex Paint White (4L)', 'Paint', 'gallon', 780, 80, 1, 'Interior acrylic latex, flat finish.'],
        ['Elastomeric Paint White (4L)', 'Paint', 'gallon', 1150, 45, 1, 'Waterproof exterior wall coating.'],
    ];

    public function run(): void
    {
        $supplier = User::query()->where('role', 'supplier')->where('email', self::SUPPLIER_EMAIL)->first()
            ?? User::query()->where('role', 'supplier')->where('approval_status', 'approved')->orderBy('id')->first();

        if (! $supplier) {
            $this->command?->error('No supplier account found. Register and approve a supplier first.');

            return;
        }

        foreach (self::MATERIALS as [$name, $category, $unit, $price, $stock, $minOrder, $description]) {
            $supplier->supplierProducts()->updateOrCreate(
                ['name' => $name],
                [
                    'category' => $category,
                    'unit' => $unit,
                    'price' => $price,
                    'stock' => $stock,
                    'min_order' => $minOrder,
                    'description' => $description,
                    'is_active' => true,
                ],
            );
        }

        $this->command?->info(count(self::MATERIALS)." materials seeded for {$supplier->name} ({$supplier->email}).");
    }
}
