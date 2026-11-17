import type { Config } from 'drizzle-kit';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is required for drizzle-kit');
}

export default {
  // schema.ts est la seule source de vérité pour le schéma. Le projet
  // n'a jamais réellement suivi de fil de migrations versionnées (la
  // base live a été construite via `db:push` + SQL ad-hoc) — plutôt que
  // de reconstituer un historique factice à partir de fichiers épars et
  // parfois obsolètes, on assume ce mode de fonctionnement : tout
  // changement de schéma passe par `pnpm db:push`, jamais par des
  // fichiers de migration.
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
  // Note: PostGIS extensions and custom functions are not handled by Drizzle
  // Apply those separately via SQL migrations if needed
  verbose: true,
  strict: true,
} satisfies Config;
