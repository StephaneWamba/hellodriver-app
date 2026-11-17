/**
 * One-time script: Create the platform admin account for HelloDriver.
 * Run: pnpm tsx scripts/create-platform-user.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PLATFORM_PHONE = '+24177716770';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Check if user already exists in our users table
const existingUsers = await db.select().from(users).where(eq(users.phone, PLATFORM_PHONE));
if (existingUsers.length > 0) {
  console.log('Platform user already exists in users table:');
  console.log('PLATFORM_USER_ID=' + existingUsers[0].id);
  process.exit(0);
}

// Create auth user via Supabase admin API (bypasses OTP)
const { data, error } = await supabase.auth.admin.createUser({
  phone: PLATFORM_PHONE,
  phone_confirm: true,
  user_metadata: { role: 'admin', name: 'HelloDriver Platform' },
});

if (error) {
  // User may already exist in auth but not in our table
  if (error.message.includes('already')) {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData?.users.find(u => u.phone === PLATFORM_PHONE);
    if (existing) {
      console.log('Auth user exists, ID:', existing.id);
      // Insert into our users table
      await db.insert(users).values({
        id: existing.id,
        phone: PLATFORM_PHONE,
        role: 'admin',
        name: 'HelloDriver Platform',
      }).onConflictDoNothing();
      console.log('PLATFORM_USER_ID=' + existing.id);
      process.exit(0);
    }
  }
  console.error('Error:', error.message);
  process.exit(1);
}

const authId = data.user.id;
console.log('Auth user created, ID:', authId);

// Insert into our users table
await db.insert(users).values({
  id: authId,
  phone: PLATFORM_PHONE,
  role: 'admin',
  name: 'HelloDriver Platform',
}).onConflictDoNothing();

console.log('\n✅ Platform user created successfully!');
console.log('PLATFORM_USER_ID=' + authId);
console.log('\nNow run:');
console.log('fly secrets set PLATFORM_USER_ID=' + authId + ' --app hellodriver-main');
