package com.hermes.backend.races.model;

import com.hermes.backend.races.OverlayBounds;
import com.hermes.backend.routing.RoutePoint;
import java.util.List;

public record CourseMapAlignment(boolean isCourseMap, int confidence, String summary, OverlayBounds overlayBounds, List<RoutePoint> routePoints, String startLabel, String finishLabel) {}
