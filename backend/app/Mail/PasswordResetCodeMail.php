<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly User $user, public readonly string $code) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Your Project-Panday password reset code');
    }

    public function content(): Content
    {
        $name = e($this->user->name);
        $code = e($this->code);

        return new Content(htmlString: <<<HTML
            <p>Hi {$name},</p>
            <p>Use this code to reset your Project-Panday password. It expires in 15 minutes.</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">{$code}</p>
            <p>If you didn't request this, you can ignore this email — your password won't change.</p>
            HTML);
    }
}
