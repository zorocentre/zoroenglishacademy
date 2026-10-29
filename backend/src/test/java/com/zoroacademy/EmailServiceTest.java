package com.zoroacademy;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.entity.Competition;
import com.zoroacademy.entity.CompetitionRegistration;
import com.zoroacademy.entity.Enquiry;
import com.zoroacademy.service.EmailService;
import com.zoroacademy.service.email.BrevoEmailProvider;
import com.zoroacademy.service.email.SesEmailProvider;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.util.Collections;
import java.util.Map;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock
    private JavaMailSender mailSender;

    private TemplateEngine templateEngine;
    private BrevoEmailProvider brevoProvider;
    private SesEmailProvider sesProvider;
    private EmailService emailService;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode("HTML");
        resolver.setCharacterEncoding("UTF-8");

        org.thymeleaf.spring6.SpringTemplateEngine springEngine = new org.thymeleaf.spring6.SpringTemplateEngine();
        springEngine.setTemplateResolver(resolver);
        this.templateEngine = springEngine;

        // Brevo with unconfigured key by default
        brevoProvider = new BrevoEmailProvider("", "zorocentre@gmail.com", "Zoro English Academy", new ObjectMapper());

        // SES with active host
        sesProvider = new SesEmailProvider(mailSender, "email-smtp.ap-south-1.amazonaws.com", "zorocentre@gmail.com", "Zoro English Academy");

        emailService = new EmailService(brevoProvider, sesProvider, templateEngine);
        ReflectionTestUtils.setField(emailService, "preferredProvider", "ses");
        ReflectionTestUtils.setField(emailService, "frontendUrl", "https://zoroenglish.com");
    }

    @Test
    @DisplayName("Email sending is safely skipped when neither provider is configured")
    void testEmailSkippedWhenNoProviderConfigured() {
        SesEmailProvider emptySes = new SesEmailProvider(mailSender, "", "zorocentre@gmail.com", "Zoro");
        BrevoEmailProvider emptyBrevo = new BrevoEmailProvider("", "zorocentre@gmail.com", "Zoro", new ObjectMapper());
        EmailService unconfigured = new EmailService(emptyBrevo, emptySes, templateEngine);

        assertFalse(unconfigured.isMailConfigured());

        Enquiry enq = new Enquiry();
        enq.setEmail("test@example.com");
        unconfigured.sendEnquiryAcknowledgement(enq);

        verifyNoInteractions(mailSender);
    }

    @Test
    @DisplayName("Enquiry acknowledgement email is generated and sent via SES")
    void testSendEnquiryAcknowledgement() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        Enquiry enq = new Enquiry();
        enq.setId("enq_test_123");
        enq.setName("John Doe");
        enq.setEmail("john@example.com");
        enq.setCourseInterest("Spoken English");
        enq.setPhone("+91 9988776655");
        enq.setMessage("Please share details");

        emailService.sendEnquiryAcknowledgement(enq);

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        assertNotNull(captor.getValue());
    }

    @Test
    @DisplayName("Competition registration success email with receipt and credentials is sent")
    void testSendCompetitionRegistrationSuccess() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendCompetitionRegistrationSuccess(
                "alice@example.com",
                "Alice Smith",
                "SecretPass123!",
                "Annual English Competition",
                "pay_xyz123",
                "₹199",
                "2026-10-29"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        assertNotNull(captor.getValue());
    }

    @Test
    @DisplayName("Student welcome email with enrolled courses and credentials is sent")
    void testSendStudentWelcomeEmail() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendStudentWelcomeEmail("student@example.com", "Bob Williams", "TempPass123!", Collections.singletonList("Spoken English Mastery"));

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        assertNotNull(captor.getValue());
    }

    @Test
    @DisplayName("Trainer welcome email is generated and sent")
    void testSendTrainerWelcomeEmail() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendTrainerWelcomeEmail("trainer@example.com", "Jane Trainer", "TrainerPass123!", "IELTS Preparation");

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        assertNotNull(captor.getValue());
    }

    @Test
    @DisplayName("Profile updated email with changed fields and password reset is sent")
    void testSendProfileUpdatedEmail() {
        MimeMessage mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        when(mailSender.createMimeMessage()).thenReturn(mimeMessage);

        emailService.sendProfileUpdatedEmail(
                "student@example.com",
                "Charlie",
                "STUDENT",
                Map.of("Full Name", "Charlie Davis", "Phone", "9988776655"),
                "NewTempPass123!"
        );

        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, times(1)).send(captor.capture());
        assertNotNull(captor.getValue());
    }

    @Test
    @DisplayName("Provider selection prefers Brevo when configured")
    void testProviderSelectionPrefersBrevo() {
        BrevoEmailProvider configuredBrevo = new BrevoEmailProvider("xkeysib-dummy-key", "zorocentre@gmail.com", "Zoro", new ObjectMapper());
        EmailService service = new EmailService(configuredBrevo, sesProvider, templateEngine);
        ReflectionTestUtils.setField(service, "preferredProvider", "");

        assertTrue(service.isMailConfigured());
        assertEquals("BREVO", service.getActiveProvider().getProviderName());
    }
}
