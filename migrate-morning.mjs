import { createConnection } from 'mysql2/promise';

const url = process.env.DATABASE_URL;
const conn = await createConnection(url);

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS morning_routine_config (
      id int AUTO_INCREMENT NOT NULL,
      \`key\` varchar(64) NOT NULL,
      sections text NOT NULL,
      wakeTime varchar(8) DEFAULT '07:00',
      musicQuery text,
      customGreeting text,
      readAloud int NOT NULL DEFAULT 1,
      weatherLocation text,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT morning_routine_config_id PRIMARY KEY(id),
      CONSTRAINT morning_routine_config_key_unique UNIQUE(\`key\`)
    )
  `);
  console.log('✓ morning_routine_config table created (or already exists)');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
