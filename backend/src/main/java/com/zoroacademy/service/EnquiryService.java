package com.zoroacademy.service;

import com.zoroacademy.entity.Enquiry;
import com.zoroacademy.repository.CourseRepository;
import com.zoroacademy.repository.EnquiryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class EnquiryService {

    private final EnquiryRepository enquiryRepository;
    private final CourseRepository courseRepository;
    private final EmailService emailService;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired
    public EnquiryService(EnquiryRepository enquiryRepository,
                          CourseRepository courseRepository,
                          @org.springframework.beans.factory.annotation.Autowired(required = false) EmailService emailService,
                          @org.springframework.beans.factory.annotation.Autowired(required = false) ActivityLogService activityLogService) {
        this.enquiryRepository = enquiryRepository;
        this.courseRepository = courseRepository;
        this.emailService = emailService;
        this.activityLogService = activityLogService;
    }

    public EnquiryService(EnquiryRepository enquiryRepository, CourseRepository courseRepository) {
        this(enquiryRepository, courseRepository, null, null);
    }


    @Transactional(readOnly = true)
    public List<Enquiry> getAllEnquiries() {
        return enquiryRepository.findAll();
    }

    @Transactional
    public Enquiry createEnquiry(Enquiry enquiry) {
        if (enquiry.getId() == null || enquiry.getId().isBlank()) {
            enquiry.setId("enq_" + java.util.UUID.randomUUID());
        }
        if (enquiry.getStatus() == null || enquiry.getStatus().isBlank()) {
            enquiry.setStatus("New");
        }
        if (enquiry.getPhone() != null && !enquiry.getPhone().isBlank()) {
            enquiry.setPhone(com.zoroacademy.util.PhoneValidator.sanitize(enquiry.getPhone()));
        }

        if (enquiry.getCourseId() != null && !enquiry.getCourseId().isBlank()) {
            if (enquiry.getCourseInterest() == null || enquiry.getCourseInterest().isBlank()) {
                courseRepository.findById(enquiry.getCourseId())
                        .ifPresent(course -> enquiry.setCourseInterest(course.getTitle()));
            }
        } else if (enquiry.getCourseInterest() != null && !enquiry.getCourseInterest().isBlank()) {
            courseRepository.findByTitleIgnoreCase(enquiry.getCourseInterest().trim())
                    .ifPresent(course -> enquiry.setCourseId(course.getId()));
        }

        Enquiry saved = enquiryRepository.save(enquiry);
        if (activityLogService != null) {
            activityLogService.logAction(
                null,
                saved.getName(),
                "ENQUIRIES",
                "CREATE_ENQUIRY",
                "New enquiry from " + saved.getName() + " (" + saved.getEmail() + ") for " + (saved.getCourseInterest() != null ? saved.getCourseInterest() : "course"),
                null
            );
        }
        if (emailService != null) {
            try {
                emailService.sendEnquiryAcknowledgement(saved);
            } catch (Exception ignored) {}
        }
        return saved;
    }

    @Transactional
    public Enquiry updateEnquiryStatus(String id, String status) {
        Enquiry enquiry = enquiryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Enquiry not found: " + id));

        enquiry.setStatus(status);
        Enquiry saved = enquiryRepository.save(enquiry);
        if (activityLogService != null) {
            activityLogService.logAction(
                null,
                null,
                "ENQUIRIES",
                "UPDATE_ENQUIRY_STATUS",
                "Updated enquiry status to " + status + " for " + saved.getName(),
                null
            );
        }
        return saved;
    }

    @Transactional
    public void deleteEnquiry(String id) {
        enquiryRepository.findById(id).ifPresent(enq -> {
            enquiryRepository.delete(enq);
            if (activityLogService != null) {
                activityLogService.logAction(
                    null,
                    null,
                    "ENQUIRIES",
                    "DELETE_ENQUIRY",
                    "Deleted enquiry from " + enq.getName() + " (" + enq.getId() + ")",
                    null
                );
            }
        });
    }
}
