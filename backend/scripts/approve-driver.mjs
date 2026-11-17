import pg from 'pg';
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.log('DATABASE_URL manquant. Usage: DATABASE_URL=... node approve_driver.mjs +24177000007');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const phone = process.argv[2];
if (!phone) { console.log('Usage: node approve_driver.mjs +24177000007'); process.exit(1); }

const { rows: [user] } = await pool.query("SELECT id FROM users WHERE phone = $1", [phone]);
if (!user) { console.log('User not found'); process.exit(1); }

await pool.query(`
  UPDATE driver_profiles
  SET verification_status = 'approved', is_verified = true, verified_at = NOW(), updated_at = NOW()
  WHERE user_id = $1
`, [user.id]);

const { rows: [dp] } = await pool.query("SELECT verification_status, is_verified FROM driver_profiles WHERE user_id = $1", [user.id]);
console.log(`✓ ${phone} approuvé:`, dp);
await pool.end();
