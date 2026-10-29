package com.zoroacademy.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;

public class RazorpayVerifyRequest {

    @NotBlank(message = "Order ID is required")
    @JsonAlias({"razorpay_order_id", "razorpayOrderId"})
    private String orderId;

    @NotBlank(message = "Payment ID is required")
    @JsonAlias({"razorpay_payment_id", "razorpayPaymentId"})
    private String paymentId;

    @NotBlank(message = "Signature is required")
    @JsonAlias({"razorpay_signature", "razorpaySignature"})
    private String signature;

    public RazorpayVerifyRequest() {}

    public RazorpayVerifyRequest(String orderId, String paymentId, String signature) {
        this.orderId = orderId;
        this.paymentId = paymentId;
        this.signature = signature;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public String getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(String paymentId) {
        this.paymentId = paymentId;
    }

    public String getSignature() {
        return signature;
    }

    public void setSignature(String signature) {
        this.signature = signature;
    }
}
