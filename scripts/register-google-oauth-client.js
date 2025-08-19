#!/usr/bin/env node

/**
 * Script to manually register a Google OAuth client for production use
 * Run this script once to get client credentials for your production environment
 * 
 * Usage: node scripts/register-google-oauth-client.js https://your-production-url.com
 */

const productionUrl = process.argv[2];

if (!productionUrl) {
  console.error('Usage: node scripts/register-google-oauth-client.js <production-url>');
  console.error('Example: node scripts/register-google-oauth-client.js https://chat.bullhorn.com');
  process.exit(1);
}

async function registerClient() {
  const registrationData = {
    client_name: 'Bullhorn Chat',
    redirect_uris: [
      `${productionUrl}/auth/google`,
      `${productionUrl}/auth/google-callback`
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    application_type: 'web',
    contacts: ['support@bullhorn.com'],
    client_uri: productionUrl,
    policy_uri: `${productionUrl}/privacy`,
    tos_uri: `${productionUrl}/terms`,
    scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/tasks.readonly https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly'
  };

  console.log('Registering OAuth client for:', productionUrl);
  console.log('Registration data:', JSON.stringify(registrationData, null, 2));
  
  try {
    const response = await fetch('https://google.bullhornlabs.app/oauth2/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Bullhorn-Chat-Registration/1.0'
      },
      redirect: 'manual',
      body: JSON.stringify(registrationData)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Registration failed: ${response.status} - ${text}`);
    }

    const result = await response.json();
    
    console.log('\n✅ Successfully registered OAuth client!\n');
    console.log('Add these environment variables to your production environment:\n');
    console.log(`GOOGLE_OAUTH_CLIENT_ID=${result.client_id}`);
    console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${result.client_secret}`);
    
    if (result.client_id_issued_at) {
      console.log(`\nClient issued at: ${new Date(result.client_id_issued_at * 1000).toISOString()}`);
    }
    
    if (result.client_secret_expires_at) {
      console.log(`Client secret expires at: ${new Date(result.client_secret_expires_at * 1000).toISOString()}`);
    }
    
    console.log('\n⚠️  Keep these credentials secure and never commit them to source control!');
    
  } catch (error) {
    console.error('\n❌ Registration failed:', error.message);
    console.error('\nIf registration continues to fail, you may need to:');
    console.error('1. Check if the Google OAuth server is accessible');
    console.error('2. Verify the production URL is correct');
    console.error('3. Contact the OAuth server administrator');
    process.exit(1);
  }
}

registerClient();