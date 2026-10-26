package com.hermes.backend.explorer;

import java.util.Map;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice(basePackageClasses=ExplorerController.class)
@org.springframework.core.annotation.Order(-10)
public class ExplorerErrors {
    @ExceptionHandler(org.springframework.dao.ConcurrencyFailureException.class) ResponseEntity<?> changed(){return ResponseEntity.status(409).body(Map.of("message","The dataset changed. Reload the selection."));}
    @ExceptionHandler(ResponseStatusException.class) ResponseEntity<?> response(ResponseStatusException exception){return ResponseEntity.status(exception.getStatusCode()).body(Map.of("message",exception.getReason()==null?"Request unavailable.":exception.getReason()));}
    @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<?> invalid(){return ResponseEntity.badRequest().body(Map.of("message","Invalid Explorer request."));}
}
