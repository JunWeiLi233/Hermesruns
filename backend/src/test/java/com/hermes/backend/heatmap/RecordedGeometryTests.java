package com.hermes.backend.heatmap;

import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class RecordedGeometryTests {
    @Test void declaredScreenErrorIncludesEndpointPrecisionAtHighZoom() {
        double lat=40.700000049,lon=-74;var a=new double[]{lat,lon};double scale=256*Math.pow(2,20);
        double midY=RecordedGeometry.project(a,20)[1]-.749;
        double midLat=Math.toDegrees(Math.atan(Math.sinh(Math.PI*(1-2*midY/scale))));
        var path=List.of(a,new double[]{midLat,lon+.00001},new double[]{lat,lon+.00002});
        var simplified=RecordedGeometry.simplify(path,20,.75);
        assertThat(simplified).hasSize(2);
        double error=Math.abs(RecordedGeometry.project(path.get(1),20)[1]-RecordedGeometry.project(simplified.get(0),20)[1]);
        assertThat(error).isLessThanOrEqualTo(.75);
    }
    @Test void nullableModeIsRejectedAsInvalidInputRatherThanAnUnexpectedServerFailure() {
        for(String key:List.of("mode","basemap")) {
            var patch=new HashMap<String,Object>();patch.put(key,null);
            assertThatThrownBy(()->RecordedMapPreferences.merge(Map.of(),patch)).isInstanceOf(IllegalArgumentException.class);
        }
    }
    @Test void preservesHairpinRatherThanTakingThumbnailShortcuts() {
        var path=List.of(new double[]{40.7,-74},new double[]{40.701,-74},new double[]{40.701,-73.999},new double[]{40.7001,-73.999},new double[]{40.7001,-73.998});
        assertThat(RecordedGeometry.simplify(path,18,.75)).hasSize(5);
    }
    @Test void breaksSequenceHolesInvalidFixesAndDateline() {
        var points=List.of(new RecordedGeometry.Fix(0,40,-74),new RecordedGeometry.Fix(1,40.001,-74),
            new RecordedGeometry.Fix(4,40.002,-74),new RecordedGeometry.Fix(5,40.003,-74),
            new RecordedGeometry.Fix(6,Double.NaN,-74),new RecordedGeometry.Fix(7,0,179.999),new RecordedGeometry.Fix(8,0,-179.999));
        assertThat(RecordedGeometry.split(points)).hasSize(2).allSatisfy(line->assertThat(line).hasSize(2));
    }
    @Test void reducesStraightRunsButKeepsEndsAndDoesNotChangeSource() {
        var path=new ArrayList<double[]>();for(int i=0;i<1000;i++)path.add(new double[]{40,-74+i*.000001});
        var result=RecordedGeometry.simplify(path,14,.75);
        assertThat(result).hasSize(2);assertThat(path).hasSize(1000);
        assertThat(result.get(0)).containsExactly(40,-74);
        assertThat(result.get(1)[1]).isCloseTo(-73.999001,within(.00000001));
    }
    @Test void mapPreferencePatchIsAllowlistedAndLeavesInputIntact() {
        var base=new LinkedHashMap<String,Object>(RecordedMapPreferences.defaults());
        var result=RecordedMapPreferences.merge(base,Map.of("weight",2.5,"mode","heat"));
        assertThat(result).containsEntry("weight",2.5).containsEntry("mode","heat");
        assertThat(base).containsEntry("mode","lines");
        assertThatThrownBy(()->RecordedMapPreferences.merge(base,Map.of("owner",5))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->RecordedMapPreferences.merge(base,Map.of("weight",999))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->RecordedMapPreferences.merge(base,Map.of("color","url(secret)"))).isInstanceOf(IllegalArgumentException.class);
    }
}
