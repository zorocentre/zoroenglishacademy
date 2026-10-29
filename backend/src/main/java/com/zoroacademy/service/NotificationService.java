package com.zoroacademy.service;

import com.zoroacademy.entity.Notification;
import com.zoroacademy.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final com.zoroacademy.repository.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public NotificationService(
            NotificationRepository notificationRepository,
            @org.springframework.beans.factory.annotation.Autowired(required = false) com.zoroacademy.repository.UserRepository userRepository
    ) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    public NotificationService(NotificationRepository notificationRepository) {
        this(notificationRepository, null);
    }

    @Transactional(readOnly = true)
    public List<Notification> getNotificationsForRoleOrUser(String role, String userId) {
        String effectiveRole = role != null && !role.isBlank() ? role.toUpperCase() : "ALL";
        List<Notification> allRoleNotifs = notificationRepository.findByRecipientRoleIgnoreCaseOrRecipientRoleIgnoreCase("ALL", effectiveRole);
        // Only broadcast notifications (without a specific recipientId) apply to the whole role
        List<Notification> broadcastRoleNotifs = allRoleNotifs.stream()
                .filter(n -> n.getRecipientId() == null || n.getRecipientId().isBlank())
                .toList();

        java.util.List<Notification> userNotifs = new java.util.ArrayList<>();
        if (userId != null && !userId.isBlank()) {
            userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(userId));
            if (userRepository != null) {
                userRepository.findById(userId)
                        .or(() -> userRepository.findByEmailIgnoreCase(userId))
                        .or(() -> userRepository.findByUsernameIgnoreCase(userId))
                        .or(() -> userRepository.findByNameIgnoreCase(userId).stream().findFirst())
                        .ifPresent(u -> {
                            if (u.getId() != null) userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(u.getId()));
                            if (u.getEmail() != null) userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(u.getEmail()));
                            if (u.getUsername() != null) userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(u.getUsername()));
                            if (u.getName() != null) userNotifs.addAll(notificationRepository.findByRecipientIdIgnoreCase(u.getName()));
                        });
            }
        }

        java.util.Set<String> seenIds = new java.util.HashSet<>();
        java.util.List<Notification> merged = new java.util.ArrayList<>();
        for (Notification n : userNotifs) {
            if (seenIds.add(n.getId())) merged.add(n);
        }
        for (Notification n : broadcastRoleNotifs) {
            if (seenIds.add(n.getId())) merged.add(n);
        }
        merged.sort((a, b) -> {
            if (a.getCreatedAt() == null || b.getCreatedAt() == null) return 0;
            return b.getCreatedAt().compareTo(a.getCreatedAt());
        });
        return merged;
    }

    @Transactional
    public Notification createNotification(Notification notification) {
        if (notification.getId() == null || notification.getId().isBlank()) {
            notification.setId("notif_" + java.util.UUID.randomUUID());
        }
        return notificationRepository.save(notification);
    }

    @Transactional
    public Notification createNotification(String recipientId, String title, String message, String role) {
        Notification n = Notification.builder()
                .id("notif_" + java.util.UUID.randomUUID())
                .recipientId(recipientId)
                .recipientRole(role != null ? role : "ALL")
                .title(title)
                .message(message)
                .readStatus(false)
                .build();
        return notificationRepository.save(n);
    }

    @Transactional
    public Notification createNotification(String recipientId, String title, String message, String role, String link) {
        return createNotification(recipientId, title, message, role);
    }

    @Transactional
    public void markAsRead(String id) {
        notificationRepository.findById(id).ifPresent(n -> {
            n.setReadStatus(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void deleteNotification(String id) {
        notificationRepository.deleteById(id);
    }
}
