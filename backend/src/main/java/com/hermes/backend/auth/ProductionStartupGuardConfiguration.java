package com.hermes.backend.auth;

import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Validate production settings before Hibernate or compatibility writers can execute DDL. */
@Configuration(proxyBeanMethods = false)
public class ProductionStartupGuardConfiguration {
    @Bean
    static BeanFactoryPostProcessor schemaWritersRequireSecurityValidation() {
        return factory -> {
            for (String name : List.of("entityManagerFactory", "dataSourceScriptDatabaseInitializer",
                    "trainingStore", "wellnessProviderSchemaCompatibility",
                    "raceCourseMapSchemaCompatibilityRunner", "officialCourseStartupSeeder",
                    "raceCourseMapBulkSeedCommand", "courseMapBulkScanCommand")) {
                if (!factory.containsBeanDefinition(name)) continue;
                var definition = factory.getBeanDefinition(name);
                var dependencies = new LinkedHashSet<String>();
                if (definition.getDependsOn() != null) dependencies.addAll(List.of(definition.getDependsOn()));
                dependencies.add("productionSecurityValidator");
                definition.setDependsOn(dependencies.toArray(String[]::new));
            }
        };
    }
}
