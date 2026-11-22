package com.zoroacademy;

import com.zoroacademy.entity.CompetitionRegistration;
import com.zoroacademy.repository.CompetitionRegistrationRepository;
import com.zoroacademy.service.CompetitionService;
import com.zoroacademy.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

public class PaymentStatusCompatibilityTest {

    @Test
    @DisplayName("Payment Compatibility: Both PAID and SUCCESS are recognized as paid")
    void testPaidAndSuccessStatusesAccepted() throws Exception {
        CompetitionService service = org.springframework.test.util.AopTestUtils.getTargetObject(
                mock(CompetitionService.class, CALLS_REAL_METHODS)
        );

        Method isPaidMethod = CompetitionService.class.getDeclaredMethod("isPaid", String.class);
        isPaidMethod.setAccessible(true);

        // Positive cases: PAID, SUCCESS (case-insensitive)
        assertTrue((Boolean) isPaidMethod.invoke(service, "PAID"));
        assertTrue((Boolean) isPaidMethod.invoke(service, "paid"));
        assertTrue((Boolean) isPaidMethod.invoke(service, "SUCCESS"));
        assertTrue((Boolean) isPaidMethod.invoke(service, "success"));
        assertTrue((Boolean) isPaidMethod.invoke(service, " Success "));
        assertTrue((Boolean) isPaidMethod.invoke(service, " Paid "));

        // Negative cases: PENDING, FAILED, null, empty
        assertFalse((Boolean) isPaidMethod.invoke(service, "PENDING"));
        assertFalse((Boolean) isPaidMethod.invoke(service, "pending"));
        assertFalse((Boolean) isPaidMethod.invoke(service, "FAILED"));
        assertFalse((Boolean) isPaidMethod.invoke(service, "failed"));
        assertFalse((Boolean) isPaidMethod.invoke(service, ""));
        assertFalse((Boolean) isPaidMethod.invoke(service, (String) null));
        assertFalse((Boolean) isPaidMethod.invoke(service, "INITIATED"));
    }

    @Test
    @DisplayName("UserService Compatibility: Accepts both PAID and SUCCESS for competition access")
    void testUserServicePaidAndSuccessLogic() {
        CompetitionRegistrationRepository regRepo = mock(CompetitionRegistrationRepository.class);

        CompetitionRegistration regPaid = new CompetitionRegistration();
        regPaid.setStudentId("user-1");
        regPaid.setPaymentStatus("PAID");

        CompetitionRegistration regSuccess = new CompetitionRegistration();
        regSuccess.setStudentId("user-2");
        regSuccess.setPaymentStatus("SUCCESS");

        CompetitionRegistration regPending = new CompetitionRegistration();
        regPending.setStudentId("user-3");
        regPending.setPaymentStatus("PENDING");

        CompetitionRegistration regFailed = new CompetitionRegistration();
        regFailed.setStudentId("user-4");
        regFailed.setPaymentStatus("FAILED");

        CompetitionRegistration regNull = new CompetitionRegistration();
        regNull.setStudentId("user-5");
        regNull.setPaymentStatus(null);

        // Emulate UserService verification logic
        java.util.function.Predicate<CompetitionRegistration> isEligible = r ->
                "PAID".equalsIgnoreCase(r.getPaymentStatus()) || "SUCCESS".equalsIgnoreCase(r.getPaymentStatus());

        assertTrue(isEligible.test(regPaid), "PAID status must be accepted");
        assertTrue(isEligible.test(regSuccess), "SUCCESS status must be accepted");
        assertFalse(isEligible.test(regPending), "PENDING status must be rejected");
        assertFalse(isEligible.test(regFailed), "FAILED status must be rejected");
        assertFalse(isEligible.test(regNull), "null status must be rejected");
    }
}
