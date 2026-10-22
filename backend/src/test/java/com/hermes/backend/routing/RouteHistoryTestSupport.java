package com.hermes.backend.routing;

import com.hermes.backend.activity.ActivityPointRepository;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Unit-test boundary for the SQL aggregation; its actual query is tested separately. */
public final class RouteHistoryTestSupport {
    private RouteHistoryTestSupport() {}
    public static void stubHistory(ActivityPointRepository repository, long runnerId, List<Object[]> points) {
        var anchor = RouteHeatmapAnchorService.selectAnchor(points);
        when(repository.findDensestHeatmapAnchor(eq(runnerId), anyString())).thenReturn(anchor == null ? List.of()
                : List.<Object[]>of(new Object[]{anchor.startLat(), anchor.startLng(), anchor.activityCount(), anchor.pointCount()}));
        var ids = points.stream().filter(p -> anchor != null && p[1] instanceof Number && p[2] instanceof Number
                && anchor.containsPoint(((Number)p[1]).doubleValue(), ((Number)p[2]).doubleValue()))
                .map(p -> ((Number)p[0]).longValue()).distinct().limit(18).toList();
        when(repository.findHeatmapRouteActivityIds(eq(runnerId), anyString(), anyDouble(), anyDouble(), anyDouble(), anyDouble(), nullable(Double.class)))
                .thenReturn(ids);
        when(repository.findHeatmapPointsByActivityIds(anyList())).thenAnswer(call -> {
            List<Long> requested = call.getArgument(0);
            return points.stream().filter(p -> requested.contains(((Number)p[0]).longValue())).toList();
        });
    }
}
