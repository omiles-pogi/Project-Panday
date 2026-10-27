<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password', 'role', 'approval_status', 'business_name', 'license_number'])]
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

    /** Roles that must submit a license/ID number (and, for companies, a business name) to register. */
    public const VERIFIED_ROLES = ['contractor', 'supplier', 'worker'];

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

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function workerProfile(): HasOne
    {
        return $this->hasOne(WorkerProfile::class);
    }

    public function ratingsReceived(): HasMany
    {
        return $this->hasMany(WorkerRating::class, 'worker_id');
    }

    public function contractorProfile(): HasOne
    {
        return $this->hasOne(ContractorProfile::class);
    }

    public function contractorRatingsReceived(): HasMany
    {
        return $this->hasMany(ContractorRating::class, 'contractor_id');
    }

    /** Projects this user is assigned to work on as a contractor. */
    public function contractorAssignments(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_contractors', 'contractor_id', 'project_id')
            ->withTimestamps();
    }

    /** Projects this user is assigned to work on as a skilled worker. */
    public function workerAssignments(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_workers', 'worker_id', 'project_id')
            ->withTimestamps();
    }

    /** This supplier's shop listings. */
    public function supplierProducts(): HasMany
    {
        return $this->hasMany(SupplierProduct::class, 'supplier_id');
    }

    /** This user's in-app notification feed (invites, applications, decisions), newest first. */
    public function appNotifications(): HasMany
    {
        return $this->hasMany(AppNotification::class)->latest();
    }

    /** Invite/application requests where this user is the worker side. */
    public function workerRequests(): HasMany
    {
        return $this->hasMany(ProjectWorkerRequest::class, 'worker_id');
    }

    /** Invite/application requests where this user is the contractor side. */
    public function contractorRequests(): HasMany
    {
        return $this->hasMany(ProjectContractorRequest::class, 'contractor_id');
    }
}
