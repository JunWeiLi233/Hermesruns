import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class H2ToPostgresMigrator {
    private static final int BATCH_SIZE = 5_000;

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.out.println("Usage: java H2ToPostgresMigrator <h2Url> <pgUrl> <pgUser> <pgPassword> [--truncate]");
            return;
        }

        String h2Url = args[0];
        String pgUrl = args[1];
        String pgUser = args[2];
        String pgPassword = args[3];
        boolean truncate = args.length >= 5 && "--truncate".equalsIgnoreCase(args[4]);

        try (Connection h2 = DriverManager.getConnection(h2Url, "sa", "");
             Connection pg = DriverManager.getConnection(pgUrl, pgUser, pgPassword)) {
            pg.setAutoCommit(false);

            createTables(pg);

            if (truncate) {
                truncateTables(pg);
            }

            MigrationCounts counts = new MigrationCounts();
            counts.runners = copyRunner(h2, pg);
            counts.activities = copyActivities(h2, pg);
            counts.activityPoints = copyActivityPoints(h2, pg);

            resetSequence(pg, "runner");
            resetSequence(pg, "activities");
            resetSequence(pg, "activity_points");

            pg.commit();
            printSummary(h2, pg, counts);
        }
    }

    private static void createTables(Connection pg) throws SQLException {
        execute(pg, """
                CREATE TABLE IF NOT EXISTS runner (
                    id BIGSERIAL PRIMARY KEY,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    status VARCHAR(255),
                    password VARCHAR(255),
                    deleted BOOLEAN NOT NULL DEFAULT FALSE,
                    session_token VARCHAR(255),
                    role VARCHAR(255),
                    display_name VARCHAR(255),
                    strava_athlete_id BIGINT,
                    strava_username VARCHAR(255),
                    strava_access_token TEXT,
                    strava_refresh_token TEXT,
                    strava_token_expires_at BIGINT
                )
                """);
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_runner_email ON runner (email)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_runner_session_token ON runner (session_token)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_runner_strava_athlete_id ON runner (strava_athlete_id)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_runner_deleted_role ON runner (deleted, role)");

        execute(pg, """
                CREATE TABLE IF NOT EXISTS activities (
                    id BIGSERIAL PRIMARY KEY,
                    runner_id BIGINT,
                    name VARCHAR(255),
                    strava_id VARCHAR(255),
                    distance_km DOUBLE PRECISION NOT NULL,
                    moving_time_seconds INT NOT NULL,
                    start_date VARCHAR(255),
                    provider VARCHAR(255),
                    activity_type VARCHAR(255),
                    start_time TIMESTAMP(6),
                    distance_meters DOUBLE PRECISION,
                    duration_seconds BIGINT,
                    source_file_name VARCHAR(255),
                    source_checksum VARCHAR(64),
                    created_at TIMESTAMP(6),
                    average_heart_rate DOUBLE PRECISION,
                    max_heart_rate DOUBLE PRECISION,
                    total_elevation_gain DOUBLE PRECISION,
                    calories INT,
                    average_cadence DOUBLE PRECISION,
                    average_watts DOUBLE PRECISION,
                    max_speed_mps DOUBLE PRECISION,
                    suffer_score INT,
                    CONSTRAINT uk_activity_runner_provider_checksum UNIQUE (runner_id, provider, source_checksum),
                    CONSTRAINT fk_activities_runner FOREIGN KEY (runner_id) REFERENCES runner(id)
                )
                """);
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_runner ON activities (runner_id)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_runner_type ON activities (runner_id, activity_type)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_runner_start_time ON activities (runner_id, start_time)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_provider_checksum ON activities (provider, source_checksum)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_strava_id ON activities (strava_id)");

        execute(pg, """
                CREATE TABLE IF NOT EXISTS activity_points (
                    id BIGSERIAL PRIMARY KEY,
                    activity_id BIGINT NOT NULL,
                    sequence_index INT NOT NULL,
                    latitude DOUBLE PRECISION NOT NULL,
                    longitude DOUBLE PRECISION NOT NULL,
                    CONSTRAINT fk_activity_points_activity FOREIGN KEY (activity_id) REFERENCES activities(id)
                )
                """);
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_point_activity ON activity_points (activity_id)");
        execute(pg, "CREATE INDEX IF NOT EXISTS idx_activity_point_activity_sequence ON activity_points (activity_id, sequence_index)");
    }

    private static void truncateTables(Connection pg) throws SQLException {
        execute(pg, "TRUNCATE TABLE activity_points, activities, runner CASCADE");
        pg.commit();
    }

    private static long copyRunner(Connection h2, Connection pg) throws SQLException {
        String select = """
                SELECT id, email, status, password, deleted, session_token, role, display_name,
                       strava_athlete_id, strava_username, strava_access_token,
                       strava_refresh_token, strava_token_expires_at
                FROM runner
                ORDER BY id
                """;
        String insert = """
                INSERT INTO runner (
                    id, email, status, password, deleted, session_token, role, display_name,
                    strava_athlete_id, strava_username, strava_access_token,
                    strava_refresh_token, strava_token_expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    email = EXCLUDED.email,
                    status = EXCLUDED.status,
                    password = EXCLUDED.password,
                    deleted = EXCLUDED.deleted,
                    session_token = EXCLUDED.session_token,
                    role = EXCLUDED.role,
                    display_name = EXCLUDED.display_name,
                    strava_athlete_id = EXCLUDED.strava_athlete_id,
                    strava_username = EXCLUDED.strava_username,
                    strava_access_token = EXCLUDED.strava_access_token,
                    strava_refresh_token = EXCLUDED.strava_refresh_token,
                    strava_token_expires_at = EXCLUDED.strava_token_expires_at
                """;
        return copyTable(h2, pg, select, insert, 13);
    }

    private static long copyActivities(Connection h2, Connection pg) throws SQLException {
        String select = """
                SELECT id, runner_id, name, strava_id, distance_km, moving_time_seconds, start_date,
                       provider, activity_type, start_time, distance_meters, duration_seconds,
                       source_file_name, source_checksum, created_at, average_heart_rate,
                       max_heart_rate, total_elevation_gain, calories, average_cadence,
                       average_watts, max_speed_mps, suffer_score
                FROM activities
                ORDER BY id
                """;
        String insert = """
                INSERT INTO activities (
                    id, runner_id, name, strava_id, distance_km, moving_time_seconds, start_date,
                    provider, activity_type, start_time, distance_meters, duration_seconds,
                    source_file_name, source_checksum, created_at, average_heart_rate,
                    max_heart_rate, total_elevation_gain, calories, average_cadence,
                    average_watts, max_speed_mps, suffer_score
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    runner_id = EXCLUDED.runner_id,
                    name = EXCLUDED.name,
                    strava_id = EXCLUDED.strava_id,
                    distance_km = EXCLUDED.distance_km,
                    moving_time_seconds = EXCLUDED.moving_time_seconds,
                    start_date = EXCLUDED.start_date,
                    provider = EXCLUDED.provider,
                    activity_type = EXCLUDED.activity_type,
                    start_time = EXCLUDED.start_time,
                    distance_meters = EXCLUDED.distance_meters,
                    duration_seconds = EXCLUDED.duration_seconds,
                    source_file_name = EXCLUDED.source_file_name,
                    source_checksum = EXCLUDED.source_checksum,
                    created_at = EXCLUDED.created_at,
                    average_heart_rate = EXCLUDED.average_heart_rate,
                    max_heart_rate = EXCLUDED.max_heart_rate,
                    total_elevation_gain = EXCLUDED.total_elevation_gain,
                    calories = EXCLUDED.calories,
                    average_cadence = EXCLUDED.average_cadence,
                    average_watts = EXCLUDED.average_watts,
                    max_speed_mps = EXCLUDED.max_speed_mps,
                    suffer_score = EXCLUDED.suffer_score
                """;
        return copyTable(h2, pg, select, insert, 23);
    }

    private static long copyActivityPoints(Connection h2, Connection pg) throws SQLException {
        String select = """
                SELECT id, activity_id, sequence_index, latitude, longitude
                FROM activity_points
                ORDER BY id
                """;
        String insert = """
                INSERT INTO activity_points (
                    id, activity_id, sequence_index, latitude, longitude
                ) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    activity_id = EXCLUDED.activity_id,
                    sequence_index = EXCLUDED.sequence_index,
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude
                """;
        return copyTable(h2, pg, select, insert, 5);
    }

    private static long copyTable(
            Connection h2,
            Connection pg,
            String selectSql,
            String insertSql,
            int parameterCount
    ) throws SQLException {
        long count = 0;
        try (Statement selectStatement = h2.createStatement(ResultSet.TYPE_FORWARD_ONLY, ResultSet.CONCUR_READ_ONLY);
             ResultSet resultSet = selectStatement.executeQuery(selectSql);
             PreparedStatement insert = pg.prepareStatement(insertSql)) {
            while (resultSet.next()) {
                for (int index = 1; index <= parameterCount; index++) {
                    insert.setObject(index, resultSet.getObject(index));
                }
                insert.addBatch();
                count++;
                if (count % BATCH_SIZE == 0) {
                    insert.executeBatch();
                    pg.commit();
                }
            }
            insert.executeBatch();
        }
        return count;
    }

    private static void resetSequence(Connection pg, String table) throws SQLException {
        // Whitelist table names to prevent injection
        if (!table.matches("^(runner|activities|activity_points)$")) {
            throw new IllegalArgumentException("Unsupported table for sequence reset: " + table);
        }

        try (Statement statement = pg.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COALESCE(MAX(id), 0) + 1 FROM " + table)) {
            if (resultSet.next()) {
                long nextId = resultSet.getLong(1);
                // Note: pg_get_serial_sequence and setval are specific to Postgres.
                // table name is whitelisted above.
                execute(pg, "SELECT setval(pg_get_serial_sequence('" + table + "', 'id'), " + nextId + ", false)");       
            }
        }
    }
    private static void printSummary(Connection h2, Connection pg, MigrationCounts counts) throws SQLException {
        System.out.println("Migration complete.");
        System.out.println("Copied rows:");
        System.out.println("  runner: " + counts.runners);
        System.out.println("  activities: " + counts.activities);
        System.out.println("  activity_points: " + counts.activityPoints);
        System.out.println("Source counts:");
        printCount(h2, "runner");
        printCount(h2, "activities");
        printCount(h2, "activity_points");
        System.out.println("Destination counts:");
        printCount(pg, "runner");
        printCount(pg, "activities");
        printCount(pg, "activity_points");
    }

    private static void printCount(Connection connection, String table) throws SQLException {
        // Whitelist table names to prevent injection
        if (!table.matches("^(runner|activities|activity_points)$")) {
            throw new IllegalArgumentException("Unsupported table for count: " + table);
        }
        try (Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT COUNT(*) AS row_count FROM " + table)) {
            if (resultSet.next()) {
                System.out.println("  " + table + ": " + resultSet.getLong("row_count"));
            }
        }
    }

    private static void execute(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute(sql);
        }
    }

    private static final class MigrationCounts {
        private long runners;
        private long activities;
        private long activityPoints;
    }
}
