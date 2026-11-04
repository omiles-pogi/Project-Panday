<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // The single account allowed into the web admin portal (/admin).
    'admin' => [
        'email' => env('ADMIN_EMAIL', 'admin@panday.test'),
    ],

    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
        // gpt-oss models "think" before answering and those tokens count against the rate limit;
        // low is plenty for structured estimation. Ignored for models that don't support it.
        'reasoning_effort' => env('GROQ_REASONING_EFFORT', 'low'),
        // The account's tokens-per-minute cap (Groq free tier: 8000). Every request reserves its
        // prompt + max reply size against this, so reply size is shrunk to fit. Raise it after upgrading.
        'tpm_limit' => (int) env('GROQ_TPM_LIMIT', 8000),
    ],

    // Push notifications to phones with the app closed, through Expo's push service. The access
    // token is optional — only needed if "enhanced security" is switched on for the Expo project.
    'expo_push' => [
        'url' => env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'),
        'access_token' => env('EXPO_ACCESS_TOKEN'),
    ],

];
