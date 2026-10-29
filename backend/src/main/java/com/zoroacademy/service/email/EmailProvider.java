package com.zoroacademy.service.email;

/**
 * Common abstraction for email delivery providers (Brevo, AWS SES, etc.)
 */
public interface EmailProvider {

    /**
     * Unique identifier for this provider (e.g., "BREVO", "SES").
     */
    String getProviderName();

    /**
     * Checks if this provider has all required credentials configured.
     */
    boolean isConfigured();

    /**
     * Sends an email message.
     *
     * @param to          Recipient email address
     * @param subject     Email subject line
     * @param htmlContent HTML formatted body
     * @param textContent Plain text alternative body
     * @return true if successfully accepted/sent by provider, false otherwise
     * @throws Exception if a transport or API error occurs
     */
    boolean sendEmail(String to, String subject, String htmlContent, String textContent) throws Exception;
}
