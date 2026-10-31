package com.zoroacademy.service;

import com.zoroacademy.entity.CompetitionActivityLog;
import com.zoroacademy.repository.CompetitionActivityLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

@Service
public class CompetitionActivityLogService {

    private final CompetitionActivityLogRepository repository;

    public CompetitionActivityLogService(CompetitionActivityLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public CompetitionActivityLog logEvent(String competitionId, String competitionTitle, String eventType,
                                          String actorId, String actorName, String actorRole, String details) {
        CompetitionActivityLog log = CompetitionActivityLog.builder()
                .id("cal_" + UUID.randomUUID())
                .competitionId(competitionId)
                .competitionTitle(competitionTitle)
                .eventType(eventType)
                .actorId(actorId)
                .actorName(actorName)
                .actorRole(actorRole)
                .details(details)
                .createdAt(OffsetDateTime.now(ZoneId.of("Asia/Kolkata")))
                .build();
        return repository.save(log);
    }

    @Transactional(readOnly = true)
    public List<CompetitionActivityLog> getLogs(String fromDateStr, String toDateStr, String competitionId, String eventType) {
        ZoneId zone = ZoneId.of("Asia/Kolkata");
        OffsetDateTime fromTime = null;
        OffsetDateTime toTime = null;

        if (fromDateStr != null && !fromDateStr.isBlank()) {
            LocalDate fromDate = LocalDate.parse(fromDateStr);
            fromTime = fromDate.atStartOfDay(zone).toOffsetDateTime();
        }

        if (toDateStr != null && !toDateStr.isBlank()) {
            LocalDate toDate = LocalDate.parse(toDateStr);
            toTime = toDate.atTime(23, 59, 59, 999000000).atZone(zone).toOffsetDateTime();
        }

        String effectiveCompId = (competitionId != null && !competitionId.isBlank() && !"ALL".equalsIgnoreCase(competitionId)) ? competitionId : null;
        String effectiveEventType = (eventType != null && !eventType.isBlank() && !"ALL".equalsIgnoreCase(eventType)) ? eventType : null;

        return repository.filterLogs(effectiveCompId, effectiveEventType, fromTime, toTime);
    }
}
