package com.zoroacademy;

import com.zoroacademy.dto.FeedbackMediaPublicDto;
import com.zoroacademy.dto.VideoPlaybackResponse;
import com.zoroacademy.entity.FeedbackMedia;
import com.zoroacademy.entity.StoredFile;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.repository.FeedbackMediaRepository;
import com.zoroacademy.service.BunnyStreamService;
import com.zoroacademy.service.BunnyTokenService;
import com.zoroacademy.service.FeedbackMediaService;
import com.zoroacademy.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class FeedbackMediaServiceTest {

    @Mock
    private FeedbackMediaRepository feedbackMediaRepository;

    @Mock
    private FileStorageService fileStorageService;

    @Mock
    private BunnyStreamService bunnyStreamService;

    @Mock
    private BunnyTokenService bunnyTokenService;

    private FeedbackMediaService service;

    @BeforeEach
    void setUp() {
        service = new FeedbackMediaService(feedbackMediaRepository, fileStorageService, bunnyStreamService, bunnyTokenService);
    }

    // 1. Audio rejected by extension
    @Test
    @DisplayName("Audio file rejected by extension (.mp3)")
    void testAudioRejectedByExtension() {
        byte[] bytes = new byte[]{1, 2, 3, 4, 5, 6, 7, 8};
        MockMultipartFile file = new MockMultipartFile("files", "audio.mp3", "application/octet-stream", bytes);

        assertThatThrownBy(() -> service.validateFile(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Audio files are not supported");
    }

    // 2. Audio rejected by declared content-type
    @Test
    @DisplayName("Audio file rejected by declared content-type (audio/wav)")
    void testAudioRejectedByContentType() {
        byte[] bytes = new byte[]{1, 2, 3, 4, 5, 6, 7, 8};
        MockMultipartFile file = new MockMultipartFile("files", "unknown_file.bin", "audio/wav", bytes);

        assertThatThrownBy(() -> service.validateFile(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Audio files are not supported");
    }

    // 3. Renamed audio file rejected by magic bytes (ID3 tag renamed to .jpg)
    @Test
    @DisplayName("Renamed audio file (ID3 in .jpg) rejected by magic bytes")
    void testRenamedAudioFileWithId3Rejected() {
        byte[] bytes = new byte[32];
        bytes[0] = 'I';
        bytes[1] = 'D';
        bytes[2] = '3';
        MockMultipartFile file = new MockMultipartFile("files", "photo.jpg", "image/jpeg", bytes);

        assertThatThrownBy(() -> service.validateFile(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("File signature indicates an audio file");
    }

    // 4. Renamed audio file (RIFF WAVE renamed to .mp4) rejected by magic bytes
    @Test
    @DisplayName("Renamed audio file (RIFF WAVE in .mp4) rejected by magic bytes")
    void testRenamedAudioFileWithWaveRejected() {
        byte[] bytes = new byte[32];
        bytes[0] = 'R'; bytes[1] = 'I'; bytes[2] = 'F'; bytes[3] = 'F';
        bytes[8] = 'W'; bytes[9] = 'A'; bytes[10] = 'V'; bytes[11] = 'E';
        MockMultipartFile file = new MockMultipartFile("files", "clip.mp4", "video/mp4", bytes);

        assertThatThrownBy(() -> service.validateFile(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("File signature indicates an audio file");
    }

    // 5. Oversize image (> 5 MB) rejected
    @Test
    @DisplayName("Oversize image (> 5MB) rejected")
    void testOversizeImageRejected() {
        byte[] bytes = new byte[6 * 1024 * 1024]; // 6 MB
        bytes[0] = (byte) 0xFF; bytes[1] = (byte) 0xD8; bytes[2] = (byte) 0xFF; // JPEG magic
        MockMultipartFile file = new MockMultipartFile("files", "large.jpg", "image/jpeg", bytes);

        assertThatThrownBy(() -> service.validateFile(file))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Image file size exceeds the maximum limit of 5 MB");
    }

    // 6. Valid image accepted
    @Test
    @DisplayName("Valid JPEG image accepted")
    void testValidImageAccepted() {
        byte[] bytes = new byte[1024];
        bytes[0] = (byte) 0xFF; bytes[1] = (byte) 0xD8; bytes[2] = (byte) 0xFF;
        MockMultipartFile file = new MockMultipartFile("files", "student.jpg", "image/jpeg", bytes);

        FeedbackMediaService.ValidatedMediaInfo info = service.validateFile(file);
        assertThat(info.isImage()).isTrue();
        assertThat(info.isVideo()).isFalse();
        assertThat(info.getExtension()).isEqualTo("jpg");
    }

    // 7. Valid video accepted
    @Test
    @DisplayName("Valid MP4 video accepted")
    void testValidVideoAccepted() {
        byte[] bytes = new byte[2048];
        bytes[4] = 'f'; bytes[5] = 't'; bytes[6] = 'y'; bytes[7] = 'p'; // ftyp
        MockMultipartFile file = new MockMultipartFile("files", "presentation.mp4", "video/mp4", bytes);

        FeedbackMediaService.ValidatedMediaInfo info = service.validateFile(file);
        assertThat(info.isVideo()).isTrue();
        assertThat(info.isImage()).isFalse();
        assertThat(info.getExtension()).isEqualTo("mp4");
    }

    // 8. Reorder with invalid ID set rejected
    @Test
    @DisplayName("Reorder with invalid ID set (missing/mismatched IDs) rejected")
    void testReorderWithInvalidIdsRejected() {
        FeedbackMedia m1 = new FeedbackMedia("id_1", "IMAGE", "sf_1", null, "/url1", null, "f1.jpg", "image/jpeg", 100L, 0, "READY", "admin");
        FeedbackMedia m2 = new FeedbackMedia("id_2", "IMAGE", "sf_2", null, "/url2", null, "f2.jpg", "image/jpeg", 200L, 1, "READY", "admin");
        when(feedbackMediaRepository.findAll()).thenReturn(List.of(m1, m2));

        // Pass invalid list (id_3 does not exist)
        assertThatThrownBy(() -> service.updateOrder(List.of("id_1", "id_3")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("provided IDs do not match the existing feedback media items");

        // Pass mismatched size list
        assertThatThrownBy(() -> service.updateOrder(List.of("id_1")))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("does not match existing feedback media count");
    }

    // 9. Reorder with valid ID set succeeds in exact order
    @Test
    @DisplayName("Reorder with valid ID set updates sort_order correctly")
    void testReorderSuccess() {
        FeedbackMedia m1 = new FeedbackMedia("id_1", "IMAGE", "sf_1", null, "/url1", null, "f1.jpg", "image/jpeg", 100L, 0, "READY", "admin");
        FeedbackMedia m2 = new FeedbackMedia("id_2", "IMAGE", "sf_2", null, "/url2", null, "f2.jpg", "image/jpeg", 200L, 1, "READY", "admin");
        when(feedbackMediaRepository.findAll()).thenReturn(List.of(m1, m2));
        when(feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc()).thenReturn(List.of(m2, m1));

        List<FeedbackMedia> result = service.updateOrder(List.of("id_2", "id_1"));

        assertThat(m2.getSortOrder()).isEqualTo(0);
        assertThat(m1.getSortOrder()).isEqualTo(1);
        verify(feedbackMediaRepository, times(2)).save(any(FeedbackMedia.class));
    }

    // 10. Public API returns only ready items in order
    @Test
    @DisplayName("Public API returns only READY items in sort order")
    void testPublicApiReturnsOnlyReadyItems() {
        FeedbackMedia m1 = new FeedbackMedia("id_1", "IMAGE", "sf_1", null, "/url1", null, "f1.jpg", "image/jpeg", 100L, 0, "READY", "admin");
        FeedbackMedia m2 = new FeedbackMedia("id_2", "VIDEO", null, "bunny_vid_2", null, "/thumb2.jpg", "f2.mp4", "video/mp4", 200L, 1, "READY", "admin");

        when(feedbackMediaRepository.findByStatusOrderBySortOrderAscCreatedAtAsc("READY")).thenReturn(List.of(m1, m2));

        List<FeedbackMediaPublicDto> publicItems = service.getPublishedFeedbackMedia();

        assertThat(publicItems).hasSize(2);
        assertThat(publicItems.get(0).getId()).isEqualTo("id_1");
        assertThat(publicItems.get(0).getMediaType()).isEqualTo("IMAGE");
        assertThat(publicItems.get(0).getUrl()).isEqualTo("/url1");
        assertThat(publicItems.get(1).getId()).isEqualTo("id_2");
        assertThat(publicItems.get(1).getMediaType()).isEqualTo("VIDEO");
        assertThat(publicItems.get(1).getThumbnailUrl()).isEqualTo("/thumb2.jpg");
    }

    // 11. Delete removes row and purges storage
    @Test
    @DisplayName("Delete removes row from DB and purges file from storage")
    void testDeleteRemovesRowAndPurgesStorage() {
        FeedbackMedia m1 = new FeedbackMedia("id_img", "IMAGE", "sf_stored_123", null, "/url1", null, "f1.jpg", "image/jpeg", 100L, 0, "READY", "admin");
        when(feedbackMediaRepository.findById("id_img")).thenReturn(Optional.of(m1));
        when(feedbackMediaRepository.findAllByOrderBySortOrderAscCreatedAtAsc()).thenReturn(Collections.emptyList());

        service.deleteMedia("id_img");

        verify(feedbackMediaRepository).delete(m1);
        verify(fileStorageService).deleteFile("sf_stored_123");
    }

    // 12. Playback authorization succeeds for ready video in gallery
    @Test
    @DisplayName("Playback authorization generates signed URLs for gallery video")
    void testPlaybackAuthorizationSuccess() {
        FeedbackMedia mVideo = new FeedbackMedia("id_vid", "VIDEO", null, "guid_bunny_123", null, "/thumb.jpg", "clip.mp4", "video/mp4", 500L, 0, "READY", "admin");
        when(feedbackMediaRepository.findById("id_vid")).thenReturn(Optional.of(mVideo));
        when(bunnyTokenService.generateSignedPlaybackUrl("guid_bunny_123")).thenReturn("https://vz.b-cdn.net/guid_bunny_123/playlist.m3u8?token=xyz");
        when(bunnyTokenService.generateSignedEmbedUrl("guid_bunny_123")).thenReturn("https://iframe.mediadelivery.net/embed/784226/guid_bunny_123?token=abc");

        VideoPlaybackResponse response = service.getPlaybackAuthorization("id_vid", "127.0.0.1");

        assertThat(response.isAuthorized()).isTrue();
        assertThat(response.getStreamUrl()).contains("playlist.m3u8");
        assertThat(response.getEmbedUrl()).contains("iframe.mediadelivery.net");
    }

    // 13. Playback authorization denied if media is an image
    @Test
    @DisplayName("Playback authorization denied if requested media is not a video")
    void testPlaybackAuthorizationDeniedForImage() {
        FeedbackMedia mImage = new FeedbackMedia("id_img", "IMAGE", "sf_1", null, "/url.jpg", null, "img.jpg", "image/jpeg", 500L, 0, "READY", "admin");
        when(feedbackMediaRepository.findById("id_img")).thenReturn(Optional.of(mImage));

        assertThatThrownBy(() -> service.getPlaybackAuthorization("id_img", "127.0.0.1"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("is an image, not a video");
    }
}
