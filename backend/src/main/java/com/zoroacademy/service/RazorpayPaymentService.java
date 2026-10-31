package com.zoroacademy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zoroacademy.dto.CompetitionOrderRequest;
import com.zoroacademy.dto.RazorpayOrderResponse;
import com.zoroacademy.dto.RazorpayVerifyRequest;
import com.zoroacademy.entity.Competition;
import com.zoroacademy.entity.CompetitionRegistration;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.CompetitionRegistrationRepository;
import com.zoroacademy.repository.CompetitionRepository;
import com.zoroacademy.repository.EnrollmentRepository;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.entity.User;
import com.zoroacademy.util.PhoneValidator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

import com.zoroacademy.entity.User;
import com.zoroacademy.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Service
public class RazorpayPaymentService {

    private static final Logger log = LoggerFactory.getLogger(RazorpayPaymentService.class);

    private final CompetitionRepository competitionRepository;
    private final CompetitionRegistrationRepository registrationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CompetitionSetDistributionService setDistributionService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private com.zoroacademy.security.AdminPasswordCryptoService adminPasswordCryptoService;

    @Autowired(required = false)
    private EmailService emailService;

    @Autowired(required = false)
    private EnrollmentRepository enrollmentRepository;

    private String resolveExistingCourseStudentName(String email) {
        if (email == null || email.isBlank() || userRepository == null) return null;
        try {
            Optional<User> uOpt = userRepository.findByEmailIgnoreCase(email.trim());
            if (uOpt.isPresent()) {
                User u = uOpt.get();
                boolean isStudent = "STUDENT".equalsIgnoreCase(u.getRole());
                boolean hasCourse = (u.getCourse() != null && !u.getCourse().isBlank());
                boolean hasEnrollment = false;
                if (enrollmentRepository != null) {
                    hasEnrollment = !enrollmentRepository.findByStudentId(u.getId()).isEmpty()
                            || !enrollmentRepository.findByStudentEmailIgnoreCase(email.trim()).isEmpty();
                }
                if (isStudent && (hasCourse || hasEnrollment)) {
                    return u.getName() != null && !u.getName().isBlank() ? u.getName() : "Student";
                }
            }
        } catch (Exception e) {
            log.warn("Error checking existing course enrollment for {}: {}", email, e.getMessage());
        }
        return null;
    }

    @Value("${razorpay.key-id:}")
    private String keyId;

    @Value("${razorpay.key-secret:}")
    private String keySecret;

    @Value("${razorpay.webhook-secret:}")
    private String webhookSecret;

    @Value("${razorpay.base-url:https://api.razorpay.com/v1}")
    private String razorpayBaseUrl;

    // In-memory rate limiting: max 20 order requests per minute per IP
    private final Map<String, List<Long>> rateLimitMap = new ConcurrentHashMap<>();

    @Autowired
    public RazorpayPaymentService(
            CompetitionRepository competitionRepository,
            CompetitionRegistrationRepository registrationRepository,
            @Autowired(required = false) UserRepository userRepository,
            @Autowired(required = false) PasswordEncoder passwordEncoder,
            @Autowired(required = false) CompetitionSetDistributionService setDistributionService,
            @Autowired(required = false) RestTemplate restTemplate,
            @Autowired(required = false) ObjectMapper objectMapper
    ) {
        this.competitionRepository = competitionRepository;
        this.registrationRepository = registrationRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.setDistributionService = setDistributionService;
        this.restTemplate = (restTemplate != null) ? restTemplate : new RestTemplate();
        this.objectMapper = (objectMapper != null) ? objectMapper : new ObjectMapper();
    }

    public RazorpayPaymentService(
            CompetitionRepository competitionRepository,
            CompetitionRegistrationRepository registrationRepository,
            RestTemplate restTemplate,
            ObjectMapper objectMapper
    ) {
        this(competitionRepository, registrationRepository, null, null, null, restTemplate, objectMapper);
    }

    public void setAdminPasswordCryptoService(com.zoroacademy.security.AdminPasswordCryptoService adminPasswordCryptoService) {
        this.adminPasswordCryptoService = adminPasswordCryptoService;
    }

    public void setEmailService(EmailService emailService) {
        this.emailService = emailService;
    }

    public static String generateSecureRandomPassword() {
        final String upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        final String lower = "abcdefghijkmnpqrstuvwxyz";
        final String digits = "23456789";
        final String symbols = "!@#$%&*";
        final String all = upper + lower + digits + symbols;
        java.security.SecureRandom random = new java.security.SecureRandom();
        StringBuilder sb = new StringBuilder();
        sb.append(upper.charAt(random.nextInt(upper.length())));
        sb.append(lower.charAt(random.nextInt(lower.length())));
        sb.append(digits.charAt(random.nextInt(digits.length())));
        sb.append(symbols.charAt(random.nextInt(symbols.length())));
        for (int i = 4; i < 10; i++) {
            sb.append(all.charAt(random.nextInt(all.length())));
        }
        char[] chars = sb.toString().toCharArray();
        for (int i = chars.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char temp = chars[i];
            chars[i] = chars[j];
            chars[j] = temp;
        }
        return new String(chars);
    }

    private void activateCandidateUserAccount(CompetitionRegistration reg, Competition comp) {
        if (userRepository == null || reg == null || reg.getStudentEmail() == null) {
            return;
        }
        String cleanEmail = reg.getStudentEmail().trim().toLowerCase();
        Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(cleanEmail);
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            reg.setStudentId(existingUser.getId());
            registrationRepository.save(reg);
        } else {
            String plainPassword;
            if (reg.getEncryptedPassword() != null) {
                plainPassword = (adminPasswordCryptoService != null)
                        ? adminPasswordCryptoService.decrypt(reg.getEncryptedPassword())
                        : reg.getEncryptedPassword();
            } else {
                plainPassword = generateSecureRandomPassword();
            }
            String encryptedPassword = (adminPasswordCryptoService != null)
                    ? adminPasswordCryptoService.encrypt(plainPassword)
                    : plainPassword;

            User newUser = new User();
            newUser.setId("usr_" + UUID.randomUUID());
            newUser.setEmail(cleanEmail);
            newUser.setName(reg.getStudentName());
            newUser.setPhone(reg.getStudentPhone());
            if (passwordEncoder != null) {
                newUser.setPassword(passwordEncoder.encode(plainPassword));
            } else {
                newUser.setPassword(plainPassword);
            }
            newUser.setAdminVisiblePassword(encryptedPassword);
            newUser.setRole("STUDENT");
            newUser.setOrigin("COMPETITION");
            newUser.setStatus("Active");
            newUser.setJoinedOn(LocalDate.now().toString());
            userRepository.save(newUser);

            reg.setStudentId(newUser.getId());
            reg.setEncryptedPassword(encryptedPassword);
            registrationRepository.save(reg);
        }
    }

    private void notifyRegistrationConfirmed(CompetitionRegistration reg, Competition comp) {
        if (reg == null || emailService == null || reg.getStudentEmail() == null || reg.getStudentEmail().isBlank()) {
            return;
        }
        try {
            String compTitle = comp != null && comp.getTitle() != null ? comp.getTitle() : "Annual Competition";
            User user = null;
            if (userRepository != null && reg.getStudentId() != null) {
                user = userRepository.findById(reg.getStudentId()).orElse(null);
            }
            if (user == null && userRepository != null && reg.getStudentEmail() != null) {
                user = userRepository.findByEmailIgnoreCase(reg.getStudentEmail()).orElse(null);
            }

            String plainPassword = null;
            if (reg.getEncryptedPassword() != null) {
                plainPassword = (adminPasswordCryptoService != null)
                        ? adminPasswordCryptoService.decrypt(reg.getEncryptedPassword())
                        : reg.getEncryptedPassword();
            }
            String feeStr = (reg.getAmountPaise() != null) ? "₹" + (reg.getAmountPaise() / 100) : "₹199.00";
            String dateStr = reg.getPaidAt() != null ? reg.getPaidAt().toLocalDate().toString() : (reg.getCreatedAt() != null ? reg.getCreatedAt().toLocalDate().toString() : "Today");
            emailService.sendCompetitionRegistrationSuccess(
                    reg.getStudentEmail(),
                    reg.getStudentName(),
                    plainPassword,
                    compTitle,
                    reg.getRazorpayPaymentId() != null ? reg.getRazorpayPaymentId() : "N/A",
                    feeStr,
                    dateStr
            );
        } catch (Exception e) {
            log.error("Failed to send competition confirmation / credentials email to {}: {}", reg.getStudentEmail(), e.getMessage());
        }
    }

    public void checkRateLimit(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return;
        }
        long now = System.currentTimeMillis();
        long windowStart = now - 60000; // 1 minute window

        rateLimitMap.compute(clientIp, (ip, timestamps) -> {
            if (timestamps == null) {
                timestamps = new ArrayList<>();
            }
            timestamps.removeIf(t -> t < windowStart);
            if (timestamps.size() >= 20) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please try again later.");
            }
            timestamps.add(now);
            return timestamps;
        });
    }

    @Transactional
    public RazorpayOrderResponse createCompetitionOrder(CompetitionOrderRequest request, String clientIp) {
        checkRateLimit(clientIp);

        Competition comp = competitionRepository.findById(request.getCompetitionId())
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found with ID: " + request.getCompetitionId()));

        if (!CompetitionService.isRegistrationOpen(comp)) {
            throw new ConflictException("Registration for this competition is closed.");
        }

        String sanitizedPhone = PhoneValidator.sanitize(request.getStudentPhone());
        String cleanEmail = request.getStudentEmail().trim().toLowerCase();
        String existingStudentName = resolveExistingCourseStudentName(cleanEmail);

        // Check for duplicates with PAID status
        Optional<CompetitionRegistration> existingByPhone = registrationRepository.findByCompetitionIdAndStudentPhone(comp.getId(), sanitizedPhone);
        if (existingByPhone.isPresent() && isPaid(existingByPhone.get().getPaymentStatus())) {
            throw new ConflictException("Participant with phone " + sanitizedPhone + " is already registered and confirmed for this competition");
        }

        Optional<CompetitionRegistration> existingByEmail = registrationRepository.findByCompetitionIdAndStudentEmailIgnoreCase(comp.getId(), cleanEmail);
        if (existingByEmail.isPresent() && isPaid(existingByEmail.get().getPaymentStatus())) {
            throw new ConflictException("Participant with email " + cleanEmail + " is already registered and confirmed for this competition");
        }

        // Server-side fee computation (IGNORE any client amount)
        BigDecimal fee = comp.getRegistrationFee() != null ? comp.getRegistrationFee() : BigDecimal.ZERO;
        long amountPaise = fee.multiply(new BigDecimal("100")).longValue();

        // Reuse existing pending registration or create fresh
        CompetitionRegistration reg = existingByEmail.orElseGet(() -> existingByPhone.orElseGet(() -> {
            CompetitionRegistration newReg = new CompetitionRegistration();
            newReg.setId("reg_" + UUID.randomUUID());
            newReg.setCompetition(comp);
            return newReg;
        }));

        reg.setStudentName(request.getStudentName());
        reg.setStudentEmail(cleanEmail);
        reg.setStudentPhone(sanitizedPhone);
        reg.setAge(request.getAge());
        reg.setSchool(request.getSchool());
        reg.setCity(request.getCity());

        // Account linkage / credential preparation (deferred user creation until payment success)
        if (userRepository != null) {
            Optional<User> existingUserOpt = userRepository.findByEmailIgnoreCase(cleanEmail);
            if (existingUserOpt.isPresent()) {
                // CASE 1: Email matches an existing student (course student)
                User existingUser = existingUserOpt.get();
                reg.setStudentId(existingUser.getId());
                if (reg.getStudentName() == null || reg.getStudentName().isBlank()) {
                    reg.setStudentName(existingUser.getName());
                }
                if (reg.getStudentPhone() == null || reg.getStudentPhone().isBlank()) {
                    reg.setStudentPhone(existingUser.getPhone());
                }
                if (existingUser.getAdminVisiblePassword() != null) {
                    reg.setEncryptedPassword(existingUser.getAdminVisiblePassword());
                }
            } else {
                // CASE 2: New competition-only candidate:
                // DO NOT CREATE ACTIVE USER ACCOUNT PREMATURELY!
                // Only prepare the encrypted credentials on registration.
                String plainPassword = (request.getPassword() != null && request.getPassword().trim().length() >= 8)
                        ? request.getPassword().trim()
                        : generateSecureRandomPassword();

                String encryptedPassword = (adminPasswordCryptoService != null)
                        ? adminPasswordCryptoService.encrypt(plainPassword)
                        : plainPassword;

                reg.setEncryptedPassword(encryptedPassword);
            }
        } else if (request.getStudentId() != null) {
            reg.setStudentId(request.getStudentId());
        }

        // Free Competition -> Confirm immediately without payment
        if (amountPaise <= 0) {
            reg.setPaymentStatus("PAID");
            reg.setAmountPaise(0L);
            reg.setAmount(BigDecimal.ZERO);
            reg.setCurrency("INR");
            reg.setSignatureVerified(false);
            reg.setPaidAt(LocalDateTime.now());
            registrationRepository.save(reg);

            activateCandidateUserAccount(reg, comp);

            if (setDistributionService != null) {
                try {
                    setDistributionService.assignStudentToSet(comp.getId(), reg.getId());
                } catch (Exception e) {
                    log.error("Failed to assign student to set for free competition: {}", e.getMessage());
                }
            }

            notifyRegistrationConfirmed(reg, comp);

            reg.setExistingStudentName(existingStudentName);
            return RazorpayOrderResponse.builder()
                    .orderId(null)
                    .amount(0L)
                    .currency("INR")
                    .keyId(null)
                    .registrationId(reg.getId())
                    .free(true)
                    .existingStudentName(existingStudentName)
                    .build();
        }

        // Paid Competition -> Check server keys
        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            log.error("Payment gateway unconfigured: missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Payments are not configured");
        }

        // Call Razorpay Orders REST API
        String orderId = callRazorpayCreateOrder(amountPaise, reg.getId(), comp.getId(), cleanEmail);

        reg.setPaymentStatus("PENDING");
        reg.setRazorpayOrderId(orderId);
        reg.setAmountPaise(amountPaise);
        reg.setAmount(fee);
        reg.setCurrency("INR");
        reg.setSignatureVerified(false);
        registrationRepository.save(reg);

        reg.setExistingStudentName(existingStudentName);
        return RazorpayOrderResponse.builder()
                .orderId(orderId)
                .amount(amountPaise)
                .currency("INR")
                .keyId(keyId.trim())
                .registrationId(reg.getId())
                .free(false)
                .existingStudentName(existingStudentName)
                .build();
    }

    private String callRazorpayCreateOrder(long amountPaise, String receiptId, String competitionId, String email) {
        try {
            String url = razorpayBaseUrl + "/orders";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBasicAuth(keyId.trim(), keySecret.trim());

            Map<String, Object> body = new HashMap<>();
            body.put("amount", amountPaise);
            body.put("currency", "INR");
            body.put("receipt", receiptId);

            Map<String, String> notes = new HashMap<>();
            notes.put("competitionId", competitionId);
            notes.put("email", email);
            body.put("notes", notes);

            HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(url, requestEntity, String.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String id = root.path("id").asText();
                if (id != null && !id.isBlank()) {
                    return id;
                }
            }
            throw new RuntimeException("Unexpected response from Razorpay Orders API: " + response.getBody());
        } catch (Exception e) {
            log.error("Error creating Razorpay order: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to initialize payment order with payment gateway: " + e.getMessage());
        }
    }

    @Transactional
    public CompetitionRegistration verifyPayment(RazorpayVerifyRequest request) {
        String orderId = request.getOrderId();
        String paymentId = request.getPaymentId();
        String signature = request.getSignature();

        CompetitionRegistration reg = registrationRepository.findByRazorpayOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration not found for Razorpay Order ID: " + orderId));

        // Idempotency: if already paid, return existing verified registration
        if (isPaid(reg.getPaymentStatus())) {
            log.info("Payment already verified for order {}", orderId);
            return reg;
        }

        // Verify HMAC-SHA256 signature
        if (keySecret == null || keySecret.isBlank()) {
            log.error("Online payments verification failed: RAZORPAY_KEY_SECRET is not set.");
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Online payments are not configured");
        }

        boolean valid = verifyHmacSha256Signature(orderId + "|" + paymentId, signature, keySecret);
        if (!valid) {
            log.warn("Invalid payment signature for order {} and payment {}", orderId, paymentId);
            throw new BadRequestException("Invalid payment signature");
        }

        reg.setPaymentStatus("PAID");
        reg.setRazorpayPaymentId(paymentId);
        reg.setRazorpaySignature(signature);
        reg.setPaidAt(LocalDateTime.now());
        reg.setSignatureVerified(true);
        if (reg.getCurrency() == null) {
            reg.setCurrency("INR");
        }
        if (reg.getAmount() == null) {
            if (reg.getAmountPaise() != null) {
                reg.setAmount(BigDecimal.valueOf(reg.getAmountPaise()).divide(BigDecimal.valueOf(100)));
            } else if (reg.getCompetition() != null && reg.getCompetition().getRegistrationFee() != null) {
                reg.setAmount(reg.getCompetition().getRegistrationFee());
            }
        }
        reg = registrationRepository.save(reg);

        // Activate / create candidate User account upon confirmed payment
        activateCandidateUserAccount(reg, reg.getCompetition());

        if (setDistributionService != null && reg.getCompetition() != null) {
            try {
                setDistributionService.assignStudentToSet(reg.getCompetition().getId(), reg.getId());
            } catch (Exception e) {
                log.error("Failed to assign student to set in verifyPayment: {}", e.getMessage());
            }
        }
        notifyRegistrationConfirmed(reg, reg.getCompetition());
        reg.setExistingStudentName(resolveExistingCourseStudentName(reg.getStudentEmail()));
        return reg;
    }

    @Transactional
    public boolean handleWebhook(String payload, String signatureHeader) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            log.warn("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not configured.");
            return false;
        }

        boolean valid = verifyHmacSha256Signature(payload, signatureHeader, webhookSecret);
        if (!valid) {
            log.warn("Invalid Razorpay webhook signature");
            throw new BadRequestException("Invalid webhook signature");
        }

        try {
            JsonNode root = objectMapper.readTree(payload);
            String event = root.path("event").asText();

            if ("payment.captured".equals(event) || "order.paid".equals(event)) {
                JsonNode payloadEntity = "order.paid".equals(event) 
                        ? root.path("payload").path("order").path("entity")
                        : root.path("payload").path("payment").path("entity");
                String orderId = payloadEntity.path("order_id").asText();
                if (orderId == null || orderId.isBlank()) {
                    orderId = payloadEntity.path("id").asText();
                }
                String paymentId = "order.paid".equals(event)
                        ? root.path("payload").path("payment").path("entity").path("id").asText()
                        : payloadEntity.path("id").asText();

                if (orderId != null && !orderId.isBlank()) {
                    registrationRepository.findByRazorpayOrderId(orderId).ifPresent(reg -> {
                        if (!isPaid(reg.getPaymentStatus())) {
                            reg.setPaymentStatus("PAID");
                            if (paymentId != null && !paymentId.isBlank()) {
                                reg.setRazorpayPaymentId(paymentId);
                            }
                            reg.setPaidAt(LocalDateTime.now());
                            reg.setSignatureVerified(true);
                            if (reg.getCurrency() == null) reg.setCurrency("INR");
                            if (reg.getAmount() == null) {
                                if (reg.getAmountPaise() != null) {
                                    reg.setAmount(BigDecimal.valueOf(reg.getAmountPaise()).divide(BigDecimal.valueOf(100)));
                                } else if (reg.getCompetition() != null && reg.getCompetition().getRegistrationFee() != null) {
                                    reg.setAmount(reg.getCompetition().getRegistrationFee());
                                }
                            }
                            registrationRepository.save(reg);

                            activateCandidateUserAccount(reg, reg.getCompetition());

                            if (setDistributionService != null && reg.getCompetition() != null) {
                                try {
                                    setDistributionService.assignStudentToSet(reg.getCompetition().getId(), reg.getId());
                                } catch (Exception e) {
                                    log.error("Failed to assign student to set in handleWebhook: {}", e.getMessage());
                                }
                            }
                            notifyRegistrationConfirmed(reg, reg.getCompetition());
                            log.info("Webhook successfully marked registration {} as SUCCESS", reg.getId());
                        }
                    });
                }
            } else if ("payment.failed".equals(event)) {
                JsonNode paymentEntity = root.path("payload").path("payment").path("entity");
                String orderId = paymentEntity.path("order_id").asText();
                if (orderId != null && !orderId.isBlank()) {
                    registrationRepository.findByRazorpayOrderId(orderId).ifPresent(reg -> {
                        if (!isPaid(reg.getPaymentStatus())) {
                            reg.setPaymentStatus("FAILED");
                            registrationRepository.save(reg);
                            log.info("Webhook marked registration {} as FAILED", reg.getId());
                        }
                    });
                }
            }
            return true;
        } catch (Exception e) {
            log.error("Error processing Razorpay webhook: {}", e.getMessage(), e);
            return false;
        }
    }

    public static boolean verifyHmacSha256Signature(String data, String signature, String secret) {
        if (data == null || signature == null || secret == null) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hmac = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder hex = new StringBuilder();
            for (byte b : hmac) {
                hex.append(String.format("%02x", b));
            }
            String calculatedSignature = hex.toString();

            // Constant-time comparison
            return MessageDigest.isEqual(
                    calculatedSignature.getBytes(StandardCharsets.UTF_8),
                    signature.trim().toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
        } catch (Exception e) {
            log.error("Error calculating HMAC-SHA256 signature: {}", e.getMessage());
            return false;
        }
    }

    private boolean isPaid(String status) {
        return status != null && ("SUCCESS".equalsIgnoreCase(status) || "PAID".equalsIgnoreCase(status));
    }

    // Automatically delete / clean up PENDING registrations older than 5 days via scheduled cron
    @Scheduled(cron = "0 0 2 * * *") // Daily at 2:00 AM
    @Transactional
    public void cleanupStalePendingRegistrations() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(5);
        List<CompetitionRegistration> staleList = registrationRepository.findByPaymentStatusInAndCreatedAtBefore(
                List.of("PENDING", "PENDING_PAYMENT"), cutoff);
        for (CompetitionRegistration reg : staleList) {
            log.info("Deleting stale pending competition registration {} (order {}, created {})",
                    reg.getId(), reg.getRazorpayOrderId(), reg.getCreatedAt());
            registrationRepository.delete(reg);
        }
    }

    // Setters for unit testing
    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }

    public void setKeySecret(String keySecret) {
        this.keySecret = keySecret;
    }

    public void setWebhookSecret(String webhookSecret) {
        this.webhookSecret = webhookSecret;
    }

    public void setRazorpayBaseUrl(String razorpayBaseUrl) {
        this.razorpayBaseUrl = razorpayBaseUrl;
    }
}
