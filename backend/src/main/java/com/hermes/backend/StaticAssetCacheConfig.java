package com.hermes.backend;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

/**
 * Vite emits content-hashed filenames under /assets/ (index-CXIMLV24.css),
 * so those responses can be cached forever. Without this the SPA re-downloads
 * its multi-megabyte CSS/JS chunks on every navigation.
 */
@Configuration
public class StaticAssetCacheConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/assets/**")
                .addResourceLocations("classpath:/static/assets/")
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable())
                .setUseLastModified(true);
    }
}
