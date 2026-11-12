package com.zoroacademy.dto;

import java.util.List;

public class FeedbackMediaOrderRequest {
    private List<String> orderedIds;

    public FeedbackMediaOrderRequest() {}

    public FeedbackMediaOrderRequest(List<String> orderedIds) {
        this.orderedIds = orderedIds;
    }

    public List<String> getOrderedIds() {
        return orderedIds;
    }

    public void setOrderedIds(List<String> orderedIds) {
        this.orderedIds = orderedIds;
    }
}
