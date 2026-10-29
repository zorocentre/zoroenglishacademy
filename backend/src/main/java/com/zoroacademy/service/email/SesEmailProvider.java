package com.zoroacademy.service.email;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class SesEmailProvider implements EmailProvider {

    private static final Logger log = LoggerFactory.getLogger(SesEmailProvider.class);

    private final JavaMailSender mailSender;
    private final String smtpHost;
    private final String senderEmail;
    private final String senderName;

    public SesEmailProvider(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${spring.mail.host:}") String smtpHost,
            @Value("${EMAIL_SENDER_EMAIL:${AWS_SES_FROM_EMAIL:zorocentre@gmail.com}}") String senderEmail,
            @Value("${EMAIL_SENDER_NAME:${AWS_SES_FROM_NAME:Zoro English Academy}}") String senderName) {
        this.mailSender = mailSender;
        this.smtpHost = smtpHost != null ? smtpHost.trim() : "";
        this.senderEmail = senderEmail != null && !senderEmail.isBlank() ? senderEmail.trim() : "zorocentre@gmail.com";
        this.senderName = senderName != null && !senderName.isBlank() ? senderName.trim() : "Zoro English Academy";
    }

    @Override
    public String getProviderName() {
        return "SES";
    }

    @Override
    public boolean isConfigured() {
        return mailSender != null && !smtpHost.isEmpty();
    }

    @Override
    public boolean sendEmail(String to, String subject, String htmlContent, String textContent) throws Exception {
        if (!isConfigured()) {
            throw new IllegalStateException("AWS SES / SMTP host is not configured.");
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED, StandardCharsets.UTF_8.name());

        helper.setFrom(senderEmail, senderName);
        helper.setTo(to.trim());
        helper.setSubject(subject);

        if (htmlContent != null && !htmlContent.isBlank()) {
            if (textContent != null && !textContent.isBlank()) {
                helper.setText(textContent, htmlContent);
            } else {
                helper.setText(htmlContent, true);
            }
        } else if (textContent != null) {
            helper.setText(textContent, false);
        }

        mailSender.send(message);
        log.info("AWS SES email sent successfully to {}", to);
        return true;
    }
}
