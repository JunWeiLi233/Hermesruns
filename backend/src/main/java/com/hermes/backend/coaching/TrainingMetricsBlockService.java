package com.hermes.backend.coaching;

import com.hermes.backend.activity.ActivityLocalDates;
import com.hermes.backend.activity.ActivityType;
import com.hermes.backend.runner.HeartRateZones;
import com.hermes.backend.runner.Runner;
import com.hermes.backend.runner.TrainingZonesService;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only stored measurements, not an effort/pace model or a state-changing metrics refresh. */
@Service
public class TrainingMetricsBlockService {
    public record Run(Long activityId, LocalDate localDate, String calendarBasis, long totalSeconds,
            long coveredSeconds, long durationCoveredSeconds, long sampleExcessSeconds, long unknownSeconds,
            long[] zoneSeconds, String metricsStatus,
            String effortSource, int[] boundariesBpm, Integer maxHeartRateBpm, LocalDateTime computedAt) {}
    public record Day(LocalDate date, int activityCount, long totalSeconds, long coveredSeconds,
            long durationCoveredSeconds, long sampleExcessSeconds, long unknownSeconds, long[] zoneSeconds) {}
    public record Block(int days, LocalDate startDate, LocalDate endDate, String timeZone, String source,
            String percentageDenominator, String coverageDenominator, String durationBasis, int activityCount, double distanceKm,
            long totalSeconds, long coveredSeconds, long durationCoveredSeconds, long sampleExcessSeconds,
            long unknownSeconds, Double coveragePercent,
            long[] zoneSeconds, List<Day> daily, List<Run> activities) {}

    private final ActivityTrainingMetricsRepository rows;
    private final TrainingZonesService zones;
    private final Clock clock;
    public TrainingMetricsBlockService(ActivityTrainingMetricsRepository rows, TrainingZonesService zones, Clock clock) {
        this.rows=rows;this.zones=zones;this.clock=clock;
    }

    @Transactional(readOnly=true)
    public Block read(Runner runner, int days) {
        if(days!=7 && days!=28) throw new IllegalArgumentException("Select a 7 or 28 calendar-day window.");
        ZoneId zone=ActivityLocalDates.zoneOf(runner);
        LocalDate end=LocalDate.now(clock.withZone(zone)), start=end.minusDays(days-1);
        HeartRateZones current=zones.resolve(runner).zones();
        // UTC-file timestamps and unknown-zone legacy wall times share a storage column.
        // Two guard days cover every supported UTC offset; precise membership is evaluated below.
        List<HrBlockProjection> candidates=rows.findHrBlockCandidates(runner.getId(),ActivityType.RUN,
                start.minusDays(2).atStartOfDay(),end.plusDays(3).atStartOfDay());
        List<Run> included=new ArrayList<>();
        Map<LocalDate,List<Run>> byDay=new LinkedHashMap<>();
        for(int i=0;i<days;i++)byDay.put(start.plusDays(i),new ArrayList<>());
        long total=0, covered=0, durationCovered=0, sampleExcess=0;double km=0;long[] sums=new long[5];
        for(HrBlockProjection p:candidates) {
            LocalDate date=p.getStartTime()==null ? p.getEffectiveStartTime().toLocalDate()
                    : ActivityLocalDates.of(p.getStartTime(),Boolean.TRUE.equals(p.getStravaApiSourced()),runner);
            if(date.isBefore(start)||date.isAfter(end))continue;
            long duration=p.getMovingTimeSeconds()!=null && p.getMovingTimeSeconds()>0 ? p.getMovingTimeSeconds()
                    : p.getDurationSeconds()==null ? 0 : Math.max(0,p.getDurationSeconds());
            String status=status(p,current,date);
            long[] seconds="CURRENT".equals(status) ? zoneSeconds(p) : new long[5];
            long observed=Arrays.stream(seconds).sum();
            // Keep accepted stored sample time intact, including the producer's terminal sample gap.
            // Cap coverage per activity so its excess cannot fill another activity's unknown duration.
            long observedDuration=Math.min(observed,duration), excess=Math.max(0,observed-duration);
            int[] boundaries=p.getMetricsId()==null ? null : new int[]{nz(p.getB1()),nz(p.getB2()),nz(p.getB3()),nz(p.getB4())};
            String calendarBasis=p.getStartTime()==null ? "ADDED_DATE_FALLBACK"
                    : Boolean.TRUE.equals(p.getStravaApiSourced()) ? "STRAVA_LOCAL_WALL_TIME" : "UTC_INSTANT";
            Run run=new Run(p.getActivityId(),date,calendarBasis,duration,observed,observedDuration,excess,duration-observedDuration,
                    seconds,status,p.getEffortSource(),boundaries,p.getMaxHrUsed(),p.getComputedAt());
            included.add(run);byDay.get(date).add(run);total+=duration;covered+=observed;
            durationCovered+=observedDuration;sampleExcess+=excess;
            double distance=positive(p.getDistanceKm());km+=distance>0?distance:positive(p.getDistanceMeters())/1000;
            for(int i=0;i<5;i++)sums[i]+=seconds[i];
        }
        included.sort(Comparator.comparing(Run::localDate).thenComparing(Run::activityId));
        List<Day> daily=new ArrayList<>();
        byDay.forEach((date,runs)->{
            long time=0,observed=0,observedDuration=0,excess=0;long[] seconds=new long[5];
            for(Run r:runs){time+=r.totalSeconds();observed+=r.coveredSeconds();observedDuration+=r.durationCoveredSeconds();
                excess+=r.sampleExcessSeconds();for(int i=0;i<5;i++)seconds[i]+=r.zoneSeconds()[i];}
            daily.add(new Day(date,runs.size(),time,observed,observedDuration,excess,time-observedDuration,seconds));
        });
        return new Block(days,start,end,zone.getId(),"STORED_HR_ZONES","COVERED_HR_SECONDS",
                "ACTIVITY_DURATION_SECONDS_WITH_PER_ACTIVITY_CAP","MOVING_SECONDS_OR_RECORDED_DURATION",
                included.size(),km,total,covered,durationCovered,sampleExcess,total-durationCovered,
                total>0?durationCovered*100.0/total:null,sums,List.copyOf(daily),List.copyOf(included));
    }
    private static String status(HrBlockProjection p, HeartRateZones current, LocalDate date) {
        if(p.getMetricsId()==null)return "MISSING";
        if(Boolean.TRUE.equals(p.getStale())||!Objects.equals(p.getModelVersion(),TrainingMetricsService.MODEL_VERSION)
                ||!Objects.equals(p.getMetricsDate(),date)||!Objects.equals(p.getMaxHrUsed(),current.maxHeartRate())
                ||!Arrays.equals(new int[]{nz(p.getB1()),nz(p.getB2()),nz(p.getB3()),nz(p.getB4())},current.boundaries()))return "STALE";
        long[] seconds=zoneSeconds(p);long sum=Arrays.stream(seconds).sum();
        if(Arrays.stream(seconds).anyMatch(v->v<0)||p.getCoveredSeconds()==null||sum!=p.getCoveredSeconds()
                ||sum<0)return "INVALID";
        return sum==0?"NO_HR":"CURRENT";
    }
    private static long[] zoneSeconds(HrBlockProjection p){return new long[]{nz(p.getZ1()),nz(p.getZ2()),nz(p.getZ3()),nz(p.getZ4()),nz(p.getZ5())};}
    private static int nz(Integer n){return n==null?0:n;}
    private static double positive(Double d){return d!=null&&Double.isFinite(d)&&d>0?d:0;}
}
