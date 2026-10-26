package com.hermes.backend.entertainment;
import com.hermes.backend.runner.*;
import org.springframework.stereotype.Component;

@Component
class EntertainmentAccountExport implements RunnerDataExportContributor {
    private final EntertainmentService service;
    EntertainmentAccountExport(EntertainmentService service) { this.service=service; }
    public String filename() { return "entertainment.json"; }
    public Object export(Runner runner) { return service.read(runner.getId(),"me",null); }
}
