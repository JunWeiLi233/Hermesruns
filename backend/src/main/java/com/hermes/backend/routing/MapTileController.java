package com.hermes.backend.routing;

import com.hermes.backend.routing.MapTileService.TileResult;
import com.hermes.backend.routing.MapTileService.TileState;
import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/maps")
public class MapTileController {
    private final MapTileService mapTileService;

    public MapTileController(MapTileService mapTileService) {
        this.mapTileService = mapTileService;
    }

    @GetMapping("/tiles/{z}/{x}/{y}.png")
    public ResponseEntity<byte[]> tile(
        @PathVariable int z,
        @PathVariable int x,
        @PathVariable int y
    ) {
        return response(mapTileService.tile(z, x, y));
    }

    @GetMapping("/tiles/carto/{style}/{z}/{x}/{y}.png")
    public ResponseEntity<byte[]> cartoTile(
        @PathVariable String style,
        @PathVariable int z,
        @PathVariable int x,
        @PathVariable int y,
        @RequestParam(name = "r", required = false, defaultValue = "") String retina
    ) {
        return response(mapTileService.cartoTile(style, z, x, y, retina));
    }

    @GetMapping("/tiles/esri-dark/{z}/{y}/{x}.png")
    public ResponseEntity<byte[]> esriDarkTile(
        @PathVariable int z,
        @PathVariable int y,
        @PathVariable int x
    ) {
        return response(mapTileService.esriDarkTile(z, y, x));
    }

    @GetMapping("/tiles/esri-dark-labels/{z}/{y}/{x}.png")
    public ResponseEntity<byte[]> esriDarkLabelsTile(
        @PathVariable int z,
        @PathVariable int y,
        @PathVariable int x
    ) {
        return response(mapTileService.esriDarkLabelsTile(z, y, x));
    }

    private ResponseEntity<byte[]> response(TileResult tile) {
        if (tile.state() == TileState.EMPTY) {
            return ResponseEntity.noContent()
                    .cacheControl(CacheControl.noStore())
                    .build();
        }
        CacheControl cacheControl = tile.state() == TileState.STALE
                ? CacheControl.maxAge(5, TimeUnit.MINUTES).cachePublic()
                : CacheControl.maxAge(6, TimeUnit.HOURS).cachePublic();
        return ResponseEntity.status(HttpStatus.OK)
                .contentType(mediaType(tile.contentType()))
                .cacheControl(cacheControl)
                .body(tile.body());
    }

    private MediaType mediaType(String contentType) {
        try {
            return MediaType.parseMediaType(contentType);
        } catch (Exception ignored) {
            return MediaType.IMAGE_PNG;
        }
    }
}
