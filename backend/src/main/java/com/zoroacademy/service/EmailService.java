package com.zoroacademy.service;

import com.zoroacademy.entity.Competition;
import com.zoroacademy.entity.CompetitionRegistration;
import com.zoroacademy.entity.Enquiry;
import com.zoroacademy.service.email.BrevoEmailProvider;
import com.zoroacademy.service.email.EmailProvider;
import com.zoroacademy.service.email.SesEmailProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.ITemplateEngine;
import org.thymeleaf.context.Context;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final BrevoEmailProvider brevoProvider;
    private final SesEmailProvider sesProvider;
    private final ITemplateEngine templateEngine;

    @Value("${EMAIL_PROVIDER:${app.mail.provider:}}")
    private String preferredProvider;

    @Value("${app.frontend.url:https://zoroenglish.com}")
    private String frontendUrl;

    @Autowired
    public EmailService(
            BrevoEmailProvider brevoProvider,
            SesEmailProvider sesProvider,
            ITemplateEngine templateEngine) {
        this.brevoProvider = brevoProvider;
        this.sesProvider = sesProvider;
        this.templateEngine = templateEngine;
    }

    /**
     * Resolves the active email provider based on configuration priority:
     * 1. Explicit override via EMAIL_PROVIDER (brevo | ses)
     * 2. Brevo (if BREVO_API_KEY is configured)
     * 3. AWS SES (if AWS_SES_HOST is configured)
     */
    public EmailProvider getActiveProvider() {
        String pref = preferredProvider != null ? preferredProvider.trim().toLowerCase() : "";
        if ("brevo".equals(pref)) {
            return brevoProvider;
        } else if ("ses".equals(pref)) {
            return sesProvider;
        }

        if (brevoProvider != null && brevoProvider.isConfigured()) {
            return brevoProvider;
        }
        if (sesProvider != null && sesProvider.isConfigured()) {
            return sesProvider;
        }
        return null;
    }

    public boolean isMailConfigured() {
        EmailProvider provider = getActiveProvider();
        return provider != null && provider.isConfigured();
    }

    /**
     * Core send method with automatic single retry and safe failure handling.
     */
    public boolean sendEmail(String to, String subject, String htmlContent, String textContent) {
        if (to == null || to.isBlank()) {
            log.warn("Cannot send email: recipient address is empty.");
            return false;
        }

        EmailProvider provider = getActiveProvider();
        if (provider == null || !provider.isConfigured()) {
            log.info("Email service not configured (neither Brevo nor AWS SES); skipping email to '{}' with subject '{}'", to, subject);
            return false;
        }

        String providerName = provider.getProviderName();
        try {
            log.info("Attempting to send email via {} to '{}' [Subject: '{}']", providerName, to, subject);
            return provider.sendEmail(to, subject, htmlContent, textContent);
        } catch (Exception primaryEx) {
            log.warn("Primary attempt failed sending email via {} to '{}': {}. Retrying once...", providerName, to, primaryEx.getMessage());
            try {
                // Single retry attempt
                Thread.sleep(1000);
                return provider.sendEmail(to, subject, htmlContent, textContent);
            } catch (Exception retryEx) {
                log.error("Failed to send email via {} to '{}' after retry: {}", providerName, to, retryEx.getMessage(), retryEx);
                return false;
            }
        }
    }

    // =========================================================================
    // 1. COMPETITION REGISTRATION SUCCESS & PAYMENT RECEIPT (Sent only after payment SUCCESS)
    // =========================================================================
    @Async
    public void sendCompetitionRegistrationSuccess(
            String email,
            String name,
            String plainPassword,
            String competitionTitle,
            String paymentId,
            String amount,
            String date) {
        if (email == null || email.isBlank()) return;

        try {
            Context context = new Context();
            context.setVariable("name", name != null && !name.isBlank() ? name : "Participant");
            context.setVariable("email", email.trim());
            context.setVariable("plainPassword", plainPassword);
            context.setVariable("competitionTitle", competitionTitle != null ? competitionTitle : "Competition");
            context.setVariable("paymentId", paymentId != null ? paymentId : "N/A");
            context.setVariable("amount", amount != null ? amount : "₹199");
            context.setVariable("date", date != null && !date.isBlank() ? date : "Recent");
            context.setVariable("loginUrl", frontendUrl + "/login");
            context.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("email/competition-registration-success", context);
            String subject = "Payment Confirmed & Competition Credentials - " + (competitionTitle != null ? competitionTitle : "Zoro English Academy");
            sendEmail(email.trim(), subject, html, null);
        } catch (Exception e) {
            log.error("Error creating competition registration success email for {}: {}", email, e.getMessage());
        }
    }

    // =========================================================================
    // 2. ADMIN ADDS A STUDENT (Welcome + Enrolled Courses + Credentials)
    // =========================================================================
    @Async
    public void sendStudentWelcomeEmail(String email, String name, String plainPassword, List<String> enrolledCourses) {
        if (email == null || email.isBlank()) return;

        try {
            Context context = new Context();
            context.setVariable("name", name != null && !name.isBlank() ? name : "Student");
            context.setVariable("email", email.trim());
            context.setVariable("plainPassword", plainPassword);
            context.setVariable("courses", (enrolledCourses != null && !enrolledCourses.isEmpty()) ? String.join(", ", enrolledCourses) : "");
            context.setVariable("loginUrl", frontendUrl + "/login");
            context.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("email/student-welcome", context);
            String subject = "Welcome to Zoro English Academy - Your Student Portal Account";
            sendEmail(email.trim(), subject, html, null);
        } catch (Exception e) {
            log.error("Error creating student welcome email for {}: {}", email, e.getMessage());
        }
    }

    @Async
    public void sendStudentWelcomeEmail(String email, String name, String plainPassword) {
        sendStudentWelcomeEmail(email, name, plainPassword, Collections.emptyList());
    }

    // =========================================================================
    // 3. ADMIN ADDS A TRAINER (Welcome + Role Info + Credentials)
    // =========================================================================
    @Async
    public void sendTrainerWelcomeEmail(String email, String name, String plainPassword, String specialty) {
        if (email == null || email.isBlank()) return;

        try {
            Context context = new Context();
            context.setVariable("name", name != null && !name.isBlank() ? name : "Trainer");
            context.setVariable("email", email.trim());
            context.setVariable("plainPassword", plainPassword);
            context.setVariable("specialty", specialty);
            context.setVariable("loginUrl", frontendUrl + "/login");
            context.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("email/trainer-welcome", context);
            String subject = "Welcome to Zoro English Academy Faculty - Your Account Details";
            sendEmail(email.trim(), subject, html, null);
        } catch (Exception e) {
            log.error("Error creating trainer welcome email for {}: {}", email, e.getMessage());
        }
    }

    public void sendTrainerWelcomeEmail(String email, String name, String plainPassword) {
        sendTrainerWelcomeEmail(email, name, plainPassword, null);
    }

    // =========================================================================
    // 4. ADMIN UPDATES STUDENT OR TRAINER RECORD (Changed Fields, Password only if reset)
    // =========================================================================
    @Async
    public void sendProfileUpdatedEmail(String email, String name, String role, Map<String, Object> changedFields, String newPassword) {
        if (email == null || email.isBlank()) return;

        try {
            Context context = new Context();
            context.setVariable("name", name != null && !name.isBlank() ? name : "User");
            context.setVariable("role", role != null ? role : "Account");
            context.setVariable("changedFields", changedFields != null ? changedFields : Collections.emptyMap());
            context.setVariable("newPassword", newPassword);
            context.setVariable("loginUrl", frontendUrl + "/login");
            context.setVariable("frontendUrl", frontendUrl);

            String html = templateEngine.process("email/profile-updated", context);
            String subject = "Your Zoro English Academy Profile Has Been Updated";
            sendEmail(email.trim(), subject, html, null);
        } catch (Exception e) {
            log.error("Error creating profile updated email for {}: {}", email, e.getMessage());
        }
    }

    // =========================================================================
    // LEGACY & RETROFIT METHODS FOR BACKWARD COMPATIBILITY
    // =========================================================================
    @Async
    public void sendEnquiryAcknowledgement(Enquiry enquiry) {
        if (enquiry == null || enquiry.getEmail() == null || enquiry.getEmail().isBlank()) return;

        try {
            Context context = new Context();
            context.setVariable("name", enquiry.getName() != null ? enquiry.getName() : "Learner");
            context.setVariable("enquiryId", enquiry.getId());
            context.setVariable("courseInterest", enquiry.getCourseInterest() != null ? enquiry.getCourseInterest() : "English Course");
            context.setVariable("phone", enquiry.getPhone());
            context.setVariable("message", enquiry.getMessage());

            String html = templateEngine.process("email/enquiry-acknowledgement", context);
            sendEmail(enquiry.getEmail().trim(), "We received your enquiry - Zoro English Academy", html, null);
        } catch (Exception e) {
            log.error("Error creating enquiry acknowledgement email for {}: {}", enquiry.getEmail(), e.getMessage());
        }
    }

    @Async
    public void sendCompetitionCredentials(String email, String name, String plainPassword, String competitionTitle) {
        sendCompetitionRegistrationSuccess(email, name, plainPassword, competitionTitle, "N/A", "₹199", "N/A");
    }

    @Async
    public void sendCompetitionRegistrationConfirmation(CompetitionRegistration registration) {
        if (registration == null || registration.getStudentEmail() == null) return;
        Competition comp = registration.getCompetition();
        String title = comp != null && comp.getTitle() != null ? comp.getTitle() : "Annual Competition";
        String feeStr = (registration.getAmountPaise() != null) ? "₹" + (registration.getAmountPaise() / 100) : "₹199";
        String dateStr = registration.getPaidAt() != null ? registration.getPaidAt().toString() : (registration.getCreatedAt() != null ? registration.getCreatedAt().toString() : "");
        sendCompetitionRegistrationSuccess(
                registration.getStudentEmail(),
                registration.getStudentName(),
                null,
                title,
                registration.getRazorpayPaymentId(),
                feeStr,
                dateStr
        );
    }
}
