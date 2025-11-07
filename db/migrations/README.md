This folder contains SQL migrations to be applied to the SOW application's MySQL database.

20251107_add_metadata_to_sow_activities.sql
  - Adds a nullable JSON `metadata` column to `sow_activities`.

How to apply (recommended):

1. Add this migration to your project's migration runner (if you use one, e.g., knex, sequelize, flyway).
2. If you don't have an automated runner in production, run this manually from a safe machine:

```bash
# from the deploy host or where mysql client can reach the container
docker exec -i ahmad_mysql-database.1.fkz4juvmtvnakiy10ph4zmw0f mysql -u sg_sow_user -p'SG_sow_2025_SecurePass!' socialgarden_sow < db/migrations/20251107_add_metadata_to_sow_activities.sql
```

Rollback (manual):

```sql
ALTER TABLE sow_activities DROP COLUMN metadata;
```

Do NOT commit secrets or credentials to the repo. This folder should only contain SQL and migration metadata.
