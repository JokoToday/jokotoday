#!/usr/bin/env bash
# Isolated disposable database only. Does not touch the existing app database.
set -euo pipefail
container="${SMILE_TEST_PG_CONTAINER:-supabase_db_jokotoday}"
test_db="smile_validation_$(date +%s)_$$"
docker exec "$container" createdb -U postgres "$test_db"
trap 'docker exec "$container" dropdb -U postgres "$test_db"' EXIT
for sql in scripts/fixtures/smile-likes-setup.sql supabase/migrations/20261030032732_joko_smile_episode_likes.sql scripts/fixtures/smile-likes-assert.sql; do
  docker exec -i "$container" psql -U postgres -d "$test_db" -v ON_ERROR_STOP=1 < "$sql"
done
