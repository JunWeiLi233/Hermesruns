package com.hermes.backend;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.CascadeType;
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

    @JsonIgnore
    public List<ActivityPoint> getPoints() { return points; }
    public void setPoints(List<ActivityPoint> points) { this.points = points; }

    @JsonIgnore
    public Shoe getShoe() { return shoe; }
    public void setShoe(Shoe shoe) { this.shoe = shoe; }
}
