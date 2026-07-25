/**
 * Ensure company_notes / company_status_history exist in production.
 * Local gets these via sequelize.sync({ alter: true }); prod does not.
 *
 * On managed Postgres (RDS) the app user often lacks REFERENCES privilege on
 * companies/users, which makes "CREATE TABLE ... REFERENCES" fail with
 * "permission denied for table companies". In that case we create the table
 * without foreign keys — the app enforces the relations anyway.
 */

const isPrivilegeError = (error) => {
  const code = error?.original?.code || error?.parent?.code;
  const message = String(error?.message || '');
  return code === '42501' || /permission denied/i.test(message);
};

const createTableWithFkFallback = async (sequelize, { table, withFk, withoutFk }) => {
  try {
    await sequelize.query(withFk);
    return { table, foreignKeys: true };
  } catch (error) {
    if (!isPrivilegeError(error)) throw error;

    console.warn(
      `${table}: no REFERENCES privilege on related tables — creating without foreign keys.`
    );
    await sequelize.query(withoutFk);
    return { table, foreignKeys: false };
  }
};

const createIndexQuietly = async (sequelize, sql) => {
  try {
    await sequelize.query(sql);
  } catch (error) {
    if (!isPrivilegeError(error)) throw error;
    console.warn('Index creation skipped (insufficient privilege).');
  }
};

async function ensureCompanyNotesSchema(sequelize) {
  const result = await createTableWithFkFallback(sequelize, {
    table: 'company_notes',
    withFk: `
      CREATE TABLE IF NOT EXISTS company_notes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    withoutFk: `
      CREATE TABLE IF NOT EXISTS company_notes (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  });

  await createIndexQuietly(
    sequelize,
    `CREATE INDEX IF NOT EXISTS idx_company_notes_company_id ON company_notes(company_id);`
  );
  await createIndexQuietly(
    sequelize,
    `CREATE INDEX IF NOT EXISTS idx_company_notes_user_id ON company_notes(user_id);`
  );
  await createIndexQuietly(
    sequelize,
    `CREATE INDEX IF NOT EXISTS idx_company_notes_created_at ON company_notes(created_at DESC);`
  );

  return result;
}

async function ensureCompanyStatusHistorySchema(sequelize) {
  const result = await createTableWithFkFallback(sequelize, {
    table: 'company_status_history',
    withFk: `
      CREATE TABLE IF NOT EXISTS company_status_history (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        from_status VARCHAR(255),
        to_status VARCHAR(255) NOT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        change_source VARCHAR(80),
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `,
    withoutFk: `
      CREATE TABLE IF NOT EXISTS company_status_history (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        from_status VARCHAR(255),
        to_status VARCHAR(255) NOT NULL,
        changed_by INTEGER,
        change_source VARCHAR(80),
        note TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `
  });

  await createIndexQuietly(
    sequelize,
    `CREATE INDEX IF NOT EXISTS idx_company_status_history_company_id ON company_status_history(company_id);`
  );
  await createIndexQuietly(
    sequelize,
    `CREATE INDEX IF NOT EXISTS idx_company_status_history_created_at ON company_status_history(created_at ASC);`
  );

  return result;
}

module.exports = {
  ensureCompanyNotesSchema,
  ensureCompanyStatusHistorySchema
};
