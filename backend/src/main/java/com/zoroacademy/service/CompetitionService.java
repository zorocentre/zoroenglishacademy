package com.zoroacademy.service;

import com.zoroacademy.entity.*;
import com.zoroacademy.exception.BadRequestException;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.exception.ForbiddenException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CompetitionService {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CompetitionService.class);

    private final CompetitionRepository competitionRepository;
    private final CompetitionModuleRepository moduleRepository;
    private final CompetitionRegistrationRepository registrationRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;
    private final CompetitionSetRepository setRepository;
    private final CompetitionSetMemberRepository setMemberRepository;
    private final CompetitionSyllabusRepository syllabusRepository;
    private final CompetitionGuidanceVideoRepository guidanceVideoRepository;
    private final CompetitionStudyMaterialRepository studyMaterialRepository;
    private final CompetitionAssessmentRepository assessmentRepository;
    private final AssessmentQuestionRepository questionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final AssessmentEvaluationCriteriaRepository evaluationCriteriaRepository;
    private final StoredFileRepository storedFileRepository;

    @Autowired(required = false)
    private AssessmentAttemptRepository assessmentAttemptRepository;

    @Autowired(required = false)
    private AttemptAnswerRepository attemptAnswerRepository;

    @Autowired(required = false)
    private VoiceEvaluationScoreRepository voiceEvaluationScoreRepository;

    @Autowired(required = false)
    private LeaderboardEntryRepository leaderboardEntryRepository;

    @Autowired(required = false)
    private CompetitionLeaderboardCacheRepository leaderboardCacheRepository;

    @Autowired(required = false)
    private ResultCorrectionRepository resultCorrectionRepository;

    @Autowired(required = false)
    private AssessmentSetQuestionRepository assessmentSetQuestionRepository;

    @Autowired(required = false)
    private AssessmentSetOptionRepository assessmentSetOptionRepository;

    @Autowired(required = false)
    private EmailService emailService;

    @Autowired(required = false)
    private BunnyStreamService bunnyStreamService;

    @Autowired(required = false)
    private com.zoroacademy.config.BunnyStreamProperties bunnyStreamProperties;

    @Autowired(required = false)
    private com.zoroacademy.security.AdminPasswordCryptoService adminPasswordCryptoService;

    @Autowired(required = false)
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired(required = false)
    private ExamProctorEventRepository examProctorEventRepository;

    @Autowired(required = false)
    private RepublishAuditRepository republishAuditRepository;

    @Autowired(required = false)
    private NotificationService notificationService;

    @Autowired(required = false)
    private CompetitionActivityLogService activityLogService;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private void logCompetitionActivity(String compId, String compTitle, String eventType, String actorId, String actorName, String actorRole, String details) {
        if (activityLogService != null && compId != null) {
            try {
                activityLogService.logEvent(compId, compTitle, eventType, actorId, actorName, actorRole, details);
            } catch (Exception ignored) {
            }
        }
    }

    @Autowired
    public CompetitionService(
            CompetitionRepository competitionRepository,
            CompetitionModuleRepository moduleRepository,
            CompetitionRegistrationRepository registrationRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService,
            CompetitionSetRepository setRepository,
            CompetitionSetMemberRepository setMemberRepository,
            CompetitionSyllabusRepository syllabusRepository,
            CompetitionGuidanceVideoRepository guidanceVideoRepository,
            CompetitionStudyMaterialRepository studyMaterialRepository,
            CompetitionAssessmentRepository assessmentRepository,
            AssessmentQuestionRepository questionRepository,
            QuestionOptionRepository questionOptionRepository,
            AssessmentEvaluationCriteriaRepository evaluationCriteriaRepository,
            StoredFileRepository storedFileRepository) {
        this.competitionRepository = competitionRepository;
        this.moduleRepository = moduleRepository;
        this.registrationRepository = registrationRepository;
        this.userRepository = userRepository;
        this.fileStorageService = fileStorageService;
        this.setRepository = setRepository;
        this.setMemberRepository = setMemberRepository;
        this.syllabusRepository = syllabusRepository;
        this.guidanceVideoRepository = guidanceVideoRepository;
        this.studyMaterialRepository = studyMaterialRepository;
        this.assessmentRepository = assessmentRepository;
        this.questionRepository = questionRepository;
        this.questionOptionRepository = questionOptionRepository;
        this.evaluationCriteriaRepository = evaluationCriteriaRepository;
        this.storedFileRepository = storedFileRepository;
    }

    public CompetitionService(
            CompetitionRepository competitionRepository,
            CompetitionModuleRepository moduleRepository,
            CompetitionRegistrationRepository registrationRepository,
            UserRepository userRepository,
            FileStorageService fileStorageService) {
        this(competitionRepository, moduleRepository, registrationRepository, userRepository, fileStorageService,
             null, null, null, null, null, null, null, null, null, null);
    }

    public void setAssessmentAttemptRepository(AssessmentAttemptRepository assessmentAttemptRepository) {
        this.assessmentAttemptRepository = assessmentAttemptRepository;
    }

    public void setAttemptAnswerRepository(AttemptAnswerRepository attemptAnswerRepository) {
        this.attemptAnswerRepository = attemptAnswerRepository;
    }

    public void setVoiceEvaluationScoreRepository(VoiceEvaluationScoreRepository voiceEvaluationScoreRepository) {
        this.voiceEvaluationScoreRepository = voiceEvaluationScoreRepository;
    }


    public void setLeaderboardEntryRepository(LeaderboardEntryRepository leaderboardEntryRepository) {
        this.leaderboardEntryRepository = leaderboardEntryRepository;
    }

    public void setLeaderboardCacheRepository(CompetitionLeaderboardCacheRepository leaderboardCacheRepository) {
        this.leaderboardCacheRepository = leaderboardCacheRepository;
    }

    public void setResultCorrectionRepository(ResultCorrectionRepository resultCorrectionRepository) {
        this.resultCorrectionRepository = resultCorrectionRepository;
    }

    public void setAssessmentSetQuestionRepository(AssessmentSetQuestionRepository r) {
        this.assessmentSetQuestionRepository = r;
    }

    public void setAssessmentSetOptionRepository(AssessmentSetOptionRepository r) {
        this.assessmentSetOptionRepository = r;
    }

    @Transactional(readOnly = true)
    public List<Competition> getAllCompetitions() {
        return competitionRepository.findAll();
    }

    public static boolean isRegistrationOpen(Competition comp) {
        if (comp == null) return false;
        if (!"Active".equalsIgnoreCase(comp.getStatus())) return false;
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        OffsetDateTime now = ZonedDateTime.now(zone).toOffsetDateTime();

        // 1. Check regStart: defaults to 00:00:00 IST of regStartDate
        OffsetDateTime start = comp.getRegStartAt();
        if (start == null && comp.getRegStartDate() != null && !comp.getRegStartDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(comp.getRegStartDate().trim().substring(0, 10));
                start = ZonedDateTime.of(d, LocalTime.MIN, zone).toOffsetDateTime();
            } catch (Exception ignored) {}
        }
        if (start != null && now.isBefore(start)) {
            return false;
        }

        // 2. Check regEnd: defaults to 23:59:59.999 IST of regEndDate
        OffsetDateTime end = comp.getRegEndAt();
        if (end == null && comp.getRegEndDate() != null && !comp.getRegEndDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(comp.getRegEndDate().trim().substring(0, 10));
                end = ZonedDateTime.of(d, LocalTime.of(23, 59, 59, 999_000_000), zone).toOffsetDateTime();
            } catch (Exception ignored) {}
        }
        if (end != null && now.isAfter(end)) {
            return false;
        }

        return true;
    }

    @Transactional(readOnly = true)
    public List<Competition> getPublicActiveCompetitions() {
        return competitionRepository.findAll().stream()
                .filter(CompetitionService::isRegistrationOpen)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public Competition getCompetitionById(String id) {
        return competitionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + id));
    }

    private boolean isPaid(String status) {
        return status != null && ("PAID".equalsIgnoreCase(status) || "SUCCESS".equalsIgnoreCase(status));
    }

    /**
     * Validates that the current user has paid registration access to the specified competition.
     * Admins and trainers are permitted; students must have a PAID or SUCCESS registration.
     */
    public void validateUserCompetitionAccess(String compId, User user) {
        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";
        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role) || "TRAINER".equals(role)) {
            return;
        }

        // Student validation
        Optional<CompetitionRegistration> reg = registrationRepository.findByCompetitionIdAndStudentId(compId, user.getId());
        if (reg.isEmpty() && user.getEmail() != null) {
            reg = registrationRepository.findByCompetitionIdAndStudentEmailIgnoreCase(compId, user.getEmail());
        }
        if (reg.isEmpty() || !isPaid(reg.get().getPaymentStatus())) {
            throw new ForbiddenException("Access denied: You do not have a paid registration for this competition");
        }
    }

    /**
     * Validates timing rules for competitions.
     * 1. End must be after start
     * 2. Registration closes before or when competition starts
     * 3. Final unlock must be inside the competition window
     * 4. Publish rule: 5 days after scheduled completion date at configured time.
     */
    public void validateCompetitionTimings(Competition comp) {
        ZoneId ist = ZoneId.of("Asia/Kolkata");

        if (comp.getStartAt() != null && comp.getEndAt() != null) {
            if (!comp.getEndAt().isAfter(comp.getStartAt())) {
                throw new BadRequestException("Competition end date/time must be strictly after start date/time");
            }
        }

        if (comp.getRegEndAt() != null && comp.getStartAt() != null) {
            if (comp.getRegEndAt().isAfter(comp.getStartAt())) {
                throw new BadRequestException("Registration closes before or when the competition starts");
            }
        }

        if (comp.getFinalUnlockAt() != null) {
            if (comp.getStartAt() != null && comp.getFinalUnlockAt().isBefore(comp.getStartAt())) {
                throw new BadRequestException("Final Assessment unlock time must be inside the competition window");
            }
            if (comp.getEndAt() != null && comp.getFinalUnlockAt().isAfter(comp.getEndAt())) {
                throw new BadRequestException("Final Assessment unlock time must be inside the competition window");
            }
        }

        // Publish rule: 5 days after the scheduled completion date at the configured time
        if (comp.getEndAt() != null) {
            LocalTime pubTime = LocalTime.of(18, 0);
            if (comp.getLeaderboardPublishTime() != null && !comp.getLeaderboardPublishTime().isBlank()) {
                String lpt = comp.getLeaderboardPublishTime().trim();
                if (lpt.contains("T")) {
                    try {
                        if (lpt.endsWith("Z") || lpt.contains("+")) {
                            comp.setLeaderboardPublishedAt(OffsetDateTime.parse(lpt));
                        } else {
                            LocalDateTime ldt = LocalDateTime.parse(lpt);
                            comp.setLeaderboardPublishedAt(ldt.atZone(ist).toOffsetDateTime());
                        }
                    } catch (Exception e) {
                        try {
                            pubTime = parseTime(lpt);
                            ZonedDateTime endZoned = comp.getEndAt().atZoneSameInstant(ist);
                            ZonedDateTime pubZoned = endZoned.plusDays(5).with(pubTime);
                            comp.setLeaderboardPublishedAt(pubZoned.toOffsetDateTime());
                        } catch (Exception ignored) {}
                    }
                } else {
                    try {
                        pubTime = parseTime(lpt);
                    } catch (Exception ignored) {}
                    ZonedDateTime endZoned = comp.getEndAt().atZoneSameInstant(ist);
                    ZonedDateTime pubZoned = endZoned.plusDays(5).with(pubTime);
                    comp.setLeaderboardPublishedAt(pubZoned.toOffsetDateTime());
                }
            } else {
                comp.setLeaderboardPublishTime("18:00");
                ZonedDateTime endZoned = comp.getEndAt().atZoneSameInstant(ist);
                ZonedDateTime pubZoned = endZoned.plusDays(5).with(pubTime);
                comp.setLeaderboardPublishedAt(pubZoned.toOffsetDateTime());
            }
        }
    }

    @Transactional
    public Competition createCompetition(Competition competition) {
        if (competition.getId() == null || competition.getId().isBlank()) {
            competition.setId("comp_" + UUID.randomUUID());
        }

        ZoneId zone = ZoneId.of("Asia/Kolkata");
        if (competition.getStartAt() == null && competition.getStartDate() != null && !competition.getStartDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(competition.getStartDate().trim());
                LocalTime t = (competition.getStartTime() != null && !competition.getStartTime().isBlank())
                        ? parseTime(competition.getStartTime()) : LocalTime.MIN;
                competition.setStartAt(ZonedDateTime.of(d, t, zone).toOffsetDateTime());
            } catch (Exception ignored) {}
        }
        if (competition.getEndAt() == null && competition.getEndDate() != null && !competition.getEndDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(competition.getEndDate().trim());
                LocalTime t = (competition.getEndTime() != null && !competition.getEndTime().isBlank())
                        ? parseTime(competition.getEndTime()) : LocalTime.of(23, 59, 59);
                competition.setEndAt(ZonedDateTime.of(d, t, zone).toOffsetDateTime());
            } catch (Exception ignored) {}
        }
        if (competition.getRegStartAt() == null && competition.getRegStartDate() != null && !competition.getRegStartDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(competition.getRegStartDate().trim());
                competition.setRegStartAt(ZonedDateTime.of(d, LocalTime.MIN, zone).toOffsetDateTime());
            } catch (Exception ignored) {}
        }
        if (competition.getRegEndAt() == null && competition.getRegEndDate() != null && !competition.getRegEndDate().isBlank()) {
            try {
                LocalDate d = LocalDate.parse(competition.getRegEndDate().trim());
                competition.setRegEndAt(ZonedDateTime.of(d, LocalTime.of(23, 59, 59), zone).toOffsetDateTime());
            } catch (Exception ignored) {}
        }

        // Sync string dates from OffsetDateTime only if missing
        if (competition.getStartAt() != null) {
            if (competition.getStartDate() == null || competition.getStartDate().isBlank()) {
                competition.setStartDate(competition.getStartAt().atZoneSameInstant(zone).toLocalDate().toString());
            }
            if (competition.getStartTime() == null || competition.getStartTime().isBlank()) {
                competition.setStartTime(String.format("%02d:%02d", competition.getStartAt().atZoneSameInstant(zone).getHour(), competition.getStartAt().atZoneSameInstant(zone).getMinute()));
            }
        }
        if (competition.getEndAt() != null) {
            if (competition.getEndDate() == null || competition.getEndDate().isBlank()) {
                competition.setEndDate(competition.getEndAt().atZoneSameInstant(zone).toLocalDate().toString());
            }
            if (competition.getEndTime() == null || competition.getEndTime().isBlank()) {
                competition.setEndTime(String.format("%02d:%02d", competition.getEndAt().atZoneSameInstant(zone).getHour(), competition.getEndAt().atZoneSameInstant(zone).getMinute()));
            }
        }
        if (competition.getRegStartAt() != null && (competition.getRegStartDate() == null || competition.getRegStartDate().isBlank())) {
            competition.setRegStartDate(competition.getRegStartAt().atZoneSameInstant(zone).toLocalDate().toString());
        }
        if (competition.getRegEndAt() != null && (competition.getRegEndDate() == null || competition.getRegEndDate().isBlank())) {
            competition.setRegEndDate(competition.getRegEndAt().atZoneSameInstant(zone).toLocalDate().toString());
        }

        validateCompetitionTimings(competition);

        Competition saved = competitionRepository.save(competition);
        String compId = saved.getId();

        // Auto-create 4 sets (A, B, C, D)
        if (setRepository != null) {
            for (String code : List.of("A", "B", "C", "D")) {
                if (setRepository.findByCompetitionIdAndCode(compId, code).isEmpty()) {
                    CompetitionSet set = new CompetitionSet("set_" + compId + "_" + code, compId, code);
                    setRepository.save(set);
                }
            }
        }

        // Auto-create 35 TEST_SERIES, 4 MOCK, 1 FINAL slots as DRAFT
        if (assessmentRepository != null) {
            for (int i = 1; i <= 35; i++) {
                if (assessmentRepository.findByCompetitionIdAndTypeAndSequenceNo(compId, "TEST_SERIES", i).isEmpty()) {
                    CompetitionAssessment ca = new CompetitionAssessment();
                    ca.setId("asmt_" + compId + "_ts_" + i);
                    ca.setCompetitionId(compId);
                    ca.setType("TEST_SERIES");
                    ca.setSequenceNo(i);
                    ca.setTitle("Test Series " + i);
                    ca.setStatus("DRAFT");
                    ca.setDurationMinutes(20);
                    ca.setTotalMarks(20);
                    assessmentRepository.save(ca);
                }
            }

            for (int i = 1; i <= 4; i++) {
                if (assessmentRepository.findByCompetitionIdAndTypeAndSequenceNo(compId, "MOCK", i).isEmpty()) {
                    CompetitionAssessment ca = new CompetitionAssessment();
                    ca.setId("asmt_" + compId + "_mock_" + i);
                    ca.setCompetitionId(compId);
                    ca.setType("MOCK");
                    ca.setSequenceNo(i);
                    ca.setTitle("Mock Test " + i);
                    ca.setStatus("DRAFT");
                    ca.setDurationMinutes(45);
                    ca.setTotalMarks(50);
                    assessmentRepository.save(ca);
                }
            }

            if (assessmentRepository.findByCompetitionIdAndTypeAndSequenceNo(compId, "FINAL", 1).isEmpty()) {
                CompetitionAssessment ca = new CompetitionAssessment();
                ca.setId("asmt_" + compId + "_final_1");
                ca.setCompetitionId(compId);
                ca.setType("FINAL");
                ca.setSequenceNo(1);
                ca.setTitle("Final Assessment");
                ca.setStatus("DRAFT");
                ca.setDurationMinutes(60);
                ca.setTotalMarks(100);
                assessmentRepository.save(ca);
            }
        }

        return saved;
    }

    private LocalTime parseTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) return LocalTime.MIDNIGHT;
        String t = timeStr.trim();
        try {
            return LocalTime.parse(t, DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH));
        } catch (Exception e1) {
            try {
                return LocalTime.parse(t, DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH));
            } catch (Exception e2) {
                try {
                    return LocalTime.parse(t, DateTimeFormatter.ISO_LOCAL_TIME);
                } catch (Exception e3) {
                    return LocalTime.MIDNIGHT;
                }
            }
        }
    }

    @Transactional
    public CompetitionModule addModule(String compId, CompetitionModule module) {
        Competition comp = getCompetitionById(compId);
        if (module.getId() == null || module.getId().isBlank()) {
            module.setId("comp_mod_" + UUID.randomUUID());
        }
        module.setCompetition(comp);
        return moduleRepository.save(module);
    }

    @Transactional(readOnly = true)
    public List<CompetitionRegistration> getAllRegistrations() {
        return registrationRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<CompetitionModule> getModules(String compId) {
        return moduleRepository.findByCompetitionIdOrderByRoundNumberAsc(compId);
    }

    @Transactional(readOnly = true)
    public List<CompetitionRegistration> getRegistrations(String compId) {
        return registrationRepository.findByCompetitionId(compId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> precheckRegistrationEmail(String compId, String email) {
        Map<String, Object> result = new HashMap<>();
        result.put("existingAccountName", null);
        result.put("existingAccountType", null);

        if (email == null || email.isBlank() || userRepository == null) {
            return result;
        }

        String normEmail = email.trim().toLowerCase();
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normEmail);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String role = user.getRole() != null ? user.getRole().toUpperCase() : "STUDENT";
            String accountType = "TRAINER".equals(role) ? "TRAINER" : "STUDENT";
            result.put("existingAccountName", user.getName() != null && !user.getName().isBlank() ? user.getName() : user.getEmail());
            result.put("existingAccountType", accountType);
        }
        return result;
    }

    @Transactional
    public CompetitionRegistration registerStudent(String compId, CompetitionRegistration reg) {
        Competition comp = getCompetitionById(compId);
        if (!isRegistrationOpen(comp)) {
            throw new ConflictException("Registration for this competition is closed.");
        }
        if (reg.getId() == null || reg.getId().isBlank()) {
            reg.setId("reg_" + UUID.randomUUID());
        }
        if (reg.getStudentPhone() != null && !reg.getStudentPhone().isBlank()) {
            reg.setStudentPhone(com.zoroacademy.util.PhoneValidator.sanitize(reg.getStudentPhone()));
        }
        if (reg.getPaymentStatus() == null || reg.getPaymentStatus().isBlank()) {
            reg.setPaymentStatus("Pending");
        }

        // Relational student resolution (if registered student)
        if (reg.getStudentId() != null && reg.getStudentId().contains("@")) {
            userRepository.findByEmailIgnoreCase(reg.getStudentId()).ifPresent(u -> {
                reg.setStudentId(u.getId());
                if (reg.getStudentEmail() == null) reg.setStudentEmail(u.getEmail());
                if (reg.getStudentName() == null) reg.setStudentName(u.getName());
            });
        } else if (reg.getStudentEmail() != null && !reg.getStudentEmail().isBlank()) {
            userRepository.findByEmailIgnoreCase(reg.getStudentEmail()).ifPresent(u -> {
                if (reg.getStudentId() == null || reg.getStudentId().isBlank()) reg.setStudentId(u.getId());
                if (reg.getStudentName() == null) reg.setStudentName(u.getName());
            });
        }

        reg.setCompetition(comp);
        CompetitionRegistration saved = registrationRepository.save(reg);
        if (emailService != null) {
            try {
                emailService.sendCompetitionRegistrationConfirmation(saved);
            } catch (Exception ignored) {}
        }
        return saved;
    }

    @Transactional
    public Competition updateCompetition(String id, Competition updated) {
        Competition comp = getCompetitionById(id);
        if (updated.getTitle() != null) comp.setTitle(updated.getTitle());
        if (updated.getCategory() != null) comp.setCategory(updated.getCategory());
        if (updated.getStartDate() != null) comp.setStartDate(updated.getStartDate());
        if (updated.getEndDate() != null) comp.setEndDate(updated.getEndDate());
        if (updated.getRegStartDate() != null) comp.setRegStartDate(updated.getRegStartDate());
        if (updated.getRegEndDate() != null) comp.setRegEndDate(updated.getRegEndDate());
        if (updated.getStartTime() != null) comp.setStartTime(updated.getStartTime());
        if (updated.getEndTime() != null) comp.setEndTime(updated.getEndTime());
        if (updated.getVenue() != null) comp.setVenue(updated.getVenue());
        if (updated.getBannerUrl() != null) {
            if (comp.getBannerUrl() != null && !comp.getBannerUrl().isBlank()
                    && !comp.getBannerUrl().equals(updated.getBannerUrl())) {
                deleteAttachedFileIfPresent(comp.getBannerUrl());
            }
            comp.setBannerUrl(updated.getBannerUrl());
        }
        if (updated.getRulesPdfUrl() != null) {
            if (comp.getRulesPdfUrl() != null && !comp.getRulesPdfUrl().isBlank()
                    && !comp.getRulesPdfUrl().equals(updated.getRulesPdfUrl())) {
                deleteAttachedFileIfPresent(comp.getRulesPdfUrl());
            }
            comp.setRulesPdfUrl(updated.getRulesPdfUrl());
        }
        if (updated.getInstructions() != null) comp.setInstructions(updated.getInstructions());
        if (updated.getContactDetails() != null) comp.setContactDetails(updated.getContactDetails());
        if (updated.getRegistrationFee() != null) comp.setRegistrationFee(updated.getRegistrationFee());
        if (updated.getDescription() != null) comp.setDescription(updated.getDescription());
        if (updated.getRules() != null) comp.setRules(updated.getRules());
        if (updated.getStatus() != null) comp.setStatus(updated.getStatus());

        // Timestamp and review fields
        if (updated.getRegStartAt() != null) comp.setRegStartAt(updated.getRegStartAt());
        if (updated.getRegEndAt() != null) comp.setRegEndAt(updated.getRegEndAt());
        if (updated.getStartAt() != null) comp.setStartAt(updated.getStartAt());
        if (updated.getEndAt() != null) comp.setEndAt(updated.getEndAt());
        if (updated.getFinalUnlockAt() != null) {
            comp.setFinalUnlockAt(updated.getFinalUnlockAt());
            if (assessmentRepository != null) {
                List<CompetitionAssessment> finalAsmts = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(comp.getId())
                        .stream()
                        .filter(a -> "FINAL".equalsIgnoreCase(a.getType()))
                        .toList();
                for (CompetitionAssessment fa : finalAsmts) {
                    fa.setStartAt(comp.getFinalUnlockAt());
                    if (comp.getEndAt() != null) {
                        fa.setEndAt(comp.getEndAt());
                    }
                    assessmentRepository.save(fa);
                }
            }
        }
        if (updated.getLeaderboardPublishTime() != null) comp.setLeaderboardPublishTime(updated.getLeaderboardPublishTime());
        if (updated.getLeaderboardStatus() != null) comp.setLeaderboardStatus(updated.getLeaderboardStatus());
        if (updated.getLeaderboardPublishedAt() != null) comp.setLeaderboardPublishedAt(updated.getLeaderboardPublishedAt());
        if (updated.getAnswerReviewEnabled() != null) comp.setAnswerReviewEnabled(updated.getAnswerReviewEnabled());

        ZoneId zone = ZoneId.of("Asia/Kolkata");
        if (comp.getStartAt() != null) {
            if (comp.getStartDate() == null || comp.getStartDate().isBlank()) {
                comp.setStartDate(comp.getStartAt().atZoneSameInstant(zone).toLocalDate().toString());
            }
            if (comp.getStartTime() == null || comp.getStartTime().isBlank()) {
                comp.setStartTime(String.format("%02d:%02d", comp.getStartAt().atZoneSameInstant(zone).getHour(), comp.getStartAt().atZoneSameInstant(zone).getMinute()));
            }
        }
        if (comp.getEndAt() != null) {
            if (comp.getEndDate() == null || comp.getEndDate().isBlank()) {
                comp.setEndDate(comp.getEndAt().atZoneSameInstant(zone).toLocalDate().toString());
            }
            if (comp.getEndTime() == null || comp.getEndTime().isBlank()) {
                comp.setEndTime(String.format("%02d:%02d", comp.getEndAt().atZoneSameInstant(zone).getHour(), comp.getEndAt().atZoneSameInstant(zone).getMinute()));
            }
        }
        if (comp.getRegStartAt() != null && (comp.getRegStartDate() == null || comp.getRegStartDate().isBlank())) {
            comp.setRegStartDate(comp.getRegStartAt().atZoneSameInstant(zone).toLocalDate().toString());
        }
        if (comp.getRegEndAt() != null && (comp.getRegEndDate() == null || comp.getRegEndDate().isBlank())) {
            comp.setRegEndDate(comp.getRegEndAt().atZoneSameInstant(zone).toLocalDate().toString());
        }

        validateCompetitionTimings(comp);

        return competitionRepository.save(comp);
    }

    @Transactional
    public void deleteCompetition(String id) {
        Competition comp = competitionRepository.findById(id).orElse(null);
        if (comp != null) {
            deleteAttachedFileIfPresent(comp.getRulesPdfUrl());
            deleteAttachedFileIfPresent(comp.getBannerUrl());
        }
        competitionRepository.deleteById(id);
    }

    private void deleteAttachedFileIfPresent(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) return;
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", java.util.regex.Pattern.CASE_INSENSITIVE)
                    .matcher(fileUrl);
            if (m.find()) {
                String fileId = m.group();
                fileStorageService.deleteFile(fileId);
            }
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(CompetitionService.class)
                    .warn("Could not delete attached file for {}: {}", fileUrl, e.getMessage());
        }
    }

    @Transactional
    public CompetitionModule updateModule(String moduleId, CompetitionModule updated) {
        CompetitionModule mod = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new IllegalArgumentException("Module not found: " + moduleId));
        if (updated.getTitle() != null) mod.setTitle(updated.getTitle());
        if (updated.getDescription() != null) mod.setDescription(updated.getDescription());
        if (updated.getRoundNumber() != null) mod.setRoundNumber(updated.getRoundNumber());
        if (updated.getAssessmentData() != null) mod.setAssessmentData(updated.getAssessmentData());
        return moduleRepository.save(mod);
    }

    @Transactional
    public void deleteModule(String moduleId) {
        moduleRepository.deleteById(moduleId);
    }

    @Transactional
    public CompetitionRegistration updateRegistration(String regId, CompetitionRegistration updated) {
        CompetitionRegistration reg = registrationRepository.findById(regId)
                .orElseThrow(() -> new IllegalArgumentException("Registration not found: " + regId));
        if (updated.getPaymentStatus() != null) reg.setPaymentStatus(updated.getPaymentStatus());
        if (updated.getRazorpayOrderId() != null) reg.setRazorpayOrderId(updated.getRazorpayOrderId());
        if (updated.getRazorpayPaymentId() != null) reg.setRazorpayPaymentId(updated.getRazorpayPaymentId());
        if (updated.getAmount() != null) {
            reg.setAmount(updated.getAmount());
            reg.setAmountPaise(updated.getAmount().multiply(java.math.BigDecimal.valueOf(100)).longValue());
        } else if (updated.getAmountPaise() != null) {
            reg.setAmountPaise(updated.getAmountPaise());
            reg.setAmount(java.math.BigDecimal.valueOf(updated.getAmountPaise()).divide(java.math.BigDecimal.valueOf(100)));
        }
        if (updated.getPaidAt() != null) reg.setPaidAt(updated.getPaidAt());
        if (updated.getScore() != null) reg.setScore(updated.getScore());
        if (updated.getRank() != null) reg.setRank(updated.getRank());
        if (updated.getCertificateUrl() != null) reg.setCertificateUrl(updated.getCertificateUrl());
        return registrationRepository.save(reg);
    }

    @Transactional
    public void deleteRegistration(String regId) {
        registrationRepository.deleteById(regId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRegistrationCredential(String regId) {
        CompetitionRegistration reg = registrationRepository.findById(regId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration not found: " + regId));

        String enc = reg.getEncryptedPassword();
        if (enc == null || enc.isBlank()) {
            if (reg.getStudentId() != null) {
                Optional<User> uOpt = userRepository.findById(reg.getStudentId());
                if (uOpt.isPresent() && uOpt.get().getAdminVisiblePassword() != null) {
                    enc = uOpt.get().getAdminVisiblePassword();
                }
            }
            if ((enc == null || enc.isBlank()) && reg.getStudentEmail() != null) {
                Optional<User> uOpt = userRepository.findByEmailIgnoreCase(reg.getStudentEmail().trim());
                if (uOpt.isPresent() && uOpt.get().getAdminVisiblePassword() != null) {
                    enc = uOpt.get().getAdminVisiblePassword();
                }
            }
        }

        if (enc != null && !enc.isBlank() && adminPasswordCryptoService != null) {
            try {
                String plain = adminPasswordCryptoService.decrypt(enc);
                if (plain != null && !plain.isBlank()) {
                    Map<String, Object> res = new HashMap<>();
                    res.put("hasPassword", true);
                    res.put("password", plain);
                    res.put("source", "STORED");
                    return res;
                }
            } catch (Exception e) {
                log.warn("Failed to decrypt password for registration {}: {}", regId, e.getMessage());
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("hasPassword", false);
        res.put("password", "");
        res.put("source", "LEGACY_HASH");
        res.put("message", "Set by admin");
        return res;
    }

    @Transactional
    public Map<String, Object> resetRegistrationPassword(String regId, String optionalNewPassword) {
        CompetitionRegistration reg = registrationRepository.findById(regId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration not found: " + regId));

        String newPlain = (optionalNewPassword != null && optionalNewPassword.trim().length() >= 8)
                ? optionalNewPassword.trim()
                : RazorpayPaymentService.generateSecureRandomPassword();

        String enc = (adminPasswordCryptoService != null)
                ? adminPasswordCryptoService.encrypt(newPlain)
                : newPlain;

        reg.setEncryptedPassword(enc);
        registrationRepository.save(reg);

        // Update User account if found
        Optional<User> userOpt = Optional.empty();
        if (reg.getStudentId() != null) {
            userOpt = userRepository.findById(reg.getStudentId());
        }
        if (userOpt.isEmpty() && reg.getStudentEmail() != null) {
            userOpt = userRepository.findByEmailIgnoreCase(reg.getStudentEmail().trim());
        }

        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (passwordEncoder != null) {
                user.setPassword(passwordEncoder.encode(newPlain));
            } else {
                user.setPassword(newPlain);
            }
            user.setAdminVisiblePassword(enc);
            userRepository.save(user);
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("password", newPlain);
        res.put("message", "Password reset successfully");
        return res;
    }

    // --- Sets & Trainers Management (Phase 5) ---
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getSetsWithDetails(String compId) {
        List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(compId);
        if (sets.isEmpty()) {
            for (String code : List.of("A", "B", "C", "D")) {
                CompetitionSet set = new CompetitionSet("set_" + compId + "_" + code, compId, code);
                sets.add(setRepository.save(set));
            }
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (CompetitionSet s : sets) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", s.getId());
            map.put("competitionId", s.getCompetitionId());
            map.put("code", s.getCode());
            map.put("trainerId", s.getTrainerId());
            long count = setMemberRepository.countBySetId(s.getId());
            map.put("memberCount", count);

            if (s.getTrainerId() != null) {
                userRepository.findById(s.getTrainerId()).ifPresent(u -> {
                    map.put("trainerName", u.getName());
                    map.put("trainerEmail", u.getEmail());
                });
            }
            result.add(map);
        }
        return result;
    }

    @Transactional
    public CompetitionSet assignTrainerToSet(String compId, String setCode, String trainerId) {
        CompetitionSet set = setRepository.findByCompetitionIdAndCode(compId, setCode)
                .orElseThrow(() -> new ResourceNotFoundException("Set " + setCode + " not found for competition " + compId));
        if (trainerId != null && !trainerId.isBlank()) {
            User trainer = userRepository.findById(trainerId)
                    .orElseThrow(() -> new ResourceNotFoundException("Trainer not found: " + trainerId));
            set.setTrainerId(trainer.getId());
        } else {
            set.setTrainerId(null);
        }
        return setRepository.save(set);
    }

    // --- Syllabus (Phase 6 & Tasks M6/M7) ---
    @Transactional(readOnly = true)
    public Map<String, Object> getSyllabus(String compId) {
        Optional<CompetitionSyllabus> syllabusOpt = syllabusRepository.findByCompetitionId(compId);
        if (syllabusOpt.isEmpty()) {
            return null;
        }
        CompetitionSyllabus syllabus = syllabusOpt.get();
        if (syllabus.getStoredFileId() == null || syllabus.getStoredFileId().isBlank()) {
            return null;
        }
        Optional<StoredFile> sfOpt = storedFileRepository.findById(syllabus.getStoredFileId());
        if (sfOpt.isEmpty()) {
            return null;
        }
        StoredFile sf = sfOpt.get();
        Map<String, Object> result = new HashMap<>();
        result.put("id", syllabus.getId());
        result.put("competitionId", syllabus.getCompetitionId());
        result.put("title", syllabus.getTitle());
        result.put("storedFileId", syllabus.getStoredFileId());
        result.put("fileType", syllabus.getFileType() != null ? syllabus.getFileType() : getFileExtension(sf.getOriginalName()));
        result.put("fileName", sf.getOriginalName());
        result.put("fileSize", sf.getSizeBytes());
        result.put("updatedAt", syllabus.getUpdatedAt());

        try {
            Map<String, Object> link = fileStorageService.generateFileLink(sf, 3600);
            result.put("viewUrl", link != null ? link.get("url") : fileStorageService.getFileUrl(sf));
        } catch (Exception e) {
            result.put("viewUrl", fileStorageService.getFileUrl(sf));
        }
        return result;
    }

    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) return "";
        return fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    }

    @Transactional
    public CompetitionSyllabus saveSyllabus(String compId, String title, String storedFileId, String fileType) {
        Competition comp = getCompetitionById(compId);

        // Validation: syllabus must be PDF, DOC/DOCX, or TXT
        if (storedFileId != null && !storedFileId.isBlank()) {
            StoredFile sf = storedFileRepository.findById(storedFileId)
                    .orElseThrow(() -> new ResourceNotFoundException("Stored file not found: " + storedFileId));
            String name = (sf.getOriginalName() != null ? sf.getOriginalName().toLowerCase(Locale.ROOT) : "");
            boolean isValidExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt");
            if (!isValidExt) {
                throw new BadRequestException("Syllabus file must be PDF, DOC, DOCX, or TXT format. Media files are not allowed.");
            }
            sf.setCategory("competition-syllabus");
            storedFileRepository.save(sf);
        }

        CompetitionSyllabus syllabus = syllabusRepository.findByCompetitionId(compId)
                .orElseGet(() -> {
                    CompetitionSyllabus s = new CompetitionSyllabus();
                    s.setId("syl_" + UUID.randomUUID());
                    s.setCompetitionId(comp.getId());
                    return s;
                });

        if (syllabus.getStoredFileId() != null && !syllabus.getStoredFileId().equals(storedFileId)) {
            try {
                fileStorageService.deleteFile(syllabus.getStoredFileId());
            } catch (Exception ignored) {}
        }

        syllabus.setTitle(title != null && !title.isBlank() ? title : "Competition Syllabus");
        if (storedFileId != null) syllabus.setStoredFileId(storedFileId);
        if (fileType != null && !fileType.isBlank()) {
            syllabus.setFileType(fileType.toLowerCase(Locale.ROOT));
        } else if (storedFileId != null) {
            storedFileRepository.findById(storedFileId).ifPresent(sf -> {
                syllabus.setFileType(getFileExtension(sf.getOriginalName()));
            });
        }
        return syllabusRepository.save(syllabus);
    }

    @Transactional
    public void deleteSyllabus(String compId) {
        syllabusRepository.findByCompetitionId(compId).ifPresent(syl -> {
            if (syl.getStoredFileId() != null) {
                fileStorageService.deleteFile(syl.getStoredFileId());
            }
            syllabusRepository.delete(syl);
        });
    }

    // --- Guidance Videos (Phase 6 & Admin Guidance Videos Redesign) ---
    @Transactional(readOnly = true)
    public List<CompetitionGuidanceVideo> getGuidanceVideos(String compId) {
        return guidanceVideoRepository.findByCompetitionIdOrderBySortOrderAsc(compId);
    }

    private void ensureVideoUrls(CompetitionGuidanceVideo video) {
        if (video.getBunnyVideoId() != null && !video.getBunnyVideoId().isBlank()) {
            String libId = (bunnyStreamProperties != null && bunnyStreamProperties.getLibraryId() != null && !bunnyStreamProperties.getLibraryId().isBlank())
                    ? bunnyStreamProperties.getLibraryId() : "784226";
            String cdn = (bunnyStreamProperties != null && bunnyStreamProperties.getCdnHost() != null && !bunnyStreamProperties.getCdnHost().isBlank())
                    ? bunnyStreamProperties.getCdnHost() : "video.bunnycdn.com";
            if (video.getEmbedUrl() == null || video.getEmbedUrl().isBlank()) {
                video.setEmbedUrl("https://iframe.mediadelivery.net/embed/" + libId + "/" + video.getBunnyVideoId());
            }
            if (video.getPlaybackUrl() == null || video.getPlaybackUrl().isBlank()) {
                video.setPlaybackUrl("https://" + cdn + "/" + video.getBunnyVideoId() + "/playlist.m3u8");
            }
        }
    }

    @Transactional
    public CompetitionGuidanceVideo saveGuidanceVideo(String compId, CompetitionGuidanceVideo video) {
        Competition comp = getCompetitionById(compId);
        String caption = video.getCaption();
        if (caption == null || caption.isBlank()) {
            caption = video.getTitle();
        }
        if (caption == null || caption.isBlank()) {
            caption = "Guidance Video";
        }
        String title = (video.getTitle() != null && !video.getTitle().isBlank()) ? video.getTitle() : caption;
        String bunnyVideoId = video.getBunnyVideoId() != null ? video.getBunnyVideoId().trim() : null;

        // 1. Check if updating by ID
        if (video.getId() != null && !video.getId().isBlank()) {
            Optional<CompetitionGuidanceVideo> existingById = guidanceVideoRepository.findById(video.getId());
            if (existingById.isPresent()) {
                CompetitionGuidanceVideo ev = existingById.get();
                ev.setTitle(title);
                ev.setCaption(caption);
                if (bunnyVideoId != null && !bunnyVideoId.isBlank()) {
                    ev.setBunnyVideoId(bunnyVideoId);
                }
                if (video.getDuration() != null) ev.setDuration(video.getDuration());
                if (video.getSortOrder() != null && video.getSortOrder() > 0) ev.setSortOrder(video.getSortOrder());
                if (video.getStatus() != null) ev.setStatus(video.getStatus());
                if (video.getEmbedUrl() != null) ev.setEmbedUrl(video.getEmbedUrl());
                if (video.getPlaybackUrl() != null) ev.setPlaybackUrl(video.getPlaybackUrl());
                ensureVideoUrls(ev);
                return guidanceVideoRepository.save(ev);
            }
        }

        // 2. Check if video with same bunnyVideoId already exists for this competition (de-duplicate / idempotent)
        if (bunnyVideoId != null && !bunnyVideoId.isBlank()) {
            Optional<CompetitionGuidanceVideo> existingByBunny = guidanceVideoRepository
                    .findByCompetitionIdAndBunnyVideoId(comp.getId(), bunnyVideoId);
            if (existingByBunny.isPresent()) {
                CompetitionGuidanceVideo ev = existingByBunny.get();
                ev.setTitle(title);
                ev.setCaption(caption);
                if (video.getDuration() != null) ev.setDuration(video.getDuration());
                if (video.getSortOrder() != null && video.getSortOrder() > 0) ev.setSortOrder(video.getSortOrder());
                if (video.getStatus() != null) ev.setStatus(video.getStatus());
                if (video.getEmbedUrl() != null) ev.setEmbedUrl(video.getEmbedUrl());
                if (video.getPlaybackUrl() != null) ev.setPlaybackUrl(video.getPlaybackUrl());
                ensureVideoUrls(ev);
                return guidanceVideoRepository.save(ev);
            }
        }

        // 3. Brand new guidance video entry
        if (video.getId() == null || video.getId().isBlank()) {
            video.setId("cgv_" + UUID.randomUUID());
        }
        video.setCompetitionId(comp.getId());
        video.setTitle(title);
        video.setCaption(caption);
        if (video.getSortOrder() == null || video.getSortOrder() <= 0) {
            int currentCount = guidanceVideoRepository.findByCompetitionIdOrderBySortOrderAsc(comp.getId()).size();
            video.setSortOrder(currentCount + 1);
        }
        ensureVideoUrls(video);
        return guidanceVideoRepository.save(video);
    }

    @Transactional
    public CompetitionGuidanceVideo uploadGuidanceVideo(String compId, org.springframework.web.multipart.MultipartFile file, String caption, Integer sortOrder) {
        if (file == null || file.isEmpty()) {
            throw new com.zoroacademy.exception.BadRequestException("Video file cannot be empty");
        }
        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!origName.endsWith(".mp4") && !origName.endsWith(".webm") && !origName.endsWith(".mov")) {
            throw new com.zoroacademy.exception.BadRequestException("Only MP4, WebM, and MOV video formats are allowed");
        }
        if (caption == null || caption.trim().isBlank()) {
            throw new com.zoroacademy.exception.BadRequestException("Caption is required for guidance video");
        }

        if (bunnyStreamService == null) {
            throw new com.zoroacademy.exception.BadRequestException("Bunny Stream service is not configured");
        }

        Map<String, Object> uploadResult;
        try {
            uploadResult = bunnyStreamService.uploadVideoBinary(file, caption.trim());
        } catch (Exception e) {
            log.error("Failed to upload guidance video to Bunny Stream: {}", e.getMessage(), e);
            throw new com.zoroacademy.exception.BadRequestException("Failed to upload video to Bunny Stream: " + e.getMessage());
        }

        String bunnyVideoId = uploadResult.get("bunnyVideoId") != null ? uploadResult.get("bunnyVideoId").toString() : null;
        if (bunnyVideoId == null || bunnyVideoId.isBlank()) {
            bunnyVideoId = uploadResult.get("id") != null ? uploadResult.get("id").toString() : null;
        }

        CompetitionGuidanceVideo cgv = new CompetitionGuidanceVideo();
        cgv.setCaption(caption.trim());
        cgv.setTitle(caption.trim());
        cgv.setBunnyVideoId(bunnyVideoId);
        cgv.setDuration(uploadResult.get("duration") != null ? uploadResult.get("duration").toString() : null);
        cgv.setSortOrder(sortOrder != null ? sortOrder : 0);
        cgv.setEmbedUrl(uploadResult.get("embedUrl") != null ? uploadResult.get("embedUrl").toString() : null);
        cgv.setPlaybackUrl(uploadResult.get("directStreamUrl") != null ? uploadResult.get("directStreamUrl").toString() : null);

        return saveGuidanceVideo(compId, cgv);
    }

    @Transactional
    public CompetitionGuidanceVideo updateGuidanceVideo(String videoId, String caption, Integer sortOrder) {
        CompetitionGuidanceVideo v = guidanceVideoRepository.findById(videoId)
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("Guidance video not found: " + videoId));
        if (caption != null && !caption.trim().isBlank()) {
            v.setCaption(caption.trim());
            v.setTitle(caption.trim());
        }
        if (sortOrder != null) {
            v.setSortOrder(sortOrder);
        }
        ensureVideoUrls(v);
        return guidanceVideoRepository.save(v);
    }

    @Transactional
    public CompetitionGuidanceVideo replaceGuidanceVideoFile(String videoId, org.springframework.web.multipart.MultipartFile file, String caption) {
        CompetitionGuidanceVideo v = guidanceVideoRepository.findById(videoId)
                .orElseThrow(() -> new com.zoroacademy.exception.ResourceNotFoundException("Guidance video not found: " + videoId));

        if (file == null || file.isEmpty()) {
            throw new com.zoroacademy.exception.BadRequestException("Replacement video file cannot be empty");
        }
        String origName = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!origName.endsWith(".mp4") && !origName.endsWith(".webm") && !origName.endsWith(".mov")) {
            throw new com.zoroacademy.exception.BadRequestException("Only MP4, WebM, and MOV video formats are allowed");
        }

        String oldBunnyId = v.getBunnyVideoId();
        String effectiveCaption = (caption != null && !caption.trim().isBlank()) ? caption.trim() : v.getCaption();

        Map<String, Object> uploadResult = bunnyStreamService.uploadVideoBinary(file, effectiveCaption);
        String newBunnyId = uploadResult.get("bunnyVideoId") != null ? uploadResult.get("bunnyVideoId").toString() : null;
        if (newBunnyId == null || newBunnyId.isBlank()) {
            newBunnyId = uploadResult.get("id") != null ? uploadResult.get("id").toString() : null;
        }

        // Delete old video from Bunny Stream
        if (oldBunnyId != null && !oldBunnyId.isBlank() && !oldBunnyId.equals(newBunnyId)) {
            try {
                bunnyStreamService.deleteVideo(oldBunnyId);
            } catch (Exception e) {
                log.warn("Failed to delete old replaced video from Bunny Stream: {}", e.getMessage());
            }
        }

        v.setBunnyVideoId(newBunnyId);
        v.setCaption(effectiveCaption);
        v.setTitle(effectiveCaption);
        v.setDuration(uploadResult.get("duration") != null ? uploadResult.get("duration").toString() : null);
        if (uploadResult.get("embedUrl") != null) {
            v.setEmbedUrl(uploadResult.get("embedUrl").toString());
        }
        if (uploadResult.get("directStreamUrl") != null) {
            v.setPlaybackUrl(uploadResult.get("directStreamUrl").toString());
        }
        ensureVideoUrls(v);
        return guidanceVideoRepository.save(v);
    }

    @Transactional
    public void deleteGuidanceVideo(String videoId) {
        Optional<CompetitionGuidanceVideo> videoOpt = guidanceVideoRepository.findById(videoId);
        if (videoOpt.isPresent()) {
            CompetitionGuidanceVideo v = videoOpt.get();
            if (bunnyStreamService != null && v.getBunnyVideoId() != null && !v.getBunnyVideoId().isBlank()) {
                try {
                    bunnyStreamService.deleteVideo(v.getBunnyVideoId());
                } catch (Exception e) {
                    log.warn("Failed to delete video from Bunny Stream: {}", e.getMessage());
                }
            }
            guidanceVideoRepository.delete(v);
        }
    }

    @Transactional
    public List<CompetitionGuidanceVideo> reorderGuidanceVideos(String compId, List<String> videoIds) {
        if (videoIds == null || videoIds.isEmpty()) {
            return getGuidanceVideos(compId);
        }
        for (int i = 0; i < videoIds.size(); i++) {
            String vid = videoIds.get(i);
            Optional<CompetitionGuidanceVideo> opt = guidanceVideoRepository.findById(vid);
            if (opt.isPresent()) {
                CompetitionGuidanceVideo v = opt.get();
                v.setSortOrder(i + 1);
                guidanceVideoRepository.save(v);
            }
        }
        return getGuidanceVideos(compId);
    }

    // --- Study Materials (Phase 6) ---
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getStudyMaterials(String compId) {
        List<CompetitionStudyMaterial> materials = studyMaterialRepository.findByCompetitionIdOrderBySortOrderAsc(compId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (CompetitionStudyMaterial sm : materials) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", sm.getId());
            map.put("competitionId", sm.getCompetitionId());
            map.put("title", sm.getTitle());
            map.put("storedFileId", sm.getStoredFileId());
            map.put("fileType", sm.getFileType());
            map.put("sortOrder", sm.getSortOrder());
            map.put("createdAt", sm.getCreatedAt());

            if (sm.getStoredFileId() != null) {
                storedFileRepository.findById(sm.getStoredFileId()).ifPresent(sf -> {
                    Map<String, Object> link = fileStorageService.generateFileLink(sf, 3600);
                    map.put("viewUrl", link.get("url"));
                    map.put("fileName", sf.getOriginalName());
                });
            }
            result.add(map);
        }
        return result;
    }

    @Transactional
    public CompetitionStudyMaterial saveStudyMaterial(String compId, CompetitionStudyMaterial material) {
        Competition comp = getCompetitionById(compId);

        // Validation: study material must be PDF, DOC/DOCX, or TXT
        if (material.getStoredFileId() != null && !material.getStoredFileId().isBlank()) {
            StoredFile sf = storedFileRepository.findById(material.getStoredFileId())
                    .orElseThrow(() -> new ResourceNotFoundException("Stored file not found: " + material.getStoredFileId()));
            String name = (sf.getOriginalName() != null ? sf.getOriginalName().toLowerCase(Locale.ROOT) : "");
            boolean isValidExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx") || name.endsWith(".txt");
            if (!isValidExt) {
                throw new BadRequestException("Study material file must be PDF, DOC, DOCX, or TXT format. Media files are not allowed.");
            }
        }

        if (material.getId() == null || material.getId().isBlank()) {
            material.setId("csm_" + UUID.randomUUID());
        }
        material.setCompetitionId(comp.getId());
        return studyMaterialRepository.save(material);
    }

    @Transactional
    public void deleteStudyMaterial(String materialId) {
        studyMaterialRepository.findById(materialId).ifPresent(mat -> {
            if (mat.getStoredFileId() != null) {
                fileStorageService.deleteFile(mat.getStoredFileId());
            }
            studyMaterialRepository.delete(mat);
        });
    }

    // --- Assessments (Phase 7) ---
    @Transactional(readOnly = true)
    public List<CompetitionAssessment> getAssessments(String compId) {
        List<CompetitionAssessment> list = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(compId);
        for (CompetitionAssessment a : list) {
            List<AssessmentQuestion> qs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(a.getId());
            a.setQuestionCount((long) qs.size());
            int sumMarks = qs.stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum();
            a.setTotalMarks(sumMarks);
            a.setTargetQuestions(qs.size());
        }
        return list;
    }

    @Transactional(readOnly = true)
    public CompetitionAssessment getAssessmentById(String asmtId) {
        CompetitionAssessment asmt = assessmentRepository.findById(asmtId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment not found: " + asmtId));
        List<AssessmentQuestion> qs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmt.getId());
        asmt.setQuestionCount((long) qs.size());
        int sumMarks = qs.stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum();
        asmt.setTotalMarks(sumMarks);
        asmt.setTargetQuestions(qs.size());
        return asmt;
    }

    @Transactional
    public CompetitionAssessment updateAssessment(String asmtId, CompetitionAssessment updated) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        if (updated.getTitle() != null) asmt.setTitle(updated.getTitle());
        if (updated.getStatus() != null) asmt.setStatus(updated.getStatus());
        if (updated.getStartAt() != null) asmt.setStartAt(updated.getStartAt());
        if (updated.getEndAt() != null) asmt.setEndAt(updated.getEndAt());
        if (updated.getDurationMinutes() != null) asmt.setDurationMinutes(updated.getDurationMinutes());
        if (updated.getTotalMarks() != null) asmt.setTotalMarks(updated.getTotalMarks());
        return assessmentRepository.save(asmt);
    }

    /**
     * Publishes an assessment with comprehensive server-side rule verification.
     */
    @Transactional
    public CompetitionAssessment publishAssessment(String asmtId) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        if (questions.isEmpty()) {
            throw new BadRequestException("Assessment must have at least one question before publishing");
        }

        int computedTotalMarks = 0;
        for (AssessmentQuestion q : questions) {
            computedTotalMarks += (q.getMarks() != null ? q.getMarks() : 1);
            if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
                if (options.size() < 2) {
                    throw new BadRequestException("Every MCQ question must have at least 2 options: " + q.getQuestionText());
                }
                long correctCount = options.stream().filter(o -> Boolean.TRUE.equals(o.getIsCorrect())).count();
                if (correctCount != 1) {
                    throw new BadRequestException("Every MCQ question must have exactly one correct option: " + q.getQuestionText());
                }
            }
        }
        asmt.setTotalMarks(computedTotalMarks);

        Competition comp = getCompetitionById(asmt.getCompetitionId());

        if ("MOCK".equalsIgnoreCase(asmt.getType())) {
            if (asmt.getStartAt() == null || asmt.getEndAt() == null) {
                throw new BadRequestException("Mock tests require explicit start and end date/time to be set");
            }
            if (!asmt.getEndAt().isAfter(asmt.getStartAt())) {
                throw new BadRequestException("Mock test end time must be after start time");
            }
            if (comp.getStartAt() != null && asmt.getStartAt().isBefore(comp.getStartAt())) {
                throw new BadRequestException("Mock test schedule must fall within the competition timeline");
            }
            if (comp.getEndAt() != null && asmt.getEndAt().isAfter(comp.getEndAt())) {
                throw new BadRequestException("Mock test schedule must fall within the competition timeline");
            }
        }

        if ("FINAL".equalsIgnoreCase(asmt.getType())) {
            if (asmt.getDurationMinutes() == null || asmt.getDurationMinutes() <= 0) {
                throw new BadRequestException("Final Assessment duration minutes must be configured (> 0)");
            }
            if (comp.getFinalUnlockAt() == null) {
                throw new BadRequestException("Final Assessment unlock date/time must be configured on the competition");
            }
            if (asmt.getStartAt() == null && comp.getFinalUnlockAt() != null) {
                asmt.setStartAt(comp.getFinalUnlockAt());
            }
            if (asmt.getEndAt() == null && comp.getEndAt() != null) {
                asmt.setEndAt(comp.getEndAt());
            }
            List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(comp.getId());
            for (String code : List.of("A", "B", "C", "D")) {
                boolean hasTrainer = sets.stream()
                        .anyMatch(s -> code.equalsIgnoreCase(s.getCode()) && s.getTrainerId() != null && !s.getTrainerId().isBlank());
                if (!hasTrainer) {
                    throw new BadRequestException("All four set trainers (Sets A, B, C, D) must be assigned before publishing the Final Assessment");
                }
            }
        }

        asmt.setStatus("PUBLISHED");
        CompetitionAssessment saved = assessmentRepository.save(asmt);
        saved.setQuestionCount((long) questions.size());
        saved.setTargetQuestions(questions.size());
        return saved;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getRepublishInfo(String asmtId) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        int currentVer = asmt.getPublishVersion() != null ? asmt.getPublishVersion() : 1;
        long attemptCount = (assessmentAttemptRepository != null)
                ? assessmentAttemptRepository.countByAssessmentId(asmtId)
                : 0;
        Map<String, Object> info = new HashMap<>();
        info.put("assessmentId", asmtId);
        info.put("title", asmt.getTitle());
        info.put("publishVersion", currentVer);
        info.put("attemptCount", attemptCount);
        return info;
    }

    @Transactional
    public CompetitionAssessment republishAssessment(String asmtId) {
        return republishAssessment(asmtId, null);
    }

    /**
     * Task K7: Republish permanently deletes ALL previous attempt data for that test
     * across all students in ONE DB transaction (attempts, answers, scores, trainer
     * evaluations/marks, reviews, proctor events, leaderboard cache/entries), increments
     * publishVersion, logs an audit row, notifies candidates, and deletes related objects from Bunny Storage.
     */
    @Transactional
    public CompetitionAssessment republishAssessment(String asmtId, User adminUser) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        if (questions.isEmpty()) {
            throw new BadRequestException("Assessment must have at least one question before republishing");
        }

        int computedTotalMarks = 0;
        for (AssessmentQuestion q : questions) {
            computedTotalMarks += (q.getMarks() != null ? q.getMarks() : 1);
            if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
                if (options.size() < 2) {
                    throw new BadRequestException("Every MCQ question must have at least 2 options: " + q.getQuestionText());
                }
                long correctCount = options.stream().filter(o -> Boolean.TRUE.equals(o.getIsCorrect())).count();
                if (correctCount != 1) {
                    throw new BadRequestException("Every MCQ question must have exactly one correct option: " + q.getQuestionText());
                }
            }
        }
        asmt.setTotalMarks(computedTotalMarks);

        List<String> voiceFilesToDelete = new ArrayList<>();
        int deletedAttemptsCount = 0;
        int deletedAnswersCount = 0;

        if (assessmentAttemptRepository != null) {
            List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByAssessmentId(asmtId);
            deletedAttemptsCount = attempts.size();

            for (AssessmentAttempt att : attempts) {
                if (examProctorEventRepository != null) {
                    try {
                        examProctorEventRepository.deleteByAttemptId(att.getId());
                    } catch (Exception e) {
                        log.warn("Failed to delete proctor events for attempt {}: {}", att.getId(), e.getMessage());
                    }
                }

                if (attemptAnswerRepository != null) {
                    List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
                    deletedAnswersCount += answers.size();
                    for (AttemptAnswer ans : answers) {
                        if (ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()) {
                            voiceFilesToDelete.add(ans.getVoiceFileId());
                        }
                        if (ans.getAudioFileId() != null && !ans.getAudioFileId().isBlank()) {
                            voiceFilesToDelete.add(ans.getAudioFileId());
                        }
                        if (voiceEvaluationScoreRepository != null) {
                            try {
                                List<VoiceEvaluationScore> scores = voiceEvaluationScoreRepository.findByAnswerId(ans.getId());
                                if (!scores.isEmpty()) {
                                    voiceEvaluationScoreRepository.deleteAll(scores);
                                }
                            } catch (Exception e) {
                                log.warn("Failed to delete voice evaluation scores for answer {}: {}", ans.getId(), e.getMessage());
                            }
                        }
                    }
                    if (!answers.isEmpty()) {
                        attemptAnswerRepository.deleteAll(answers);
                    }
                }
            }

            if (!attempts.isEmpty()) {
                assessmentAttemptRepository.deleteAll(attempts);
            }
        }

        // Delete voice stored_files rows from database
        if (storedFileRepository != null && !voiceFilesToDelete.isEmpty()) {
            for (String fileId : voiceFilesToDelete) {
                try {
                    storedFileRepository.deleteById(fileId);
                } catch (Exception e) {
                    log.warn("Failed to delete stored_files record {}: {}", fileId, e.getMessage());
                }
            }
        }

        // Clear leaderboard cache and entries for this competition so rankings are cleanly recomputed
        if (leaderboardCacheRepository != null) {
            try {
                leaderboardCacheRepository.deleteByCompetitionId(asmt.getCompetitionId());
            } catch (Exception ignored) {}
        }
        if (leaderboardEntryRepository != null) {
            try {
                leaderboardEntryRepository.deleteByCompetitionId(asmt.getCompetitionId());
            } catch (Exception ignored) {}
        }
        if (entityManager != null) {
            try {
                entityManager.flush();
            } catch (Exception ignored) {}
        }

        int currentVer = asmt.getPublishVersion() != null ? asmt.getPublishVersion() : 1;
        int nextVer = currentVer + 1;
        asmt.setPublishVersion(nextVer);
        asmt.setRepublishedAt(OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));
        asmt.setStatus("PUBLISHED");

        CompetitionAssessment saved = assessmentRepository.save(asmt);
        saved.setQuestionCount((long) questions.size());
        saved.setTargetQuestions(questions.size());

        // Regenerate sets if this is a FINAL assessment and sets exist
        if ("FINAL".equalsIgnoreCase(asmt.getType()) && setRepository != null) {
            try {
                List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(asmt.getCompetitionId());
                if (!sets.isEmpty() && assessmentSetQuestionRepository != null) {
                    if (assessmentSetOptionRepository != null) {
                        assessmentSetOptionRepository.deleteByAssessmentId(asmtId);
                    }
                    assessmentSetQuestionRepository.deleteByAssessmentId(asmtId);
                    if (entityManager != null) {
                        entityManager.flush();
                    }
                    for (int sIdx = 0; sIdx < sets.size(); sIdx++) {
                        CompetitionSet set = sets.get(sIdx);
                        List<AssessmentQuestion> setQuestions = new ArrayList<>(questions);
                        long seed = (long) set.getCode().hashCode() * 31L + (sIdx + 1) * 17L;
                        Collections.shuffle(setQuestions, new Random(seed));

                        for (int pos = 0; pos < setQuestions.size(); pos++) {
                            AssessmentQuestion q = setQuestions.get(pos);
                            AssessmentSetQuestion asq = new AssessmentSetQuestion(
                                    "asq_" + UUID.randomUUID(),
                                    asmtId,
                                    set.getId(),
                                    q.getId(),
                                    pos
                            );
                            assessmentSetQuestionRepository.save(asq);

                            if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                                List<QuestionOption> options = new ArrayList<>(questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId()));
                                if (!options.isEmpty()) {
                                    long optSeed = seed + pos * 13L;
                                    Collections.shuffle(options, new Random(optSeed));
                                    for (int oPos = 0; oPos < options.size(); oPos++) {
                                        QuestionOption opt = options.get(oPos);
                                        AssessmentSetOption aso = new AssessmentSetOption(
                                                "aso_" + UUID.randomUUID(),
                                                asmtId,
                                                set.getId(),
                                                q.getId(),
                                                opt.getId(),
                                                oPos
                                        );
                                        if (assessmentSetOptionRepository != null) {
                                            assessmentSetOptionRepository.save(aso);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (entityManager != null) {
                        entityManager.flush();
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to regenerate set papers on republish: {}", e.getMessage());
            }
        }

        // Write an audit row per republish (M5 requirement 6)
        if (republishAuditRepository != null) {
            RepublishAudit audit = new RepublishAudit(
                    "rep_aud_" + UUID.randomUUID(),
                    asmtId,
                    adminUser != null ? adminUser.getId() : null,
                    deletedAttemptsCount,
                    deletedAnswersCount,
                    voiceFilesToDelete.size(),
                    currentVer,
                    nextVer
            );
            republishAuditRepository.save(audit);
        }

        // Notify candidates that the test is available again (M5 requirement)
        if (notificationService != null) {
            try {
                List<CompetitionRegistration> regs = registrationRepository.findByCompetitionId(asmt.getCompetitionId());
                for (CompetitionRegistration r : regs) {
                    if (r.getStudentId() != null) {
                        notificationService.createNotification(
                                r.getStudentId(),
                                asmt.getTitle() + " is available again",
                                "The test has been republished by the administrator. You may now start a fresh attempt.",
                                "STUDENT"
                        );
                    }
                }
            } catch (Exception ignored) {}
        }

        // After the transaction commits, delete related objects from Bunny Storage with retry (M5 requirement 2)
        for (String fileId : voiceFilesToDelete) {
            int retries = 3;
            while (retries > 0) {
                try {
                    fileStorageService.deleteFile(fileId);
                    break;
                } catch (Exception e) {
                    retries--;
                    if (retries == 0) {
                        log.warn("Failed to delete Bunny object {} after retries: {}", fileId, e.getMessage());
                    }
                }
            }
        }

        return saved;
    }

    // --- Questions Builder (Phase 7) ---
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAssessmentQuestions(String asmtId) {
        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (AssessmentQuestion q : questions) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", q.getId());
            map.put("assessmentId", q.getAssessmentId());
            map.put("sortOrder", q.getSortOrder());

            String effectiveFormat = q.getQuestionFormat();
            if ((effectiveFormat == null || "MCQ".equalsIgnoreCase(effectiveFormat) || "TEXT".equalsIgnoreCase(effectiveFormat)) && q.getMediaRef() != null && !q.getMediaRef().isBlank()) {
                String refLower = q.getMediaRef().toLowerCase();
                if (refLower.matches(".*\\.(png|jpe?g|webp|gif|svg)(\\?.*)?$")) {
                    effectiveFormat = "IMAGE";
                } else if (refLower.matches(".*\\.(mp3|wav|ogg|m4a|opus|aac)(\\?.*)?$")) {
                    effectiveFormat = "AUDIO";
                } else if (refLower.matches(".*\\.(mp4|webm|mov|mkv)(\\?.*)?$")) {
                    effectiveFormat = "VIDEO";
                } else if (storedFileRepository != null) {
                    Optional<StoredFile> sfOpt = storedFileRepository.findById(q.getMediaRef());
                    if (sfOpt.isPresent()) {
                        String ct = sfOpt.get().getContentType() != null ? sfOpt.get().getContentType().toLowerCase() : "";
                        if (ct.startsWith("image/")) effectiveFormat = "IMAGE";
                        else if (ct.startsWith("audio/")) effectiveFormat = "AUDIO";
                        else if (ct.startsWith("video/")) effectiveFormat = "VIDEO";
                    }
                }
            }
            map.put("questionFormat", effectiveFormat != null ? effectiveFormat : "MCQ");
            map.put("questionText", q.getQuestionText());
            map.put("mediaRef", q.getMediaRef());
            map.put("answerFormat", q.getAnswerFormat());
            map.put("guidanceText", q.getGuidanceText());
            map.put("maxDurationSeconds", q.getMaxDurationSeconds());
            map.put("marks", q.getMarks());
            map.put("explanation", q.getExplanation());
            map.put("status", q.getStatus());

            List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
            map.put("options", options);

            List<AssessmentEvaluationCriteria> criteria = evaluationCriteriaRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
            map.put("evaluationCriteria", criteria);

            result.add(map);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> saveQuestion(String asmtId, Map<String, Object> payload) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);

        String qId = (String) payload.get("id");
        boolean isNew = (qId == null || qId.isBlank() || !questionRepository.existsById(qId));

        // Task K3: Admin can add, edit (text, options, correct answer, marks, media, formats),
        // reorder, and delete questions at any time on published assessments without blocking.
        // A non-blocking banner is displayed in the UI when attempts exist for the current version.
        // Existing attempts are preserved with their original stored scores until Republish (K7) is pressed.

        String qFormat = (String) payload.getOrDefault("questionFormat", "MCQ");
        String aFormat = (String) payload.getOrDefault("answerFormat", "MCQ_OPTIONS");

        // Format validation: Fill in the blank is rejected everywhere
        if ("FILL_BLANK".equalsIgnoreCase(qFormat) || "FILL_BLANK".equalsIgnoreCase(aFormat)) {
            throw new BadRequestException("Fill-in-the-blank format is not supported");
        }
        if ("IMAGE".equalsIgnoreCase(qFormat)) {
            String mRef = (String) payload.get("mediaRef");
            if (mRef == null || mRef.trim().isEmpty()) {
                throw new BadRequestException("Image question requires an uploaded image");
            }
        } else if ("AUDIO".equalsIgnoreCase(qFormat) || "VIDEO".equalsIgnoreCase(qFormat)) {
            String mRef = (String) payload.get("mediaRef");
            if (mRef == null || mRef.trim().isEmpty()) {
                String typeName = qFormat.toLowerCase();
                throw new BadRequestException("Please upload an " + (typeName.startsWith("a") ? "audio" : "video") + " file for this question.");
            }
        }

        AssessmentQuestion q = isNew ? new AssessmentQuestion() : questionRepository.findById(qId).orElse(new AssessmentQuestion());
        if (isNew) {
            q.setId("aq_" + UUID.randomUUID());
        }
        q.setAssessmentId(asmtId);
        if (payload.get("questionText") != null) q.setQuestionText((String) payload.get("questionText"));
        if (payload.get("questionFormat") != null) q.setQuestionFormat(qFormat);
        if (payload.get("answerFormat") != null) q.setAnswerFormat(aFormat);
        if (payload.get("mediaRef") != null) q.setMediaRef((String) payload.get("mediaRef"));
        if (payload.get("guidanceText") != null) q.setGuidanceText((String) payload.get("guidanceText"));
        if (payload.get("maxDurationSeconds") != null) q.setMaxDurationSeconds(((Number) payload.get("maxDurationSeconds")).intValue());
        if (payload.get("marks") != null) q.setMarks(((Number) payload.get("marks")).intValue());
        if (payload.get("sortOrder") != null) q.setSortOrder(((Number) payload.get("sortOrder")).intValue());
        if (payload.get("explanation") != null) q.setExplanation((String) payload.get("explanation"));
        if (payload.get("status") != null) q.setStatus((String) payload.get("status"));
        q = questionRepository.save(q);

        // Options
        if (payload.containsKey("options")) {
            questionOptionRepository.deleteByQuestionId(q.getId());
            List<Map<String, Object>> optionsList = (List<Map<String, Object>>) payload.get("options");
            if (optionsList != null) {
                int order = 0;
                for (Map<String, Object> optMap : optionsList) {
                    QuestionOption opt = new QuestionOption();
                    if (optMap.get("id") != null && !((String) optMap.get("id")).isBlank()) {
                        try { opt.setId(UUID.fromString((String) optMap.get("id"))); } catch (Exception ignored) {}
                    }
                    opt.setQuestionId(q.getId());
                    opt.setText((String) optMap.get("text"));
                    opt.setIsCorrect(Boolean.TRUE.equals(optMap.get("isCorrect")));
                    opt.setSortOrder(optMap.get("sortOrder") != null ? ((Number) optMap.get("sortOrder")).intValue() : order++);
                    questionOptionRepository.save(opt);
                }
            }
        }

        // Voice Evaluation Criteria
        if (payload.containsKey("evaluationCriteria")) {
            evaluationCriteriaRepository.deleteByQuestionId(q.getId());
            List<Map<String, Object>> criteriaList = (List<Map<String, Object>>) payload.get("evaluationCriteria");
            if (criteriaList != null) {
                int cOrder = 0;
                for (Map<String, Object> cMap : criteriaList) {
                    AssessmentEvaluationCriteria crit = new AssessmentEvaluationCriteria();
                    crit.setId("aec_" + UUID.randomUUID());
                    crit.setQuestionId(q.getId());
                    crit.setTitle((String) cMap.get("title"));
                    crit.setMaxMarks(cMap.get("maxMarks") != null ? ((Number) cMap.get("maxMarks")).intValue() : 5);
                    crit.setSortOrder(cMap.get("sortOrder") != null ? ((Number) cMap.get("sortOrder")).intValue() : cOrder++);
                    evaluationCriteriaRepository.save(crit);
                }
            }
        }

        // Auto-update parent assessment totalMarks to sum of question marks
        List<AssessmentQuestion> allQs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        int sumMarks = allQs.stream().mapToInt(item -> item.getMarks() != null ? item.getMarks() : 1).sum();
        asmt.setTotalMarks(sumMarks);
        assessmentRepository.save(asmt);

        final String finalQId = q.getId();
        return getAssessmentQuestions(asmtId).stream().filter(m -> finalQId.equals(m.get("id"))).findFirst().orElse(null);
    }

    @Transactional
    public void deleteQuestion(String questionId) {
        AssessmentQuestion q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));
        String asmtId = q.getAssessmentId();
        CompetitionAssessment asmt = assessmentRepository.findById(asmtId).orElse(null);
        // Task K3: Admin can delete questions without blocking even if attempts exist.
        questionRepository.delete(q);
        if (asmt != null) {
            List<AssessmentQuestion> allQs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
            int sumMarks = allQs.stream().mapToInt(item -> item.getMarks() != null ? item.getMarks() : 1).sum();
            asmt.setTotalMarks(sumMarks);
            assessmentRepository.save(asmt);
        }
    }

    // --- Student Competition Portal Context ---
    @Transactional(readOnly = true)
    public Map<String, Object> getStudentPortalContext(String compId, User user) {
        Competition comp = getCompetitionById(compId);

        List<CompetitionRegistration> regs = new ArrayList<>(registrationRepository.findByStudentId(user.getId()));
        if (user.getEmail() != null) {
            for (CompetitionRegistration r : registrationRepository.findByStudentEmailIgnoreCase(user.getEmail())) {
                if (regs.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                    regs.add(r);
                }
            }
        }

        CompetitionRegistration reg = regs.stream()
                .filter(r -> (r.getCompetition() != null && compId.equals(r.getCompetition().getId()))
                        || compId.equals(r.getCompetitionId()))
                .filter(r -> "PAID".equalsIgnoreCase(r.getPaymentStatus()))
                .findFirst()
                .orElse(null);

        if ("STUDENT".equalsIgnoreCase(user.getRole()) && reg == null) {
            throw new ForbiddenException("You are not registered for this competition");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("competition", comp);
        result.put("registration", reg);
        result.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));

        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCompetitionOverview(String compId) {
        Competition comp = getCompetitionById(compId);
        List<CompetitionRegistration> regs = registrationRepository.findByCompetitionId(compId);
        long totalRegs = regs.size();
        long paidRegs = regs.stream().filter(r -> isPaid(r.getPaymentStatus())).count();
        long pendingRegs = totalRegs - paidRegs;

        List<Map<String, Object>> setsDetails = getSetsWithDetails(compId);

        boolean hasSyllabus = syllabusRepository.findByCompetitionId(compId).isPresent();
        long videoCount = guidanceVideoRepository.findByCompetitionIdOrderBySortOrderAsc(compId).size();
        long materialCount = studyMaterialRepository.findByCompetitionIdOrderBySortOrderAsc(compId).size();

        List<CompetitionAssessment> asmts = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(compId);
        long publishedAsmts = asmts.stream().filter(a -> "PUBLISHED".equalsIgnoreCase(a.getStatus())).count();

        Map<String, Object> evalsProgress = new HashMap<>();
        long totalAttempts = assessmentAttemptRepository != null ? assessmentAttemptRepository.count() : 0;
        evalsProgress.put("totalAttempts", totalAttempts);

        Map<String, Object> overview = new HashMap<>();
        overview.put("competition", comp);
        overview.put("totalRegistrations", totalRegs);
        overview.put("paidRegistrations", paidRegs);
        overview.put("pendingRegistrations", pendingRegs);
        overview.put("sets", setsDetails);
        overview.put("hasSyllabus", hasSyllabus);
        overview.put("guidanceVideosCount", videoCount);
        overview.put("studyMaterialsCount", materialCount);
        overview.put("totalAssessmentsCount", asmts.size());
        overview.put("publishedAssessmentsCount", publishedAsmts);
        overview.put("evaluationsProgress", evalsProgress);
        overview.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));

        return overview;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRegisteredStudentsWithDetails(String compId) {
        List<CompetitionRegistration> regs = registrationRepository.findByCompetitionId(compId);
        List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(compId);
        Map<String, String> setIdToCode = sets.stream().collect(Collectors.toMap(CompetitionSet::getId, CompetitionSet::getCode, (a, b) -> a));

        List<Map<String, Object>> list = new ArrayList<>();
        for (CompetitionRegistration r : regs) {
            // Strictly include only paid/confirmed registrations
            if (!isPaid(r.getPaymentStatus())) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("id", r.getId());
            item.put("studentId", r.getStudentId());
            item.put("studentName", r.getStudentName());
            item.put("studentEmail", r.getStudentEmail());
            item.put("studentPhone", r.getStudentPhone());
            item.put("paymentStatus", r.getPaymentStatus());
            item.put("amount", r.getAmount());
            item.put("amountPaise", r.getAmountPaise());
            item.put("createdAt", r.getCreatedAt());
            item.put("paidAt", r.getPaidAt());

            Optional<CompetitionSetMember> mem = setMemberRepository.findByRegistrationId(r.getId());
            if (mem.isPresent()) {
                item.put("setId", mem.get().getSetId());
                item.put("setCode", setIdToCode.get(mem.get().getSetId()));
            } else {
                item.put("setId", null);
                item.put("setCode", null);
            }
            list.add(item);
        }
        return list;
    }

    @Transactional
    public Map<String, Object> duplicateQuestion(String questionId) {
        AssessmentQuestion q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));
        if (assessmentAttemptRepository != null && assessmentAttemptRepository.countByAssessmentId(q.getAssessmentId()) > 0) {
            throw new BadRequestException("Cannot duplicate question in an assessment that already has student attempts");
        }

        AssessmentQuestion copy = new AssessmentQuestion();
        copy.setId("aq_" + UUID.randomUUID());
        copy.setAssessmentId(q.getAssessmentId());
        copy.setQuestionFormat(q.getQuestionFormat());
        copy.setQuestionText(q.getQuestionText() + " (Copy)");
        copy.setMediaRef(q.getMediaRef());
        copy.setAnswerFormat(q.getAnswerFormat());
        copy.setGuidanceText(q.getGuidanceText());
        copy.setMaxDurationSeconds(q.getMaxDurationSeconds());
        copy.setMarks(q.getMarks());
        copy.setSortOrder(q.getSortOrder() != null ? q.getSortOrder() + 1 : 1);
        copy.setExplanation(q.getExplanation());
        copy.setStatus(q.getStatus());
        AssessmentQuestion savedCopy = questionRepository.save(copy);

        List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
        for (QuestionOption opt : options) {
            QuestionOption optCopy = new QuestionOption();
            optCopy.setQuestionId(savedCopy.getId());
            optCopy.setText(opt.getText());
            optCopy.setIsCorrect(opt.getIsCorrect());
            optCopy.setSortOrder(opt.getSortOrder());
            questionOptionRepository.save(optCopy);
        }

        List<AssessmentEvaluationCriteria> criteria = evaluationCriteriaRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
        for (AssessmentEvaluationCriteria crit : criteria) {
            AssessmentEvaluationCriteria critCopy = new AssessmentEvaluationCriteria();
            critCopy.setId("aec_" + UUID.randomUUID());
            critCopy.setQuestionId(savedCopy.getId());
            critCopy.setTitle(crit.getTitle());
            critCopy.setMaxMarks(crit.getMaxMarks());
            critCopy.setSortOrder(crit.getSortOrder());
            evaluationCriteriaRepository.save(critCopy);
        }

        return getAssessmentQuestions(savedCopy.getAssessmentId()).stream()
                .filter(m -> savedCopy.getId().equals(m.get("id")))
                .findFirst()
                .orElse(null);
    }

    @Transactional
    public List<Map<String, Object>> reorderQuestions(String asmtId, List<String> questionIds) {
        if (questionIds == null || questionIds.isEmpty()) return getAssessmentQuestions(asmtId);
        for (int i = 0; i < questionIds.size(); i++) {
            String qId = questionIds.get(i);
            Optional<AssessmentQuestion> qOpt = questionRepository.findById(qId);
            if (qOpt.isPresent() && asmtId.equals(qOpt.get().getAssessmentId())) {
                AssessmentQuestion q = qOpt.get();
                q.setSortOrder(i);
                questionRepository.save(q);
            }
        }
        return getAssessmentQuestions(asmtId);
    }

    // --- Phase 1: Test Series & Assessment Execution ---

    public CompetitionRegistration getStudentPaidRegistration(String compId, User user) {
        if (user == null) return null;
        List<CompetitionRegistration> regs = new ArrayList<>(registrationRepository.findByStudentId(user.getId()));
        if (user.getEmail() != null) {
            for (CompetitionRegistration r : registrationRepository.findByStudentEmailIgnoreCase(user.getEmail())) {
                if (regs.stream().noneMatch(existing -> existing.getId().equals(r.getId()))) {
                    regs.add(r);
                }
            }
        }
        return regs.stream()
                .filter(r -> (r.getCompetition() != null && compId.equals(r.getCompetition().getId()))
                        || compId.equals(r.getCompetitionId()))
                .filter(r -> isPaid(r.getPaymentStatus()))
                .findFirst()
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStudentTestSeries(String compId, User user) {
        Competition comp = getCompetitionById(compId);
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();

        CompetitionRegistration reg = null;
        if ("STUDENT".equals(role)) {
            reg = getStudentPaidRegistration(compId, user);
            if (reg == null) {
                throw new ForbiddenException("You are not registered for this competition");
            }
        } else {
            reg = getStudentPaidRegistration(compId, user);
        }

        List<CompetitionAssessment> asmts = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(compId)
                .stream()
                .filter(a -> "TEST_SERIES".equalsIgnoreCase(a.getType()))
                .collect(Collectors.toList());

        List<Map<String, Object>> testList = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        String regId = reg != null ? reg.getId() : (user != null ? "reg_admin_" + user.getId() : null);

        for (CompetitionAssessment a : asmts) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("competitionId", a.getCompetitionId());
            item.put("type", a.getType());
            item.put("sequenceNo", a.getSequenceNo());
            item.put("title", a.getTitle());
            item.put("durationMinutes", null); // Test Series has no duration limit
            item.put("status", a.getStatus()); // DRAFT or PUBLISHED

            List<AssessmentQuestion> qs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(a.getId());
            int dynMarks = qs.stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum();
            item.put("totalMarks", dynMarks);
            item.put("questionCount", (long) qs.size());
            item.put("targetQuestions", qs.size());

            int currentVer = a.getPublishVersion() != null ? a.getPublishVersion() : 1;
            item.put("publishVersion", currentVer);

            boolean isPublished = "PUBLISHED".equalsIgnoreCase(a.getStatus());

            if (!isPublished) {
                item.put("attemptStatus", "UNPUBLISHED");
            } else if (regId != null && assessmentAttemptRepository != null) {
                Optional<AssessmentAttempt> attOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(a.getId(), regId, currentVer);
                if (attOpt.isEmpty()) {
                    item.put("attemptStatus", "NOT_STARTED");
                } else {
                    AssessmentAttempt att = attOpt.get();
                    item.put("attemptStatus", att.getStatus());
                    item.put("attemptId", att.getId());
                    item.put("startedAt", att.getStartedAt());
                    item.put("submittedAt", att.getSubmittedAt());

                    boolean hidePendingScores = "EVALUATION_PENDING".equalsIgnoreCase(att.getStatus());
                    if (!hidePendingScores) {
                        item.put("mcqMarks", att.getMcqMarks());
                        item.put("voiceMarks", att.getVoiceMarks());
                        item.put("totalMarksAwarded", att.getTotalMarks());
                    }

                    if (attemptAnswerRepository != null) {
                        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
                        item.put("answeredCount", answers.size());
                        long voiceTotal = answers.stream().filter(ans -> ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()).count();
                        long voiceEvaluated = answers.stream().filter(ans -> "EVALUATED".equalsIgnoreCase(ans.getEvaluationStatus()) && ans.getVoiceFileId() != null).count();
                        item.put("voiceQuestionsCount", voiceTotal);
                        item.put("voiceEvaluatedCount", voiceEvaluated);
                    }
                }
            } else {
                item.put("attemptStatus", "NOT_STARTED");
            }
            testList.add(item);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("competitionId", compId);
        response.put("competitionTitle", comp.getTitle());
        response.put("testSeries", testList);
        response.put("serverNow", now);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStudentMockTests(String compId, User user) {
        Competition comp = getCompetitionById(compId);
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();

        CompetitionRegistration reg = null;
        if ("STUDENT".equals(role)) {
            reg = getStudentPaidRegistration(compId, user);
            if (reg == null) {
                throw new ForbiddenException("You are not registered for this competition");
            }
        } else {
            reg = getStudentPaidRegistration(compId, user);
        }

        List<CompetitionAssessment> mocks = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(compId)
                .stream()
                .filter(a -> "MOCK".equalsIgnoreCase(a.getType()))
                .collect(Collectors.toList());

        List<Map<String, Object>> mockList = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        String regId = reg != null ? reg.getId() : (user != null ? "reg_admin_" + user.getId() : null);

        for (CompetitionAssessment a : mocks) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("competitionId", a.getCompetitionId());
            item.put("type", a.getType());
            item.put("sequenceNo", a.getSequenceNo());
            item.put("title", a.getTitle());
            item.put("durationMinutes", a.getDurationMinutes());
            item.put("startAt", a.getStartAt());
            item.put("endAt", a.getEndAt());
            item.put("status", a.getStatus()); // DRAFT or PUBLISHED

            List<AssessmentQuestion> qs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(a.getId());
            int dynMarks = qs.stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum();
            item.put("totalMarks", dynMarks);
            item.put("questionCount", (long) qs.size());
            item.put("targetQuestions", qs.size());

            int currentVer = a.getPublishVersion() != null ? a.getPublishVersion() : 1;
            item.put("publishVersion", currentVer);

            boolean isPublished = "PUBLISHED".equalsIgnoreCase(a.getStatus());

            // Determine Window Status & Attempt Status
            String windowStatus = "UPCOMING";
            long secondsToStart = 0;
            long secondsToEnd = 0;

            if (a.getStartAt() != null && a.getEndAt() != null) {
                if (now.isBefore(a.getStartAt())) {
                    windowStatus = "UPCOMING";
                    secondsToStart = java.time.Duration.between(now, a.getStartAt()).getSeconds();
                } else if (now.isAfter(a.getEndAt())) {
                    windowStatus = "EXPIRED";
                } else {
                    windowStatus = "LIVE";
                    secondsToEnd = java.time.Duration.between(now, a.getEndAt()).getSeconds();
                }
            } else {
                windowStatus = isPublished ? "LIVE" : "DRAFT";
            }
            item.put("windowStatus", windowStatus);
            item.put("secondsToStart", secondsToStart);
            item.put("secondsToEnd", secondsToEnd);

            if (!isPublished) {
                item.put("attemptStatus", "UNPUBLISHED");
            } else if (regId != null && assessmentAttemptRepository != null) {
                Optional<AssessmentAttempt> attOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(a.getId(), regId, currentVer);
                if (attOpt.isEmpty()) {
                    if ("UPCOMING".equals(windowStatus)) {
                        item.put("attemptStatus", "UPCOMING_LOCKED");
                    } else if ("EXPIRED".equals(windowStatus)) {
                        item.put("attemptStatus", "MISSED");
                    } else {
                        item.put("attemptStatus", "NOT_STARTED");
                    }
                } else {
                    AssessmentAttempt att = attOpt.get();
                    item.put("attemptStatus", att.getStatus());
                    item.put("attemptId", att.getId());
                    item.put("startedAt", att.getStartedAt());
                    item.put("submittedAt", att.getSubmittedAt());

                    boolean hidePendingScores = "EVALUATION_PENDING".equalsIgnoreCase(att.getStatus());
                    if (!hidePendingScores) {
                        item.put("mcqMarks", att.getMcqMarks());
                        item.put("voiceMarks", att.getVoiceMarks());
                        item.put("totalMarksAwarded", att.getTotalMarks());
                    }

                    if (attemptAnswerRepository != null) {
                        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
                        item.put("answeredCount", answers.size());
                        long voiceTotal = answers.stream().filter(ans -> ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()).count();
                        long voiceEvaluated = answers.stream().filter(ans -> "EVALUATED".equalsIgnoreCase(ans.getEvaluationStatus()) && ans.getVoiceFileId() != null).count();
                        item.put("voiceQuestionsCount", voiceTotal);
                        item.put("voiceEvaluatedCount", voiceEvaluated);
                    }
                }
            } else {
                item.put("attemptStatus", "UPCOMING".equals(windowStatus) ? "UPCOMING_LOCKED" : "NOT_STARTED");
            }
            mockList.add(item);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("competitionId", compId);
        response.put("competitionTitle", comp.getTitle());
        response.put("mockTests", mockList);
        response.put("serverNow", now);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStudentFinalAssessment(String compId, User user) {
        Competition comp = getCompetitionById(compId);
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();

        CompetitionRegistration reg = null;
        if ("STUDENT".equals(role)) {
            reg = getStudentPaidRegistration(compId, user);
            if (reg == null) {
                throw new ForbiddenException("You are not registered for this competition");
            }
        } else {
            reg = getStudentPaidRegistration(compId, user);
        }

        CompetitionAssessment finalAsmt = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(compId)
                .stream()
                .filter(a -> "FINAL".equalsIgnoreCase(a.getType()))
                .findFirst()
                .orElse(null);

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        Map<String, Object> response = new HashMap<>();
        response.put("competitionId", compId);
        response.put("competitionTitle", comp.getTitle());
        response.put("serverNow", now);

        // Assigned Set (available strictly to staff; hidden from students)
        Map<String, Object> assignedSetMap = null;
        if (!"STUDENT".equals(role) && reg != null) {
            Optional<CompetitionSetMember> memOpt = setMemberRepository.findByRegistrationId(reg.getId());
            if (memOpt.isPresent()) {
                String assignedSetId = memOpt.get().getSetId();
                Optional<CompetitionSet> setOpt = setRepository.findById(assignedSetId);
                if (setOpt.isPresent()) {
                    CompetitionSet s = setOpt.get();
                    Map<String, Object> setMap = new HashMap<>();
                    setMap.put("id", s.getId());
                    setMap.put("code", s.getCode());
                    setMap.put("title", "Championship Paper - Set " + s.getCode());
                    setMap.put("trainerId", s.getTrainerId());
                    if (s.getTrainerId() != null) {
                        userRepository.findById(s.getTrainerId()).ifPresent(tr -> {
                            setMap.put("trainerName", tr.getName());
                            setMap.put("trainerEmail", tr.getEmail());
                        });
                    }
                    assignedSetMap = setMap;
                }
            }
            response.put("assignedSet", assignedSetMap);
        }

        if (finalAsmt == null) {
            response.put("hasFinalAssessment", false);
            return response;
        }

        OffsetDateTime effectiveStart = finalAsmt.getStartAt() != null ? finalAsmt.getStartAt() : comp.getFinalUnlockAt();
        OffsetDateTime effectiveEnd = finalAsmt.getEndAt() != null ? finalAsmt.getEndAt() : comp.getEndAt();

        response.put("hasFinalAssessment", true);
        Map<String, Object> item = new HashMap<>();
        item.put("id", finalAsmt.getId());
        item.put("competitionId", finalAsmt.getCompetitionId());
        item.put("type", finalAsmt.getType());
        item.put("sequenceNo", finalAsmt.getSequenceNo());
        item.put("title", finalAsmt.getTitle());
        item.put("durationMinutes", finalAsmt.getDurationMinutes());
        item.put("startAt", effectiveStart);
        item.put("endAt", effectiveEnd);
        item.put("status", finalAsmt.getStatus());

        List<AssessmentQuestion> qs = questionRepository.findByAssessmentIdOrderBySortOrderAsc(finalAsmt.getId());
        int dynMarks = qs.stream().mapToInt(q -> q.getMarks() != null ? q.getMarks() : 1).sum();
        item.put("totalMarks", dynMarks);
        item.put("questionCount", (long) qs.size());
        item.put("targetQuestions", qs.size());

        int currentVer = finalAsmt.getPublishVersion() != null ? finalAsmt.getPublishVersion() : 1;
        item.put("publishVersion", currentVer);

        boolean isPublished = "PUBLISHED".equalsIgnoreCase(finalAsmt.getStatus());

        // Window status
        String windowStatus = "UPCOMING";
        long secondsToStart = 0;
        long secondsToEnd = 0;

        if (effectiveStart == null) {
            windowStatus = isPublished ? "UNANNOUNCED" : "DRAFT";
        } else if (now.isBefore(effectiveStart)) {
            windowStatus = "UPCOMING";
            secondsToStart = java.time.Duration.between(now, effectiveStart).getSeconds();
        } else if (effectiveEnd != null && now.isAfter(effectiveEnd)) {
            windowStatus = "EXPIRED";
        } else {
            windowStatus = "LIVE";
            if (effectiveEnd != null) {
                secondsToEnd = java.time.Duration.between(now, effectiveEnd).getSeconds();
            }
        }
        item.put("windowStatus", windowStatus);
        item.put("status", windowStatus);
        item.put("opensAt", effectiveStart);
        item.put("closesAt", effectiveEnd);
        item.put("secondsToStart", secondsToStart);
        item.put("secondsToEnd", secondsToEnd);

        String regId = reg != null ? reg.getId() : (user != null ? "reg_admin_" + user.getId() : null);
        if (!isPublished) {
            item.put("attemptStatus", "UNPUBLISHED");
        } else if (regId != null && assessmentAttemptRepository != null) {
            Optional<AssessmentAttempt> attOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(finalAsmt.getId(), regId, currentVer);
            if (attOpt.isEmpty()) {
                if ("UPCOMING".equals(windowStatus)) {
                    item.put("attemptStatus", "UPCOMING_LOCKED");
                } else if ("EXPIRED".equals(windowStatus)) {
                    item.put("attemptStatus", "MISSED");
                } else {
                    item.put("attemptStatus", "NOT_STARTED");
                }
            } else {
                AssessmentAttempt att = attOpt.get();
                item.put("attemptStatus", att.getStatus());
                item.put("attemptId", att.getId());
                item.put("startedAt", att.getStartedAt());
                item.put("submittedAt", att.getSubmittedAt());
                item.put("mcqMarks", att.getMcqMarks());
                item.put("voiceMarks", att.getVoiceMarks());
                item.put("totalMarksAwarded", att.getTotalMarks());
                item.put("setId", att.getSetId());

                if (attemptAnswerRepository != null) {
                    List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
                    item.put("answeredCount", answers.size());
                    long voiceTotal = answers.stream().filter(ans -> ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()).count();
                    long voiceEvaluated = answers.stream().filter(ans -> "EVALUATED".equalsIgnoreCase(ans.getEvaluationStatus()) && ans.getVoiceFileId() != null).count();
                    item.put("voiceQuestionsCount", voiceTotal);
                    item.put("voiceEvaluatedCount", voiceEvaluated);
                }
            }
        } else {
            item.put("attemptStatus", "UPCOMING".equals(windowStatus) ? "UPCOMING_LOCKED" : "NOT_STARTED");
        }

        response.put("finalAssessment", item);
        return response;
    }

    @Transactional
    public Map<String, Object> startOrResumeTestAttempt(String asmtId, User user) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        if (!"PUBLISHED".equalsIgnoreCase(asmt.getStatus())) {
            throw new BadRequestException("Assessment is not published yet");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        if ("MOCK".equalsIgnoreCase(asmt.getType()) || "FINAL".equalsIgnoreCase(asmt.getType())) {
            OffsetDateTime effectiveStart = asmt.getStartAt();
            OffsetDateTime effectiveEnd = asmt.getEndAt();
            if ("FINAL".equalsIgnoreCase(asmt.getType())) {
                Competition comp = getCompetitionById(asmt.getCompetitionId());
                if (effectiveStart == null && comp.getFinalUnlockAt() != null) {
                    effectiveStart = comp.getFinalUnlockAt();
                }
                if (effectiveEnd == null && comp.getEndAt() != null) {
                    effectiveEnd = comp.getEndAt();
                }
            }
            if (effectiveStart == null && "FINAL".equalsIgnoreCase(asmt.getType())) {
                throw new BadRequestException("Final Assessment unlock time has not been configured yet. It will be opened soon.");
            }
            if (effectiveStart != null && now.isBefore(effectiveStart)) {
                throw new BadRequestException("This test window is not open yet. Scheduled to open at: " + effectiveStart);
            }
            if (effectiveEnd != null && now.isAfter(effectiveEnd)) {
                throw new BadRequestException("This test window has closed. Ended at: " + effectiveEnd);
            }
        }

        CompetitionRegistration reg = getStudentPaidRegistration(asmt.getCompetitionId(), user);
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if ("STUDENT".equals(role) && reg == null) {
            throw new ForbiddenException("You must have a paid registration to attempt this test");
        }

        if (asmt.getDurationMinutes() == null || asmt.getDurationMinutes() <= 0) {
            throw new BadRequestException("Assessment duration is not configured. Please contact the administrator.");
        }

        String regId = reg != null ? reg.getId() : "reg_admin_" + user.getId();
        int currentVer = asmt.getPublishVersion() != null ? asmt.getPublishVersion() : 1;
        AssessmentAttempt attempt = null;
        if (assessmentAttemptRepository != null) {
            Optional<AssessmentAttempt> existingOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(asmtId, regId, currentVer);
            if (existingOpt.isPresent()) {
                attempt = existingOpt.get();
                if ("COMPLETED".equalsIgnoreCase(attempt.getStatus()) || "EVALUATION_PENDING".equalsIgnoreCase(attempt.getStatus()) || "SUBMITTED".equalsIgnoreCase(attempt.getStatus()) || "AUTO_SUBMITTED".equalsIgnoreCase(attempt.getStatus())) {
                    throw new BadRequestException("You have already submitted this assessment");
                }
                if (attempt.getStartedAt() == null) {
                    attempt.setStartedAt(now);
                }
                if (attempt.getEndsAt() == null) {
                    OffsetDateTime endsAt = attempt.getStartedAt().plusMinutes(asmt.getDurationMinutes());
                    if (asmt.getEndAt() != null && asmt.getEndAt().isBefore(endsAt)) {
                        endsAt = asmt.getEndAt();
                    }
                    attempt.setEndsAt(endsAt);
                    attempt.setDeadlineAt(endsAt);
                    attempt = assessmentAttemptRepository.save(attempt);
                }
                if (now.isAfter(attempt.getEndsAt())) {
                    attempt.setAutoSubmitted(true);
                    evaluateAndFinalizeAttempt(attempt);
                    assessmentAttemptRepository.save(attempt);
                    throw new BadRequestException("Assessment time has expired and your exam has been auto-submitted.");
                }
            } else {
                attempt = new AssessmentAttempt();
                attempt.setId("att_" + UUID.randomUUID());
                attempt.setAssessmentId(asmtId);
                attempt.setRegistrationId(regId);
                attempt.setPublishVersion(currentVer);
                if (reg != null) {
                    Optional<CompetitionSetMember> memOpt = setMemberRepository.findByRegistrationId(reg.getId());
                    if (memOpt.isPresent()) {
                        attempt.setSetId(memOpt.get().getSetId());
                    }
                }

                attempt.setStatus("IN_PROGRESS");
                attempt.setStartedAt(now);
                OffsetDateTime calculatedEndsAt = now.plusMinutes(asmt.getDurationMinutes());
                if (asmt.getEndAt() != null && asmt.getEndAt().isBefore(calculatedEndsAt)) {
                    calculatedEndsAt = asmt.getEndAt();
                }
                attempt.setEndsAt(calculatedEndsAt);
                attempt.setDeadlineAt(calculatedEndsAt);
                attempt.setMcqMarks(BigDecimal.ZERO);
                attempt.setVoiceMarks(BigDecimal.ZERO);
                attempt.setTotalMarks(BigDecimal.ZERO);
                attempt = assessmentAttemptRepository.save(attempt);
            }
        }

        // Load questions, respecting Set assignment if this is a FINAL assessment
        List<AssessmentQuestion> allQuestions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        List<AssessmentQuestion> questions = new ArrayList<>(allQuestions);

        if ("FINAL".equalsIgnoreCase(asmt.getType()) && attempt != null && attempt.getSetId() != null && assessmentSetQuestionRepository != null) {
            List<AssessmentSetQuestion> setQuestions = assessmentSetQuestionRepository.findByAssessmentIdAndSetIdOrderByPositionAsc(asmtId, attempt.getSetId());
            if (!setQuestions.isEmpty()) {
                Map<String, AssessmentQuestion> qMap = allQuestions.stream().collect(Collectors.toMap(AssessmentQuestion::getId, q -> q, (a, b) -> a));
                List<AssessmentQuestion> ordered = new ArrayList<>();
                for (AssessmentSetQuestion sq : setQuestions) {
                    AssessmentQuestion q = qMap.get(sq.getQuestionId());
                    if (q != null) {
                        ordered.add(q);
                    }
                }
                if (!ordered.isEmpty()) {
                    questions = ordered;
                }
            }
        }

        List<Map<String, Object>> sanitizedQuestions = new ArrayList<>();
        for (AssessmentQuestion q : questions) {
            Map<String, Object> qMap = new HashMap<>();
            qMap.put("id", q.getId());
            qMap.put("assessmentId", q.getAssessmentId());
            qMap.put("sortOrder", q.getSortOrder());
            qMap.put("questionFormat", q.getQuestionFormat());
            qMap.put("questionText", q.getQuestionText());
            qMap.put("mediaRef", q.getMediaRef());
            qMap.put("answerFormat", q.getAnswerFormat());
            qMap.put("guidanceText", q.getGuidanceText());
            qMap.put("maxDurationSeconds", q.getMaxDurationSeconds());
            qMap.put("marks", q.getMarks());
            // Intentionally omit explanation to avoid leakage before submission

            List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
            if ("FINAL".equalsIgnoreCase(asmt.getType()) && attempt != null && attempt.getSetId() != null && assessmentSetOptionRepository != null) {
                List<AssessmentSetOption> setOpts = assessmentSetOptionRepository.findByAssessmentIdAndSetIdAndQuestionIdOrderByPositionAsc(asmtId, attempt.getSetId(), q.getId());
                if (!setOpts.isEmpty()) {
                    Map<UUID, QuestionOption> optMap = options.stream().collect(Collectors.toMap(QuestionOption::getId, o -> o, (a, b) -> a));
                    List<QuestionOption> orderedOpts = new ArrayList<>();
                    for (AssessmentSetOption so : setOpts) {
                        QuestionOption opt = optMap.get(so.getOptionId());
                        if (opt != null) {
                            orderedOpts.add(opt);
                        }
                    }
                    if (!orderedOpts.isEmpty()) {
                        options = orderedOpts;
                    }
                }
            }

            List<Map<String, Object>> sanitizedOptions = new ArrayList<>();
            for (QuestionOption opt : options) {
                Map<String, Object> optMap = new HashMap<>();
                optMap.put("id", opt.getId());
                optMap.put("text", opt.getText());
                optMap.put("sortOrder", opt.getSortOrder());
                // Intentionally omit isCorrect to avoid answer leakage
                sanitizedOptions.add(optMap);
            }
            qMap.put("options", sanitizedOptions);
            sanitizedQuestions.add(qMap);
        }

        // Load student's saved answers
        Map<String, Object> savedAnswersMap = new HashMap<>();
        if (attempt != null && attemptAnswerRepository != null) {
            List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getId());
            for (AttemptAnswer ans : answers) {
                Map<String, Object> aMap = new HashMap<>();
                aMap.put("id", ans.getId());
                aMap.put("questionId", ans.getQuestionId());
                aMap.put("selectedOptionId", ans.getSelectedOptionId());
                aMap.put("voiceFileId", ans.getVoiceFileId());
                aMap.put("voiceDurationSec", ans.getVoiceDurationSec());
                aMap.put("textAnswer", ans.getTextAnswer());
                aMap.put("savedAt", ans.getSavedAt());
                savedAnswersMap.put(ans.getQuestionId(), aMap);
            }
        }

        long remainingSeconds = 0;
        if (attempt != null && attempt.getEndsAt() != null) {
            remainingSeconds = Math.max(0, java.time.Duration.between(now, attempt.getEndsAt()).getSeconds());
        } else if (asmt.getDurationMinutes() != null && asmt.getDurationMinutes() > 0) {
            remainingSeconds = asmt.getDurationMinutes() * 60L;
        }

        Map<String, Object> assignedSetMap = null;
        if (!"STUDENT".equals(role) && attempt != null && attempt.getSetId() != null) {
            Optional<CompetitionSet> sOpt = setRepository.findById(attempt.getSetId());
            if (sOpt.isPresent()) {
                CompetitionSet s = sOpt.get();
                assignedSetMap = new HashMap<>();
                assignedSetMap.put("id", s.getId());
                assignedSetMap.put("code", s.getCode());
                assignedSetMap.put("title", "Set " + s.getCode());
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("attempt", attempt);
        result.put("attemptId", attempt != null ? attempt.getId() : null);
        result.put("startedAt", attempt != null ? attempt.getStartedAt() : null);
        result.put("endsAt", attempt != null ? attempt.getEndsAt() : null);
        result.put("deadlineAt", attempt != null ? attempt.getDeadlineAt() : null);
        result.put("proctorViolationCount", attempt != null && attempt.getProctorViolationCount() != null ? attempt.getProctorViolationCount() : 0);
        result.put("autoSubmitted", attempt != null && Boolean.TRUE.equals(attempt.getAutoSubmitted()));
        result.put("assessment", asmt);
        if (!"STUDENT".equals(role)) {
            result.put("assignedSet", assignedSetMap);
        }
        result.put("questions", sanitizedQuestions);
        result.put("answers", savedAnswersMap);
        result.put("remainingSeconds", remainingSeconds);
        result.put("durationMinutes", asmt.getDurationMinutes());
        result.put("serverNow", now);
        return result;
    }

    @Transactional
    public Map<String, Object> generateSetPapers(String asmtId, User user) {
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only an administrator can generate set question papers");
        }

        CompetitionAssessment asmt = getAssessmentById(asmtId);
        List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(asmt.getCompetitionId());
        if (sets.isEmpty()) {
            throw new BadRequestException("No competition sets configured for this competition");
        }

        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        if (questions.isEmpty()) {
            throw new BadRequestException("Assessment has no questions to distribute across sets");
        }

        // Clean previous
        if (assessmentSetQuestionRepository != null) {
            assessmentSetQuestionRepository.deleteByAssessmentId(asmtId);
        }
        if (assessmentSetOptionRepository != null) {
            assessmentSetOptionRepository.deleteByAssessmentId(asmtId);
        }

        int totalSetQuestions = 0;
        int totalSetOptions = 0;

        for (int sIdx = 0; sIdx < sets.size(); sIdx++) {
            CompetitionSet set = sets.get(sIdx);
            List<AssessmentQuestion> setQuestions = new ArrayList<>(questions);
            long seed = (long) set.getCode().hashCode() * 31L + (sIdx + 1) * 17L;
            Collections.shuffle(setQuestions, new Random(seed));

            for (int pos = 0; pos < setQuestions.size(); pos++) {
                AssessmentQuestion q = setQuestions.get(pos);
                AssessmentSetQuestion asq = new AssessmentSetQuestion(
                        "asq_" + UUID.randomUUID(),
                        asmtId,
                        set.getId(),
                        q.getId(),
                        pos
                );
                if (assessmentSetQuestionRepository != null) {
                    assessmentSetQuestionRepository.save(asq);
                    totalSetQuestions++;
                }

                if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                    List<QuestionOption> options = new ArrayList<>(questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId()));
                    if (!options.isEmpty()) {
                        long optSeed = seed + pos * 13L;
                        Collections.shuffle(options, new Random(optSeed));
                        for (int oPos = 0; oPos < options.size(); oPos++) {
                            QuestionOption opt = options.get(oPos);
                            AssessmentSetOption aso = new AssessmentSetOption(
                                    "aso_" + UUID.randomUUID(),
                                    asmtId,
                                    set.getId(),
                                    q.getId(),
                                    opt.getId(),
                                    oPos
                            );
                            if (assessmentSetOptionRepository != null) {
                                assessmentSetOptionRepository.save(aso);
                                totalSetOptions++;
                            }
                        }
                    }
                }
            }
        }

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("assessmentId", asmtId);
        res.put("setsCount", sets.size());
        res.put("totalQuestionsPerSet", questions.size());
        res.put("totalSetQuestionsSaved", totalSetQuestions);
        res.put("totalSetOptionsSaved", totalSetOptions);
        return res;
    }

    @Transactional
    public Map<String, Object> saveAttemptAnswer(String asmtId, Map<String, Object> payload, User user) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        CompetitionRegistration reg = getStudentPaidRegistration(asmt.getCompetitionId(), user);
        String regId = reg != null ? reg.getId() : "reg_admin_" + user.getId();
        int currentVer = asmt.getPublishVersion() != null ? asmt.getPublishVersion() : 1;

        Optional<AssessmentAttempt> currentAttemptOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(asmtId, regId, currentVer);
        AssessmentAttempt attempt;
        if (currentAttemptOpt.isPresent()) {
            attempt = currentAttemptOpt.get();
        } else {
            Optional<AssessmentAttempt> olderAttempt = assessmentAttemptRepository.findTopByAssessmentIdAndRegistrationIdOrderByPublishVersionDesc(asmtId, regId);
            if (olderAttempt.isPresent() && olderAttempt.get().getPublishVersion() != null && olderAttempt.get().getPublishVersion() < currentVer) {
                throw new ConflictException("This test was republished. Please start again.");
            }
            if ((asmt.getPublishVersion() != null && asmt.getPublishVersion() > 1) || (republishAuditRepository != null && republishAuditRepository.existsByAssessmentId(asmtId))) {
                throw new ConflictException("This test was republished. Please start again.");
            }
            throw new BadRequestException("No active attempt found for this assessment");
        }

        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new BadRequestException("Attempt is not in progress (status: " + attempt.getStatus() + ")");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        if (attempt.getEndsAt() != null && now.isAfter(attempt.getEndsAt())) {
            if ("IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
                attempt.setAutoSubmitted(true);
                evaluateAndFinalizeAttempt(attempt);
                assessmentAttemptRepository.save(attempt);
            }
            throw new BadRequestException("Assessment time has expired. No further answers can be saved.");
        }

        String questionId = (String) payload.get("questionId");
        if (questionId == null || questionId.isBlank()) {
            throw new BadRequestException("Question ID is required");
        }
        AssessmentQuestion question = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found: " + questionId));
        if (!asmtId.equals(question.getAssessmentId())) {
            throw new BadRequestException("Question does not belong to this assessment");
        }

        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndQuestionId(attempt.getId(), questionId)
                .orElse(new AttemptAnswer());
        if (answer.getId() == null) {
            answer.setId("ans_" + UUID.randomUUID());
            answer.setAttemptId(attempt.getId());
            answer.setQuestionId(questionId);
        }

        if (payload.containsKey("selectedOptionId")) {
            Object sel = payload.get("selectedOptionId");
            if (sel == null || sel.toString().isBlank()) {
                answer.setSelectedOptionId(null);
            } else {
                try {
                    answer.setSelectedOptionId(UUID.fromString(sel.toString()));
                } catch (Exception e) {
                    throw new BadRequestException("Invalid option ID format");
                }
            }
        }

        if (payload.containsKey("voiceFileId")) {
            Object vVal = payload.get("voiceFileId");
            if (vVal instanceof Map<?, ?> m) {
                Object subFile = m.get("voiceFileId");
                if (subFile == null) subFile = m.get("id");
                if (subFile == null) subFile = m.get("fileId");
                answer.setVoiceFileId(subFile != null ? subFile.toString() : null);
                if (m.containsKey("durationSec") && !payload.containsKey("voiceDurationSec")) {
                    Object dur = m.get("durationSec");
                    if (dur instanceof Number) {
                        answer.setVoiceDurationSec(((Number) dur).intValue());
                    }
                }
            } else {
                answer.setVoiceFileId(vVal != null ? vVal.toString() : null);
            }
        }

        if (payload.containsKey("voiceDurationSec")) {
            Object dur = payload.get("voiceDurationSec");
            if (dur instanceof Number) {
                answer.setVoiceDurationSec(((Number) dur).intValue());
            } else if (dur != null) {
                try {
                    answer.setVoiceDurationSec(Integer.parseInt(dur.toString()));
                } catch (NumberFormatException ignored) {}
            }
        }

        if (payload.containsKey("textAnswer")) {
            Object tVal = payload.get("textAnswer");
            if (tVal == null) {
                answer.setTextAnswer(null);
            } else {
                String str = tVal.toString().trim();
                if (str.length() > 5000) {
                    throw new BadRequestException("Text answer must not exceed 5000 characters");
                }
                answer.setTextAnswer(str);
            }
        }

        answer.setSavedAt(now);

        if ("VOICE".equalsIgnoreCase(question.getAnswerFormat()) || "TEXT".equalsIgnoreCase(question.getAnswerFormat())) {
            answer.setEvaluationStatus("PENDING_TRAINER");
        } else {
            answer.setEvaluationStatus("AUTO");
        }

        AttemptAnswer savedAns = attemptAnswerRepository.save(answer);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("answerId", savedAns.getId());
        res.put("questionId", questionId);
        res.put("savedAt", savedAns.getSavedAt());
        res.put("serverNow", now);
        return res;
    }

    @Transactional
    public Map<String, Object> submitTestAttempt(String asmtId, User user) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        CompetitionRegistration reg = getStudentPaidRegistration(asmt.getCompetitionId(), user);
        String regId = reg != null ? reg.getId() : "reg_admin_" + user.getId();
        int currentVer = asmt.getPublishVersion() != null ? asmt.getPublishVersion() : 1;

        Optional<AssessmentAttempt> currentAttemptOpt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationIdAndPublishVersion(asmtId, regId, currentVer);
        AssessmentAttempt attempt;
        if (currentAttemptOpt.isPresent()) {
            attempt = currentAttemptOpt.get();
        } else {
            Optional<AssessmentAttempt> olderAttempt = assessmentAttemptRepository.findTopByAssessmentIdAndRegistrationIdOrderByPublishVersionDesc(asmtId, regId);
            if (olderAttempt.isPresent() && olderAttempt.get().getPublishVersion() != null && olderAttempt.get().getPublishVersion() < currentVer) {
                throw new ConflictException("This test was republished. Please start again.");
            }
            if ((asmt.getPublishVersion() != null && asmt.getPublishVersion() > 1) || (republishAuditRepository != null && republishAuditRepository.existsByAssessmentId(asmtId))) {
                throw new ConflictException("This test was republished. Please start again.");
            }
            throw new BadRequestException("No active attempt found for this assessment");
        }

        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            throw new BadRequestException("Attempt is not in progress (status: " + attempt.getStatus() + ")");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        if (attempt.getEndsAt() != null && now.isAfter(attempt.getEndsAt())) {
            attempt.setAutoSubmitted(true);
        }

        evaluateAndFinalizeAttempt(attempt);
        AssessmentAttempt savedAttempt = assessmentAttemptRepository.save(attempt);

        // Immediately recalculate leaderboard so live board reflects final score
        try {
            CompetitionAssessment evalAsmt = assessmentRepository.findById(attempt.getAssessmentId()).orElse(null);
            if (evalAsmt != null && "FINAL".equalsIgnoreCase(evalAsmt.getType()) && evalAsmt.getCompetitionId() != null) {
                recalculateLeaderboard(evalAsmt.getCompetitionId(), null);
            }
        } catch (Exception e) {
            log.warn("Failed to recalculate leaderboard after evaluating voice answer: {}", e.getMessage());
        }

        Map<String, Object> result = new HashMap<>();
        result.put("attemptId", savedAttempt.getId());
        result.put("status", savedAttempt.getStatus());
        result.put("evaluationMode", savedAttempt.getEvaluationMode());
        if (!"FINAL".equalsIgnoreCase(asmt.getType()) && ("EVALUATION_PENDING".equalsIgnoreCase(savedAttempt.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(savedAttempt.getEvaluationMode()))) {
            result.put("isPendingEvaluation", true);
            result.put("mcqMarks", null);
            result.put("totalMarks", null);
        } else {
            result.put("isPendingEvaluation", false);
            result.put("mcqMarks", savedAttempt.getMcqMarks());
            result.put("totalMarks", savedAttempt.getTotalMarks());
        }
        result.put("submittedAt", savedAttempt.getSubmittedAt());
        result.put("autoSubmitted", Boolean.TRUE.equals(savedAttempt.getAutoSubmitted()));
        result.put("proctorViolationCount", savedAttempt.getProctorViolationCount() != null ? savedAttempt.getProctorViolationCount() : 0);
        result.put("hasVoiceQuestions", "EVALUATION_PENDING".equalsIgnoreCase(savedAttempt.getStatus()));
        result.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));
        return result;
    }

    @Transactional
    public void evaluateAndFinalizeAttempt(AssessmentAttempt attempt) {
        String asmtId = attempt.getAssessmentId();
        CompetitionAssessment asmt = assessmentRepository.findById(asmtId).orElse(null);
        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getId());
        Map<String, AttemptAnswer> answerMap = answers.stream()
                .collect(Collectors.toMap(AttemptAnswer::getQuestionId, a -> a, (a, b) -> a));

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        BigDecimal totalMcqMarks = BigDecimal.ZERO;
        int answeredMcqCount = 0;
        int answeredVoiceCount = 0;

        for (AssessmentQuestion q : questions) {
            AttemptAnswer ans = answerMap.get(q.getId());
            if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat()) || "MCQ".equalsIgnoreCase(q.getAnswerFormat())) {
                List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
                Optional<QuestionOption> correctOpt = options.stream().filter(o -> Boolean.TRUE.equals(o.getIsCorrect())).findFirst();

                boolean isCorrect = false;
                if (ans != null && ans.getSelectedOptionId() != null) {
                    answeredMcqCount++;
                    // Check if selected option still exists in current options
                    UUID selectedId = ans.getSelectedOptionId();
                    boolean optionStillExists = options.stream().anyMatch(o -> o.getId().equals(selectedId));
                    if (!optionStillExists) {
                        ans.setSelectedOptionId(null);
                    } else if (correctOpt.isPresent() && selectedId.equals(correctOpt.get().getId())) {
                        isCorrect = true;
                    }
                }

                if (ans == null) {
                    ans = new AttemptAnswer();
                    ans.setId("ans_" + UUID.randomUUID());
                    ans.setAttemptId(attempt.getId());
                    ans.setQuestionId(q.getId());
                    ans.setSavedAt(now);
                }

                ans.setIsCorrect(isCorrect);
                ans.setEvaluationStatus("EVALUATED");
                ans.setEvaluatedAt(now);
                int qMarks = (q.getMarks() != null && q.getMarks() > 0) ? q.getMarks() : 1;
                BigDecimal awarded = isCorrect ? BigDecimal.valueOf(qMarks) : BigDecimal.ZERO;
                ans.setMarksAwarded(awarded);
                totalMcqMarks = totalMcqMarks.add(awarded);
                attemptAnswerRepository.save(ans);
            } else if ("VOICE".equalsIgnoreCase(q.getAnswerFormat())) {
                if (ans != null && ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()) {
                    answeredVoiceCount++;
                    ans.setEvaluationStatus("PENDING_TRAINER");
                    ans.setMarksAwarded(null);
                    attemptAnswerRepository.save(ans);
                } else {
                    if (ans == null) {
                        ans = new AttemptAnswer();
                        ans.setId("ans_" + UUID.randomUUID());
                        ans.setAttemptId(attempt.getId());
                        ans.setQuestionId(q.getId());
                        ans.setSavedAt(now);
                    }
                    ans.setEvaluationStatus("SKIPPED");
                    ans.setMarksAwarded(BigDecimal.ZERO);
                    attemptAnswerRepository.save(ans);
                }
            } else if ("TEXT".equalsIgnoreCase(q.getAnswerFormat())) {
                if (ans != null && ans.getTextAnswer() != null && !ans.getTextAnswer().trim().isEmpty()) {
                    answeredVoiceCount++;
                    ans.setEvaluationStatus("PENDING_TRAINER");
                    ans.setMarksAwarded(null);
                    attemptAnswerRepository.save(ans);
                } else {
                    if (ans == null) {
                        ans = new AttemptAnswer();
                        ans.setId("ans_" + UUID.randomUUID());
                        ans.setAttemptId(attempt.getId());
                        ans.setQuestionId(q.getId());
                        ans.setSavedAt(now);
                    }
                    ans.setEvaluationStatus("SKIPPED");
                    ans.setMarksAwarded(BigDecimal.ZERO);
                    attemptAnswerRepository.save(ans);
                }
            }
        }

        attempt.setSubmittedAt(now);
        attempt.setMcqMarks(totalMcqMarks);
        attempt.setVoiceMarks(BigDecimal.ZERO);
        attempt.setTotalMarks(totalMcqMarks);

        // M1 Server Classification:
        // CASE 1: answered >= 1 MCQ AND >= 1 voice question -> MANUAL_PENDING, EVALUATION_PENDING
        // CASE 2: answered MCQ(s) ONLY (no voice answers) OR zero answers -> AUTO_EVALUATED, COMPLETED
        // CASE 3: answered voice question(s) ONLY (no MCQ answered) -> MANUAL_PENDING, EVALUATION_PENDING
        // FINAL ASSESSMENT: retains existing behavior
        boolean isFinal = asmt != null && "FINAL".equalsIgnoreCase(asmt.getType());
        if (isFinal) {
            if (answeredVoiceCount > 0) {
                attempt.setEvaluationMode("MANUAL_PENDING");
                attempt.setStatus("EVALUATION_PENDING");
            } else {
                attempt.setEvaluationMode("AUTO_EVALUATED");
                attempt.setStatus("COMPLETED");
            }
        } else {
            if (answeredVoiceCount > 0) {
                // CASE 1 or CASE 3
                attempt.setEvaluationMode("MANUAL_PENDING");
                attempt.setStatus("EVALUATION_PENDING");
            } else {
                // CASE 2 (MCQ only or zero answers)
                attempt.setEvaluationMode("AUTO_EVALUATED");
                attempt.setStatus("COMPLETED");
            }
        }
        assessmentAttemptRepository.save(attempt);
    }

    @Transactional
    public Map<String, Object> recordProctorEvent(String attemptId, Map<String, Object> payload, User user) {
        AssessmentAttempt attempt = assessmentAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found: " + attemptId));

        int maxWarnings = 3;

        if (!"IN_PROGRESS".equalsIgnoreCase(attempt.getStatus())) {
            Map<String, Object> res = new HashMap<>();
            res.put("autoSubmitted", true);
            res.put("status", attempt.getStatus());
            res.put("warningCount", attempt.getProctorViolationCount());
            res.put("maxWarnings", maxWarnings);
            return res;
        }

        String eventType = (String) payload.getOrDefault("eventType", "PROCTOR_VIOLATION");
        String details = (String) payload.getOrDefault("details", "");

        if (examProctorEventRepository != null) {
            ExamProctorEvent event = new ExamProctorEvent(
                    "pe_" + UUID.randomUUID(),
                    attemptId,
                    attempt.getRegistrationId(),
                    eventType,
                    1,
                    details
            );
            examProctorEventRepository.save(event);
        }

        int currentCount = (attempt.getProctorViolationCount() != null ? attempt.getProctorViolationCount() : 0) + 1;
        attempt.setProctorViolationCount(currentCount);

        boolean shouldAutoSubmit = currentCount >= maxWarnings;

        Map<String, Object> res = new HashMap<>();
        res.put("warningCount", currentCount);
        res.put("maxWarnings", maxWarnings);

        if (shouldAutoSubmit) {
            attempt.setAutoSubmitted(true);
            evaluateAndFinalizeAttempt(attempt);
            assessmentAttemptRepository.save(attempt);

            res.put("autoSubmitted", true);
            res.put("status", attempt.getStatus());
            res.put("message", "Exam auto-submitted due to exceeding maximum allowed proctoring violations (" + maxWarnings + ").");
        } else {
            assessmentAttemptRepository.save(attempt);
            res.put("autoSubmitted", false);
            res.put("remainingWarnings", Math.max(0, maxWarnings - currentCount));
        }

        return res;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getProctorEvents(String attemptId, User user) {
        AssessmentAttempt attempt = assessmentAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found: " + attemptId));
        List<ExamProctorEvent> events = (examProctorEventRepository != null)
                ? examProctorEventRepository.findByAttemptIdOrderByCreatedAtAsc(attemptId)
                : Collections.emptyList();

        Map<String, Object> res = new HashMap<>();
        res.put("attemptId", attemptId);
        res.put("violationCount", attempt.getProctorViolationCount() != null ? attempt.getProctorViolationCount() : events.size());
        res.put("autoSubmitted", Boolean.TRUE.equals(attempt.getAutoSubmitted()));
        res.put("events", events);
        return res;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAttemptResults(String asmtId, User user) {
        CompetitionAssessment asmt = getAssessmentById(asmtId);
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();

        AssessmentAttempt attempt = null;
        if ("STUDENT".equals(role)) {
            CompetitionRegistration reg = getStudentPaidRegistration(asmt.getCompetitionId(), user);
            if (reg == null) {
                throw new ForbiddenException("You are not registered for this competition");
            }
            attempt = assessmentAttemptRepository.findTopByAssessmentIdAndRegistrationIdOrderByPublishVersionDesc(asmtId, reg.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("No attempt found for this assessment"));
        } else if ("TRAINER".equals(role)) {
            List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByAssessmentId(asmtId);
            // Verify trainer belongs to attempt set
            List<CompetitionSet> trainerSets = setRepository.findByCompetitionIdOrderByCodeAsc(asmt.getCompetitionId())
                    .stream()
                    .filter(s -> user.getId().equals(s.getTrainerId()))
                    .collect(Collectors.toList());
            Set<String> setIds = trainerSets.stream().map(CompetitionSet::getId).collect(Collectors.toSet());
            attempt = attempts.stream()
                    .filter(a -> a.getSetId() != null && setIds.contains(a.getSetId()))
                    .findFirst()
                    .orElseThrow(() -> new ForbiddenException("Trainer does not have access to this assessment attempt"));
        } else {
            // Admin
            Optional<AssessmentAttempt> adminAtt = assessmentAttemptRepository.findByAssessmentIdAndRegistrationId(asmtId, "reg_admin_" + user.getId());
            if (adminAtt.isPresent()) {
                attempt = adminAtt.get();
            } else {
                List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByAssessmentId(asmtId);
                if (!attempts.isEmpty()) {
                    attempt = attempts.get(0);
                }
            }
        }

        if (attempt == null) {
            throw new ResourceNotFoundException("Attempt not found");
        }

        if ("IN_PROGRESS".equalsIgnoreCase(attempt.getStatus()) || "NOT_STARTED".equalsIgnoreCase(attempt.getStatus())) {
            throw new BadRequestException("Assessment has not been submitted yet");
        }

        List<AssessmentQuestion> questions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmtId);
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getId());

        boolean isStudent = "STUDENT".equals(role);
        boolean isPendingEval = !"FINAL".equalsIgnoreCase(asmt.getType()) && 
                ("EVALUATION_PENDING".equalsIgnoreCase(attempt.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(attempt.getEvaluationMode()));

        if (isStudent && isPendingEval) {
            Set<String> voiceQuestionIds = questions.stream()
                    .filter(q -> "VOICE".equalsIgnoreCase(q.getAnswerFormat()) || "TEXT".equalsIgnoreCase(q.getAnswerFormat()))
                    .map(q -> q.getId() != null ? q.getId().toString() : "")
                    .collect(Collectors.toSet());
            long vCount = voiceQuestionIds.size();
            long vEvalCount = answers.stream()
                    .filter(a -> a.getQuestionId() != null && voiceQuestionIds.contains(a.getQuestionId()) && "EVALUATED".equalsIgnoreCase(a.getEvaluationStatus()))
                    .count();

            Map<String, Object> summary = new HashMap<>();
            summary.put("attemptId", attempt.getId());
            summary.put("status", attempt.getStatus());
            summary.put("evaluationMode", attempt.getEvaluationMode());
            summary.put("isPendingEvaluation", true);
            summary.put("startedAt", attempt.getStartedAt());
            summary.put("submittedAt", attempt.getSubmittedAt());
            summary.put("totalQuestions", questions.size());
            summary.put("answeredCount", answers.size());
            summary.put("voiceCount", (int) vCount);
            summary.put("voiceEvaluatedCount", (int) vEvalCount);
            summary.put("autoSubmitted", Boolean.TRUE.equals(attempt.getAutoSubmitted()));
            summary.put("proctorViolationCount", attempt.getProctorViolationCount() != null ? attempt.getProctorViolationCount() : 0);

            Map<String, Object> result = new HashMap<>();
            result.put("assessment", asmt);
            result.put("attempt", summary);
            result.put("questions", Collections.emptyList());
            result.put("isPendingEvaluation", true);
            result.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));
            return result;
        }

        Map<String, AttemptAnswer> answerMap = answers.stream()
                .collect(Collectors.toMap(AttemptAnswer::getQuestionId, a -> a, (a, b) -> a));

        List<Map<String, Object>> reviewQuestions = new ArrayList<>();
        int correctCount = 0;
        int incorrectCount = 0;
        int voiceCount = 0;
        int voiceEvaluatedCount = 0;

        for (AssessmentQuestion q : questions) {
            Map<String, Object> qMap = new HashMap<>();
            qMap.put("id", q.getId());
            qMap.put("assessmentId", q.getAssessmentId());
            qMap.put("sortOrder", q.getSortOrder());
            qMap.put("questionFormat", q.getQuestionFormat());
            qMap.put("questionText", q.getQuestionText());
            qMap.put("mediaRef", q.getMediaRef());
            qMap.put("answerFormat", q.getAnswerFormat());
            qMap.put("guidanceText", q.getGuidanceText());
            qMap.put("marks", q.getMarks());
            qMap.put("explanation", q.getExplanation());
            qMap.put("mediaRef", q.getMediaRef());
            qMap.put("fileId", q.getMediaRef());

            List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
            qMap.put("options", options);

            AttemptAnswer ans = answerMap.get(q.getId());
            if (ans != null) {
                Map<String, Object> ansMap = new HashMap<>();
                ansMap.put("id", ans.getId());
                UUID rawOpt = ans.getSelectedOptionId();
                UUID selectedOpt = (rawOpt != null && options.stream().anyMatch(o -> o.getId().equals(rawOpt))) ? rawOpt : null;
                ansMap.put("selectedOptionId", selectedOpt);
                ansMap.put("isCorrect", ans.getIsCorrect());
                ansMap.put("marksAwarded", ans.getMarksAwarded());
                ansMap.put("voiceFileId", ans.getVoiceFileId());
                ansMap.put("voiceDurationSec", ans.getVoiceDurationSec());
                ansMap.put("textAnswer", ans.getTextAnswer());
                ansMap.put("evaluationStatus", ans.getEvaluationStatus());
                ansMap.put("feedback", ans.getFeedback());
                qMap.put("studentAnswer", ansMap);

                if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                    if (Boolean.TRUE.equals(ans.getIsCorrect())) {
                        correctCount++;
                    } else {
                        incorrectCount++;
                    }
                } else if ("VOICE".equalsIgnoreCase(q.getAnswerFormat()) || "TEXT".equalsIgnoreCase(q.getAnswerFormat())) {
                    voiceCount++;
                    if ("EVALUATED".equalsIgnoreCase(ans.getEvaluationStatus())) {
                        voiceEvaluatedCount++;
                    }
                }
            } else {
                qMap.put("studentAnswer", null);
                if ("MCQ_OPTIONS".equalsIgnoreCase(q.getAnswerFormat())) {
                    incorrectCount++;
                }
            }

            reviewQuestions.add(qMap);
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("attemptId", attempt.getId());
        summary.put("status", attempt.getStatus());
        summary.put("evaluationMode", attempt.getEvaluationMode());
        summary.put("startedAt", attempt.getStartedAt());
        summary.put("submittedAt", attempt.getSubmittedAt());
        summary.put("mcqMarks", attempt.getMcqMarks());
        summary.put("voiceMarks", attempt.getVoiceMarks());
        summary.put("totalMarks", attempt.getTotalMarks());
        summary.put("maxMarks", asmt.getTotalMarks());
        summary.put("totalQuestions", questions.size());
        summary.put("answeredCount", answers.size());
        summary.put("correctCount", correctCount);
        summary.put("incorrectCount", incorrectCount);
        summary.put("voiceCount", voiceCount);
        summary.put("voiceEvaluatedCount", voiceEvaluatedCount);
        summary.put("autoSubmitted", Boolean.TRUE.equals(attempt.getAutoSubmitted()));
        summary.put("proctorViolationCount", attempt.getProctorViolationCount() != null ? attempt.getProctorViolationCount() : 0);

        Map<String, Object> result = new HashMap<>();
        result.put("assessment", asmt);
        result.put("attempt", summary);
        result.put("questions", reviewQuestions);
        result.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));
        return result;
    }

    @Transactional
    public void resetAssessmentAttempt(String asmtId, String attemptId, User user) {
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only an admin can reset an assessment attempt");
        }

        AssessmentAttempt att = assessmentAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found: " + attemptId));

        if (attemptAnswerRepository != null) {
            attemptAnswerRepository.deleteByAttemptId(att.getId());
        }
        assessmentAttemptRepository.delete(att);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTrainerPendingSubmissions(String competitionId, User user) {
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can access evaluation submissions");
        }

        List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(competitionId);
        List<CompetitionSet> targetSets;
        if ("TRAINER".equals(role)) {
            targetSets = sets.stream()
                    .filter(s -> user.getId().equals(s.getTrainerId()))
                    .collect(Collectors.toList());
            if (targetSets.isEmpty()) {
                return Collections.emptyList();
            }
        } else {
            targetSets = sets;
        }

        Set<String> setIds = targetSets.stream().map(CompetitionSet::getId).collect(Collectors.toSet());
        Map<String, CompetitionSet> setMap = targetSets.stream().collect(Collectors.toMap(CompetitionSet::getId, s -> s, (a, b) -> a));

        List<CompetitionAssessment> assessments = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(competitionId);
        List<Map<String, Object>> resultList = new ArrayList<>();

        for (CompetitionAssessment asmt : assessments) {
            List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByAssessmentId(asmt.getId());
            for (AssessmentAttempt att : attempts) {
                if ("NOT_STARTED".equalsIgnoreCase(att.getStatus()) || "IN_PROGRESS".equalsIgnoreCase(att.getStatus())) {
                    continue;
                }

                String setId = att.getSetId();
                if (setId == null) {
                    Optional<CompetitionSetMember> mem = setMemberRepository.findByRegistrationId(att.getRegistrationId());
                    if (mem.isPresent()) {
                        setId = mem.get().getSetId();
                    }
                }

                if (setId == null || !setIds.contains(setId)) {
                    continue; // Strict set isolation
                }

                CompetitionSet cSet = setMap.get(setId);
                CompetitionRegistration reg = registrationRepository.findById(att.getRegistrationId()).orElse(null);

                List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
                long voiceCount = answers.stream().filter(a -> a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();
                long voiceEvaluatedCount = answers.stream().filter(a -> "EVALUATED".equalsIgnoreCase(a.getEvaluationStatus()) && a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();
                long voicePendingCount = answers.stream().filter(a -> "PENDING_TRAINER".equalsIgnoreCase(a.getEvaluationStatus()) && a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();

                Map<String, Object> item = new HashMap<>();
                item.put("attemptId", att.getId());
                item.put("assessmentId", asmt.getId());
                item.put("assessmentTitle", asmt.getTitle());
                item.put("assessmentType", asmt.getType());
                item.put("sequenceNo", asmt.getSequenceNo());
                item.put("status", att.getStatus());
                item.put("evaluationMode", att.getEvaluationMode());
                item.put("startedAt", att.getStartedAt());
                item.put("submittedAt", att.getSubmittedAt());
                item.put("mcqMarks", att.getMcqMarks());
                item.put("voiceMarks", att.getVoiceMarks());
                item.put("totalMarks", att.getTotalMarks());
                item.put("maxMarks", asmt.getTotalMarks());
                item.put("registrationId", att.getRegistrationId());
                item.put("studentName", reg != null ? reg.getStudentName() : "Student");
                item.put("studentEmail", reg != null ? reg.getStudentEmail() : "");
                item.put("studentPhone", reg != null ? reg.getStudentPhone() : "");
                item.put("setId", setId);
                item.put("setCode", cSet != null ? cSet.getCode() : "");
                item.put("setName", cSet != null ? "Set " + cSet.getCode() : "");
                item.put("competitionId", competitionId);
                Competition comp = competitionRepository.findById(competitionId).orElse(null);
                item.put("competitionTitle", comp != null ? comp.getTitle() : "");
                if (cSet != null && cSet.getTrainerId() != null && userRepository != null) {
                    item.put("trainerId", cSet.getTrainerId());
                    userRepository.findById(cSet.getTrainerId()).ifPresent(tr -> {
                        item.put("trainerName", tr.getName());
                        item.put("trainerEmail", tr.getEmail());
                    });
                }
                item.put("voiceQuestionsCount", voiceCount);
                item.put("voiceEvaluatedCount", voiceEvaluatedCount);
                item.put("voicePendingCount", voicePendingCount);

                resultList.add(item);
            }
        }

        resultList.sort((a, b) -> {
            boolean aPending = "EVALUATION_PENDING".equalsIgnoreCase((String) a.get("status"));
            boolean bPending = "EVALUATION_PENDING".equalsIgnoreCase((String) b.get("status"));
            if (aPending && !bPending) return -1;
            if (!aPending && bPending) return 1;
            OffsetDateTime aTime = (OffsetDateTime) a.get("submittedAt");
            OffsetDateTime bTime = (OffsetDateTime) b.get("submittedAt");
            if (aTime != null && bTime != null) {
                return bTime.compareTo(aTime);
            }
            return 0;
        });

        return resultList;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTrainerAttemptDetail(String attemptId, User user) {
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can view attempt details");
        }

        AssessmentAttempt att = assessmentAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found: " + attemptId));
        CompetitionAssessment asmt = getAssessmentById(att.getAssessmentId());

        String setId = att.getSetId();
        if (setId == null) {
            Optional<CompetitionSetMember> mem = setMemberRepository.findByRegistrationId(att.getRegistrationId());
            if (mem.isPresent()) {
                setId = mem.get().getSetId();
            }
        }

        CompetitionSet set = null;
        if (setId != null) {
            set = setRepository.findById(setId).orElse(null);
        }

        if ("TRAINER".equals(role)) {
            if (set == null || !user.getId().equals(set.getTrainerId())) {
                throw new ForbiddenException("Trainer does not have permission to evaluate this attempt (assigned to Set " + (set != null ? set.getCode() : "unknown") + ")");
            }
        }

        CompetitionRegistration reg = registrationRepository.findById(att.getRegistrationId()).orElse(null);

        List<AssessmentQuestion> allQuestions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(asmt.getId());
        List<AssessmentQuestion> orderedQuestions = new ArrayList<>(allQuestions);

        if ("FINAL".equalsIgnoreCase(asmt.getType()) && set != null && assessmentSetQuestionRepository != null) {
            List<AssessmentSetQuestion> setQuestions = assessmentSetQuestionRepository.findByAssessmentIdAndSetIdOrderByPositionAsc(asmt.getId(), set.getId());
            if (!setQuestions.isEmpty()) {
                Map<String, AssessmentQuestion> qMap = allQuestions.stream().collect(Collectors.toMap(AssessmentQuestion::getId, q -> q, (a, b) -> a));
                List<AssessmentQuestion> ordered = new ArrayList<>();
                for (AssessmentSetQuestion sq : setQuestions) {
                    AssessmentQuestion q = qMap.get(sq.getQuestionId());
                    if (q != null) ordered.add(q);
                }
                if (!ordered.isEmpty()) {
                    orderedQuestions = ordered;
                }
            }
        }

        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
        Map<String, AttemptAnswer> answerMap = answers.stream().collect(Collectors.toMap(AttemptAnswer::getQuestionId, a -> a, (a, b) -> a));

        List<Map<String, Object>> questionItems = new ArrayList<>();
        for (AssessmentQuestion q : orderedQuestions) {
            Map<String, Object> qMap = new HashMap<>();
            qMap.put("id", q.getId());
            qMap.put("sortOrder", q.getSortOrder());
            qMap.put("questionFormat", q.getQuestionFormat());
            qMap.put("questionText", q.getQuestionText());
            qMap.put("answerFormat", q.getAnswerFormat());
            qMap.put("guidanceText", q.getGuidanceText());
            qMap.put("marks", q.getMarks());
            qMap.put("explanation", q.getExplanation());
            qMap.put("mediaRef", q.getMediaRef());
            qMap.put("fileId", q.getMediaRef());

            List<QuestionOption> options = questionOptionRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
            qMap.put("options", options);

            if (evaluationCriteriaRepository != null) {
                List<AssessmentEvaluationCriteria> criteria = evaluationCriteriaRepository.findByQuestionIdOrderBySortOrderAsc(q.getId());
                qMap.put("criteria", criteria);
            } else {
                qMap.put("criteria", Collections.emptyList());
            }

            AttemptAnswer ans = answerMap.get(q.getId());
            if (ans != null) {
                Map<String, Object> ansMap = new HashMap<>();
                ansMap.put("id", ans.getId());
                ansMap.put("selectedOptionId", ans.getSelectedOptionId());
                ansMap.put("isCorrect", ans.getIsCorrect());
                ansMap.put("voiceFileId", ans.getVoiceFileId());
                ansMap.put("voiceDurationSec", ans.getVoiceDurationSec());
                ansMap.put("textAnswer", ans.getTextAnswer());
                ansMap.put("marksAwarded", ans.getMarksAwarded());
                ansMap.put("evaluationStatus", ans.getEvaluationStatus());
                ansMap.put("feedback", ans.getFeedback());
                ansMap.put("trainerFeedback", ans.getTrainerFeedback());
                ansMap.put("evaluatedBy", ans.getEvaluatedBy());
                ansMap.put("evaluatedAt", ans.getEvaluatedAt());
                if (ans.getEvaluatedBy() != null && userRepository != null) {
                    userRepository.findById(ans.getEvaluatedBy()).ifPresent(ev -> {
                        ansMap.put("evaluatorName", ev.getName());
                        ansMap.put("evaluatorEmail", ev.getEmail());
                        ansMap.put("evaluatorRole", ev.getRole());
                    });
                }

                if (ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank()) {
                    String audioUrl = null;
                    if (storedFileRepository != null) {
                        Optional<StoredFile> sfOpt = storedFileRepository.findById(ans.getVoiceFileId());
                        if (sfOpt.isPresent()) {
                            try {
                                Map<String, Object> link = fileStorageService.generateFileLink(sfOpt.get(), 7200);
                                audioUrl = (String) link.get("url");
                            } catch (Exception e) {
                                audioUrl = fileStorageService.getFileUrl(sfOpt.get());
                            }
                        }
                    }
                    if (audioUrl == null) {
                        audioUrl = "/api/files/" + ans.getVoiceFileId();
                    }
                    ansMap.put("audioUrl", audioUrl);
                }

                if (voiceEvaluationScoreRepository != null) {
                    List<VoiceEvaluationScore> vScores = voiceEvaluationScoreRepository.findByAnswerId(ans.getId());
                    ansMap.put("criteriaScores", vScores);
                } else {
                    ansMap.put("criteriaScores", Collections.emptyList());
                }

                qMap.put("studentAnswer", ansMap);
            } else {
                qMap.put("studentAnswer", null);
            }

            questionItems.add(qMap);
        }

        Map<String, Object> attemptSummary = new HashMap<>();
        attemptSummary.put("id", att.getId());
        attemptSummary.put("assessmentId", asmt.getId());
        attemptSummary.put("assessmentTitle", asmt.getTitle());
        attemptSummary.put("assessmentType", asmt.getType());
        attemptSummary.put("status", att.getStatus());
        attemptSummary.put("evaluationMode", att.getEvaluationMode());
        attemptSummary.put("startedAt", att.getStartedAt());
        attemptSummary.put("submittedAt", att.getSubmittedAt());
        attemptSummary.put("mcqMarks", att.getMcqMarks());
        attemptSummary.put("voiceMarks", att.getVoiceMarks());
        attemptSummary.put("totalMarks", att.getTotalMarks());
        attemptSummary.put("maxMarks", asmt.getTotalMarks());
        attemptSummary.put("registrationId", att.getRegistrationId());
        attemptSummary.put("studentName", reg != null ? reg.getStudentName() : "Student");
        attemptSummary.put("studentEmail", reg != null ? reg.getStudentEmail() : "");
        attemptSummary.put("studentPhone", reg != null ? reg.getStudentPhone() : "");
        attemptSummary.put("setId", setId);
        attemptSummary.put("setCode", set != null ? set.getCode() : "");
        attemptSummary.put("setName", set != null ? "Set " + set.getCode() : "");
        attemptSummary.put("proctorViolationsCount", att.getProctorViolationCount() != null ? att.getProctorViolationCount() : 0);
        attemptSummary.put("autoSubmitted", Boolean.TRUE.equals(att.getAutoSubmitted()));

        Map<String, Object> response = new HashMap<>();
        response.put("attempt", attemptSummary);
        response.put("assessment", asmt);
        response.put("questions", questionItems);
        response.put("serverNow", OffsetDateTime.now(ZoneId.of("Asia/Kolkata")));
        return response;
    }

    @Transactional
    public Map<String, Object> evaluateVoiceAnswer(String attemptId, String answerId, Map<String, Object> payload, User user) {
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can evaluate answers");
        }

        AssessmentAttempt attempt = assessmentAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Attempt not found with id: " + attemptId));

        if ("AUTO_EVALUATED".equalsIgnoreCase(attempt.getEvaluationMode())) {
            throw new ConflictException("Cannot evaluate system-evaluated attempt (Case 2 MCQ-only submission)");
        }

        String setId = attempt.getSetId();
        if (setId == null) {
            Optional<CompetitionSetMember> mem = setMemberRepository.findByRegistrationId(attempt.getRegistrationId());
            if (mem.isPresent()) {
                setId = mem.get().getSetId();
                attempt.setSetId(setId);
                assessmentAttemptRepository.save(attempt);
            }
        }

        CompetitionSet set = null;
        if (setId != null) {
            set = setRepository.findById(setId).orElse(null);
        }

        if ("TRAINER".equals(role)) {
            if (set == null || !user.getId().equals(set.getTrainerId())) {
                throw new ForbiddenException("Trainer does not have permission to evaluate attempts for Set " + (set != null ? set.getCode() : "unknown"));
            }
        }

        AttemptAnswer answer = attemptAnswerRepository.findById(answerId)
                .orElseThrow(() -> new ResourceNotFoundException("Answer not found with id: " + answerId));

        if (!attempt.getId().equals(answer.getAttemptId())) {
            throw new BadRequestException("Answer does not belong to attempt: " + attemptId);
        }

        AssessmentQuestion question = questionRepository.findById(answer.getQuestionId())
                .orElseThrow(() -> new ResourceNotFoundException("Question not found with id: " + answer.getQuestionId()));

        boolean isManualQuestion = ("VOICE".equalsIgnoreCase(question.getAnswerFormat()) || "TEXT".equalsIgnoreCase(question.getAnswerFormat()))
                || (answer.getVoiceFileId() != null && !answer.getVoiceFileId().isBlank())
                || (answer.getTextAnswer() != null && !answer.getTextAnswer().trim().isEmpty());
        if (!isManualQuestion) {
            throw new BadRequestException("MCQ questions are automatically evaluated by the system and cannot be manually scored.");
        }

        Object marksObj = payload.get("marksAwarded");
        if (marksObj == null) {
            throw new BadRequestException("marksAwarded is required");
        }
        BigDecimal marksAwarded = new BigDecimal(marksObj.toString());
        BigDecimal maxMarks = BigDecimal.valueOf(question.getMarks() != null && question.getMarks() > 0 ? question.getMarks() : 10);
        if (marksAwarded.compareTo(BigDecimal.ZERO) < 0 || marksAwarded.compareTo(maxMarks) > 0) {
            throw new BadRequestException("Marks awarded must be between 0 and " + maxMarks);
        }

        String feedback = (String) payload.getOrDefault("feedback", "");
        answer.setMarksAwarded(marksAwarded);
        answer.setFeedback(feedback);
        answer.setTrainerFeedback(feedback);
        answer.setEvaluationStatus("EVALUATED");
        answer.setEvaluatedBy(user.getId());
        answer.setEvaluatorId(user.getId());
        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        answer.setEvaluatedAt(now);
        attemptAnswerRepository.save(answer);

        if (voiceEvaluationScoreRepository != null && payload.get("criteriaScores") instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> cMap) {
                    String criterionId = (String) cMap.get("criterionId");
                    Object cScoreObj = cMap.get("score");
                    if (criterionId != null && cScoreObj != null) {
                        BigDecimal cScore = new BigDecimal(cScoreObj.toString());
                        Optional<VoiceEvaluationScore> existingScore = voiceEvaluationScoreRepository.findByAnswerIdAndCriterionId(answer.getId(), criterionId);
                        VoiceEvaluationScore ves = existingScore.orElseGet(() -> {
                            VoiceEvaluationScore s = new VoiceEvaluationScore();
                            s.setId("ves_" + UUID.randomUUID());
                            s.setAnswerId(answer.getId());
                            s.setCriterionId(criterionId);
                            return s;
                        });
                        ves.setScore(cScore);
                        voiceEvaluationScoreRepository.save(ves);
                    }
                }
            }
        }

        List<AttemptAnswer> allAnswers = attemptAnswerRepository.findByAttemptId(attempt.getId());
        List<AssessmentQuestion> allQuestions = questionRepository.findByAssessmentIdOrderBySortOrderAsc(attempt.getAssessmentId());
        Map<String, AssessmentQuestion> qMap = allQuestions.stream().collect(Collectors.toMap(AssessmentQuestion::getId, q -> q, (a, b) -> a));

        BigDecimal totalVoiceMarks = BigDecimal.ZERO;
        boolean anyVoicePending = false;

        for (AttemptAnswer ans : allAnswers) {
            AssessmentQuestion q = qMap.get(ans.getQuestionId());
            boolean isManual = (q != null && ("VOICE".equalsIgnoreCase(q.getAnswerFormat()) || "TEXT".equalsIgnoreCase(q.getAnswerFormat())))
                    || (ans.getVoiceFileId() != null && !ans.getVoiceFileId().isBlank())
                    || (ans.getTextAnswer() != null && !ans.getTextAnswer().trim().isEmpty());
            if (isManual) {
                if (ans.getMarksAwarded() != null) {
                    totalVoiceMarks = totalVoiceMarks.add(ans.getMarksAwarded());
                }
                if (!"EVALUATED".equalsIgnoreCase(ans.getEvaluationStatus())) {
                    anyVoicePending = true;
                }
            }
        }

        attempt.setVoiceMarks(totalVoiceMarks);
        BigDecimal mcqMarks = attempt.getMcqMarks() != null ? attempt.getMcqMarks() : BigDecimal.ZERO;
        attempt.setTotalMarks(mcqMarks.add(totalVoiceMarks));

        if (!anyVoicePending) {
            attempt.setStatus("COMPLETED");
            attempt.setEvaluationMode("EVALUATED");
            if (notificationService != null && attempt.getRegistrationId() != null) {
                try {
                    CompetitionAssessment asmt = assessmentRepository.findById(attempt.getAssessmentId()).orElse(null);
                    String asmtTitle = asmt != null ? asmt.getTitle() : "Test";
                    Optional<CompetitionRegistration> regOpt = registrationRepository.findById(attempt.getRegistrationId());
                    if (regOpt.isPresent() && regOpt.get().getStudentId() != null) {
                        notificationService.createNotification(
                                regOpt.get().getStudentId(),
                                "Result Ready",
                                "Your result for " + asmtTitle + " is ready",
                                "STUDENT"
                        );
                    }
                } catch (Exception e) {
                    log.warn("Failed to send result ready notification: {}", e.getMessage());
                }
            }
        }
        AssessmentAttempt savedAttempt = assessmentAttemptRepository.save(attempt);

        // Immediately recalculate leaderboard so live board reflects final score
        try {
            CompetitionAssessment evalAsmt = assessmentRepository.findById(attempt.getAssessmentId()).orElse(null);
            if (evalAsmt != null && "FINAL".equalsIgnoreCase(evalAsmt.getType()) && evalAsmt.getCompetitionId() != null) {
                recalculateLeaderboard(evalAsmt.getCompetitionId(), null);
            }
        } catch (Exception e) {
            log.warn("Failed to recalculate leaderboard after evaluating voice answer: {}", e.getMessage());
        }

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("attemptId", savedAttempt.getId());
        resp.put("status", savedAttempt.getStatus());
        resp.put("evaluationMode", savedAttempt.getEvaluationMode());
        resp.put("mcqMarks", savedAttempt.getMcqMarks());
        resp.put("voiceMarks", savedAttempt.getVoiceMarks());
        resp.put("totalMarks", savedAttempt.getTotalMarks());
        resp.put("evaluatedAnswerId", answer.getId());
        resp.put("marksAwarded", answer.getMarksAwarded());
        resp.put("feedback", answer.getFeedback());
        resp.put("serverNow", now);
        return resp;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAdminCompetitionEvaluations(
            String competitionId,
            String examType,
            String setCode,
            String status,
            String search) {

        List<Competition> comps;
        if (competitionId != null && !competitionId.isBlank() && !"all".equalsIgnoreCase(competitionId)) {
            comps = Collections.singletonList(getCompetitionById(competitionId));
        } else {
            comps = competitionRepository.findAll();
        }

        List<Map<String, Object>> allSubmissions = new ArrayList<>();
        User adminUser = new User();
        adminUser.setId("admin");
        adminUser.setRole("ADMIN");

        for (Competition c : comps) {
            try {
                List<Map<String, Object>> compSubs = getTrainerPendingSubmissions(c.getId(), adminUser);
                allSubmissions.addAll(compSubs);
            } catch (Exception ignored) {}
        }

        // Apply filters
        return allSubmissions.stream().filter(sub -> {
            // Exam Type filter
            if (examType != null && !examType.isBlank() && !"all".equalsIgnoreCase(examType)) {
                String subType = (String) sub.get("assessmentType");
                if (subType == null || !subType.equalsIgnoreCase(examType)) {
                    return false;
                }
            }
            // Set Code filter
            if (setCode != null && !setCode.isBlank() && !"all".equalsIgnoreCase(setCode)) {
                String subSet = (String) sub.get("setCode");
                if (subSet == null || !subSet.equalsIgnoreCase(setCode)) {
                    return false;
                }
            }
            // Status filter
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
                String subStatus = (String) sub.get("status");
                if ("PENDING".equalsIgnoreCase(status) || "EVALUATION_PENDING".equalsIgnoreCase(status)) {
                    if (!"EVALUATION_PENDING".equalsIgnoreCase(subStatus)) return false;
                } else if ("EVALUATED".equalsIgnoreCase(status) || "COMPLETED".equalsIgnoreCase(status)) {
                    if (!"COMPLETED".equalsIgnoreCase(subStatus)) return false;
                }
            }
            // Search filter
            if (search != null && !search.isBlank()) {
                String q = search.toLowerCase().trim();
                String studentName = (String) sub.getOrDefault("studentName", "");
                String studentEmail = (String) sub.getOrDefault("studentEmail", "");
                String asmtTitle = (String) sub.getOrDefault("assessmentTitle", "");
                String trainerName = (String) sub.getOrDefault("trainerName", "");
                boolean matches = (studentName != null && studentName.toLowerCase().contains(q))
                        || (studentEmail != null && studentEmail.toLowerCase().contains(q))
                        || (asmtTitle != null && asmtTitle.toLowerCase().contains(q))
                        || (trainerName != null && trainerName.toLowerCase().contains(q));
                if (!matches) return false;
            }
            return true;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTrainerAssignedCompetitions(User user) {
        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can view assigned competitions");
        }

        List<CompetitionSet> assignedSets;
        if ("TRAINER".equals(role)) {
            assignedSets = setRepository.findAll().stream()
                    .filter(s -> user.getId().equals(s.getTrainerId()))
                    .collect(Collectors.toList());
        } else {
            assignedSets = setRepository.findAll();
        }

        if (assignedSets.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, List<CompetitionSet>> compSetsMap = assignedSets.stream()
                .collect(Collectors.groupingBy(CompetitionSet::getCompetitionId));

        List<Map<String, Object>> results = new ArrayList<>();
        for (Map.Entry<String, List<CompetitionSet>> entry : compSetsMap.entrySet()) {
            String compId = entry.getKey();
            Competition comp = competitionRepository.findById(compId).orElse(null);
            if (comp == null) continue;

            Map<String, Object> cMap = new HashMap<>();
            cMap.put("id", comp.getId());
            cMap.put("title", comp.getTitle());
            cMap.put("category", comp.getCategory());
            cMap.put("status", comp.getStatus());
            cMap.put("startDate", comp.getStartDate());
            cMap.put("endDate", comp.getEndDate());

            List<Map<String, Object>> setsList = entry.getValue().stream()
                    .sorted(Comparator.comparing(CompetitionSet::getCode))
                    .map(s -> {
                        Map<String, Object> sm = new HashMap<>();
                        sm.put("id", s.getId());
                        sm.put("code", s.getCode());
                        sm.put("name", "Set " + s.getCode());
                        return sm;
                    })
                    .collect(Collectors.toList());

            cMap.put("assignedSets", setsList);
            cMap.put("totalAssignedSets", setsList.size());
            results.add(cMap);
        }

        results.sort(Comparator.comparing(c -> (String) c.get("title")));
        return results;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTrainerEvaluationsWithFilters(
            String competitionId,
            String examType,
            String setCode,
            String status,
            String search,
            User user) {
        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can view evaluation submissions");
        }

        List<Map<String, Object>> allSubmissions = new ArrayList<>();
        if (competitionId != null && !competitionId.isBlank() && !"ALL".equalsIgnoreCase(competitionId)) {
            allSubmissions.addAll(getTrainerPendingSubmissions(competitionId, user));
        } else {
            List<Map<String, Object>> assignedComps = getTrainerAssignedCompetitions(user);
            for (Map<String, Object> ac : assignedComps) {
                String cId = (String) ac.get("id");
                try {
                    allSubmissions.addAll(getTrainerPendingSubmissions(cId, user));
                } catch (Exception ignored) {}
            }
        }

        return allSubmissions.stream().filter(sub -> {
            if (examType != null && !examType.isBlank() && !"ALL".equalsIgnoreCase(examType)) {
                String subType = (String) sub.get("assessmentType");
                if (subType == null || !subType.equalsIgnoreCase(examType)) return false;
            }

            if (setCode != null && !setCode.isBlank() && !"ALL".equalsIgnoreCase(setCode)) {
                String subSet = (String) sub.get("setCode");
                if (subSet == null || !subSet.equalsIgnoreCase(setCode)) return false;
            }

            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                String subStatus = (String) sub.get("status");
                if ("PENDING".equalsIgnoreCase(status)) {
                    if (!"EVALUATION_PENDING".equalsIgnoreCase(subStatus)) return false;
                } else if ("EVALUATED".equalsIgnoreCase(status) || "COMPLETED".equalsIgnoreCase(status)) {
                    if (!"EVALUATED".equalsIgnoreCase(subStatus) && !"COMPLETED".equalsIgnoreCase(subStatus)) return false;
                }
            }

            if (search != null && !search.isBlank()) {
                String q = search.trim().toLowerCase();
                String studentName = (String) sub.getOrDefault("studentName", "");
                String studentEmail = (String) sub.getOrDefault("studentEmail", "");
                String asmtTitle = (String) sub.getOrDefault("assessmentTitle", "");
                boolean matches = (studentName != null && studentName.toLowerCase().contains(q))
                        || (studentEmail != null && studentEmail.toLowerCase().contains(q))
                        || (asmtTitle != null && asmtTitle.toLowerCase().contains(q));
                if (!matches) return false;
            }

            return true;
        }).collect(Collectors.toList());
    }

    // =========================================================================
    // N8: TRAINER PORTAL SUBMISSIONS HIERARCHY (3 LEVELS)
    // =========================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> getTrainerAssignedStudents(
            String competitionId,
            String setCode,
            String search,
            int page,
            int size,
            User user) {

        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if (!"TRAINER".equals(role) && !"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can view assigned submissions");
        }

        // 1. Get sets assigned to this trainer (or all sets for admin)
        List<CompetitionSet> targetSets;
        if ("TRAINER".equals(role)) {
            targetSets = setRepository.findAll().stream()
                    .filter(s -> user.getId().equals(s.getTrainerId()))
                    .collect(Collectors.toList());
        } else {
            targetSets = setRepository.findAll();
        }

        if (competitionId != null && !competitionId.isBlank() && !"ALL".equalsIgnoreCase(competitionId)) {
            targetSets = targetSets.stream()
                    .filter(s -> competitionId.equals(s.getCompetitionId()))
                    .collect(Collectors.toList());
        }
        if (setCode != null && !setCode.isBlank() && !"ALL".equalsIgnoreCase(setCode)) {
            targetSets = targetSets.stream()
                    .filter(s -> setCode.equalsIgnoreCase(s.getCode()))
                    .collect(Collectors.toList());
        }

        if (targetSets.isEmpty()) {
            Map<String, Object> emptyResp = new HashMap<>();
            emptyResp.put("students", Collections.emptyList());
            emptyResp.put("totalElements", 0);
            emptyResp.put("totalPages", 0);
            emptyResp.put("page", page);
            emptyResp.put("size", size);
            emptyResp.put("stats", Map.of(
                    "assignedCompetitions", 0,
                    "totalSubmissions", 0,
                    "pendingReview", 0,
                    "gradedSubmissions", 0
            ));
            return emptyResp;
        }

        Set<String> setIds = targetSets.stream().map(CompetitionSet::getId).collect(Collectors.toSet());
        Map<String, CompetitionSet> setMap = targetSets.stream().collect(Collectors.toMap(CompetitionSet::getId, s -> s, (a, b) -> a));

        List<CompetitionSetMember> allMembers = setMemberRepository.findAll().stream()
                .filter(m -> setIds.contains(m.getSetId()))
                .collect(Collectors.toList());

        Map<String, List<CompetitionSetMember>> membersByRegId = allMembers.stream()
                .collect(Collectors.groupingBy(CompetitionSetMember::getRegistrationId));

        long overallTotalSubmissions = 0;
        long overallPendingReview = 0;
        long overallGradedSubmissions = 0;
        Set<String> distinctCompIds = targetSets.stream().map(CompetitionSet::getCompetitionId).collect(Collectors.toSet());

        List<Map<String, Object>> studentCards = new ArrayList<>();

        for (Map.Entry<String, List<CompetitionSetMember>> entry : membersByRegId.entrySet()) {
            String regId = entry.getKey();
            CompetitionRegistration reg = registrationRepository.findById(regId).orElse(null);
            if (reg == null) continue;

            CompetitionSetMember member = entry.getValue().get(0);
            CompetitionSet set = setMap.get(member.getSetId());
            Competition comp = (set != null && set.getCompetitionId() != null)
                    ? competitionRepository.findById(set.getCompetitionId()).orElse(null) : null;

            List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByRegistrationId(regId);
            List<AssessmentAttempt> submittedAttempts = attempts.stream()
                    .filter(a -> !"NOT_STARTED".equalsIgnoreCase(a.getStatus()) && !"IN_PROGRESS".equalsIgnoreCase(a.getStatus()))
                    .collect(Collectors.toList());

            long totalSubs = submittedAttempts.size();
            long pendingSubs = submittedAttempts.stream()
                    .filter(a -> "EVALUATION_PENDING".equalsIgnoreCase(a.getStatus()))
                    .count();
            long gradedSubs = totalSubs - pendingSubs;

            overallTotalSubmissions += totalSubs;
            overallPendingReview += pendingSubs;
            overallGradedSubmissions += gradedSubs;

            if (search != null && !search.isBlank()) {
                String q = search.trim().toLowerCase();
                String name = reg.getStudentName() != null ? reg.getStudentName().toLowerCase() : "";
                String email = reg.getStudentEmail() != null ? reg.getStudentEmail().toLowerCase() : "";
                if (!name.contains(q) && !email.contains(q)) {
                    continue;
                }
            }

            Map<String, Object> card = new HashMap<>();
            String latestPendingAttemptId = submittedAttempts.stream()
                    .filter(a -> "EVALUATION_PENDING".equalsIgnoreCase(a.getStatus()))
                    .map(AssessmentAttempt::getId)
                    .findFirst()
                    .orElse(submittedAttempts.isEmpty() ? null : submittedAttempts.get(0).getId());
            card.put("latestAttemptId", latestPendingAttemptId);
            card.put("registrationId", regId);
            card.put("studentName", reg.getStudentName());
            card.put("studentEmail", reg.getStudentEmail());
            card.put("studentPhone", reg.getStudentPhone());
            card.put("competitionId", comp != null ? comp.getId() : (set != null ? set.getCompetitionId() : ""));
            card.put("competitionTitle", comp != null ? comp.getTitle() : "Competition");
            card.put("setCode", set != null ? set.getCode() : "");
            card.put("setName", set != null ? "Set " + set.getCode() : "");
            card.put("totalSubmissions", totalSubs);
            card.put("pendingCount", pendingSubs);
            card.put("correctedCount", gradedSubs);
            card.put("overallStatus", pendingSubs > 0 ? "PENDING" : "CORRECTED");
            card.put("statusText", pendingSubs > 0 ? (pendingSubs + " pending") : "All corrected");

            studentCards.add(card);
        }

        studentCards.sort((a, b) -> {
            int pA = ((Number) a.get("pendingCount")).intValue();
            int pB = ((Number) b.get("pendingCount")).intValue();
            if (pA > 0 && pB == 0) return -1;
            if (pA == 0 && pB > 0) return 1;
            String nA = (String) a.getOrDefault("studentName", "");
            String nB = (String) b.getOrDefault("studentName", "");
            return nA.compareToIgnoreCase(nB);
        });

        int totalElements = studentCards.size();
        int safeSize = size > 0 ? size : 10;
        int totalPages = (int) Math.ceil((double) totalElements / safeSize);
        int fromIndex = Math.min(page * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);
        List<Map<String, Object>> paginated = (fromIndex < totalElements) ? studentCards.subList(fromIndex, toIndex) : Collections.emptyList();

        Map<String, Object> resp = new HashMap<>();
        resp.put("students", paginated);
        resp.put("totalElements", totalElements);
        resp.put("totalPages", totalPages);
        resp.put("page", page);
        resp.put("size", safeSize);

        Map<String, Object> stats = new HashMap<>();
        stats.put("assignedCompetitions", distinctCompIds.size());
        stats.put("totalSubmissions", overallTotalSubmissions);
        stats.put("pendingReview", overallPendingReview);
        stats.put("gradedSubmissions", overallGradedSubmissions);
        resp.put("stats", stats);

        return resp;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTrainerStudentFolders(String registrationId, User user) {
        validateTrainerAccessToStudent(registrationId, user);

        CompetitionRegistration reg = registrationRepository.findById(registrationId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration not found: " + registrationId));

        Competition comp = reg.getCompetition();
        String compTitle = comp != null ? comp.getTitle() : "Competition";

        Optional<CompetitionSetMember> memOpt = setMemberRepository.findByRegistrationId(registrationId);
        String setCode = "";
        if (memOpt.isPresent()) {
            CompetitionSet cs = setRepository.findById(memOpt.get().getSetId()).orElse(null);
            if (cs != null) setCode = cs.getCode();
        }

        List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByRegistrationId(registrationId).stream()
                .filter(a -> !"NOT_STARTED".equalsIgnoreCase(a.getStatus()) && !"IN_PROGRESS".equalsIgnoreCase(a.getStatus()))
                .collect(Collectors.toList());

        Map<String, List<AssessmentAttempt>> byFolderType = new HashMap<>();
        byFolderType.put("TEST_SERIES", new ArrayList<>());
        byFolderType.put("MOCK", new ArrayList<>());
        byFolderType.put("FINAL", new ArrayList<>());

        for (AssessmentAttempt att : attempts) {
            CompetitionAssessment asmt = assessmentRepository.findById(att.getAssessmentId()).orElse(null);
            if (asmt != null && asmt.getType() != null) {
                String typeUpper = asmt.getType().toUpperCase();
                if ("MOCK_TEST".equals(typeUpper)) typeUpper = "MOCK";
                if ("FINAL_ASSESSMENT".equals(typeUpper)) typeUpper = "FINAL";
                if (byFolderType.containsKey(typeUpper)) {
                    byFolderType.get(typeUpper).add(att);
                }
            }
        }

        List<Map<String, Object>> folders = new ArrayList<>();

        // 1. Test Series
        List<AssessmentAttempt> tsAttempts = byFolderType.get("TEST_SERIES");
        long tsPending = tsAttempts.stream().filter(a -> "EVALUATION_PENDING".equalsIgnoreCase(a.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(a.getEvaluationMode())).count();
        long tsTotal = tsAttempts.size();
        Map<String, Object> tsFolder = new HashMap<>();
        tsFolder.put("folderKey", "TEST_SERIES");
        tsFolder.put("title", "Test Series");
        tsFolder.put("totalSubmissions", tsTotal);
        tsFolder.put("pendingCount", tsPending);
        tsFolder.put("correctedCount", tsTotal - tsPending);
        tsFolder.put("statusText", tsTotal == 0 ? "No submissions yet"
                : tsPending > 0 ? ("Correction pending (" + tsPending + ")")
                : "All test series are corrected");
        folders.add(tsFolder);

        // 2. Mock Tests
        List<AssessmentAttempt> mtAttempts = byFolderType.get("MOCK");
        long mtPending = mtAttempts.stream().filter(a -> "EVALUATION_PENDING".equalsIgnoreCase(a.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(a.getEvaluationMode())).count();
        long mtTotal = mtAttempts.size();
        Map<String, Object> mtFolder = new HashMap<>();
        mtFolder.put("folderKey", "MOCK_TEST");
        mtFolder.put("title", "Mock Tests");
        mtFolder.put("totalSubmissions", mtTotal);
        mtFolder.put("pendingCount", mtPending);
        mtFolder.put("correctedCount", mtTotal - mtPending);
        mtFolder.put("statusText", mtTotal == 0 ? "No submissions yet"
                : mtPending > 0 ? ("Correction pending (" + mtPending + ")")
                : "All mock tests are corrected");
        folders.add(mtFolder);

        // 3. Final Assessment (at most 1 submission shown)
        List<AssessmentAttempt> faAttempts = byFolderType.get("FINAL");
        long faPending = faAttempts.stream().filter(a -> "EVALUATION_PENDING".equalsIgnoreCase(a.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(a.getEvaluationMode())).count();
        long faTotal = faAttempts.size();
        long faDisplayTotal = Math.min(faTotal, 1);
        long faDisplayPending = Math.min(faPending, 1);
        Map<String, Object> faFolder = new HashMap<>();
        faFolder.put("folderKey", "FINAL_ASSESSMENT");
        faFolder.put("title", "Final Assessment");
        faFolder.put("totalSubmissions", faDisplayTotal);
        faFolder.put("pendingCount", faDisplayPending);
        faFolder.put("correctedCount", Math.max(0, faDisplayTotal - faDisplayPending));
        faFolder.put("statusText", faTotal == 0 ? "No submissions yet"
                : faDisplayPending > 0 ? ("Correction pending (" + faDisplayPending + ")")
                : "Final assessment is corrected");
        folders.add(faFolder);

        Map<String, Object> studentInfo = new HashMap<>();
        studentInfo.put("registrationId", registrationId);
        studentInfo.put("studentName", reg.getStudentName());
        studentInfo.put("studentEmail", reg.getStudentEmail());
        studentInfo.put("competitionTitle", compTitle);
        studentInfo.put("setCode", setCode);

        Map<String, Object> result = new HashMap<>();
        result.put("student", studentInfo);
        result.put("folders", folders);
        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getTrainerStudentSubmissions(String registrationId, String folderType, User user) {
        if (folderType == null || folderType.isBlank()) {
            throw new BadRequestException("Folder type is required. Must be one of: TEST_SERIES, MOCK_TEST, FINAL_ASSESSMENT");
        }

        String rawType = folderType.trim().toUpperCase();
        String targetType;
        if ("TEST_SERIES".equals(rawType) || "TEST".equals(rawType)) {
            targetType = "TEST_SERIES";
        } else if ("MOCK_TEST".equals(rawType) || "MOCK".equals(rawType)) {
            targetType = "MOCK";
        } else if ("FINAL_ASSESSMENT".equals(rawType) || "FINAL".equals(rawType)) {
            targetType = "FINAL";
        } else {
            throw new BadRequestException("Invalid folder type '" + folderType + "'. Must be one of: TEST_SERIES, MOCK_TEST, FINAL_ASSESSMENT");
        }

        CompetitionRegistration reg = registrationRepository.findById(registrationId).orElse(null);
        if (reg == null) {
            List<CompetitionRegistration> regs = registrationRepository.findByStudentId(registrationId);
            if (!regs.isEmpty()) {
                reg = regs.get(0);
                registrationId = reg.getId();
            }
        }
        if (reg == null) {
            throw new ResourceNotFoundException("Student registration not found: " + registrationId);
        }

        validateTrainerAccessToStudent(registrationId, user);

        Optional<CompetitionSetMember> memOpt = setMemberRepository.findByRegistrationId(registrationId);
        String setCode = "";
        if (memOpt.isPresent()) {
            CompetitionSet cs = setRepository.findById(memOpt.get().getSetId()).orElse(null);
            if (cs != null) setCode = cs.getCode();
        }

        List<AssessmentAttempt> attempts = assessmentAttemptRepository.findByRegistrationId(registrationId).stream()
                .filter(a -> !"NOT_STARTED".equalsIgnoreCase(a.getStatus()) && !"IN_PROGRESS".equalsIgnoreCase(a.getStatus()))
                .collect(Collectors.toList());

        List<Map<String, Object>> submissions = new ArrayList<>();

        for (AssessmentAttempt att : attempts) {
            CompetitionAssessment asmt = assessmentRepository.findById(att.getAssessmentId()).orElse(null);
            if (asmt == null || asmt.getType() == null) continue;

            String asmtType = asmt.getType().toUpperCase();
            if ("MOCK_TEST".equals(asmtType)) asmtType = "MOCK";
            if ("FINAL_ASSESSMENT".equals(asmtType)) asmtType = "FINAL";
            if ("TEST".equals(asmtType)) asmtType = "TEST_SERIES";

            if (!asmtType.equals(targetType)) {
                continue;
            }

            List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(att.getId());
            long voiceCount = answers.stream().filter(a -> a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();
            long voiceEvaluatedCount = answers.stream().filter(a -> "EVALUATED".equalsIgnoreCase(a.getEvaluationStatus()) && a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();
            long voicePendingCount = answers.stream().filter(a -> "PENDING_TRAINER".equalsIgnoreCase(a.getEvaluationStatus()) && a.getVoiceFileId() != null && !a.getVoiceFileId().isBlank()).count();

            Map<String, Object> sub = new HashMap<>();
            sub.put("attemptId", att.getId());
            sub.put("assessmentId", asmt.getId());
            sub.put("assessmentTitle", asmt.getTitle());
            sub.put("assessmentType", asmt.getType());
            sub.put("sequenceNo", asmt.getSequenceNo());
            sub.put("setCode", setCode);
            sub.put("submittedAt", att.getSubmittedAt());
            sub.put("status", att.getStatus());
            sub.put("evaluationMode", att.getEvaluationMode());
            sub.put("mcqMarks", att.getMcqMarks());
            sub.put("voiceMarks", att.getVoiceMarks());
            sub.put("totalMarks", att.getTotalMarks());
            sub.put("maxMarks", asmt.getTotalMarks());
            sub.put("voiceQuestionsCount", voiceCount);
            sub.put("voiceEvaluatedCount", voiceEvaluatedCount);
            sub.put("voicePendingCount", voicePendingCount);
            sub.put("proctorViolationsCount", att.getProctorViolationCount());
            sub.put("autoSubmitted", Boolean.TRUE.equals(att.getAutoSubmitted()));

            submissions.add(sub);
        }

        // M3 Rule 2: A student has at most ONE final assessment attempt: the Final Assessment folder shows one item or none; never a list.
        if ("FINAL".equals(targetType) && submissions.size() > 1) {
            submissions.sort((a, b) -> {
                OffsetDateTime aTime = (OffsetDateTime) a.get("submittedAt");
                OffsetDateTime bTime = (OffsetDateTime) b.get("submittedAt");
                if (aTime != null && bTime != null) return bTime.compareTo(aTime);
                return 0;
            });
            submissions = new ArrayList<>(submissions.subList(0, 1));
        }

        submissions.sort(Comparator.comparing(s -> (Integer) s.getOrDefault("sequenceNo", 0)));
        return submissions;
    }

    private void validateTrainerAccessToStudent(String registrationId, User user) {
        if (user == null) {
            throw new org.springframework.security.access.AccessDeniedException("Authentication required");
        }
        String role = (user.getRole() != null ? user.getRole() : "").toUpperCase();
        if ("ADMIN".equals(role) || "SUPER_ADMIN".equals(role)) {
            return;
        }
        if (!"TRAINER".equals(role)) {
            throw new ForbiddenException("Only trainers and admins can view evaluation submissions");
        }
        Optional<CompetitionSetMember> memOpt = setMemberRepository.findByRegistrationId(registrationId);
        if (memOpt.isEmpty()) {
            throw new ForbiddenException("Student is not assigned to any competition set");
        }
        CompetitionSet cs = setRepository.findById(memOpt.get().getSetId()).orElse(null);
        if (cs == null || !user.getId().equals(cs.getTrainerId())) {
            throw new ForbiddenException("You are not assigned to evaluate this student's set");
        }
    }

    // =========================================================================
    // PHASE 5: LEADERBOARD ENGINE
    // =========================================================================

    @Transactional
    public Map<String, Object> recalculateLeaderboard(String competitionId, User currentUser) {
        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + competitionId));

        // 1. Fetch all registrations for this competition
        List<CompetitionRegistration> registrations = registrationRepository.findByCompetitionId(competitionId);
        if (registrations == null) registrations = new ArrayList<>();

        // 2. Map set assignments
        List<CompetitionSet> sets = setRepository.findByCompetitionIdOrderByCodeAsc(competitionId);
        Map<String, String> setIdToCodeMap = new HashMap<>();
        for (CompetitionSet s : sets) {
            setIdToCodeMap.put(s.getId(), s.getCode());
        }

        List<CompetitionSetMember> members = setMemberRepository.findByCompetitionId(competitionId);
        Map<String, String> regSetCodeMap = new HashMap<>();
        for (CompetitionSetMember m : members) {
            String code = setIdToCodeMap.getOrDefault(m.getSetId(), "A");
            regSetCodeMap.put(m.getRegistrationId(), code);
        }

        // 3. Find the championship final assessment for this competition
        List<CompetitionAssessment> assessments = assessmentRepository.findByCompetitionIdOrderBySequenceNoAsc(competitionId);
        CompetitionAssessment finalAsmt = assessments.stream()
                .filter(a -> "FINAL".equalsIgnoreCase(a.getType()))
                .findFirst().orElse(null);

        // Helper class to hold student scoring row
        class StudentScoreRow {
            CompetitionRegistration reg;
            String setCode;
            BigDecimal totalMarks;
            OffsetDateTime submittedAt;
            boolean isProvisional;
        }

        List<StudentScoreRow> rows = new ArrayList<>();
        if (finalAsmt != null && assessmentAttemptRepository != null) {
            for (CompetitionRegistration reg : registrations) {
                Optional<AssessmentAttempt> opt = assessmentAttemptRepository.findTopByAssessmentIdAndRegistrationIdOrderByPublishVersionDesc(finalAsmt.getId(), reg.getId());
                if (opt.isPresent()) {
                    AssessmentAttempt att = opt.get();
                    // Candidate MUST have submitted the Final Assessment to appear on the leaderboard
                    if ("IN_PROGRESS".equalsIgnoreCase(att.getStatus()) || att.getSubmittedAt() == null) {
                        continue;
                    }

                    StudentScoreRow row = new StudentScoreRow();
                    row.reg = reg;
                    row.setCode = regSetCodeMap.getOrDefault(reg.getId(), "A");
                    row.submittedAt = att.getSubmittedAt();

                    boolean isPending = "EVALUATION_PENDING".equalsIgnoreCase(att.getStatus()) || "MANUAL_PENDING".equalsIgnoreCase(att.getEvaluationMode());
                    if (isPending) {
                        row.isProvisional = true;
                        row.totalMarks = att.getMcqMarks() != null ? att.getMcqMarks() : BigDecimal.ZERO;
                    } else {
                        row.isProvisional = false;
                        row.totalMarks = att.getTotalMarks() != null ? att.getTotalMarks() : BigDecimal.ZERO;
                    }
                    rows.add(row);
                }
            }
        }

        // 4. Sort entries:
        //    Primary: totalMarks DESC
        //    Secondary: submittedAt ASC (nulls last)
        //    Tertiary: studentName ASC
        rows.sort((a, b) -> {
            int cmp = b.totalMarks.compareTo(a.totalMarks);
            if (cmp != 0) return cmp;
            if (a.submittedAt != null && b.submittedAt != null) {
                int timeCmp = a.submittedAt.compareTo(b.submittedAt);
                if (timeCmp != 0) return timeCmp;
            } else if (a.submittedAt != null && b.submittedAt == null) {
                return -1;
            } else if (a.submittedAt == null && b.submittedAt != null) {
                return 1;
            }
            String nameA = a.reg.getStudentName() != null ? a.reg.getStudentName() : "";
            String nameB = b.reg.getStudentName() != null ? b.reg.getStudentName() : "";
            return nameA.compareToIgnoreCase(nameB);
        });

        // 5. Calculate Ranks and Percentiles
        int totalStudents = rows.size();
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime now = OffsetDateTime.now(ist);

        List<CompetitionLeaderboardCache> cacheList = new ArrayList<>();
        List<LeaderboardEntry> entryList = new ArrayList<>();

        int currentRank = 1;
        for (int i = 0; i < totalStudents; i++) {
            StudentScoreRow r = rows.get(i);
            if (i > 0) {
                StudentScoreRow prev = rows.get(i - 1);
                boolean sameMarks = r.totalMarks.compareTo(prev.totalMarks) == 0;
                boolean sameTime = (r.submittedAt == null && prev.submittedAt == null) ||
                        (r.submittedAt != null && prev.submittedAt != null && r.submittedAt.isEqual(prev.submittedAt));
                if (!sameMarks || !sameTime) {
                    currentRank = i + 1;
                }
            } else {
                currentRank = 1;
            }

            // Percentile formula: ((totalStudents - rank) / (totalStudents - 1)) * 100
            BigDecimal percentile = BigDecimal.valueOf(100.00);
            if (totalStudents > 1) {
                double pct = ((double)(totalStudents - currentRank) / (double)(totalStudents - 1)) * 100.0;
                percentile = BigDecimal.valueOf(Math.max(0.0, Math.min(100.0, pct))).setScale(2, RoundingMode.HALF_UP);
            }

            CompetitionLeaderboardCache cache = null;
            if (leaderboardCacheRepository != null) {
                cache = leaderboardCacheRepository.findByCompetitionIdAndRegistrationId(competitionId, r.reg.getId()).orElse(null);
            }
            if (cache == null) {
                cache = new CompetitionLeaderboardCache();
                cache.setId("lbc_" + UUID.randomUUID().toString().substring(0, 16));
                cache.setCompetitionId(competitionId);
                cache.setRegistrationId(r.reg.getId());
            }
            cache.setStudentName(r.reg.getStudentName() != null ? r.reg.getStudentName() : "Student");
            cache.setSetCode(r.setCode);
            cache.setTotalMarks(r.totalMarks);
            cache.setIsProvisional(r.isProvisional);
            cache.setRank(currentRank);
            cache.setPercentile(percentile);
            cache.setPublishedAt("PUBLISHED".equalsIgnoreCase(comp.getLeaderboardStatus()) ? now : null);
            cache.setLastRefreshedAt(now);
            cacheList.add(cache);

            LeaderboardEntry entry = null;
            if (leaderboardEntryRepository != null) {
                entry = leaderboardEntryRepository.findByCompetitionIdAndRegistrationId(competitionId, r.reg.getId()).orElse(null);
            }
            if (entry == null) {
                entry = new LeaderboardEntry();
                entry.setId("lbe_" + UUID.randomUUID().toString().substring(0, 16));
                entry.setCompetitionId(competitionId);
                entry.setRegistrationId(r.reg.getId());
            }
            entry.setStudentName(r.reg.getStudentName() != null ? r.reg.getStudentName() : "Student");
            entry.setSetCode(r.setCode);
            entry.setTotalMarks(r.totalMarks);
            entry.setIsProvisional(r.isProvisional);
            entry.setRank(currentRank);
            entry.setPercentile(percentile);
            entry.setFinalSubmittedAt(r.submittedAt);
            entry.setPublishedAt(now);
            entryList.add(entry);

            // Sync rank and score to CompetitionRegistration
            r.reg.setRank(currentRank);
            r.reg.setScore(r.totalMarks);
            registrationRepository.save(r.reg);
        }

        if (leaderboardCacheRepository != null) {
            leaderboardCacheRepository.saveAll(cacheList);
        }
        if (leaderboardEntryRepository != null) {
            leaderboardEntryRepository.saveAll(entryList);
        }

        return getLeaderboard(competitionId, currentUser, false);
    }

    public Map<String, Object> getLeaderboard(String competitionId, User currentUser) {
        return getLeaderboard(competitionId, currentUser, true);
    }

    public Map<String, Object> getLeaderboard(String competitionId, User currentUser, boolean allowRecalculate) {
        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + competitionId));

        List<CompetitionLeaderboardCache> cached = leaderboardCacheRepository != null
                ? leaderboardCacheRepository.findByCompetitionIdOrderByRankAsc(competitionId)
                : Collections.emptyList();

        if ((cached == null || cached.isEmpty()) && allowRecalculate) {
            return recalculateLeaderboard(competitionId, currentUser);
        }

        String userRole = currentUser != null && currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "PUBLIC";
        boolean isStaff = "ADMIN".equals(userRole) || "SUPER_ADMIN".equals(userRole) || "TRAINER".equals(userRole);
        boolean isPublished = "PUBLISHED".equalsIgnoreCase(comp.getLeaderboardStatus());

        ZoneId ist = ZoneId.of("Asia/Kolkata");
        OffsetDateTime now = OffsetDateTime.now(ist);

        OffsetDateTime scheduledAt = comp.getLeaderboardPublishedAt();
        if (scheduledAt == null && comp.getLeaderboardPublishTime() != null && comp.getLeaderboardPublishTime().contains("T")) {
            try {
                LocalDateTime ldt = LocalDateTime.parse(comp.getLeaderboardPublishTime());
                scheduledAt = ldt.atZone(ist).toOffsetDateTime();
            } catch (Exception ignored) {}
        }

        isPublished = "PUBLISHED".equalsIgnoreCase(comp.getLeaderboardStatus());
        boolean isExplicitlyUnpublished = "UNPUBLISHED".equalsIgnoreCase(comp.getLeaderboardStatus());

        // Check if scheduled publish time has arrived for lazy unlock
        if (!isPublished && !isExplicitlyUnpublished && scheduledAt != null && (now.isAfter(scheduledAt) || now.isEqual(scheduledAt))) {
            comp.setLeaderboardStatus("PUBLISHED");
            comp.setLeaderboardPublishedAt(scheduledAt);
            competitionRepository.save(comp);
            isPublished = true;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("competitionId", comp.getId());
        result.put("competitionTitle", comp.getTitle());
        result.put("status", comp.getLeaderboardStatus() != null ? comp.getLeaderboardStatus() : "NOT_PUBLISHED");
        result.put("isPublished", isPublished);
        result.put("publishedAt", comp.getLeaderboardPublishedAt());
        result.put("scheduledPublishTime", comp.getLeaderboardPublishTime());
        result.put("answerReviewEnabled", Boolean.TRUE.equals(comp.getAnswerReviewEnabled()));
        result.put("totalParticipants", cached.size());
        result.put("serverNow", now);

        // If not published and not staff, return unpublished metadata with countdown
        if (!isPublished && !isStaff) {
            result.put("entries", Collections.emptyList());
            result.put("podium", Collections.emptyList());
            result.put("myRank", null);
            result.put("setStats", Collections.emptyMap());
            return result;
        }

        // Format entries and partition by set
        List<Map<String, Object>> entriesList = new ArrayList<>();
        Map<String, List<Map<String, Object>>> setEntriesMap = new HashMap<>();
        setEntriesMap.put("A", new ArrayList<>());
        setEntriesMap.put("B", new ArrayList<>());
        setEntriesMap.put("C", new ArrayList<>());
        setEntriesMap.put("D", new ArrayList<>());

        Map<String, Object> myRankObj = null;
        String currentStudentEmail = currentUser != null ? currentUser.getEmail() : null;
        String currentStudentId = currentUser != null ? currentUser.getId() : null;

        for (CompetitionLeaderboardCache c : cached) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", c.getId());
            item.put("rank", c.getRank());
            item.put("registrationId", c.getRegistrationId());
            boolean isProv = Boolean.TRUE.equals(c.getIsProvisional());
            item.put("isProvisional", isProv);

            boolean isCurrentStudent = false;
            if (currentUser != null) {
                Optional<CompetitionRegistration> regOpt = registrationRepository.findById(c.getRegistrationId());
                if (regOpt.isPresent()) {
                    CompetitionRegistration r = regOpt.get();
                    if ((currentStudentId != null && currentStudentId.equals(r.getStudentId())) ||
                        (currentStudentEmail != null && currentStudentEmail.equalsIgnoreCase(r.getStudentEmail()))) {
                        isCurrentStudent = true;
                    }
                }
            }

            if (isProv) {
                if (isCurrentStudent) {
                    item.put("studentName", "You (evaluation pending)");
                } else if (!isStaff) {
                    item.put("studentName", "Candidate (evaluation pending)");
                    item.put("registrationId", "PROVISIONAL");
                } else {
                    item.put("studentName", c.getStudentName() + " (evaluation pending)");
                }
            } else {
                item.put("studentName", c.getStudentName());
            }

            if (isStaff) {
                item.put("setCode", c.getSetCode());
            }
            item.put("totalMarks", c.getTotalMarks());
            item.put("percentile", c.getPercentile());

            entriesList.add(item);
            String setKey = c.getSetCode() != null ? c.getSetCode().toUpperCase() : "A";
            setEntriesMap.computeIfAbsent(setKey, k -> new ArrayList<>()).add(item);

            // Match myRank if student
            if (currentUser != null && myRankObj == null) {
                Optional<CompetitionRegistration> regOpt = registrationRepository.findById(c.getRegistrationId());
                if (regOpt.isPresent()) {
                    CompetitionRegistration r = regOpt.get();
                    if ((currentStudentId != null && currentStudentId.equals(r.getStudentId())) ||
                        (currentStudentEmail != null && currentStudentEmail.equalsIgnoreCase(r.getStudentEmail()))) {
                        myRankObj = new HashMap<>(item);
                    }
                }
            }
        }

        // Calculate setRank within each set
        for (Map.Entry<String, List<Map<String, Object>>> entry : setEntriesMap.entrySet()) {
            List<Map<String, Object>> list = entry.getValue();
            for (int i = 0; i < list.size(); i++) {
                list.get(i).put("setRank", i + 1);
            }
        }

        // Attach setRank to myRankObj for staff
        if (isStaff && myRankObj != null) {
            String mySet = (String) myRankObj.get("setCode");
            List<Map<String, Object>> setList = setEntriesMap.getOrDefault(mySet != null ? mySet.toUpperCase() : "A", Collections.emptyList());
            for (Map<String, Object> sItem : setList) {
                if (myRankObj.get("registrationId").equals(sItem.get("registrationId"))) {
                    myRankObj.put("setRank", sItem.get("setRank"));
                    break;
                }
            }
        } else if (!isStaff && myRankObj != null) {
            myRankObj.remove("setCode");
            myRankObj.remove("setRank");
        }

        result.put("entries", entriesList);
        result.put("myRank", myRankObj);

        // Podium: Top 3
        List<Map<String, Object>> podium = new ArrayList<>();
        for (int i = 0; i < Math.min(3, entriesList.size()); i++) {
            podium.add(entriesList.get(i));
        }
        result.put("podium", podium);

        // Set counts & summary stats (staff only)
        if (isStaff) {
            Map<String, Object> setStats = new HashMap<>();
            for (String sCode : Arrays.asList("A", "B", "C", "D")) {
                List<Map<String, Object>> sList = setEntriesMap.getOrDefault(sCode, Collections.emptyList());
                Map<String, Object> st = new HashMap<>();
                st.put("count", sList.size());
                BigDecimal topScore = sList.isEmpty() ? BigDecimal.ZERO : (BigDecimal) sList.get(0).get("totalMarks");
                st.put("topScore", topScore);
                setStats.put(sCode, st);
            }
            result.put("setStats", setStats);
        } else {
            result.put("setStats", Collections.emptyMap());
        }

        return result;
    }

    @Transactional
    public Map<String, Object> publishLeaderboard(String competitionId, User currentUser) {
        String role = currentUser != null && currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "";
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only administrators can publish the leaderboard");
        }

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + competitionId));

        OffsetDateTime now = OffsetDateTime.now(ZoneId.of("Asia/Kolkata"));
        comp.setLeaderboardStatus("PUBLISHED");
        comp.setLeaderboardPublishedAt(now);
        competitionRepository.save(comp);

        if (leaderboardCacheRepository != null) {
            List<CompetitionLeaderboardCache> cached = leaderboardCacheRepository.findByCompetitionIdOrderByRankAsc(competitionId);
            for (CompetitionLeaderboardCache c : cached) {
                c.setPublishedAt(now);
            }
            leaderboardCacheRepository.saveAll(cached);
        }

        return getLeaderboard(competitionId, currentUser);
    }

    @Transactional
    public Map<String, Object> unpublishLeaderboard(String competitionId, User currentUser) {
        String role = currentUser != null && currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "";
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only administrators can unpublish the leaderboard");
        }

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + competitionId));

        comp.setLeaderboardStatus("NOT_PUBLISHED");
        comp.setLeaderboardPublishedAt(null);
        competitionRepository.save(comp);

        if (leaderboardCacheRepository != null) {
            List<CompetitionLeaderboardCache> cached = leaderboardCacheRepository.findByCompetitionIdOrderByRankAsc(competitionId);
            for (CompetitionLeaderboardCache c : cached) {
                c.setPublishedAt(null);
            }
            leaderboardCacheRepository.saveAll(cached);
        }

        return getLeaderboard(competitionId, currentUser);
    }

    @Transactional
    public Map<String, Object> toggleAnswerReview(String competitionId, User currentUser) {
        String role = currentUser != null && currentUser.getRole() != null ? currentUser.getRole().toUpperCase() : "";
        if (!"ADMIN".equals(role) && !"SUPER_ADMIN".equals(role)) {
            throw new ForbiddenException("Only administrators can toggle answer review");
        }

        Competition comp = competitionRepository.findById(competitionId)
                .orElseThrow(() -> new ResourceNotFoundException("Competition not found: " + competitionId));

        boolean current = Boolean.TRUE.equals(comp.getAnswerReviewEnabled());
        comp.setAnswerReviewEnabled(!current);
        competitionRepository.save(comp);

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("answerReviewEnabled", comp.getAnswerReviewEnabled());
        return res;
    }
}

