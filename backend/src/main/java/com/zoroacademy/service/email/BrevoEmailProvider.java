package com.zoroacademy.service.email;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class BrevoEmailProvider implements EmailProvider {

    private static final Logger log = LoggerFactory.getLogger(BrevoEmailProvider.class);
    private static final String BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

    private final String apiKey;
    private final String senderEmail;
    private final String senderName;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public BrevoEmailProvider(
            @Value("${BREVO_API_KEY:${app.mail.brevo-api-key:}}") String apiKey,
            @Value("${EMAIL_SENDER_EMAIL:${AWS_SES_FROM_EMAIL:zorocentre@gmail.com}}") String senderEmail,
            @Value("${EMAIL_SENDER_NAME:${AWS_SES_FROM_NAME:Zoro English Academy}}") String senderName,
            ObjectMapper objectMapper) {
        this.apiKey = apiKey != null ? apiKey.trim() : "";
        this.senderEmail = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : "zorocentre@gmail.com";
        this.senderName = senderName != null && !senderName.isBlank() ? senderName.trim() : "Zoro English Academy";
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Override
    public String getProviderName() {
        return "BREVO";
    }

    @Override
    public boolean isConfigured() {
        return !apiKey.isEmpty();
    }

    @Override
    public boolean sendEmail(String to, String subject, String htmlContent, String textContent) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("Brevo API key is not configured.");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sender", Map.of("name", senderName, "email", senderEmail));
        payload.put("to", List.of(Map.of("email", to.trim())));
        payload.put("subject", subject);
        if (htmlContent != null && !htmlContent.isBlank()) {
            payload.put("htmlContent", htmlContent);
        }
        if (textContent != null && !textContent.isBlank()) {
            payload.put("textContent", textContent);
        } else if (htmlContent != null) {
            // Basic text fallback by stripping html tags
            payload.put("textContent", htmlContent.replaceAll("<[^>]*>", " ").replaceAll("\\s+", " ").trim());
        }

        String requestBody = objectMapper.writeValueAsString(payload);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BREVO_API_URL))
                .timeout(Duration.ofSeconds(15))
                .header("api-key", apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        int statusCode = response.statusCode();
        if (statusCode >= 200 && statusCode < 300) {
            log.info("Brevo email dispatched successfully to {}. Status: {}, Response: {}", to, statusCode, response.body());
            return true;
        } else {
            String errorMsg = "Brevo API returned error status " + statusCode + ": " + response.body();
            log.error(errorMsg);
            throw new RuntimeException(errorMsg);
        }
    }
}
