package com.hermes.backend.activity;

import com.hermes.backend.runner.Runner;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * One route a runner has run more than once, as the first run that took it described it: where it started and finished,
 * how far it went and which way round. Later runs that fit it (see {@link RouteMatcher}) point at it from
 * {@code activities.route_match_group_id}, so the runs of a group are found with one query on the run, and a run and its
 * group can be deleted in either order. A group nobody points at any more is removed the next time the catch-up runs.
 *
 * <p>Belongs to one runner and is never shared: the same route run by two runners is two groups.</p>
 */
@Entity
@Table(
        name = "route_match_group",
        indexes = @Index(name = "idx_route_match_group_runner", columnList = "runner_id")
)
public class RouteMatchGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "runner_id", nullable = false)
    private Runner runner;

    @Column(name = "start_latitude", nullable = false)
    private double startLatitude;

    @Column(name = "start_longitude", nullable = false)
    private double startLongitude;

    @Column(name = "end_latitude", nullable = false)
    private double endLatitude;

    @Column(name = "end_longitude", nullable = false)
    private double endLongitude;

    @Column(name = "distance_meters", nullable = false)
    private double distanceMeters;

    /** Start to finish, degrees clockwise from north; null for a loop. */
    @Column(name = "bearing_degrees")
    private Double bearingDegrees;

    /** +1 a loop run counter-clockwise, -1 clockwise, 0 an out-and-back or an open route. */
    @Column(nullable = false)
    private int winding;

    @Column(name = "is_loop", nullable = false)
    private boolean loop;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected RouteMatchGroup() {
    }

    RouteMatchGroup(Runner runner, RouteMatcher.Route route) {
        this.runner = runner;
        this.startLatitude = route.startLatitude();
        this.startLongitude = route.startLongitude();
        this.endLatitude = route.endLatitude();
        this.endLongitude = route.endLongitude();
        this.distanceMeters = route.distanceMeters();
        this.bearingDegrees = route.bearingDegrees();
        this.winding = route.winding();
        this.loop = route.loop();
        this.createdAt = LocalDateTime.now();
    }

    RouteMatcher.Route route() {
        return new RouteMatcher.Route(startLatitude, startLongitude, endLatitude, endLongitude, distanceMeters,
                bearingDegrees, winding, loop);
    }

    public Long getId() {
        return id;
    }

    public Runner getRunner() {
        return runner;
    }

    public double getDistanceMeters() {
        return distanceMeters;
    }

    public boolean isLoop() {
        return loop;
    }

    public int getWinding() {
        return winding;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
