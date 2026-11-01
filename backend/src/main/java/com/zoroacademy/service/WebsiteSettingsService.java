package com.zoroacademy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.zoroacademy.entity.WebsiteSettings;
import com.zoroacademy.repository.WebsiteSettingsRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WebsiteSettingsService {

    private static final Logger log = LoggerFactory.getLogger(WebsiteSettingsService.class);

    private static final String DEFAULT_SETTINGS_JSON = "{"
            + "\"landingPageContent\":{"
            + "\"heroBadge\":\"Learn Today. Grow Tomorrow.\","
            + "\"heroHeading\":\"Skills for a Brighter Tomorrow\","
            + "\"heroDescription\":\"Build skills. Boost confidence. Unlock potential through world-class interactive live classes tailored for children aged 5 to 16.\","
            + "\"heroPrimaryBtnText\":\"Explore Courses\","
            + "\"heroSecondaryBtnText\":\"Join a Competition\","
            + "\"featuresTitle\":\"Featured Learning Programs\","
            + "\"featuresSubtitle\":\"Empowering children with lifelong cognitive abilities and practical skills.\","
            + "\"spotlightTitle\":\"National Championship & Competitions Spotlight\","
            + "\"spotlightSubtitle\":\"Participate in nationwide academic showdowns and win certificates and badges.\""
            + "},"
            + "\"aboutPageContent\":{"
            + "\"heading\":\"About Zoro English Academy\","
            + "\"subtitle\":\"Nurturing Young Minds Through Small Steps and Big Communication.\","
            + "\"introParagraph\":\"Zoro English Academy is dedicated to empowering students with exceptional communication, phonics, grammar, public speaking, and analytical skills. Our structured curriculum and passionate educators ensure every child steps forward with confidence.\","
            + "\"missionStatement\":\"To make world-class skill development accessible, engaging, and transformative for every child.\","
            + "\"visionStatement\":\"Creating a global generation of articulate, confident, and empathetic leaders of tomorrow.\","
            + "\"coreValues\":\"Excellence, Continuous Growth, Integrity, Student-Centric Empathy\""
            + "},"
            + "\"contactPageContent\":{"
            + "\"heading\":\"Contact Us\","
            + "\"subtitle\":\"We are here to support your child's learning journey. Get in touch with our team.\","
            + "\"contactPhone\":\"+91 98765 43210\","
            + "\"contactEmail\":\"contact@zoroacademy.com\","
            + "\"contactAddress\":\"No. 12, Main Road, Skill Nagar, Chennai - 600001, Tamil Nadu, India\","
            + "\"businessHours\":\"Monday – Saturday: 9:00 AM – 7:00 PM IST\","
            + "\"googleMapLink\":\"https://maps.google.com\""
            + "},"
            + "\"generalInfo\":{"
            + "\"academyName\":\"Zoro English Academy\","
            + "\"tagline\":\"Small Steps Big Communication\","
            + "\"contactEmail\":\"contact@zoroacademy.com\","
            + "\"contactPhone\":\"+91 98765 43210\","
            + "\"address\":\"No. 12, Main Road, Skill Nagar, Chennai - 600001\","
            + "\"currency\":\"INR (₹)\""
            + "}"
            + "}";

    private final WebsiteSettingsRepository settingsRepository;
    private final ObjectMapper objectMapper;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired
    public WebsiteSettingsService(WebsiteSettingsRepository settingsRepository,
                                  ObjectMapper objectMapper,
                                  @org.springframework.beans.factory.annotation.Autowired(required = false) ActivityLogService activityLogService) {
        this.settingsRepository = settingsRepository;
        this.objectMapper = objectMapper;
        this.activityLogService = activityLogService;
    }

    public WebsiteSettingsService(WebsiteSettingsRepository settingsRepository, ObjectMapper objectMapper) {
        this(settingsRepository, objectMapper, null);
    }

    @Transactional(readOnly = true)
    public WebsiteSettings getSettings() {
        return settingsRepository.findById("default")
                .map(this::ensureCompleteSettings)
                .orElseGet(this::createDefaultSettings);
    }

    private WebsiteSettings createDefaultSettings() {
        WebsiteSettings defaults = WebsiteSettings.builder()
                .id("default")
                .heroHeadline("Skills for a Brighter Tomorrow")
                .heroSubheadline("Build skills. Boost confidence. Unlock potential through world-class interactive live classes tailored for children aged 5 to 16.")
                .contactEmail("contact@zoroacademy.com")
                .contactPhone("+91 98765 43210")
                .address("No. 12, Main Road, Skill Nagar, Chennai - 600001, Tamil Nadu, India")
                .bannerAnnouncement("🎉 Admissions open for new batches! Enroll now for early bird discount.")
                .settingsJson(DEFAULT_SETTINGS_JSON)
                .build();
        try {
            return settingsRepository.save(defaults);
        } catch (Exception e) {
            log.warn("Could not persist default website settings on first read: {}", e.getMessage());
            return defaults;
        }
    }

    private WebsiteSettings ensureCompleteSettings(WebsiteSettings settings) {
        String existingJson = settings.getSettingsJson();
        if (existingJson == null || existingJson.trim().isEmpty()) {
            settings.setSettingsJson(DEFAULT_SETTINGS_JSON);
            return settings;
        }

        try {
            JsonNode defaultTree = objectMapper.readTree(DEFAULT_SETTINGS_JSON);
            JsonNode existingTree = objectMapper.readTree(existingJson);
            if (existingTree.isObject() && defaultTree.isObject()) {
                ObjectNode merged = ((ObjectNode) defaultTree).deepCopy();
                mergeJsonNodes(merged, (ObjectNode) existingTree);
                settings.setSettingsJson(objectMapper.writeValueAsString(merged));
            }
        } catch (Exception e) {
            log.warn("Failed to merge website settings with defaults: {}", e.getMessage());
        }
        return settings;
    }

    private void mergeJsonNodes(ObjectNode target, ObjectNode source) {
        source.fieldNames().forEachRemaining(fieldName -> {
            JsonNode sourceVal = source.get(fieldName);
            JsonNode targetVal = target.get(fieldName);
            if (targetVal != null && targetVal.isObject() && sourceVal.isObject()) {
                mergeJsonNodes((ObjectNode) targetVal, (ObjectNode) sourceVal);
            } else {
                target.set(fieldName, sourceVal);
            }
        });
    }

    @Transactional
    public WebsiteSettings updateSettings(WebsiteSettings updated) {
        WebsiteSettings settings = settingsRepository.findById("default").orElseGet(this::createDefaultSettings);

        if (updated.getHeroHeadline() != null) settings.setHeroHeadline(updated.getHeroHeadline());
        if (updated.getHeroSubheadline() != null) settings.setHeroSubheadline(updated.getHeroSubheadline());
        if (updated.getContactEmail() != null) settings.setContactEmail(updated.getContactEmail());
        if (updated.getContactPhone() != null) settings.setContactPhone(updated.getContactPhone());
        if (updated.getAddress() != null) settings.setAddress(updated.getAddress());
        if (updated.getBannerAnnouncement() != null) settings.setBannerAnnouncement(updated.getBannerAnnouncement());

        if (updated.getSettingsJson() != null && !updated.getSettingsJson().trim().isEmpty()) {
            try {
                String existingJson = settings.getSettingsJson();
                if (existingJson != null && !existingJson.trim().isEmpty()) {
                    JsonNode currentTree = objectMapper.readTree(existingJson);
                    JsonNode newTree = objectMapper.readTree(updated.getSettingsJson());
                    if (currentTree.isObject() && newTree.isObject()) {
                        ObjectNode merged = ((ObjectNode) currentTree).deepCopy();
                        mergeJsonNodes(merged, (ObjectNode) newTree);
                        settings.setSettingsJson(objectMapper.writeValueAsString(merged));
                    } else {
                        settings.setSettingsJson(updated.getSettingsJson());
                    }
                } else {
                    settings.setSettingsJson(updated.getSettingsJson());
                }
            } catch (Exception e) {
                log.warn("Failed to merge updated settingsJson: {}", e.getMessage());
                settings.setSettingsJson(updated.getSettingsJson());
            }
        }

        WebsiteSettings saved = settingsRepository.save(settings);
        if (activityLogService != null) {
            activityLogService.logAction(
                null,
                null,
                "SETTINGS",
                "UPDATE_SETTINGS",
                "Updated website and academy settings",
                null
            );
        }
        return saved;
    }
}
