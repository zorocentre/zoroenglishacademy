package com.zoroacademy.controller;

import com.zoroacademy.common.ApiResponse;
import com.zoroacademy.dto.FeedbackMediaPublicDto;
import com.zoroacademy.dto.VideoPlaybackResponse;
import com.zoroacademy.entity.FeedbackMedia;
import com.zoroacademy.security.UserPrincipal;
import com.zoroacademy.service.FeedbackMediaService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
public class FeedbackMediaController {

    private final FeedbackMediaService feedbackMediaService;

    public FeedbackMediaController(FeedbackMediaService feedbackMediaService) {
        this.feedbackMediaService = feedbackMediaService;
    }

    private UserPrincipal resolvePrincipal(Object principal) {
        if (principal instanceof UserPrincipal up) {
            return up;
        }
        if (principal instanceof org.springframework.security.core.userdetails.UserDetails ud) {
            String role = ud.getAuthorities().stream()
                    .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                    .map(a -> a.replace("ROLE_", ""))
                    .findFirst().orElse("ADMIN");
            return new UserPrincipal(ud.getUsername(), ud.getUsername(), ud.getUsername(), role, "N/A", ud.getAuthorities());
        }
        return null;
    }

    /**
     * Public endpoint: Get published, ready feedback gallery media items.
     * Cached with a short max-age so admin edits appear quickly.
     */
    @GetMapping("/api/feedback-media")
    public ResponseEntity<ApiResponse<List<FeedbackMediaPublicDto>>> getPublishedFeedbackMedia() {
        List<FeedbackMediaPublicDto> items = feedbackMediaService.getPublishedFeedbackMedia();
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(5, TimeUnit.SECONDS).cachePublic())
                .body(ApiResponse.ok(items));
    }

    /**
     * Public endpoint: Rate-limited video playback authorization for gallery videos only.
     */
    @GetMapping("/api/feedback-media/{id}/playback")
    public ResponseEntity<ApiResponse<VideoPlaybackResponse>> getFeedbackVideoPlayback(
            @PathVariable String id,
            HttpServletRequest request
    ) {
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp != null && !clientIp.isBlank()) {
            clientIp = clientIp.split(",")[0].trim();
        } else {
            clientIp = request.getRemoteAddr();
        }

        VideoPlaybackResponse response = feedbackMediaService.getPlaybackAuthorization(id, clientIp);
        return ResponseEntity.ok(ApiResponse.ok(response, response.getMessage()));
    }

    /**
     * Admin endpoint: List all feedback media items (including processing/failed).
     */
    @GetMapping("/api/admin/feedback-media")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<FeedbackMedia>> getAllFeedbackMedia() {
        return ApiResponse.ok(feedbackMediaService.getAllFeedbackMedia());
    }

    /**
     * Admin endpoint: Upload one or more feedback images/videos.
     */
    @PostMapping(value = "/api/admin/feedback-media/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<FeedbackMedia>> uploadFeedbackMedia(
            @RequestParam("files") MultipartFile[] files,
            @AuthenticationPrincipal Object principal
    ) {
        UserPrincipal user = resolvePrincipal(principal);
        String ownerId = user != null ? user.getId() : null;
        List<FeedbackMedia> created = feedbackMediaService.uploadMedia(files, ownerId);
        return ApiResponse.ok(created, "Feedback media uploaded successfully");
    }

    /**
     * Admin endpoint: Reorder feedback media items in one transaction.
     * Validates that the provided ID list matches exactly the existing items in DB.
     */
    @PutMapping("/api/admin/feedback-media/order")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<List<FeedbackMedia>> updateOrder(
            @RequestBody Object payload
    ) {
        List<String> orderedIds;
        if (payload instanceof List<?> list) {
            orderedIds = list.stream().map(Object::toString).toList();
        } else if (payload instanceof Map<?, ?> map && map.containsKey("orderedIds") && map.get("orderedIds") instanceof List<?> list) {
            orderedIds = list.stream().map(Object::toString).toList();
        } else {
            throw new com.zoroacademy.exception.BadRequestException("Invalid payload: expected list of IDs or { orderedIds: [...] }");
        }

        List<FeedbackMedia> updated = feedbackMediaService.updateOrder(orderedIds);
        return ApiResponse.ok(updated, "Feedback media order updated successfully");
    }

    /**
     * Admin endpoint: Delete an item and purge from Bunny Storage / Stream.
     */
    @DeleteMapping("/api/admin/feedback-media/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<Void> deleteFeedbackMedia(@PathVariable String id) {
        feedbackMediaService.deleteMedia(id);
        return ApiResponse.ok(null, "Feedback media deleted successfully");
    }

    /**
     * Admin endpoint: Check/sync status of a processing item.
     */
    @GetMapping("/api/admin/feedback-media/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ApiResponse<FeedbackMedia> getMediaStatus(@PathVariable String id) {
        return ApiResponse.ok(feedbackMediaService.getMediaStatus(id));
    }
}
