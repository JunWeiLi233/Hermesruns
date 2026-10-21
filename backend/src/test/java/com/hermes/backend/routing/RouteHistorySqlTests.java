package com.hermes.backend.routing;

import com.hermes.backend.activity.ActivityPointRepository;
import java.sql.DriverManager;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Query;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import static org.assertj.core.api.Assertions.assertThat;

class RouteHistorySqlTests {
    @Test void fullHistoryDensityAndBoundedTraceSelectionStayOwnedAndMeasured() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:route-"+UUID.randomUUID()+";MODE=PostgreSQL")) {
            var jdbc = new JdbcTemplate(new SingleConnectionDataSource(connection, true));
            jdbc.execute("create table activities(id bigint primary key, runner_id bigint, activity_type varchar(20), distance_km double precision, distance_meters double precision, start_time timestamp, created_at timestamp)");
            jdbc.execute("create table activity_points(activity_id bigint, latitude double precision, longitude double precision)");
            for (int id = 1; id <= 20; id++) {
                jdbc.update("insert into activities values(?,7,'RUN',?,null,?,?)",id,(double)id,
                        java.sql.Timestamp.valueOf("2026-01-"+String.format("%02d",id)+" 12:00:00"),java.sql.Timestamp.valueOf("2026-01-01 12:00:00"));
                jdbc.update("insert into activity_points values(?,40.7135,-73.8005),(?,40.7135,-73.8005)",id,id);
            }
            jdbc.execute("insert into activities values(21,7,'RUN',4.5,null,current_timestamp,current_timestamp),(22,8,'RUN',4.5,null,current_timestamp,current_timestamp),(23,7,'WALK',4.5,null,current_timestamp,current_timestamp)");
            for(int i=0;i<60;i++) jdbc.execute("insert into activity_points values(22,41,-74),(23,41,-74),(21,0,0),(21,91,0)");
            jdbc.execute("insert into activity_points values(21,34,-118),(21,34.0001,-118)");
            var named = new NamedParameterJdbcTemplate(jdbc);
            String anchorSql = ActivityPointRepository.class.getMethod("findDensestHeatmapAnchor",Long.class,String.class).getAnnotation(Query.class).value();
            var anchor = named.queryForList(anchorSql, Map.of("runnerId",7L,"activityType","RUN"));
            assertThat(anchor).hasSize(1);
            var result = anchor.get(0);
            assertThat(((Number)result.get("LATITUDE")).doubleValue()).isEqualTo(40.7135);
            assertThat(((Number)result.get("LONGITUDE")).doubleValue()).isEqualTo(-73.8005);
            assertThat(((Number)result.get("ACTIVITY_COUNT")).intValue()).isEqualTo(20);
            assertThat(((Number)result.get("POINT_COUNT")).intValue()).isEqualTo(40);
            String idsSql = ActivityPointRepository.class.getMethod("findHeatmapRouteActivityIds",Long.class,String.class,
                    double.class,double.class,double.class,double.class,Double.class).getAnnotation(Query.class).value();
            Map<String,Object> params = new HashMap<>(Map.of("runnerId",7L,"activityType","RUN","minLat",40.713,"maxLat",40.714,"minLng",-73.801,"maxLng",-73.8,"targetKm",4.5));
            var ids = named.queryForList(idsSql,params,Long.class);
            assertThat(ids).hasSize(18).startsWith(5L,4L).doesNotContain(19L,20L,21L,22L,23L);
            params.put("targetKm",null);
            assertThat(named.queryForList(idsSql,params,Long.class)).hasSize(18).startsWith(20L,19L);
        }
    }
}
