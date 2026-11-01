<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo people for testing team matching and price comparison:
 *
 *   php artisan db:seed --class=DemoPeopleSeeder
 *
 * Creates two skilled workers (Rene the mason, Kulas the electrician), one contractor (Porman) and
 * two suppliers who list the same materials at different prices — and differ from the existing
 * "Supplier Test" listings too. All accounts are pre-approved and share PASSWORD. Safe to re-run:
 * accounts are matched by email and listings by name, so it updates instead of duplicating.
 */
class DemoPeopleSeeder extends Seeder
{
    private const PASSWORD = 'password123';

    /** [name, email, trade, years, bio, skills[]] */
    private const WORKERS = [
        [
            'Rene Dela Cruz', 'rene@panday.test', 'Mason', 12,
            'Mason with 12 years on residential builds — hollow block laying, plastering and concrete finishing.',
            ['CHB Laying', 'Plastering', 'Concrete Works', 'Tile Setting', 'Formworks'],
        ],
        [
            'Kulas Bautista', 'kulas@panday.test', 'Electrician', 9,
            'Licensed electrician for houses and small commercial units — wiring, panel boards and lighting layouts.',
            ['House Wiring', 'Panel Board Installation', 'Lighting Layout', 'Conduit Works', 'Troubleshooting'],
        ],
    ];

    /** [name, email, company, license, specialization, years, bio, skills[]] */
    private const CONTRACTORS = [
        [
            'Porman Reyes', 'porman@panday.test', 'Porman Builders', 'PCAB-DEMO-0001',
            'Residential Construction', 15,
            'General contractor building and renovating single-family homes, from foundation to finishing.',
            ['Residential Construction', 'Renovation', 'Project Management', 'Structural Works'],
        ],
    ];

    /** [name, email, business, license] */
    private const SUPPLIERS = [
        ['Bagong Buhay Hardware', 'bagongbuhay@panday.test', 'Bagong Buhay Hardware & Construction Supply', 'DTI-DEMO-0001'],
        ['Pioneer Builders Supply', 'pioneer@panday.test', 'Pioneer Builders Supply Inc.', 'DTI-DEMO-0002'],
    ];

    /**
     * Same product names as DemoMaterialsSeeder so the catalogs line up side by side. Each supplier
     * is cheaper on some things and dearer on others, so there's no single "always cheapest" shop.
     *
     * [name, category, unit, min order, description, [Bagong Buhay price, stock], [Pioneer price, stock]]
     */
    private const MATERIALS = [
        ['Portland Cement Type I (40kg)', 'Cement', 'bag', 10, 'General-purpose cement for foundations, columns and slabs.', [248, 800], [279, 400]],
        ['Masonry Cement (40kg)', 'Cement', 'bag', 10, 'For CHB laying, plastering and finishing.', [228, 300], [249, 150]],
        ['Washed Sand', 'Sand', 'cu.m', 1, 'Clean, screened sand for concrete and plaster.', [1420, 60], [1290, 90]],
        ['Gravel 3/4"', 'Gravel', 'cu.m', 1, 'Crushed aggregate for structural concrete.', [1580, 50], [1440, 70]],
        ['Deformed Steel Bar 10mm x 6m', 'Steel', 'piece', 10, 'Grade 40 rebar for slabs and beams.', [185, 1200], [208, 600]],
        ['Deformed Steel Bar 12mm x 6m', 'Steel', 'piece', 10, 'Grade 40 rebar for columns and footings.', [268, 900], [297, 450]],
        ['G.I. Tie Wire #16', 'Hardware', 'kg', 5, 'Galvanized wire for tying rebar.', [102, 250], [89, 180]],
        ['CHB 4" Hollow Block', 'Masonry', 'piece', 100, 'Load-bearing concrete hollow block for interior walls.', [14, 8000], [17, 4000]],
        ['CHB 6" Hollow Block', 'Masonry', 'piece', 100, 'For exterior and load-bearing walls.', [20, 6000], [24, 3500]],
        ['Coco Lumber 2" x 3" x 10ft', 'Lumber', 'piece', 10, 'Formworks and temporary framing.', [158, 200], [139, 400]],
        ['Marine Plywood 3/4" (4x8)', 'Lumber', 'sheet', 1, 'Water-resistant plywood for formworks and cabinetry.', [1420, 40], [1295, 80]],
        ['Common Wire Nails 3"', 'Hardware', 'kg', 1, 'For formworks and general carpentry.', [92, 220], [79, 300]],
        ['Long Span Pre-Painted Roofing (0.4mm)', 'Roofing', 'meter', 10, 'Rib-type colored roofing sheet, cut to length.', [365, 600], [398, 350]],
        ['PVC Pipe 4" x 3m (Sanitary)', 'Plumbing', 'piece', 1, 'For drainage and sewer lines.', [545, 50], [498, 110]],
        ['THHN Wire 3.5mm² (75m roll)', 'Electrical', 'roll', 1, 'Copper building wire for convenience outlets.', [3380, 40], [3590, 20]],
        ['Latex Paint White (4L)', 'Paint', 'gallon', 1, 'Interior acrylic latex, flat finish.', [745, 120], [820, 60]],
    ];

    public function run(): void
    {
        foreach (self::WORKERS as [$name, $email, $trade, $years, $bio, $skills]) {
            $user = $this->account($name, $email, 'worker');
            $profile = $user->workerProfile()->updateOrCreate([], [
                'trade' => $trade,
                'years_experience' => $years,
                'bio' => $bio,
            ]);
            foreach ($skills as $skill) {
                $profile->skills()->firstOrCreate(['skill' => $skill]);
            }
        }

        foreach (self::CONTRACTORS as [$name, $email, $company, $license, $specialization, $years, $bio, $skills]) {
            $user = $this->account($name, $email, 'contractor', $company, $license);
            $profile = $user->contractorProfile()->updateOrCreate([], [
                'company_name' => $company,
                'specialization' => $specialization,
                'years_experience' => $years,
                'bio' => $bio,
            ]);
            foreach ($skills as $skill) {
                $profile->skills()->firstOrCreate(['skill' => $skill]);
            }
        }

        foreach (self::SUPPLIERS as $index => [$name, $email, $business, $license]) {
            $supplier = $this->account($name, $email, 'supplier', $business, $license);
            foreach (self::MATERIALS as $material) {
                [$productName, $category, $unit, $minOrder, $description] = $material;
                [$price, $stock] = $material[5 + $index];
                $supplier->supplierProducts()->updateOrCreate(
                    ['name' => $productName],
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
        }

        $this->command?->info('Demo people seeded (password for all: '.self::PASSWORD.'):');
        foreach ([...self::WORKERS, ...self::CONTRACTORS, ...self::SUPPLIERS] as $row) {
            $this->command?->line("  {$row[0]} <{$row[1]}>");
        }
    }

    private function account(string $name, string $email, string $role, ?string $business = null, ?string $license = null): User
    {
        return User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => self::PASSWORD,
                'role' => $role,
                'approval_status' => 'approved',
                'business_name' => $business,
                'license_number' => $license ?? 'DEMO-'.strtoupper(substr($role, 0, 3)).'-'.crc32($email),
            ],
        );
    }
}
