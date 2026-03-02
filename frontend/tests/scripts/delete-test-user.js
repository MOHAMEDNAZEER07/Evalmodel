/**
 * Delete Test User Script
 * 
 * Run this to clean up the test user from database:
 * node tests/scripts/delete-test-user.js
 * 
 * Note: This requires direct Supabase access or admin endpoint
 */

const readline = require('readline');

const TEST_USER_EMAIL = 'e2etest@evalmodel.com';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗑️  Delete Test User\n');
console.log(`Email: ${TEST_USER_EMAIL}`);
console.log('\nTo delete this user, go to your Supabase dashboard:');
console.log('1. Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT/editor');
console.log('2. Select "users" table');
console.log(`3. Find and delete: ${TEST_USER_EMAIL}`);
console.log('\nAlternatively, run this SQL query in Supabase SQL Editor:');
console.log(`\nDELETE FROM users WHERE email = '${TEST_USER_EMAIL}';\n`);

rl.question('Press Enter to exit...', () => {
  rl.close();
});
