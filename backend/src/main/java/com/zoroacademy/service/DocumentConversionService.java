package com.zoroacademy.service;

import com.zoroacademy.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Service
public class DocumentConversionService {

    private static final Logger log = LoggerFactory.getLogger(DocumentConversionService.class);

    private static final Set<String> CONVERTIBLE_EXTENSIONS = Set.of(
            "ppt", "pptx", "doc", "docx", "xls", "xlsx"
    );

    @Value("${libreoffice.path:}")
    private String configuredLibreOfficePath;

    public boolean isConvertibleOfficeDocument(String filename) {
        if (filename == null || !filename.contains(".")) {
            return false;
        }
        String ext = filename.substring(filename.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT).trim();
        return CONVERTIBLE_EXTENSIONS.contains(ext);
    }

    public static class ConversionResult {
        private final byte[] pdfBytes;
        private final String pdfFilename;

        public ConversionResult(byte[] pdfBytes, String pdfFilename) {
            this.pdfBytes = pdfBytes;
            this.pdfFilename = pdfFilename;
        }

        public byte[] getPdfBytes() {
            return pdfBytes;
        }

        public String getPdfFilename() {
            return pdfFilename;
        }
    }

    public ConversionResult convertToPdfIfApplicable(byte[] sourceBytes, String originalFilename) {
        if (!isConvertibleOfficeDocument(originalFilename)) {
            return null;
        }

        String sofficeCmd = resolveSofficeExecutable();
        if (sofficeCmd == null) {
            log.warn("LibreOffice (soffice) not found on host environment. Storing '{}' in original format without PDF conversion. Install libreoffice on server for automatic PDF rendering.", originalFilename);
            return null;
        }

        Path tempDir = null;
        try {
            tempDir = Files.createTempDirectory("zoro_doc_conv_");
            String ext = originalFilename.substring(originalFilename.lastIndexOf('.'));
            String baseName = originalFilename.substring(0, originalFilename.lastIndexOf('.')).replaceAll("[^a-zA-Z0-9._-]", "_");
            Path sourceFile = tempDir.resolve("input_" + System.currentTimeMillis() + ext);
            Files.write(sourceFile, sourceBytes);

            ProcessBuilder pb = new ProcessBuilder(
                    sofficeCmd,
                    "--headless",
                    "--convert-to", "pdf",
                    "--outdir", tempDir.toAbsolutePath().toString(),
                    sourceFile.toAbsolutePath().toString()
            );
            pb.redirectErrorStream(true);

            log.info("Converting '{}' to PDF using LibreOffice headless...", originalFilename);
            Process process = pb.start();
            boolean finished = process.waitFor(60, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new BadRequestException("Document conversion to PDF timed out after 60 seconds.");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                String procOutput = new String(process.getInputStream().readAllBytes());
                log.error("LibreOffice conversion failed with exit code {}: {}", exitCode, procOutput);
                throw new BadRequestException("Failed to convert office document to PDF: " + procOutput.trim());
            }

            // Find generated PDF
            String expectedPdfName = sourceFile.getFileName().toString().replaceFirst("\\.[^.]+$", ".pdf");
            Path generatedPdf = tempDir.resolve(expectedPdfName);

            if (!Files.exists(generatedPdf)) {
                // Check if any .pdf file was generated in tempDir
                try (var stream = Files.list(tempDir)) {
                    generatedPdf = stream.filter(p -> p.toString().toLowerCase().endsWith(".pdf"))
                            .findFirst()
                            .orElse(null);
                }
            }

            if (generatedPdf == null || !Files.exists(generatedPdf)) {
                throw new BadRequestException("LibreOffice completed but no PDF output was produced.");
            }

            byte[] pdfBytes = Files.readAllBytes(generatedPdf);
            String finalPdfName = baseName + ".pdf";
            log.info("Successfully converted '{}' ({} bytes) to PDF '{}' ({} bytes)",
                    originalFilename, sourceBytes.length, finalPdfName, pdfBytes.length);

            return new ConversionResult(pdfBytes, finalPdfName);

        } catch (IOException | InterruptedException e) {
            log.error("Error during LibreOffice document conversion: {}", e.getMessage(), e);
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new BadRequestException("Failed to convert document to PDF: " + e.getMessage());
        } finally {
            if (tempDir != null) {
                cleanupTempDirectory(tempDir);
            }
        }
    }

    private String resolveSofficeExecutable() {
        if (configuredLibreOfficePath != null && !configuredLibreOfficePath.isBlank()) {
            File f = new File(configuredLibreOfficePath);
            if (f.exists() && f.canExecute()) {
                return f.getAbsolutePath();
            }
        }

        // Check common Linux locations
        String[] linuxCandidates = {
                "/usr/bin/soffice",
                "/usr/bin/libreoffice",
                "/usr/local/bin/soffice",
                "/snap/bin/libreoffice"
        };
        for (String c : linuxCandidates) {
            File f = new File(c);
            if (f.exists() && f.canExecute()) {
                return f.getAbsolutePath();
            }
        }

        // Check PATH via command check
        try {
            boolean isWindows = System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win");
            Process check = new ProcessBuilder(isWindows ? new String[]{"where", "soffice"} : new String[]{"which", "soffice"})
                    .start();
            if (check.waitFor(3, TimeUnit.SECONDS) && check.exitValue() == 0) {
                String path = new String(check.getInputStream().readAllBytes()).trim().split("\\r?\\n")[0];
                if (!path.isBlank()) {
                    return path;
                }
            }
        } catch (Exception ignored) {}

        return null;
    }

    private void cleanupTempDirectory(Path dir) {
        try {
            if (Files.exists(dir)) {
                try (var stream = Files.walk(dir)) {
                    stream.sorted(Comparator.reverseOrder())
                            .map(Path::toFile)
                            .forEach(File::delete);
                }
            }
        } catch (Exception e) {
            log.warn("Could not delete temp directory {}: {}", dir, e.getMessage());
        }
    }
}
