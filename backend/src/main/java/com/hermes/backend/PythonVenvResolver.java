package com.hermes.backend;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Resolves the Python executable, preferring a local .venv when available.
 */
public class PythonVenvResolver {

    private final String pythonCommand;
    private final String pythonScriptPath;

    public PythonVenvResolver(String pythonCommand, String pythonScriptPath) {
        this.pythonCommand = pythonCommand;
        this.pythonScriptPath = pythonScriptPath;
    }

    public String resolvePythonCommand(String scriptName) {
        if (pythonCommand != null && !pythonCommand.isBlank() && !"python".equalsIgnoreCase(pythonCommand.trim())) {
            return pythonCommand.trim();
        }

        Path workingDirectory = Path.of("").toAbsolutePath().normalize();
        Path parentDirectory = workingDirectory.getParent();
        List<Path> candidates = List.of(
                Path.of(".venv", "Scripts", "python.exe"),
                Path.of(".venv", "bin", "python"),
                parentDirectory == null ? Path.of("_missing_parent_python_") : parentDirectory.resolve(Path.of(".venv", "Scripts", "python.exe")),
                parentDirectory == null ? Path.of("_missing_parent_python_bin_") : parentDirectory.resolve(Path.of(".venv", "bin", "python")),
                Path.of("backend", ".venv", "Scripts", "python.exe"),
                Path.of("backend", ".venv", "bin", "python")
        );
        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate.toAbsolutePath().toString();
            }
        }
        return "python";
    }

    public String resolveScriptPath(String fallbackScriptName) {
        if (pythonScriptPath != null && !pythonScriptPath.isBlank()) {
            return pythonScriptPath.trim();
        }
        return fallbackScriptName;
    }
}
