const { sequelize } = require('./src/config/database');

async function addReviewerRoles() {
  try {
    // For PostgreSQL, we need to alter the ENUM type
    // First, add the new values to the existing ENUM type
    await sequelize.query(`
      DO $$ 
      BEGIN
        -- Check if 'data_reviewer' exists in the enum, if not add it
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'data_reviewer' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'data_reviewer';
        END IF;
        
        -- Check if 'template_reviewer' exists in the enum, if not add it
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'template_reviewer' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_users_role')
        ) THEN
          ALTER TYPE enum_users_role ADD VALUE 'template_reviewer';
        END IF;
      END $$;
    `);

    console.log('✅ Reviewer roles (data_reviewer, template_reviewer) added successfully');
  } catch (error) {
    console.error('❌ Error adding reviewer roles:', error);
    // If the enum type name is different, try alternative approach
    try {
      // Alternative: Try to find the enum type dynamically
      const enumResult = await sequelize.query(`
        SELECT t.typname 
        FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE e.enumlabel = 'admin' 
        LIMIT 1;
      `);
      
      if (enumResult[0] && enumResult[0].length > 0) {
        const enumTypeName = enumResult[0][0].typname;
        console.log(`Found enum type: ${enumTypeName}`);
        
        await sequelize.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = 'data_reviewer' 
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}')
            ) THEN
              ALTER TYPE ${enumTypeName} ADD VALUE 'data_reviewer';
            END IF;
            
            IF NOT EXISTS (
              SELECT 1 FROM pg_enum 
              WHERE enumlabel = 'template_reviewer' 
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${enumTypeName}')
            ) THEN
              ALTER TYPE ${enumTypeName} ADD VALUE 'template_reviewer';
            END IF;
          END $$;
        `);
        
        console.log('✅ Reviewer roles added successfully (alternative method)');
      }
    } catch (altError) {
      console.error('❌ Alternative method also failed:', altError);
      throw altError;
    }
  } finally {
    await sequelize.close();
  }
}

addReviewerRoles();

