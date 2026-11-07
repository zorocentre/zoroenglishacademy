package com.zoroacademy;

import com.zoroacademy.dto.UserDto;
import com.zoroacademy.entity.*;
import com.zoroacademy.exception.ConflictException;
import com.zoroacademy.exception.ResourceNotFoundException;
import com.zoroacademy.repository.*;
import com.zoroacademy.service.CompetitionService;
import com.zoroacademy.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
public class StudentCompetitionSafetyIntegrationTest {

    @Autowired
    private UserService userService;

    @Autowired
    private CompetitionService competitionService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CompetitionRegistrationRepository registrationRepository;

    @Autowired
    private CompetitionRepository competitionRepository;

    @Autowired
    private CompetitionAssessmentRepository assessmentRepository;

    @Autowired
    private AssessmentAttemptRepository attemptRepository;

    @Autowired
    private AttemptAnswerRepository answerRepository;

    @Autowired
    private LeaderboardEntryRepository leaderboardEntryRepository;

    @Autowired
    private CourseRepository courseRepository;

    @Autowired
    private BatchRepository batchRepository;

    @Autowired
    private EnrollmentRepository enrollmentRepository;

    @Autowired
    private StudentCourseBatchRepository studentCourseBatchRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Course testCourse;
    private Batch testBatch;
    private Competition testComp;

    @BeforeEach
    public void setup() {
        testCourse = Course.builder()
                .id("crs_test_" + UUID.randomUUID())
                .title("Test Course " + UUID.randomUUID())
                .mode("Online")
                .audience("student")
                .price(BigDecimal.valueOf(1000))
                .build();
        courseRepository.save(testCourse);

        testBatch = Batch.builder()
                .id("btc_test_" + UUID.randomUUID())
                .name("Batch A")
                .courseId(testCourse.getId())
                .courseName(testCourse.getTitle())
                .status("Active")
                .build();
        batchRepository.save(testBatch);

        testComp = new Competition();
        testComp.setId("comp_test_" + UUID.randomUUID());
        testComp.setTitle("Annual Test Competition");
        testComp.setStatus("PUBLISHED");
        competitionRepository.save(testComp);
    }

    @Test
    public void testA2_DeleteStudentWithCompetitionData_LeavesCompetitionDataAndUserIntact() {
        // 1. Create a student with course enrollment
        String email = "zztest_dual_" + UUID.randomUUID() + "@example.com";
        UserDto dto = new UserDto();
        dto.setEmail(email);
        dto.setName("Dual Candidate");
        dto.setPassword("Secret123!");
        dto.setCourse(testCourse.getTitle());
        dto.setCourseBatches(List.of(Map.of(
                "course", testCourse.getTitle(),
                "courseId", testCourse.getId(),
                "batch", testBatch.getName(),
                "batchId", testBatch.getId()
        )));
        UserDto createdStudent = userService.saveStudent(dto);
        assertNotNull(createdStudent.getId());
        String userId = createdStudent.getId();

        // 2. Add competition registration, attempt, answer, leaderboard row
        CompetitionRegistration reg = new CompetitionRegistration();
        reg.setId("reg_" + UUID.randomUUID());
        reg.setCompetition(testComp);
        reg.setStudentId(userId);
        reg.setStudentEmail(email);
        reg.setStudentName("Dual Candidate");
        reg.setPaymentStatus("SUCCESS");
        reg.setEncryptedPassword("dummy_encrypted");
        registrationRepository.save(reg);

        CompetitionAssessment asmt = new CompetitionAssessment();
        asmt.setId("asmt_" + UUID.randomUUID());
        asmt.setCompetitionId(testComp.getId());
        asmt.setType("TEST_SERIES");
        asmt.setSequenceNo(1);
        asmt.setTitle("Slot 1 Diagnostic");
        asmt.setStatus("PUBLISHED");
        assessmentRepository.save(asmt);

        AssessmentAttempt attempt = new AssessmentAttempt();
        attempt.setId("att_" + UUID.randomUUID());
        attempt.setAssessmentId(asmt.getId());
        attempt.setRegistrationId(reg.getId());
        attempt.setStatus("COMPLETED");
        attempt.setPublishVersion(1);
        attempt.setTotalMarks(BigDecimal.valueOf(25));
        attempt.setStartedAt(OffsetDateTime.now());
        attemptRepository.save(attempt);

        AttemptAnswer ans = new AttemptAnswer();
        ans.setId("ans_" + UUID.randomUUID());
        ans.setAttemptId(attempt.getId());
        ans.setQuestionId("q_1");
        ans.setMarksAwarded(BigDecimal.valueOf(5));
        ans.setSavedAt(OffsetDateTime.now());
        answerRepository.save(ans);

        LeaderboardEntry lb = new LeaderboardEntry();
        lb.setId("lb_" + UUID.randomUUID());
        lb.setCompetitionId(testComp.getId());
        lb.setRegistrationId(reg.getId());
        lb.setStudentName("Dual Candidate");
        lb.setTotalMarks(BigDecimal.valueOf(25));
        lb.setRank(1);
        lb.setPublishedAt(OffsetDateTime.now());
        leaderboardEntryRepository.save(lb);

        // 3. Delete the student via Manage Students delete flow (force = true because active enrollment)
        userService.deleteUser(userId, true);

        // 4. Assert: Course enrollments and student batches are removed
        assertTrue(enrollmentRepository.findByStudentId(userId).isEmpty(), "Course enrollments must be removed");
        assertTrue(studentCourseBatchRepository.findByStudentId(userId).isEmpty(), "Batch mappings must be removed");

        // 5. Assert: User identity row STILL EXISTS and retains credentials
        Optional<User> userOpt = userRepository.findById(userId);
        assertTrue(userOpt.isPresent(), "User identity row must be retained");
        User user = userOpt.get();
        assertEquals("COMPETITION", user.getOrigin());
        assertNull(user.getCourse());
        assertTrue(passwordEncoder.matches("Secret123!", user.getPassword()), "Login credentials must still work");

        // 6. Assert: All competition rows remain 100% intact
        assertTrue(registrationRepository.findById(reg.getId()).isPresent(), "Registration must be preserved");
        assertTrue(attemptRepository.findById(attempt.getId()).isPresent(), "Attempt must be preserved");
        assertTrue(answerRepository.findById(ans.getId()).isPresent(), "Answer must be preserved");
        assertTrue(leaderboardEntryRepository.findById(lb.getId()).isPresent(), "Leaderboard entry must be preserved");
    }

    @Test
    public void testA2_DeleteStudentWithoutCompetitionData_FullyDeletesAccount() {
        String email = "zztest_courseonly_" + UUID.randomUUID() + "@example.com";
        UserDto dto = new UserDto();
        dto.setEmail(email);
        dto.setName("Course Only");
        dto.setPassword("Secret123!");
        dto.setCourse(testCourse.getTitle());
        dto.setCourseBatches(List.of(Map.of(
                "course", testCourse.getTitle(),
                "courseId", testCourse.getId(),
                "batch", testBatch.getName(),
                "batchId", testBatch.getId()
        )));
        UserDto createdStudent = userService.saveStudent(dto);
        String userId = createdStudent.getId();

        // Delete student with force
        userService.deleteUser(userId, true);

        // User row must be completely gone
        assertTrue(userRepository.findById(userId).isEmpty(), "User with no competition data must be completely deleted");
    }

    @Test
    public void testA3_DuplicateCheckOrder_CasesA_B_C_D() {
        // (a) Admin / Trainer rejection
        User trainer = User.builder()
                .id("trn_" + UUID.randomUUID())
                .name("Test Trainer")
                .email("zztest_trainer_" + UUID.randomUUID() + "@example.com")
                .role("TRAINER")
                .password("Trainer123!")
                .build();
        userRepository.save(trainer);

        UserDto adminRejectDto = new UserDto();
        adminRejectDto.setEmail(trainer.getEmail());
        adminRejectDto.setName("Attempt As Student");
        adminRejectDto.setPassword("Secret123!");
        assertThrows(ConflictException.class, () -> userService.saveStudent(adminRejectDto));

        // (b) Active course student rejection: exact message
        String studentEmail = "zztest_active_" + UUID.randomUUID() + "@example.com";
        UserDto activeDto = new UserDto();
        activeDto.setEmail(studentEmail);
        activeDto.setName("Active Student");
        activeDto.setPassword("Secret123!");
        activeDto.setCourseBatches(List.of(Map.of(
                "course", testCourse.getTitle(),
                "courseId", testCourse.getId(),
                "batch", testBatch.getName(),
                "batchId", testBatch.getId()
        )));
        userService.saveStudent(activeDto);

        UserDto dupDto = new UserDto();
        dupDto.setEmail(studentEmail);
        dupDto.setName("Duplicate Try");
        dupDto.setPassword("Secret123!");
        ConflictException ex = assertThrows(ConflictException.class, () -> userService.saveStudent(dupDto));
        assertEquals("A student with this email already exists", ex.getMessage());

        // (c) Existing competition participant account:
        // Create candidate registered for competition only
        String compEmail = "zztest_componly_" + UUID.randomUUID() + "@example.com";
        User compUser = User.builder()
                .id("usr_" + UUID.randomUUID())
                .email(compEmail)
                .name("Comp Candidate")
                .role("STUDENT")
                .origin("COMPETITION")
                .password(passwordEncoder.encode("OldCompPass1!"))
                .build();
        userRepository.save(compUser);

        CompetitionRegistration reg = new CompetitionRegistration();
        reg.setId("reg_" + UUID.randomUUID());
        reg.setCompetition(testComp);
        reg.setStudentId(compUser.getId());
        reg.setStudentEmail(compEmail);
        reg.setStudentName("Comp Candidate");
        reg.setPaymentStatus("SUCCESS");
        reg.setEncryptedPassword("dummy_old_enc");
        registrationRepository.save(reg);

        // First attempt without confirmation flag: returns machine-readable confirmation payload
        UserDto addCandidateDto = new UserDto();
        addCandidateDto.setEmail(compEmail);
        addCandidateDto.setName("Comp Candidate");
        addCandidateDto.setPassword("NewCoursePass1!");
        addCandidateDto.setCourseBatches(List.of(Map.of(
                "course", testCourse.getTitle(),
                "courseId", testCourse.getId(),
                "batch", testBatch.getName(),
                "batchId", testBatch.getId()
        )));

        UserDto confirmResponse = userService.saveStudent(addCandidateDto);
        assertTrue(confirmResponse.getExistingCompetitionAccount(), "Must indicate existing competition account");
        assertEquals("Comp Candidate", confirmResponse.getCandidateName());
        assertTrue(confirmResponse.getCompetitions().contains("Annual Test Competition"));

        // Second attempt with confirmation flag: confirms and creates course profile
        addCandidateDto.setConfirmExistingCompetitionAccount(true);
        UserDto savedStudent = userService.saveStudent(addCandidateDto);
        assertEquals(compUser.getId(), savedStudent.getId(), "Must reuse existing user ID (no duplicate user)");

        User updatedUser = userRepository.findById(compUser.getId()).orElseThrow();
        assertTrue(passwordEncoder.matches("NewCoursePass1!", updatedUser.getPassword()), "New password must match");
        assertFalse(passwordEncoder.matches("OldCompPass1!", updatedUser.getPassword()), "Old password must no longer work");
        assertNotNull(updatedUser.getAdminVisiblePassword());

        // Competition registration must still exist and have updated encrypted password
        CompetitionRegistration updatedReg = registrationRepository.findById(reg.getId()).orElseThrow();
        assertEquals(updatedUser.getAdminVisiblePassword(), updatedReg.getEncryptedPassword());

        // (d) No account -> normal creation as today
        String brandNewEmail = "zztest_brandnew_" + UUID.randomUUID() + "@example.com";
        UserDto newDto = new UserDto();
        newDto.setEmail(brandNewEmail);
        newDto.setName("Brand New Student");
        newDto.setPassword("BrandNewPass1!");
        newDto.setCourseBatches(List.of(Map.of(
                "course", testCourse.getTitle(),
                "courseId", testCourse.getId(),
                "batch", testBatch.getName(),
                "batchId", testBatch.getId()
        )));
        UserDto brandNewSaved = userService.saveStudent(newDto);
        assertNotNull(brandNewSaved.getId());
        assertTrue(userRepository.findById(brandNewSaved.getId()).isPresent());
    }

    @Test
    public void testB3_PublishedVsUnpublishedAssessmentsVisibilityAnd404() {
        // Create 1 published and 1 unpublished (DRAFT) test series
        CompetitionAssessment publishedAsmt = new CompetitionAssessment();
        publishedAsmt.setId("asmt_pub_" + UUID.randomUUID());
        publishedAsmt.setCompetitionId(testComp.getId());
        publishedAsmt.setType("TEST_SERIES");
        publishedAsmt.setSequenceNo(1);
        publishedAsmt.setTitle("Test 1");
        publishedAsmt.setStatus("PUBLISHED");
        publishedAsmt.setDurationMinutes(45);
        assessmentRepository.save(publishedAsmt);

        CompetitionAssessment draftAsmt = new CompetitionAssessment();
        draftAsmt.setId("asmt_draft_" + UUID.randomUUID());
        draftAsmt.setCompetitionId(testComp.getId());
        draftAsmt.setType("TEST_SERIES");
        draftAsmt.setSequenceNo(2);
        draftAsmt.setTitle("Test 2");
        draftAsmt.setStatus("DRAFT");
        draftAsmt.setDurationMinutes(45);
        assessmentRepository.save(draftAsmt);

        // Candidate user
        String candEmail = "zztest_candidate_" + UUID.randomUUID() + "@example.com";
        User candidate = User.builder()
                .id("usr_cand_" + UUID.randomUUID())
                .name("Comp Candidate")
                .email(candEmail)
                .role("STUDENT")
                .password(passwordEncoder.encode("CandPass123!"))
                .status("Active")
                .build();
        userRepository.save(candidate);

        CompetitionRegistration reg = new CompetitionRegistration();
        reg.setId("reg_" + UUID.randomUUID());
        reg.setCompetition(testComp);
        reg.setStudentId(candidate.getId());
        reg.setStudentEmail(candEmail);
        reg.setPaymentStatus("SUCCESS");
        registrationRepository.save(reg);

        // 1. getStudentTestSeries lists ONLY published tests for candidate
        Map<String, Object> tsResp = competitionService.getStudentTestSeries(testComp.getId(), candidate);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> list = (List<Map<String, Object>>) tsResp.get("testSeries");
        assertEquals(1, list.size(), "Only published tests must be returned");
        assertEquals(publishedAsmt.getId(), list.get(0).get("id"));

        // 2. Direct API calls to unpublished test by candidate return 404 (ResourceNotFoundException)
        assertThrows(ResourceNotFoundException.class, () -> competitionService.startOrResumeTestAttempt(draftAsmt.getId(), candidate));
        assertThrows(ResourceNotFoundException.class, () -> competitionService.saveAttemptAnswer(draftAsmt.getId(), Map.of(), candidate));
        assertThrows(ResourceNotFoundException.class, () -> competitionService.submitTestAttempt(draftAsmt.getId(), candidate));
        assertThrows(ResourceNotFoundException.class, () -> competitionService.getAttemptResults(draftAsmt.getId(), candidate));

        // 3. Admin can still view or attempt
        User admin = User.builder()
                .id("admin_test_" + UUID.randomUUID())
                .email("admin_test@zoro.com")
                .role("ADMIN")
                .build();
        userRepository.save(admin);
        Map<String, Object> adminTs = competitionService.getStudentTestSeries(testComp.getId(), admin);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> adminList = (List<Map<String, Object>>) adminTs.get("testSeries");
        assertEquals(2, adminList.size(), "Admin can view all tests including draft");
    }
}
