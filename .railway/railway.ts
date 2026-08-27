import { defineRailway, project, service } from "railway/iac";

// Last resort for a per-service CaC repo. Prefer one .railway file for the
// project and drop this if you later combine services into that file.
export const partial = "hermes-web";

export default defineRailway(() => {
  const web = service("hermes-web", {
    healthcheck: "/",
    healthcheckTimeout: 180,
    // dockerfilePath from CaC: "Dockerfile"
    // builder from CaC: "DOCKERFILE"
  });

  return project("hermes-web", {
    resources: [web],
  });
});
