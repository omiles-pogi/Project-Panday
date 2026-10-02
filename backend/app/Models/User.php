<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'approval_status'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLES = ['homeowner', 'contractor', 'supplier', 'worker', 'admin', 'superadmin'];

    /**
     * Roles a caller may assign to themselves via public registration. Admin/superadmin
     * are deliberately excluded — they can only be created via `php artisan
     * make:superadmin` or by an existing superadmin.
     */
    public const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

    public const SELF_REGISTERABLE_ROLES = ['homeowner', 'contractor', 'supplier', 'worker'];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
