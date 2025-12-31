const { sequelize } = require('./src/config/database');
const { User } = require('./src/models');

async function migrateToMultipleRoles() {
  try {
    console.log('🔄 Starting migration to multiple roles...');

    // Get all users
    const users = await User.findAll();

    console.log(`📊 Found ${users.length} users to migrate`);

    let migrated = 0;
    let skipped = 0;

    for (const user of users) {
      // Check if role is already an array
      if (Array.isArray(user.role)) {
        console.log(`⏭️  User ${user.id} (${user.email}) already has array roles, skipping...`);
        skipped++;
        continue;
      }

      // Convert single role to array
      const roleArray = user.role ? [user.role] : ['employee'];
      
      await user.update({ role: roleArray });
      console.log(`✅ Migrated user ${user.id} (${user.email}): ${user.role} → [${roleArray.join(', ')}]`);
      migrated++;
    }

    console.log(`\n✨ Migration completed!`);
    console.log(`   ✅ Migrated: ${migrated} users`);
    console.log(`   ⏭️  Skipped: ${skipped} users (already arrays)`);
    console.log(`   📊 Total: ${users.length} users`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateToMultipleRoles();

