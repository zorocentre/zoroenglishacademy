package com.zoroacademy.service;

import com.zoroacademy.entity.FeePayment;
import com.zoroacademy.entity.StudentFee;
import com.zoroacademy.repository.FeePaymentRepository;
import com.zoroacademy.repository.StudentFeeRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.zoroacademy.exception.ConflictException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class FeeService {

    @Value("${razorpay.key-secret:}")
    private String razorpayKeySecret;

    private final StudentFeeRepository feeRepository;
    private final FeePaymentRepository paymentRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;
    private final com.zoroacademy.repository.CourseRepository courseRepository;
    private final com.zoroacademy.repository.BatchRepository batchRepository;
    private final NotificationService notificationService;
    private final ActivityLogService activityLogService;

    public FeeService(StudentFeeRepository feeRepository,
                      FeePaymentRepository paymentRepository,
                      com.zoroacademy.repository.UserRepository userRepository,
                      com.zoroacademy.repository.CourseRepository courseRepository,
                      com.zoroacademy.repository.BatchRepository batchRepository,
                      NotificationService notificationService,
                      ActivityLogService activityLogService) {
        this.feeRepository = feeRepository;
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.courseRepository = courseRepository;
        this.batchRepository = batchRepository;
        this.notificationService = notificationService;
        this.activityLogService = activityLogService;
    }

    @Transactional(readOnly = true)
    public List<StudentFee> getAllFeeRecords() {
        return feeRepository.findAll();
    }

    @Transactional(readOnly = true)
    public StudentFee getFeeById(String id) {
        return feeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fee record not found: " + id));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getFeeStats() {
        List<StudentFee> all = feeRepository.findAll();
        BigDecimal totalCollections = all.stream()
                .map(StudentFee::getPaidAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal pendingDues = all.stream()
                .map(StudentFee::getDueAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long paidCount = all.stream().filter(f -> "Paid".equalsIgnoreCase(f.getStatus())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalCollections", totalCollections);
        stats.put("pendingDues", pendingDues);
        stats.put("paidCount", paidCount);
        stats.put("totalRecords", all.size());
        return stats;
    }

    @Transactional
    public StudentFee createFeeRecord(StudentFee fee) {
        if (fee.getId() == null || fee.getId().isBlank()) {
            fee.setId("fee_" + java.util.UUID.randomUUID());
        }

        // Relational student resolution
        if (fee.getStudentId() != null && fee.getStudentId().contains("@")) {
            userRepository.findByEmailIgnoreCase(fee.getStudentId()).ifPresent(u -> {
                fee.setStudentId(u.getId());
                if (fee.getStudentName() == null) fee.setStudentName(u.getName());
            });
        } else if (fee.getStudentId() != null && !fee.getStudentId().isBlank()) {
            userRepository.findById(fee.getStudentId()).ifPresent(u -> {
                if (fee.getStudentName() == null) fee.setStudentName(u.getName());
            });
        } else if (fee.getStudentName() != null && !fee.getStudentName().isBlank()) {
            userRepository.findByNameIgnoreCase(fee.getStudentName()).stream().findFirst().ifPresent(u -> {
                fee.setStudentId(u.getId());
                fee.setStudentName(u.getName());
            });
        }

        // Relational course resolution
        if (fee.getCourseId() != null && !fee.getCourseId().isBlank()) {
            courseRepository.findById(fee.getCourseId()).ifPresent(c -> fee.setCourse(c.getTitle()));
        } else if (fee.getCourse() != null && !fee.getCourse().isBlank()) {
            courseRepository.findByTitleIgnoreCase(fee.getCourse()).ifPresent(c -> fee.setCourseId(c.getId()));
        }

        // Relational batch resolution
        if (fee.getBatchId() != null && !fee.getBatchId().isBlank()) {
            batchRepository.findById(fee.getBatchId()).ifPresent(b -> fee.setBatch(b.getName()));
        } else if (fee.getBatch() != null && !fee.getBatch().isBlank()) {
            batchRepository.findByNameIgnoreCaseAndCourseId(fee.getBatch(), fee.getCourseId())
                    .or(() -> batchRepository.findByNameIgnoreCaseAndCourseNameIgnoreCase(fee.getBatch(), fee.getCourse()))
                    .ifPresent(b -> fee.setBatchId(b.getId()));
        }

        if (fee.getDate() == null || fee.getDate().isBlank()) {
            fee.setDate(LocalDate.now().toString());
        }
        if (fee.getDueAmount() == null) {
            BigDecimal total = fee.getTotalFee() != null ? fee.getTotalFee() : BigDecimal.ZERO;
            BigDecimal paid = fee.getPaidAmount() != null ? fee.getPaidAmount() : BigDecimal.ZERO;
            fee.setDueAmount(total.subtract(paid).max(BigDecimal.ZERO));
        }
        if (fee.getDueAmount().compareTo(BigDecimal.ZERO) == 0) {
            fee.setStatus("Paid");
        } else {
            fee.setStatus("Pending");
        }
        StudentFee saved = feeRepository.save(fee);
        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getStudentId(),
                saved.getStudentName(),
                "FEES",
                "CREATE_FEE_RECORD",
                "Created fee record for student " + saved.getStudentName() + " (Total: ₹" + saved.getTotalFee() + ")",
                null
            );
        }
        return saved;
    }

    @Transactional
    public StudentFee recordPayment(String feeIdOrStudentId, BigDecimal amount, String method, String ref, String notes) {
        return recordPayment(feeIdOrStudentId, amount, method, ref, notes, null, null);
    }

    @Transactional
    public StudentFee recordPayment(String feeIdOrStudentId, BigDecimal amount, String method, String ref, String notes, String orderId, String signature) {
        if ("RAZORPAY".equalsIgnoreCase(method) && signature != null && !signature.isBlank()) {
            verifyRazorpaySignature(orderId, ref, signature);
        }

        StudentFee fee = feeRepository.findById(feeIdOrStudentId)
                .or(() -> feeRepository.findByStudentId(feeIdOrStudentId).stream().findFirst())
                .orElseThrow(() -> new IllegalArgumentException("Fee record not found: " + feeIdOrStudentId));

        BigDecimal currentPaid = fee.getPaidAmount() != null ? fee.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal newPaid = currentPaid.add(amount);
        BigDecimal total = fee.getTotalFee() != null ? fee.getTotalFee() : BigDecimal.ZERO;
        BigDecimal newDue = total.subtract(newPaid).max(BigDecimal.ZERO);

        fee.setPaidAmount(newPaid);
        fee.setDueAmount(newDue);
        fee.setStatus(newDue.compareTo(BigDecimal.ZERO) == 0 ? "Paid" : "Pending");
        fee = feeRepository.save(fee);

        FeePayment payment = FeePayment.builder()
                .id("pay_" + java.util.UUID.randomUUID())
                .fee(fee)
                .amount(amount)
                .paymentMethod(method != null ? method : "Online")
                .transactionRef(ref)
                .paymentDate(LocalDate.now().toString())
                .notes(notes)
                .build();
        paymentRepository.save(payment);

        notificationService.createNotification(com.zoroacademy.entity.Notification.builder()
                .id("notif_" + java.util.UUID.randomUUID())
                .recipientId(fee.getStudentId())
                .recipientRole("STUDENT")
                .title("Fee Payment Received")
                .message("Payment of ₹" + amount + " for course " + fee.getCourse() + " was received successfully.")
                .readStatus(false)
                .build());

        activityLogService.logAction(fee.getStudentId(), fee.getStudentName(), "FEE_PAID",
                "Paid fee amount ₹" + amount + " for " + fee.getCourse() + (ref != null ? " (Ref: " + ref + ")" : ""), "System");

        return fee;
    }

    private void verifyRazorpaySignature(String orderId, String paymentId, String signature) {
        if (razorpayKeySecret == null || razorpayKeySecret.isBlank()) {
            return;
        }
        try {
            String data = (orderId != null ? orderId : "") + "|" + (paymentId != null ? paymentId : "");
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            javax.crypto.spec.SecretKeySpec secretKey = new javax.crypto.spec.SecretKeySpec(
                    razorpayKeySecret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(data.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            String expected = hexString.toString();
            if (!java.security.MessageDigest.isEqual(expected.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                    signature.trim().getBytes(java.nio.charset.StandardCharsets.UTF_8))) {
                throw new ConflictException("Invalid Razorpay payment signature");
            }
        } catch (ConflictException ce) {
            throw ce;
        } catch (Exception e) {
            throw new RuntimeException("Error verifying Razorpay signature: " + e.getMessage(), e);
        }
    }

    @Transactional
    public StudentFee updateFeeRecord(String id, StudentFee updated) {
        StudentFee fee = feeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fee record not found: " + id));

        BigDecimal currentPaid = fee.getPaidAmount() != null ? fee.getPaidAmount() : BigDecimal.ZERO;

        if (updated.getTotalFee() != null) {
            if (updated.getTotalFee().compareTo(currentPaid) < 0) {
                throw new ConflictException(
                        "Cannot lower total fee (" + updated.getTotalFee() + ") below already paid amount (" + currentPaid + ")");
            }
            fee.setTotalFee(updated.getTotalFee());
            BigDecimal due = updated.getTotalFee().subtract(currentPaid).max(BigDecimal.ZERO);
            fee.setDueAmount(due);
            fee.setStatus(due.compareTo(BigDecimal.ZERO) == 0 ? "Paid" : "Pending");
        }

        if (updated.getCourse() != null) fee.setCourse(updated.getCourse());
        if (updated.getCourseId() != null) fee.setCourseId(updated.getCourseId());
        if (updated.getBatch() != null) fee.setBatch(updated.getBatch());
        if (updated.getBatchId() != null) fee.setBatchId(updated.getBatchId());

        StudentFee saved = feeRepository.save(fee);
        if (activityLogService != null) {
            activityLogService.logAction(
                saved.getStudentId(),
                saved.getStudentName(),
                "FEES",
                "UPDATE_FEE_RECORD",
                "Updated fee record for student " + saved.getStudentName() + " (" + saved.getId() + ")",
                null
            );
        }
        return saved;
    }

    @Transactional
    public void deleteFeeRecord(String id) {
        StudentFee fee = feeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Fee record not found: " + id));
        if ("Paid".equalsIgnoreCase(fee.getStatus())) {
            throw new ConflictException("Cannot delete fee record with status 'Paid'");
        }
        if (fee.getPaidAmount() != null && fee.getPaidAmount().compareTo(BigDecimal.ZERO) > 0) {
            throw new ConflictException("Cannot delete fee record with recorded payments");
        }
        feeRepository.delete(fee);
        if (activityLogService != null) {
            activityLogService.logAction(
                fee.getStudentId(),
                fee.getStudentName(),
                "FEES",
                "DELETE_FEE_RECORD",
                "Deleted fee record for student " + fee.getStudentName() + " (" + fee.getId() + ")",
                null
            );
        }
    }

    @Transactional
    public StudentFee deletePayment(String paymentId) {
        FeePayment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment record not found: " + paymentId));
        StudentFee fee = payment.getFee();
        if (fee != null) {
            fee.getPayments().remove(payment);
            paymentRepository.delete(payment);

            // Recalculate fee totals from remaining payments
            BigDecimal totalPaid = fee.getPayments().stream()
                    .map(FeePayment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalFee = fee.getTotalFee() != null ? fee.getTotalFee() : BigDecimal.ZERO;
            BigDecimal due = totalFee.subtract(totalPaid).max(BigDecimal.ZERO);

            fee.setPaidAmount(totalPaid);
            fee.setDueAmount(due);
            if (due.compareTo(BigDecimal.ZERO) == 0) {
                fee.setStatus("Paid");
            } else {
                fee.setStatus("Pending");
            }
            return feeRepository.save(fee);
        } else {
            paymentRepository.delete(payment);
            return null;
        }
    }
}
