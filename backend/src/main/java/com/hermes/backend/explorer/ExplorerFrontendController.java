package com.hermes.backend.explorer;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** The independently built shell is packaged under its own static prefix by the explorer Maven profile. */
@Controller
@ConditionalOnProperty(name="app.explorer.enabled",havingValue="true")
public class ExplorerFrontendController {
    @GetMapping("/explorer") public String slash(){return "redirect:/explorer/";}
    @GetMapping("/explorer/") public String shell(){return "forward:/explorer/index.html";}
}
