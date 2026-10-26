package com.hermes.backend.training;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import java.util.*;

@RestControllerAdvice(assignableTypes={TrainingController.class,TrainingAuthController.class})
@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
public class TrainingErrors {
    @ExceptionHandler(TrainingFailure.class) ResponseEntity<?> failure(TrainingFailure e){return error(e.status,e.getMessage());}
    @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> conflict(){return error(409,"CONFLICT");}
    @ExceptionHandler({IllegalArgumentException.class,ClassCastException.class,HttpMessageNotReadableException.class}) ResponseEntity<?> input(){return error(422,"INVALID_INPUT");}
    ResponseEntity<?> error(int status,String code){return ResponseEntity.status(status).header("Cache-Control","no-store").body(Map.of("code",code,"fieldErrors",Map.of(),"requestId",UUID.randomUUID().toString()));}
}
