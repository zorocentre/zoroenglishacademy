package com.zoroacademy.service;

import com.zoroacademy.entity.Expense;
import com.zoroacademy.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ActivityLogService activityLogService;

    @org.springframework.beans.factory.annotation.Autowired
    public ExpenseService(ExpenseRepository expenseRepository,
                          @org.springframework.beans.factory.annotation.Autowired(required = false) ActivityLogService activityLogService) {
        this.expenseRepository = expenseRepository;
        this.activityLogService = activityLogService;
    }

    public ExpenseService(ExpenseRepository expenseRepository) {
        this(expenseRepository, null);
    }

    @Transactional(readOnly = true)
    public List<Expense> getAllExpenses() {
        return expenseRepository.findAll();
    }

    @Transactional
    public Expense createExpense(Expense expense) {
        if (expense.getId() == null || expense.getId().isBlank()) {
            expense.setId("exp_" + java.util.UUID.randomUUID());
        }
        Expense saved = expenseRepository.save(expense);
        if (activityLogService != null) {
            activityLogService.logAction(
                null,
                null,
                "EXPENSES",
                "CREATE_EXPENSE",
                "Created expense: " + (saved.getCategory() != null ? saved.getCategory() : "Expense") + " (Rs. " + saved.getAmount() + ")",
                null
            );
        }
        return saved;
    }

    @Transactional
    public Expense updateExpense(String id, Expense updated) {
        Expense existing = expenseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found: " + id));
        if (updated.getCategory() != null) existing.setCategory(updated.getCategory());
        if (updated.getAmount() != null) existing.setAmount(updated.getAmount());
        if (updated.getDate() != null) existing.setDate(updated.getDate());
        if (updated.getDescription() != null) existing.setDescription(updated.getDescription());
        if (updated.getReceiptUrl() != null) existing.setReceiptUrl(updated.getReceiptUrl());
        Expense saved = expenseRepository.save(existing);
        if (activityLogService != null) {
            activityLogService.logAction(
                null,
                null,
                "EXPENSES",
                "UPDATE_EXPENSE",
                "Updated expense: " + (saved.getCategory() != null ? saved.getCategory() : saved.getId()) + " (Rs. " + saved.getAmount() + ")",
                null
            );
        }
        return saved;
    }

    @Transactional
    public void deleteExpense(String id) {
        expenseRepository.findById(id).ifPresent(exp -> {
            expenseRepository.delete(exp);
            if (activityLogService != null) {
                activityLogService.logAction(
                    null,
                    null,
                    "EXPENSES",
                    "DELETE_EXPENSE",
                    "Deleted expense: " + (exp.getCategory() != null ? exp.getCategory() : exp.getId()) + " (Rs. " + exp.getAmount() + ")",
                    null
                );
            }
        });
    }
}
