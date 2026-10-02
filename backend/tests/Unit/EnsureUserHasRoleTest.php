<?php

namespace Tests\Unit;

use App\Http\Middleware\EnsureUserHasRole;
use App\Models\User;
use Illuminate\Http\Request;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EnsureUserHasRoleTest extends TestCase
{
    #[DataProvider('roleProvider')]
    public function test_it_allows_or_blocks_based_on_role(string $userRole, array $allowedRoles, bool $shouldPass): void
    {
        $user = new User(['role' => $userRole]);
        $request = new Request;
        $request->setUserResolver(fn () => $user);

        $middleware = new EnsureUserHasRole;
        $response = $middleware->handle($request, fn () => response()->json(['ok' => true]), ...$allowedRoles);

        $this->assertSame($shouldPass ? 200 : 403, $response->getStatusCode());
    }

    public static function roleProvider(): array
    {
        return [
            'admin allowed by role:admin' => ['admin', ['admin'], true],
            'superadmin allowed by role:admin,superadmin' => ['superadmin', ['admin', 'superadmin'], true],
            'homeowner blocked by role:admin' => ['homeowner', ['admin'], false],
            'admin blocked by role:superadmin' => ['admin', ['superadmin'], false],
        ];
    }

    public function test_it_blocks_when_there_is_no_authenticated_user(): void
    {
        $request = new Request;
        $request->setUserResolver(fn () => null);

        $middleware = new EnsureUserHasRole;
        $response = $middleware->handle($request, fn () => response()->json(['ok' => true]), 'admin');

        $this->assertSame(403, $response->getStatusCode());
    }
}
