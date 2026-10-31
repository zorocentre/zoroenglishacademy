package com.zoroacademy.service;

import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.event.StorageFilePurgeEvent;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.StoredFileRepository;
import com.zoroacademy.service.storage.StorageProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.util.*;

@Service
public class FileStorageService {

    private final StoredFileRepository storedFileRepository;
    private final StorageProvider storageProvider;
    private final BunnyTokenService bunnyTokenService;
    private final ApplicationEventPublisher eventPublisher;
    private final DocumentConversionService documentConversionService;
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(FileStorageService.class);

    @Value("${jwt.secret:defaultSecretForFileLinksOnlyNotForJwtAuthKey123}")
    private String linkSecret;

    // Size limits by category (C3)
    private static final long MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
    private static final long MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB
    private static final long MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB
    private static final long MAX_SUBMISSION_SIZE = 25 * 1024 * 1024; // 25 MB
    private static final long MAX_PUBLIC_DOC_SIZE = 10 * 1024 * 1024; // 10 MB
    private static final long MAX_DOC_SIZE = 50 * 1024 * 1024; // 50 MB

    private static final Set<String> IMAGE_CATEGORIES = Set.of(
            "image", "images", "avatar", "thumbnail", "banner", "profile", "hero"
    );

    private static final Set<String> PUBLIC_CATEGORIES = Set.of(
            "avatar", "thumbnail", "banner", "profile", "public", "image", "images", "public-document", "hero",
            "question-media", "audio", "audio-prompt", "competition", "syllabus", "guidance"
    );

    @Autowired
    public FileStorageService(
            StoredFileRepository storedFileRepository,
            StorageProvider storageProvider,
            @Autowired(required = false) BunnyTokenService bunnyTokenService,
            @Autowired(required = false) ApplicationEventPublisher eventPublisher,
            @Autowired(required = false) DocumentConversionService documentConversionService
    ) {
        this.storedFileRepository = storedFileRepository;
        this.storageProvider = storageProvider;
        this.bunnyTokenService = bunnyTokenService;
        this.eventPublisher = eventPublisher;
        this.documentConversionService = documentConversionService;
    }

    public StoredFile storeFile(MultipartFile file, String category, String ownerId) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Failed to store empty file.");
        }

        String normCategory = (category != null ? category.trim().toLowerCase(Locale.ROOT) : "document");
        boolean isImage = IMAGE_CATEGORIES.contains(normCategory);

        // Size limit check per category (Requirement C3)
        long size = file.getSize();
        if ("public-document".equals(normCategory)) {
            if (size > MAX_PUBLIC_DOC_SIZE) {
                throw new BadRequestException("Public document file size exceeds maximum limit of 10 MB.");
            }
        } else if (isImage) {
            if (size > MAX_IMAGE_SIZE) {
                throw new BadRequestException("Image file size exceeds maximum limit of 5 MB.");
            }
        } else if ("audio".equals(normCategory) || "audio-recording".equals(normCategory)) {
            if (size > MAX_AUDIO_SIZE) {
                throw new BadRequestException("Audio file size exceeds maximum limit of 25 MB.");
            }
        } else if ("video".equals(normCategory) || "video-recording".equals(normCategory)) {
            if (size > MAX_VIDEO_SIZE) {
                throw new BadRequestException("Video file size exceeds maximum limit of 500 MB.");
            }
        } else if ("assignment-submission".equals(normCategory) || "submission".equals(normCategory)) {
            if (size > MAX_SUBMISSION_SIZE) {
                throw new BadRequestException("Submission file size exceeds maximum limit of 25 MB.");
            }
        } else if (size > MAX_DOC_SIZE) {
            throw new BadRequestException("Document file size exceeds maximum limit of 50 MB.");
        }

        // Magic bytes & type validation
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null) {
            originalFilename = "uploaded_file";
        }
        originalFilename = Paths.get(originalFilename).getFileName().toString();

        byte[] headerBytes = new byte[16];
        try (InputStream is = file.getInputStream()) {
            int read = is.read(headerBytes);
            if (read <= 0) {
                throw new BadRequestException("File is empty or unreadable.");
            }
        } catch (IOException e) {
            throw new BadRequestException("Failed to read file header: " + e.getMessage());
        }

        validateMagicBytes(headerBytes, originalFilename, normCategory, isImage);

        byte[] fileBytes;
        try {
            fileBytes = file.getBytes();
        } catch (IOException e) {
            throw new RuntimeException("Failed to read file bytes: " + e.getMessage(), e);
        }

        // Automatic PPT/PPTX/Office document conversion to PDF (Section 9b)
        if (documentConversionService != null && documentConversionService.isConvertibleOfficeDocument(originalFilename)) {
            var conversion = documentConversionService.convertToPdfIfApplicable(fileBytes, originalFilename);
            if (conversion != null) {
                fileBytes = conversion.getPdfBytes();
                originalFilename = conversion.getPdfFilename();
                size = (long) fileBytes.length;
            }
        }

        String ext = getFileExtension(originalFilename);

        // Image compression and resize (Requirement C3)
        if (isImage) {
            byte[] processed = compressAndResizeImage(fileBytes, ext, normCategory);
            if (processed != null && processed.length > 0) {
                fileBytes = processed;
                size = (long) fileBytes.length;
            }
        }

        // Calculate SHA-256 for deduplication (Requirement C4)
        String sha256 = computeSha256(fileBytes);

        // Deduplication check: if identical content from same owner exists, increment ref_count and reuse
        // Voice answers / recordings are never deduplicated across attempts to prevent cross-attempt collisions and dangling refs
        boolean isVoiceCategory = normCategory.contains("voice") || normCategory.contains("audio-recording");
        Optional<StoredFile> existingFileOpt = Optional.empty();
        if (!isVoiceCategory) {
            if (ownerId != null && !ownerId.isBlank()) {
                existingFileOpt = storedFileRepository.findFirstBySha256HashAndOwnerId(sha256, ownerId);
            }
            if (existingFileOpt.isEmpty()) {
                existingFileOpt = storedFileRepository.findFirstBySha256Hash(sha256);
            }

            if (existingFileOpt.isPresent()) {
                StoredFile existing = existingFileOpt.get();
                existing.setRefCount((existing.getRefCount() != null ? existing.getRefCount() : 1) + 1);
                return storedFileRepository.save(existing);
            }
        }

        // Determine public status and partition storage path
        boolean isPublic = PUBLIC_CATEGORIES.contains(normCategory);
        String prefix = isPublic ? "public" : "private";

        String fileId = UUID.randomUUID().toString();
        String storedFilename = isVoiceCategory 
                ? fileId + "_" + System.currentTimeMillis() + (ext.isEmpty() ? "" : "." + ext)
                : fileId + (ext.isEmpty() ? "" : "." + ext);
        String storagePath = prefix + "/" + normCategory + "/" + storedFilename;

        String contentType = file.getContentType();
        if ("public-document".equals(normCategory) || "pdf".equalsIgnoreCase(ext)) {
            contentType = "application/pdf";
        } else if ("mp3".equalsIgnoreCase(ext)) {
            contentType = "audio/mpeg";
        } else if ("mp4".equalsIgnoreCase(ext)) {
            contentType = "video/mp4";
        } else if ("docx".equalsIgnoreCase(ext)) {
            contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        } else if ("doc".equalsIgnoreCase(ext)) {
            contentType = "application/msword";
        } else if (contentType == null || contentType.isBlank()) {
            contentType = isImage ? "image/" + (ext.isEmpty() ? "jpeg" : ext) : "application/octet-stream";
        }

        storageProvider.store(storagePath, fileBytes, contentType);

        StoredFile storedFile = new StoredFile(
                fileId,
                originalFilename,
                contentType,
                size,
                normCategory,
                ownerId,
                storagePath,
                isPublic,
                sha256,
                1
        );

        return storedFileRepository.save(storedFile);
    }

    public StoredFile storeRawBytes(byte[] data, String originalName, String category, String contentType, String ownerId) {
        if (data == null || data.length == 0) {
            return null;
        }

        // Automatic PPT/PPTX/Office document conversion to PDF (Section 9b)
        if (documentConversionService != null && documentConversionService.isConvertibleOfficeDocument(originalName)) {
            var conversion = documentConversionService.convertToPdfIfApplicable(data, originalName);
            if (conversion != null) {
                data = conversion.getPdfBytes();
                originalName = conversion.getPdfFilename();
                contentType = "application/pdf";
            }
        }

        String normCategory = (category != null ? category.trim().toLowerCase(Locale.ROOT) : "document");
        boolean isImage = IMAGE_CATEGORIES.contains(normCategory);
        String ext = getFileExtension(originalName);

        // Compress image if applicable
        if (isImage) {
            byte[] processed = compressAndResizeImage(data, ext, normCategory);
            if (processed != null && processed.length > 0) {
                data = processed;
            }
        }

        // SHA-256 deduplication
        String sha256 = computeSha256(data);
        Optional<StoredFile> existingFileOpt = Optional.empty();
        if (ownerId != null && !ownerId.isBlank()) {
            existingFileOpt = storedFileRepository.findFirstBySha256HashAndOwnerId(sha256, ownerId);
        }
        if (existingFileOpt.isEmpty()) {
            existingFileOpt = storedFileRepository.findFirstBySha256Hash(sha256);
        }

        if (existingFileOpt.isPresent()) {
            StoredFile existing = existingFileOpt.get();
            existing.setRefCount((existing.getRefCount() != null ? existing.getRefCount() : 1) + 1);
            return storedFileRepository.save(existing);
        }

        boolean isPublic = PUBLIC_CATEGORIES.contains(normCategory);
        String prefix = isPublic ? "public" : "private";

        String fileId = UUID.randomUUID().toString();
        String storedFilename = fileId + (ext.isEmpty() ? "" : "." + ext);
        String storagePath = prefix + "/" + normCategory + "/" + storedFilename;

        String effectiveContentType = (contentType != null && !contentType.isBlank()) ? contentType : "application/octet-stream";

        storageProvider.store(storagePath, data, effectiveContentType);

        StoredFile storedFile = new StoredFile(
                fileId,
                originalName,
                effectiveContentType,
                (long) data.length,
                normCategory,
                ownerId,
                storagePath,
                isPublic,
                sha256,
                1
        );

        return storedFileRepository.save(storedFile);
    }

    public StoredFile getFileMetadata(String id) {
        return storedFileRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("File not found with id: " + id));
    }

    public void ensureConvertedToPdfIfOfficeDocument(StoredFile storedFile) {
        if (storedFile == null || documentConversionService == null) return;
        String origName = storedFile.getOriginalName();
        if (origName == null || !documentConversionService.isConvertibleOfficeDocument(origName)) return;
        if ("application/pdf".equalsIgnoreCase(storedFile.getContentType()) || origName.toLowerCase().endsWith(".pdf")) return;

        try {
            Resource res = storageProvider.loadAsResource(storedFile.getStoragePath());
            if (res == null || !res.exists()) return;
            byte[] origBytes;
            try (InputStream in = res.getInputStream()) {
                origBytes = in.readAllBytes();
            }
            if (origBytes == null || origBytes.length == 0) return;
            var conversion = documentConversionService.convertToPdfIfApplicable(origBytes, origName);
            if (conversion != null && conversion.getPdfBytes() != null && conversion.getPdfBytes().length > 0) {
                String oldPath = storedFile.getStoragePath();
                String newPath = oldPath.replaceFirst("\\.[^.]+$", ".pdf");
                if (newPath.equals(oldPath)) {
                    newPath = oldPath + ".pdf";
                }
                storageProvider.store(newPath, conversion.getPdfBytes(), "application/pdf");
                storedFile.setStoragePath(newPath);
                storedFile.setContentType("application/pdf");
                storedFile.setOriginalName(conversion.getPdfFilename());
                storedFile.setSizeBytes((long) conversion.getPdfBytes().length);
                storedFileRepository.save(storedFile);
                log.info("Lazy-converted office document id='{}' ({}) to PDF ({})", storedFile.getId(), origName, newPath);
            }
        } catch (Exception e) {
            log.warn("Failed lazy conversion of document id='{}' to PDF: {}", storedFile.getId(), e.getMessage());
        }
    }

    public Resource loadFileAsResource(StoredFile storedFile) {
        ensureConvertedToPdfIfOfficeDocument(storedFile);
        return storageProvider.loadAsResource(storedFile.getStoragePath());
    }

    /**
     * Deletes a file with reference-counting protection (Requirement C1 & C4).
     * If ref_count > 1, decrements count and keeps storage file.
     * When ref_count <= 1, removes DB record and triggers post-commit Bunny storage purge.
     */
    public void deleteFile(String id) {
        if (id == null || id.isBlank()) return;
        StoredFile storedFile = storedFileRepository.findById(id).orElse(null);
        if (storedFile == null) return;

        int currentRef = storedFile.getRefCount() != null ? storedFile.getRefCount() : 1;
        if (currentRef > 1) {
            storedFile.setRefCount(currentRef - 1);
            storedFileRepository.save(storedFile);
            return;
        }

        String storagePath = storedFile.getStoragePath();
        storedFileRepository.delete(storedFile);

        // Check if any other records share the exact same storage path
        if (storedFileRepository.countByStoragePath(storagePath) == 0) {
            if (eventPublisher != null) {
                eventPublisher.publishEvent(new StorageFilePurgeEvent(storagePath));
            } else {
                try {
                    storageProvider.delete(storagePath);
                } catch (Exception ignored) {}
            }
        }
    }

    /**
     * Resolves the primary URL for a stored file.
     * Public files return CDN URL if available, else backend relative endpoint /api/files/{id}.
     * Private files return backend relative endpoint /api/files/{id}.
     */
    public String getFileUrl(StoredFile storedFile) {
        if (storedFile == null) return null;
        if (Boolean.TRUE.equals(storedFile.getIsPublic())) {
            String publicUrl = storageProvider.getPublicUrl(storedFile.getStoragePath());
            if (publicUrl != null && !publicUrl.isBlank() && !publicUrl.contains("b-cdn.net")) {
                return publicUrl;
            }
        }
        return "/api/files/" + storedFile.getId();
    }

    /**
     * Generates a signed access link for private files with time-based expiration.
     */
    public Map<String, Object> generateFileLink(StoredFile storedFile, long expirationSeconds) {
        ensureConvertedToPdfIfOfficeDocument(storedFile);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", storedFile.getId());
        result.put("name", storedFile.getOriginalName());
        result.put("contentType", storedFile.getContentType());
        result.put("size", storedFile.getSizeBytes());
        result.put("isPublic", storedFile.getIsPublic());

        long expiresAt = (System.currentTimeMillis() / 1000) + expirationSeconds;

        // Guaranteed secure signed link flow: generate an internal HMAC token bound to fileId and expiry
        // so that <audio>, <video>, <img>, <iframe>, and new tabs can access the backend streaming endpoint
        // reliably without requiring an Authorization header (Rule 5 & Task K5).
        String token = generateInternalToken(storedFile.getId(), expiresAt);
        result.put("url", "/api/files/" + storedFile.getId() + "?token=" + token + "&expires=" + expiresAt);
        result.put("expiresAt", expiresAt);
        return result;
    }

    public boolean validateInternalToken(String fileId, String token, Long expires) {
        if (fileId == null || token == null || expires == null) return false;
        long now = System.currentTimeMillis() / 1000;
        if (now > expires) return false;

        String expected = generateInternalToken(fileId, expires);
        return expected.equals(token);
    }

    private String generateInternalToken(String fileId, long expires) {
        try {
            String data = fileId + ":" + expires;
            Mac hmac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(linkSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            hmac.init(secretKey);
            byte[] hash = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Error calculating internal link token", e);
        }
    }

    public static String computeSha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(data);
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        }
    }

    /**
     * Compress images and downscale if max dimension > 1600px with ~80% JPEG quality.
     */
    private byte[] compressAndResizeImage(byte[] imageBytes, String ext, String category) {
        if (imageBytes == null || imageBytes.length == 0) return imageBytes;
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(imageBytes);
            java.awt.image.BufferedImage original = javax.imageio.ImageIO.read(bais);
            if (original == null) {
                return imageBytes;
            }

            int width = original.getWidth();
            int height = original.getHeight();
            boolean needsResize = width > 1600 || height > 1600;
            boolean isCompressedCategory = "avatar".equals(category) || "thumbnail".equals(category) || "banner".equals(category) || "profile".equals(category);

            if (!needsResize && !isCompressedCategory && imageBytes.length <= 1024 * 1024) {
                return imageBytes;
            }

            int targetWidth = width;
            int targetHeight = height;
            if (needsResize) {
                if (width > height) {
                    targetWidth = 1600;
                    targetHeight = Math.max(1, (int) Math.round((double) height * 1600.0 / width));
                } else {
                    targetHeight = 1600;
                    targetWidth = Math.max(1, (int) Math.round((double) width * 1600.0 / height));
                }
            }

            java.awt.image.BufferedImage resized = new java.awt.image.BufferedImage(targetWidth, targetHeight, java.awt.image.BufferedImage.TYPE_INT_RGB);
            java.awt.Graphics2D g2d = resized.createGraphics();
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_RENDERING, java.awt.RenderingHints.VALUE_RENDER_QUALITY);
            g2d.setRenderingHint(java.awt.RenderingHints.KEY_ANTIALIASING, java.awt.RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setColor(java.awt.Color.WHITE);
            g2d.fillRect(0, 0, targetWidth, targetHeight);
            g2d.drawImage(original, 0, 0, targetWidth, targetHeight, null);
            g2d.dispose();

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            Iterator<javax.imageio.ImageWriter> writers = javax.imageio.ImageIO.getImageWritersByFormatName("jpg");
            if (writers.hasNext()) {
                javax.imageio.ImageWriter writer = writers.next();
                try (javax.imageio.stream.ImageOutputStream ios = javax.imageio.ImageIO.createImageOutputStream(baos)) {
                    writer.setOutput(ios);
                    javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
                    if (param.canWriteCompressed()) {
                        param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
                        param.setCompressionQuality(0.80f);
                    }
                    writer.write(null, new javax.imageio.IIOImage(resized, null, null), param);
                } finally {
                    writer.dispose();
                }
                byte[] compressed = baos.toByteArray();
                if (compressed.length < imageBytes.length || needsResize) {
                    return compressed;
                }
            }
        } catch (Exception ignored) {}
        return imageBytes;
    }

    private void validateMagicBytes(byte[] header, String originalFilename, String category, boolean requireImage) {
        String ext = getFileExtension(originalFilename).toLowerCase(Locale.ROOT);

        boolean isJpg = header.length >= 3 && (header[0] & 0xFF) == 0xFF && (header[1] & 0xFF) == 0xD8 && (header[2] & 0xFF) == 0xFF;
        boolean isPng = header.length >= 4 && (header[0] & 0xFF) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G';
        boolean isWebp = header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F'
                && header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P';

        boolean isPdf = header.length >= 4 && header[0] == '%' && header[1] == 'P' && header[2] == 'D' && header[3] == 'F';
        boolean isZipOrOfficeXml = header.length >= 4 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04;
        boolean isOle2Office = header.length >= 4 && (header[0] & 0xFF) == 0xD0 && (header[1] & 0xFF) == 0xCF && (header[2] & 0xFF) == 0x11 && (header[3] & 0xFF) == 0xE0;

        if ("public-document".equals(category)) {
            if (!isPdf) {
                throw new BadRequestException("File header does not match valid PDF format (%PDF-).");
            }
            if (!"pdf".equals(ext)) {
                throw new BadRequestException("File extension must be .pdf for public documents.");
            }
        } else if (requireImage) {
            if (!isJpg && !isPng && !isWebp) {
                if (!Set.of("jpg", "jpeg", "png", "webp", "gif").contains(ext)) {
                    throw new BadRequestException("Uploaded file header does not match valid image format (JPEG, PNG, WEBP).");
                }
            }
        } else {
            boolean isOgg = header.length >= 4 && header[0] == 'O' && header[1] == 'g' && header[2] == 'g' && header[3] == 'S';
            boolean isAudioOrVideo = (header.length >= 3 && header[0] == 'I' && header[1] == 'D' && header[2] == '3')
                    || (header.length >= 2 && (header[0] & 0xFF) == 0xFF && (header[1] & 0xE0) == 0xE0)
                    || (header.length >= 8 && header[4] == 'f' && header[5] == 't' && header[6] == 'y' && header[7] == 'p')
                    || (header.length >= 4 && (header[0] & 0xFF) == 0x1A && (header[1] & 0xFF) == 0x45 && (header[2] & 0xFF) == 0xDF && (header[3] & 0xFF) == 0xA3)
                    || (header.length >= 12 && header[0] == 'R' && header[1] == 'I' && header[2] == 'F' && header[3] == 'F' && header[8] == 'W' && header[9] == 'A' && header[10] == 'V' && header[11] == 'E')
                    || isOgg;

            boolean isValidDoc = isPdf || isZipOrOfficeXml || isOle2Office || isJpg || isPng || isWebp || isAudioOrVideo
                    || Set.of("pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "csv", "json",
                              "mp3", "mp4", "wav", "webm", "m4a", "ogg", "opus", "mov", "avi", "mkv").contains(ext);
            if (!isValidDoc) {
                throw new BadRequestException("Invalid or unsupported file format: " + ext);
            }
        }
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dotIdx = filename.lastIndexOf('.');
        return (dotIdx >= 0 && dotIdx < filename.length() - 1) ? filename.substring(dotIdx + 1) : "";
    }
}
