package com.zoroacademy.service;

import com.zoroacademy.dto.LoginRequest;
import com.zoroacademy.dto.LoginResponse;
import com.zoroacademy.dto.RegisterRequest;
import com.zoroacademy.dto.UserDto;
import com.zoroacademy.entity.User;
import com.zoroacademy.entity.CompetitionRegistration;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.exception.UnauthorizedException;
import com.zoroacademy.repository.UserRepository;
import com.zoroacademy.repository.EnrollmentRepository;
import com.zoroacademy.repository.CompetitionRegistrationRepository;
import com.zoroacademy.repository.StudentCourseBatchRepository;
import com.zoroacademy.security.JwtTokenProvider;
import com.zoroacademy.util.PhoneValidator;
import io.jsonwebtoken.Claims;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AuthService.class);
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final RefreshTokenService refreshTokenService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private NotificationService notificationService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailService emailService;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EnrollmentRepository enrollmentRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private CompetitionRegistrationRepository competitionRegistrationRepository;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private StudentCourseBatchRepository studentCourseBatchRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider, RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.refreshTokenService = refreshTokenService;
    }

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtTokenProvider tokenProvider) {
        this(userRepository, passwordEncoder, tokenProvider, null);
    }

    @Transactional(readOnly = true)
    public boolean checkEmailExists(String email) {
        if (email == null || email.isBlank()) return false;
        return userRepository.existsByEmailIgnoreCase(email.trim());
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        return login(request, null);
    }

    @Transactional
    public LoginResponse login(LoginRequest request, String userAgent) {
        String identifier = request.getEmail() != null && !request.getEmail().isBlank() 
                ? request.getEmail().trim() 
                : request.getUsername();

        if (identifier == null || identifier.isBlank()) {
            throw new IllegalArgumentException("Email or username is required");
        }

        User user = userRepository.findByEmailIgnoreCase(identifier)
                .or(() -> userRepository.findByUsernameIgnoreCase(identifier))
                .or(() -> userRepository.findById(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Invalid email/username or password"));

        // Strictly verify password via BCrypt. No hardcoded or plaintext fallbacks.
        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid email/username or password");
        }

        if ("Inactive".equalsIgnoreCase(user.getStatus())) {
            throw new IllegalArgumentException("Account is inactive. Please contact administrator.");
        }

        String accessToken = tokenProvider.generateToken(
                user.getId(), user.getEmail(), user.getRole(), user.getName());
        String refreshToken = refreshTokenService != null ? refreshTokenService.createRefreshToken(user, userAgent) : null;

        UserDto userDto = UserDto.fromEntity(user);
        enrichUserAccessFlags(user, userDto);

        return LoginResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .token(accessToken)
                .tokenType("Bearer")
                .user(userDto)
                .hasCourseEnrollment(userDto.getHasCourseEnrollment())
                .hasCompetitionRegistration(userDto.getHasCompetitionRegistration())
                .build();
    }

    @Transactional
    public LoginResponse rotateRefreshToken(String rawRefreshToken, String userAgent) {
        if (refreshTokenService == null) {
            throw new UnauthorizedException("Refresh token service is not available");
        }

        RefreshTokenService.RotationResult result = refreshTokenService.rotateRefreshToken(rawRefreshToken, userAgent);
        User user = result.getUser();

        String newAccessToken = tokenProvider.generateToken(
                user.getId(), user.getEmail(), user.getRole(), user.getName());

        UserDto userDto = UserDto.fromEntity(user);
        enrichUserAccessFlags(user, userDto);

        return LoginResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(result.getNewRefreshToken())
                .token(newAccessToken)
                .tokenType("Bearer")
                .user(userDto)
                .hasCourseEnrollment(userDto.getHasCourseEnrollment())
                .hasCompetitionRegistration(userDto.getHasCompetitionRegistration())
                .build();
    }

    @Transactional
    public LoginResponse refreshToken(String token) {
        return rotateRefreshToken(token, null);
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        if (refreshTokenService != null && rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            refreshTokenService.revokeRefreshToken(rawRefreshToken);
        }
    }

    @Transactional
    public UserDto register(RegisterRequest request) {
        if (request.getEmail() == null || request.getEmail().isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }
        String cleanEmail = request.getEmail().toLowerCase().trim();
        if (!EMAIL_PATTERN.matcher(cleanEmail).matches()) {
            throw new IllegalArgumentException("Invalid email format: " + cleanEmail);
        }

        if (userRepository.existsByEmailIgnoreCase(cleanEmail)) {
            throw new ConflictException("Email is already registered: " + cleanEmail);
        }

        if (request.getPassword() == null || request.getPassword().length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters long");
        }

        String cleanUsername = request.getUsername() != null && !request.getUsername().isBlank()
                ? request.getUsername().trim()
                : cleanEmail;
        if (userRepository.existsByUsernameIgnoreCase(cleanUsername)) {
            throw new ConflictException("Username is already taken: " + cleanUsername);
        }

        String phone = request.getPhone();
        if (phone != null && !phone.isBlank()) {
            PhoneValidator.validate(phone);
            phone = PhoneValidator.sanitize(phone);
        }

        // Public registration always assigns role STUDENT
        String id = "std_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        User user = User.builder()
                .id(id)
                .email(cleanEmail)
                .username(cleanUsername)
                .password(passwordEncoder.encode(request.getPassword()))
                .name(request.getName() != null ? request.getName().trim() : "Student")
                .role("STUDENT")
                .phone(phone)
                .address(request.getAddress())
                .status("Active")
                .build();

        user = userRepository.save(user);

        if (notificationService != null) {
            notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                    .id("notif_" + UUID.randomUUID())
                    .recipientId(user.getId())
                    .recipientRole("STUDENT")
                    .title("Welcome to Zoro Academy!")
                    .message("Welcome, " + user.getName() + "! Your student account has been created successfully. Explore courses, join sessions, and start learning.")
                    .readStatus(false)
                    .build());
        }

        if (emailService != null) {
            try {
                emailService.sendStudentWelcomeEmail(user.getEmail(), user.getName(), request.getPassword());
            } catch (Exception ignored) {}
        }

        return UserDto.fromEntity(user);
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(String emailOrId) {
        User user = userRepository.findByEmailIgnoreCase(emailOrId)
                .or(() -> userRepository.findById(emailOrId))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + emailOrId));
        UserDto dto = UserDto.fromEntity(user);
        enrichUserAccessFlags(user, dto);
        return dto;
    }

    public void enrichUserAccessFlags(User user, UserDto dto) {
        if (user == null || dto == null) return;
        String role = (user.getRole() != null ? user.getRole() : "STUDENT").toUpperCase();
        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            dto.setHasCourseEnrollment(true);
            dto.setHasCompetitionRegistration(false);
            return;
        }
        if ("TRAINER".equals(role)) {
            dto.setHasCourseEnrollment(true);
            dto.setHasCompetitionRegistration(false);
            return;
        }

        // Student role
        boolean hasActiveEnrollment = false;
        if (enrollmentRepository != null) {
            hasActiveEnrollment = enrollmentRepository.findByStudentId(user.getId()).stream()
                    .anyMatch(e -> !"Cancelled".equalsIgnoreCase(e.getStatus()) && !"Dropped".equalsIgnoreCase(e.getStatus()));
        }

        boolean hasBatch = false;
        if (studentCourseBatchRepository != null) {
            hasBatch = !studentCourseBatchRepository.findByStudentId(user.getId()).isEmpty();
        }

        boolean hasCourseField = user.getCourse() != null && !user.getCourse().isBlank();
        boolean isNotCompetitionOrigin = !"COMPETITION".equalsIgnoreCase(user.getOrigin());

        boolean hasCourse = hasActiveEnrollment || hasBatch || (isNotCompetitionOrigin && (hasCourseField || user.getOrigin() == null || "LEARNING".equalsIgnoreCase(user.getOrigin())));

        boolean hasCompetition = false;
        if (competitionRegistrationRepository != null) {
            List<CompetitionRegistration> regs = new ArrayList<>(competitionRegistrationRepository.findByStudentId(user.getId()));
            if (user.getEmail() != null) {
                for (CompetitionRegistration r : competitionRegistrationRepository.findByStudentEmailIgnoreCase(user.getEmail())) {
                    if (regs.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                        regs.add(r);
                    }
                }
            }
            hasCompetition = regs.stream().anyMatch(r -> "PAID".equalsIgnoreCase(r.getPaymentStatus()) || "SUCCESS".equalsIgnoreCase(r.getPaymentStatus()));
        }

        if (!hasCourse && !hasCompetition) {
            if ("COMPETITION".equalsIgnoreCase(user.getOrigin())) {
                hasCompetition = false;
            } else {
                hasCourse = true;
            }
        }

        dto.setHasCourseEnrollment(hasCourse);
        dto.setHasCompetitionRegistration(hasCompetition);
    }
}
