package com.zoroacademy;

import com.zoroacademy.service.CourseService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
public class GoogleMeetUrlNormalizationTest {

    @Autowired
    private CourseService courseService;

    @Test
    @DisplayName("Normalizes Google Meet URL with redundant /meet/ prefix")
    void testNormalizeFaultyMeetUrl() {
        String input = "https://meet.google.com/meet/rks-qoss-swb";
        String normalized = courseService.normalizeMeetUrl(input);
        assertThat(normalized).isEqualTo("https://meet.google.com/rks-qoss-swb");
    }

    @Test
    @DisplayName("Preserves already correct Google Meet URL")
    void testCorrectMeetUrlUnchanged() {
        String input = "https://meet.google.com/abc-defg-hij";
        String normalized = courseService.normalizeMeetUrl(input);
        assertThat(normalized).isEqualTo("https://meet.google.com/abc-defg-hij");
    }

    @Test
    @DisplayName("Preserves query parameters during normalization")
    void testPreservesQueryParams() {
        String input = "https://meet.google.com/meet/xyz-uvwx-rst?authuser=2&pli=1";
        String normalized = courseService.normalizeMeetUrl(input);
        assertThat(normalized).isEqualTo("https://meet.google.com/xyz-uvwx-rst?authuser=2&pli=1");
    }

    @Test
    @DisplayName("Leaves non-Google-Meet URLs completely untouched")
    void testLeavesOtherHostsUntouched() {
        String zoom = "https://zoom.us/j/123456789";
        String teams = "https://teams.microsoft.com/l/meetup-join/19%3ameeting";
        assertThat(courseService.normalizeMeetUrl(zoom)).isEqualTo(zoom);
        assertThat(courseService.normalizeMeetUrl(teams)).isEqualTo(teams);
    }

    @Test
    @DisplayName("Validates Google Meet format correctly")
    void testIsValidGoogleMeetUrl() {
        assertThat(courseService.isValidGoogleMeetUrl("https://meet.google.com/abc-defg-hij")).isTrue();
        assertThat(courseService.isValidGoogleMeetUrl("https://meet.google.com/meet/abc-defg-hij")).isTrue();
        assertThat(courseService.isValidGoogleMeetUrl("https://invalid.com/abc-defg-hij")).isFalse();
        assertThat(courseService.isValidGoogleMeetUrl(null)).isFalse();
        assertThat(courseService.isValidGoogleMeetUrl("")).isFalse();
    }
}
