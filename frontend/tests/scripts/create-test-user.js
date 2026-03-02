/**
 * Create Test User Script
 * 
 * Run this once to create a test user for E2E tests:
 * node tests/scripts/create-test-user.js
 */

const API_BASE_URL = 'http://localhost:8000';
const TEST_USER = {
  email: 'e2etest@evalmodel.com',
  password: 'Test123456',
  username: 'E2E Test User'
};

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...');
    console.log(`Email: ${TEST_USER.email}`);
    console.log(`Password: ${TEST_USER.password}`);
    
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
        username: TEST_USER.username,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Test user created successfully!');
      console.log(`User ID: ${data.user.id}`);
      console.log('\n📝 You can now run Playwright tests with:');
      console.log('npm run test:e2e');
    } else {
      if (response.status === 400 && data.detail?.includes('already exists')) {
        console.log('ℹ️  Test user already exists');
        
        // Try to login to verify credentials
        console.log('🔐 Verifying login...');
        const loginResponse = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password,
          }),
        });

        if (loginResponse.ok) {
          console.log('✅ Test user credentials verified!');
        } else {
          console.log('⚠️  Test user exists but password might be different');
          console.log('💡 Delete the user from Supabase and run this script again');
        }
      } else {
        console.error('❌ Failed to create test user:', data.detail);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('1. Make sure backend is running:');
    console.log('   cd backend && uvicorn app.main:app --reload');
    console.log('\n2. Check Supabase database is ACTIVE (not paused):');
    console.log('   https://supabase.com/dashboard/project/YOUR_PROJECT');
    console.log('\n3. Verify .env has correct Supabase credentials');
  }
}

// Run the function
createTestUser();
