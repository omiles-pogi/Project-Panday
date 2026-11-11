<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Loads the "House Construction Materials Listing Sheet" (91 materials) into the supplier catalog:
 *
 *   php artisan db:seed --class=SupplierSheetSeeder
 *
 * - Creates the suppliers "Tripple R" and "SLD Hardware" (both San Fabian) with every material on the
 *   sheet, each using its own handwritten prices as submitted. A material a supplier left blank is added
 *   too, but inactive with no price (it stays out of the buyer catalog until that supplier prices it).
 * - Gives every other approved supplier the whole list as well, so the remaining blanks are priced by
 *   them. Their prices are deliberately different from Tripple R's and from each other's (priced from
 *   the sheet's figure, or from a market estimate where the sheet had none), so no one shop is always
 *   cheapest. SLD Hardware's prices don't feed this synthetic fill — it's a real submitted sheet, not a
 *   market baseline.
 *
 * Materials that a supplier already lists under the older demo names (e.g. "Portland Cement Type I
 * (40kg)") are left exactly as they are rather than duplicated. Safe to re-run: both sheet suppliers'
 * priced listings and the other suppliers' sheet listings are updated by name; anything already set up
 * by hand (a legacy listing, or a blank a sheet supplier has since priced) is never overwritten.
 */
class SupplierSheetSeeder extends Seeder
{
    private const PASSWORD = 'password123';

    private const SHEET_SUPPLIER = [
        'name' => 'Tripple R',
        'email' => 'trippler@panday.test',
        'business' => 'Tripple R',
        'location' => 'San Fabian',
    ];

    private const SLD_SUPPLIER = [
        'name' => 'SLD Hardware',
        'email' => 'sldhardware@panday.test',
        'business' => 'SLD Hardware & Construction Supply',
        'location' => 'San Fabian',
    ];

    /**
     * SLD Hardware's own submitted prices, by the material name used in self::MATERIALS. A name missing
     * here was left blank on SLD's sheet (added inactive with no price, same as a blank Tripple R price).
     */
    private const SLD_PRICES = [
        'Portland Cement Type I (40kg)' => 215,
        'Washed Sand' => 1700,
        'Gravel 3/4"' => 1700,
        'Ready-Mix Concrete' => 160,
        'Deformed Steel Bar 10mm x 6m' => 215,
        'Deformed Steel Bar 12mm x 6m' => 215,
        'Deformed Steel Bar 16mm x 6m' => 350,
        'Deformed Steel Bar 20mm x 6m' => 480,
        'G.I. Tie Wire #16' => 90,
        'Marine / Phenolic Plywood' => 560,
        'Formwork Lumber' => 27,
        'Common Wire Nails 3"' => 100,
        'CHB 4" Hollow Block' => 14,
        'Welded Wire Mesh' => 160,
        'Masonry Nails' => 100,
        'Steel Angle Bar' => 350,
        'C-Purlin 2" x 3"' => 645,
        'Tubular Steel 2" x 2"' => 300,
        'Welding Rod' => 100,
        'Flashing / Gutter' => 280,
        'Metal Primer / Rust Inhibitor' => 160,
        'Door Hinges' => 150,
        'Door Lockset / Doorknob' => 270,
        'Silicone Sealant' => 160,
        'PVC Pressure Pipe 1/2"' => 90,
        'PVC Elbow 1/2"' => 20,
        'PVC Tee / Wye 1/2"' => 25,
        'PVC Solvent Cement' => 100,
        'PPR Water Pipe' => 220,
        'Faucet / Tap' => 120,
        'Floor Drain' => 120,
        'THHN / THWN Copper Wire' => 45,
        'Electrical Junction / Utility Box' => 65,
        'Panel Board / Load Center' => 650,
        'Circuit Breaker' => 480,
        'Light Switch' => 225,
        'Tile Grout' => 120,
        'Skim Coat / Wall Putty' => 300,
        'Sandpaper' => 25,
        'Paint Thinner' => 65,
        'Paint Brush' => 50,
        'Paint Roller / Tray' => 65,
        'Expansion / Anchor Bolts' => 50,
    ];

    private const SECTIONS = [
        'A' => 'Foundation, concrete & masonry',
        'B' => 'Roof, ceiling, doors & windows',
        'C' => 'Plumbing & electrical',
        'D' => 'Flooring, finishes & other supplies',
    ];

    /**
     * [sheet no., name, category, unit, Tripple R's price (null = left blank), market price for the other
     * suppliers (null = same as the sheet's), true = already listed by the demo suppliers under this name]
     *
     * Names that exist in DemoMaterialsSeeder keep that wording so the catalogs still line up; the rest
     * follow the sheet, with the handwritten size appended. Item 92 on the sheet is a blank "Other" line.
     */
    private const MATERIALS = [
        'A' => [
            [1, 'Portland Cement Type I (40kg)', 'Cement', 'bag', 215, null, true],
            [2, 'Washed Sand', 'Sand', 'cu.m', 1900, null, true],
            [3, 'Gravel 3/4"', 'Gravel', 'cu.m', 2800, null, true],
            [4, 'Ready-Mix Concrete', 'Cement', 'cu.m', null, 5200, false],
            [5, 'Deformed Steel Bar 10mm x 6m', 'Steel', 'piece', 147, null, true],
            [6, 'Deformed Steel Bar 12mm x 6m', 'Steel', 'piece', 210, null, true],
            [7, 'Deformed Steel Bar 16mm x 6m', 'Steel', 'piece', 355, 495, true],
            [8, 'Deformed Steel Bar 20mm x 6m', 'Steel', 'piece', null, 820, false],
            [9, 'G.I. Tie Wire #16', 'Hardware', 'kg', 80, null, true],
            [10, 'Rebar Spacer / Concrete Cover Block', 'Hardware', 'piece', null, 12, false],
            [11, 'Marine / Phenolic Plywood', 'Lumber', 'sheet', 520, null, false],
            [12, 'Formwork Lumber', 'Lumber', 'bd.ft', 30, null, false],
            [13, 'Common Wire Nails 3"', 'Hardware', 'kg', 80, null, true],
            [14, 'CHB 4" Hollow Block', 'Masonry', 'piece', 14, null, true],
            [15, 'CHB 6" Hollow Block', 'Masonry', 'piece', null, 22, true],
            [16, 'Masonry Cement (40kg)', 'Cement', 'bag', 80, 235, true],
            [17, 'Masonry / Plastering Sand', 'Sand', 'cu.m', null, 1450, false],
            [18, 'Welded Wire Mesh', 'Steel', 'sheet', 300, null, false],
            [19, 'Masonry Nails', 'Hardware', 'kg', null, 95, false],
            [20, 'Waterproofing Admixture', 'Cement', 'liter', null, 190, false],
            [21, 'Concrete Bonding Agent', 'Cement', 'liter', null, 240, false],
        ],
        'B' => [
            [22, 'Steel Angle Bar', 'Steel', 'length', 250, null, false],
            [23, 'C-Purlin 2" x 3"', 'Roofing', 'length', 390, null, false],
            [24, 'Tubular Steel 2" x 2"', 'Steel', 'length', 490, null, false],
            [25, 'Welding Rod', 'Hardware', 'box', 230, null, false],
            [26, 'Roofing Sheet, Long-Span / GI', 'Roofing', 'sheet', null, 540, false],
            [27, 'Roof Ridge Roll / Ridge Cap', 'Roofing', 'length', null, 320, false],
            [28, 'Flashing / Gutter', 'Roofing', 'length', 220, null, false],
            [29, 'Downspout', 'Roofing', 'length', 220, null, false],
            [30, 'Roofing Screws with Washer', 'Hardware', 'box', 300, null, false],
            [31, 'Metal Primer / Rust Inhibitor', 'Paint', 'liter', null, 240, false],
            [32, 'Roof Insulation Foil', 'Roofing', 'roll', 2500, null, false],
            [33, 'Ceiling Furring Channel', 'Steel', 'length', 100, null, false],
            [34, 'Carrying Channel', 'Steel', 'length', 100, null, false],
            [35, 'Ceiling Board / Gypsum Board', 'Other', 'sheet', 320, null, false],
            [36, 'Fiber Cement Board', 'Other', 'sheet', null, 480, false],
            [37, 'Ceiling Screws', 'Hardware', 'box', 500, null, false],
            [38, 'Interior Door', 'Lumber', 'set', null, 3200, false],
            [39, 'Exterior Door', 'Lumber', 'set', null, 5800, false],
            [40, 'Door Jamb', 'Lumber', 'set', 1000, null, false],
            [41, 'Door Hinges', 'Hardware', 'set', 70, null, false],
            [42, 'Door Lockset / Doorknob', 'Hardware', 'set', 340, null, false],
            [43, 'Aluminum Sliding Window', 'Other', 'set', null, 4800, false],
            [44, 'Window Glass / Jalousie Blade', 'Other', 'piece', null, 85, false],
            [45, 'Silicone Sealant', 'Other', 'tube', 150, null, false],
        ],
        'C' => [
            [46, 'PVC Pressure Pipe 1/2"', 'Plumbing', 'length', 70, null, false],
            [47, 'PVC Sanitary Pipe 1/2"', 'Plumbing', 'length', 70, null, false],
            [48, 'PVC Elbow 1/2"', 'Plumbing', 'piece', 15, null, false],
            [49, 'PVC Tee / Wye 1/2"', 'Plumbing', 'piece', 15, null, false],
            [50, 'PVC Coupling / Reducer 1/2"', 'Plumbing', 'piece', 15, null, false],
            [51, 'PVC Solvent Cement', 'Plumbing', 'can', 110, null, false],
            [52, 'PPR Water Pipe', 'Plumbing', 'length', 130, null, false],
            [53, 'PPR Fittings', 'Plumbing', 'piece', 15, null, false],
            [54, 'Gate Valve / Ball Valve', 'Plumbing', 'piece', 260, null, false],
            [55, 'Faucet / Tap', 'Plumbing', 'piece', 130, null, false],
            [56, 'Water Closet / Toilet Bowl', 'Plumbing', 'set', 320, null, false],
            [57, 'Lavatory / Wash Basin', 'Plumbing', 'set', null, 1450, false],
            [58, 'Floor Drain', 'Plumbing', 'piece', 190, null, false],
            [59, 'Septic Tank Materials / Components', 'Plumbing', 'set', null, 8500, false],
            [60, 'THHN / THWN Copper Wire', 'Electrical', 'meter', 29, null, false],
            [61, 'PVC Electrical Conduit 1/2" x 3m', 'Electrical', 'piece', null, 65, true],
            [62, 'Conduit Elbow / Coupling', 'Electrical', 'piece', 15, null, false],
            [63, 'Electrical Junction / Utility Box', 'Electrical', 'piece', 30, null, false],
            [64, 'Panel Board / Load Center', 'Electrical', 'set', 320, null, false],
            [65, 'Circuit Breaker', 'Electrical', 'piece', 330, null, false],
            [66, 'Light Switch', 'Electrical', 'piece', 120, null, false],
            [67, 'Convenience Outlet', 'Electrical', 'piece', 120, null, false],
            [68, 'LED Light Fixture', 'Electrical', 'piece', 130, null, false],
            [69, 'Electrical Tape', 'Electrical', 'roll', 50, null, false],
            [70, 'Wire Connectors / Terminal Lugs', 'Electrical', 'pack', null, 110, false],
        ],
        'D' => [
            [71, 'Ceramic / Porcelain Floor Tile', 'Other', 'box', null, 520, false],
            [72, 'Wall Tile', 'Other', 'box', null, 480, false],
            [73, 'Tile Adhesive', 'Other', 'bag', 200, null, false],
            [74, 'Tile Grout', 'Other', 'bag', 90, null, false],
            [75, 'Tile Trim / Edging', 'Other', 'length', 180, null, false],
            [76, 'Skim Coat / Wall Putty', 'Paint', 'bag', 360, null, false],
            [77, 'Sandpaper', 'Paint', 'sheet', 20, null, false],
            [78, 'Baseboard / Skirting', 'Other', 'length', null, 160, false],
            [79, 'Concrete Primer / Sealer', 'Paint', 'liter', null, 210, false],
            [80, 'Interior Latex Paint', 'Paint', 'liter', null, 190, false],
            [81, 'Exterior Latex Paint', 'Paint', 'liter', null, 240, false],
            [82, 'Enamel Paint', 'Paint', 'liter', null, 260, false],
            [83, 'Paint Thinner', 'Paint', 'liter', 80, null, false],
            [84, 'Paint Brush', 'Paint', 'piece', 45, null, false],
            [85, 'Paint Roller / Tray', 'Paint', 'set', 70, null, false],
            [86, 'Waterproofing Membrane / Coating', 'Other', 'pail', null, 2400, false],
            [87, 'Acrylic Sealant / Caulking', 'Other', 'tube', null, 135, false],
            [88, 'Wood Screws', 'Hardware', 'box', 360, null, false],
            [89, 'Self-Drilling Screws', 'Hardware', 'box', null, 280, false],
            [90, 'Expansion / Anchor Bolts', 'Hardware', 'piece', null, 22, false],
            [91, 'Construction Adhesive', 'Other', 'tube', null, 190, false],
        ],
    ];

    public function run(): void
    {
        $sheetSupplier = $this->sheetSupplier();
        $sldSupplier = $this->sldSupplier();
        $others = User::query()->where('role', 'supplier')->where('approval_status', 'approved')
            ->whereNotIn('id', [$sheetSupplier->id, $sldSupplier->id])->orderBy('id')->get();

        $listed = 0;
        $blank = 0;
        $sldListed = 0;
        $sldBlank = 0;
        foreach (self::MATERIALS as $section => $rows) {
            foreach ($rows as [, $name, $category, $unit, $sheetPrice, $market, $legacy]) {
                $description = self::SECTIONS[$section];

                if ($sheetPrice === null) {
                    // Left blank on the sheet: kept on file, but hidden until priced. Never overwritten.
                    $sheetSupplier->supplierProducts()->firstOrCreate(['name' => $name], [
                        'category' => $category, 'unit' => $unit, 'price' => 0, 'stock' => 0,
                        'min_order' => 1, 'description' => $description, 'is_active' => false,
                    ]);
                    $blank++;
                } else {
                    $sheetSupplier->supplierProducts()->updateOrCreate(['name' => $name], [
                        'category' => $category, 'unit' => $unit, 'price' => $sheetPrice,
                        'stock' => $this->stock($sheetSupplier->email, $name, $sheetPrice),
                        'min_order' => $this->minOrder($sheetPrice), 'description' => $description, 'is_active' => true,
                    ]);
                    $listed++;
                }

                $sldPrice = self::SLD_PRICES[$name] ?? null;
                if ($sldPrice === null) {
                    $sldSupplier->supplierProducts()->firstOrCreate(['name' => $name], [
                        'category' => $category, 'unit' => $unit, 'price' => 0, 'stock' => 0,
                        'min_order' => 1, 'description' => $description, 'is_active' => false,
                    ]);
                    $sldBlank++;
                } else {
                    $sldSupplier->supplierProducts()->updateOrCreate(['name' => $name], [
                        'category' => $category, 'unit' => $unit, 'price' => $sldPrice,
                        'stock' => $this->stock($sldSupplier->email, $name, $sldPrice),
                        'min_order' => $this->minOrder($sldPrice), 'description' => $description, 'is_active' => true,
                    ]);
                    $sldListed++;
                }

                foreach ($others as $supplier) {
                    $price = $this->otherPrice($supplier->email, $name, $sheetPrice, $market ?? $sheetPrice);
                    $attributes = [
                        'category' => $category, 'unit' => $unit, 'price' => $price,
                        'stock' => $this->stock($supplier->email, $name, $price),
                        'min_order' => $this->minOrder($price), 'description' => $description, 'is_active' => true,
                    ];

                    // A name a demo supplier already lists is theirs: add it where it is missing, never edit it.
                    if ($legacy) {
                        $supplier->supplierProducts()->firstOrCreate(['name' => $name], $attributes);
                    } else {
                        $supplier->supplierProducts()->updateOrCreate(['name' => $name], $attributes);
                    }
                }
            }
        }

        $this->command?->info("Tripple R: {$listed} priced + {$blank} left blank (inactive); SLD Hardware: {$sldListed} priced + {$sldBlank} left blank (inactive); {$others->count()} other supplier(s) now list all ".($listed + $blank).' materials.');
        $this->command?->line('  Tripple R login: '.self::SHEET_SUPPLIER['email'].' / '.self::PASSWORD);
        $this->command?->line('  SLD Hardware login: '.self::SLD_SUPPLIER['email'].' / '.self::PASSWORD);
    }

    private function sldSupplier(): User
    {
        $supplier = User::query()->updateOrCreate(
            ['email' => self::SLD_SUPPLIER['email']],
            [
                'name' => self::SLD_SUPPLIER['name'],
                'password' => self::PASSWORD,
                'role' => 'supplier',
                'approval_status' => 'approved',
                'business_name' => self::SLD_SUPPLIER['business'],
                'license_number' => 'DEMO-SUP-'.crc32(self::SLD_SUPPLIER['email']),
            ],
        );

        // Only a starting point: once SLD Hardware edits its profile, a re-run leaves it alone.
        $supplier->supplierProfile()->firstOrCreate([], ['location' => self::SLD_SUPPLIER['location']]);

        return $supplier;
    }

    private function sheetSupplier(): User
    {
        $supplier = User::query()->updateOrCreate(
            ['email' => self::SHEET_SUPPLIER['email']],
            [
                'name' => self::SHEET_SUPPLIER['name'],
                'password' => self::PASSWORD,
                'role' => 'supplier',
                'approval_status' => 'approved',
                'business_name' => self::SHEET_SUPPLIER['business'],
                'license_number' => 'DEMO-SUP-'.crc32(self::SHEET_SUPPLIER['email']),
            ],
        );

        // Only a starting point: once Tripple R edits its profile, a re-run leaves it alone.
        $supplier->supplierProfile()->firstOrCreate([], ['location' => self::SHEET_SUPPLIER['location']]);

        return $supplier;
    }

    /**
     * What another supplier charges: the market price, nudged by a per-supplier lean and a per-item wobble
     * (both fixed by the names, so a re-run lands on the same figure). Never equal to Tripple R's price.
     */
    private function otherPrice(string $email, string $name, ?int $sheetPrice, int $market): int
    {
        $lean = -0.02 + (crc32($email) % 15) / 100;
        $wobble = ((crc32($email.'|'.$name) % 121) - 60) / 1000;
        $raw = $market * (1 + $lean + $wobble);
        $step = $raw < 200 ? 1 : ($raw < 1000 ? 5 : 10);
        $price = max($step, (int) (round($raw / $step) * $step));

        return $price === $sheetPrice ? $price + $step : $price;
    }

    /** Plausible on-hand quantity: cheap items by the thousand, big-ticket items a handful. */
    private function stock(string $email, string $name, int $price): int
    {
        $base = match (true) {
            $price < 50 => 1500,
            $price < 300 => 400,
            $price < 1500 => 80,
            default => 20,
        };

        return max(5, (int) (round($base * (0.75 + (crc32($email.'#'.$name) % 51) / 100) / 5) * 5));
    }

    private function minOrder(int $price): int
    {
        return $price < 40 ? 10 : 1;
    }
}
