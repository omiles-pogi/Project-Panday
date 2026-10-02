<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class MakeSuperAdmin extends Command
{
    /**
     * The only way to create a superadmin — never exposed through the API.
     */
    protected $signature = 'make:superadmin {name? : The user\'s name} {email? : The user\'s email} {password? : The user\'s password}';

    protected $description = 'Create a superadmin user (or promote an existing user to superadmin)';

    public function handle(): int
    {
        $email = $this->argument('email') ?? $this->ask('Email');
        $existing = User::where('email', $email)->first();

        if ($existing) {
            $existing->update(['role' => 'superadmin', 'approval_status' => 'approved']);
            $this->info("Promoted existing user {$existing->email} to superadmin.");

            return self::SUCCESS;
        }

        $name = $this->argument('name') ?? $this->ask('Name');
        $password = $this->argument('password') ?? $this->secret('Password');

        $validator = Validator::make(
            ['name' => $name, 'email' => $email, 'password' => $password],
            [
                'name' => ['required', 'string', 'max:255'],
                'email' => ['required', 'string', 'email', 'max:255'],
                'password' => ['required', 'string', 'min:8'],
            ]
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => 'superadmin',
            'approval_status' => 'approved',
        ]);

        $this->info("Created superadmin {$user->email}.");

        return self::SUCCESS;
    }
}
