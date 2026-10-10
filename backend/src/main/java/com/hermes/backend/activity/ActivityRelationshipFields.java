package com.hermes.backend.activity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.hermes.backend.shoes.Shoe;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import java.util.ArrayList;
import java.util.List;

@MappedSuperclass
public abstract class ActivityRelationshipFields extends ActivityMetricFields {

    @ManyToOne
    @JoinColumn(name = "shoe_id")
    private Shoe shoe;

    @OneToMany(mappedBy = "activity", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sequenceIndex ASC")
    private List<ActivityPoint> points = new ArrayList<>();

    /**
     * The group of same-route runs this run belongs to (see {@link RouteMatchGroup}); null until the run has been
     * analysed, or when it has no usable route. A plain id rather than a relation, so the group and the run can be
     * deleted in either order. Not serialised: it is how Hermes finds matches, not part of the API response.
     */
    @Column(name = "route_match_group_id")
    private Long routeMatchGroupId;

    /**
     * The version of the run analysis (best efforts and route matching) that last ran for this run; null when none
     * has. A run whose version is behind {@code BestEffortService.MODEL_VERSION} is analysed again. Not serialised.
     */
    @Column(name = "records_version")
    private Integer recordsVersion;

    @JsonIgnore
    public List<ActivityPoint> getPoints() { return points; }
    public void setPoints(List<ActivityPoint> points) { this.points = points; }

    @JsonIgnore
    public Shoe getShoe() { return shoe; }
    public void setShoe(Shoe shoe) { this.shoe = shoe; }

    @JsonIgnore
    public Long getRouteMatchGroupId() { return routeMatchGroupId; }
    public void setRouteMatchGroupId(Long routeMatchGroupId) { this.routeMatchGroupId = routeMatchGroupId; }

    @JsonIgnore
    public Integer getRecordsVersion() { return recordsVersion; }
    public void setRecordsVersion(Integer recordsVersion) { this.recordsVersion = recordsVersion; }
}
